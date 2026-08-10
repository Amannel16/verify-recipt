import type { Request, Response } from "express";
import { db } from "../../config/db.js";
import { logger } from "../../utils/logger/logger.js";
import { EvidenceInput, V2VerificationResult, VerificationStageTimeline, NormalizedTransaction } from "./types.js";
import { classifyEvidence } from "./evidence-classifier.js";
import { detectProviderFingerprint } from "./fingerprint-engine.js";
import { providerRegistry } from "./provider-registry.js";
import { parseSmsText } from "./sms-parser.js";
import { parseUssdText } from "./ussd-parser.js";
import { validateDomain } from "./domain-validator.js";
import { analyzeFraudSignals } from "./fraud-intelligence.js";
import { calculateRiskScore, mapToV2Verdict } from "./risk-scorer.js";
import { analyzeReceiptImage } from "./ai-engine.js";
import { decodeQrCode } from "../../utils/helper/qr-decoder.js";
import { preprocessReceiptImage } from "../../utils/helper/image-preprocessor.js";
import { generateReceiptHash } from "./duplicate-detector.js";
import { crossValidate } from "./cross-validator.js";
import { addVerificationJobToQueue } from "./queue.js";

export async function processV2Verification(
  userId: string,
  input: EvidenceInput,
  quickMode: boolean = false,
): Promise<V2VerificationResult> {
  const startTime = Date.now();
  const timeline: VerificationStageTimeline[] = [];

  const recordStage = (stage: string, status: "SUCCESS" | "WARNING" | "FAILED" | "SKIPPED", duration: number, detail?: string) => {
    timeline.push({ stage, timestamp: new Date().toISOString(), durationMs: duration, status, detail });
  };

  // 1. Classification
  const t0 = Date.now();
  const evidenceType = classifyEvidence(input);
  recordStage("CLASSIFICATION", "SUCCESS", Date.now() - t0, `Evidence classified as ${evidenceType}`);

  let normalizedTx: NormalizedTransaction = {
    sourceType: evidenceType,
    extractionConfidence: 0.5,
  };

  let rawText = input.text || "";
  let receiptUrl = input.url || null;
  let receiptHash: string | undefined = undefined;

  // 2. Preprocessing & Extraction (if file uploaded)
  if (input.filePath) {
    const tPrep = Date.now();
    try {
      const preprocessed = await preprocessReceiptImage(input.filePath);
      recordStage("PREPROCESSING", "SUCCESS", Date.now() - tPrep);

      const tAi = Date.now();
      const [aiResult, qrUrl] = await Promise.all([
        analyzeReceiptImage(input.filePath, preprocessed),
        decodeQrCode(preprocessed.original),
      ]);
      recordStage("AI_EXTRACTION", "SUCCESS", Date.now() - tAi, `Extracted txId: ${aiResult.transactionId || "N/A"}`);

      rawText = aiResult.rawExtractedText || rawText;
      receiptUrl = qrUrl || aiResult.receiptUrl || receiptUrl;

      const cbeReceiptToken = receiptUrl?.includes("/v2-") ? `v2-${receiptUrl.split("/v2-").pop()}` : undefined;
      const extractedReceiptId = aiResult.receiptId || cbeReceiptToken || (aiResult.transactionId?.startsWith("v2-") ? aiResult.transactionId : undefined);
      const extractedTxId = aiResult.transactionId?.startsWith("v2-") ? undefined : aiResult.transactionId || undefined;

      normalizedTx = {
        provider: aiResult.paymentMethod ? aiResult.paymentMethod.toLowerCase() : undefined,
        receiptId: extractedReceiptId,
        transactionId: extractedTxId,
        sender: { name: aiResult.senderName || undefined, account: aiResult.senderAccount || undefined },
        receiver: { name: aiResult.receiverName || undefined, account: aiResult.receiverAccount || undefined },
        amount: aiResult.amount || undefined,
        currency: aiResult.currency || "ETB",
        date: aiResult.date || undefined,
        time: aiResult.time || undefined,
        receiptUrl: receiptUrl || undefined,
        sourceType: evidenceType,
        extractionConfidence: aiResult.confidence / 100,
      };

      receiptHash = generateReceiptHash(
        normalizedTx.provider || null,
        normalizedTx.amount || null,
        normalizedTx.sender?.name || null,
        normalizedTx.receiver?.name || null,
        normalizedTx.date || null
      ) || undefined;
    } catch (err: any) {
      recordStage("PREPROCESSING", "WARNING", Date.now() - tPrep, err.message);
    }
  }

  // 3. SMS & USSD Parsers
  if (evidenceType === "SMS_TEXT" && input.text) {
    const parsedSms = parseSmsText(input.text);
    if (parsedSms) normalizedTx = { ...normalizedTx, ...parsedSms };
  } else if (evidenceType === "USSD_SCREENSHOT" && input.text) {
    const parsedUssd = parseUssdText(input.text);
    if (parsedUssd) normalizedTx = { ...normalizedTx, ...parsedUssd };
  }

  let domainValidationResult: any = null;
  let officialResult: any = null;

  // 4. Domain Validation & Fingerprint
  const tFp = Date.now();
  if (receiptUrl) {
    domainValidationResult = validateDomain(receiptUrl, normalizedTx.provider || null);
  }

  const fingerprint = await detectProviderFingerprint(input, rawText, receiptUrl || undefined);
  let detectedProviderId = domainValidationResult?.matchedProvider || fingerprint.topProvider || normalizedTx.provider || "cbe";
  
  // If transaction ID starts with "FT", force provider to CBE
  if (normalizedTx.transactionId?.toUpperCase().startsWith("FT")) {
    detectedProviderId = "cbe";
  }

  normalizedTx.provider = detectedProviderId;
  recordStage("PROVIDER_DETECTION", "SUCCESS", Date.now() - tFp, `Provider: ${detectedProviderId}`);

  // 5. Official Portal Verification
  if (receiptUrl && domainValidationResult?.isTrusted && !quickMode) {
    const tOff = Date.now();
    const providerEntry = providerRegistry.getProvider(detectedProviderId);
    if (providerEntry?.adapter) {
      officialResult = await providerEntry.adapter.verifyOfficialTransaction(normalizedTx);
      recordStage("OFFICIAL_VERIFICATION", officialResult.verified ? "SUCCESS" : "WARNING", Date.now() - tOff);
    }
  }

  // 6. Cross-Validation & Merchant Expectation Matching
  let crossValResult = null;
  if (officialResult?.data) {
    crossValResult = crossValidate(
      {
        transactionId: normalizedTx.transactionId,
        amount: normalizedTx.amount,
        senderName: normalizedTx.sender?.name,
        receiverName: normalizedTx.receiver?.name,
        date: normalizedTx.date,
        confidence: Math.round(normalizedTx.extractionConfidence * 100),
      } as any,
      {
        isValid: true,
        providerId: detectedProviderId,
        transactionId: officialResult.data.transactionId,
        amount: officialResult.data.amount,
        senderName: officialResult.data.sender?.name,
        receiverName: officialResult.data.receiver?.name,
        date: officialResult.data.date,
      }
    );
  }

  // 7. Fraud Intelligence & Duplicate Check
  const tFraud = Date.now();
  const { fraudSignals, duplicateInfo } = await analyzeFraudSignals(userId, normalizedTx, receiptHash);
  recordStage("FRAUD_ANALYSIS", duplicateInfo.isDuplicate ? "FAILED" : "SUCCESS", Date.now() - tFraud);

  // 8. Risk Assessment & V2 Verdict
  const tRisk = Date.now();
  const riskAssessment = calculateRiskScore(
    Math.round(normalizedTx.extractionConfidence * 100),
    domainValidationResult,
    crossValResult,
    {
      isDuplicate: duplicateInfo.isDuplicate,
      duplicateOf: duplicateInfo.duplicateOfId || null,
      riskLevel: duplicateInfo.isDuplicate ? "HIGH" : "NONE",
      reasons: [duplicateInfo.details || ""],
      matchingRecords: [],
    },
    normalizedTx.date || null,
    normalizedTx.amount || null,
    !!receiptUrl
  );

  const verdict = mapToV2Verdict(
    riskAssessment.totalScore,
    duplicateInfo.isDuplicate,
    !!officialResult?.verified
  );
  recordStage("RISK_SCORING", "SUCCESS", Date.now() - tRisk, `Verdict: ${verdict} (Score: ${riskAssessment.totalScore})`);

  // 9. Save Verification Record to Database
  const verificationRecord = await db.verification.create({
    data: {
      userId,
      status: verdict === "VERIFIED" || verdict === "HIGH_CONFIDENCE" ? "APPROVED" : verdict === "SUSPICIOUS" ? "SUSPICIOUS" : "REJECTED",
      verdict,
      confidence: riskAssessment.totalScore,
      evidenceType,
      provider: detectedProviderId,
      transactionId: normalizedTx.transactionId,
      senderName: normalizedTx.sender?.name,
      receiverName: normalizedTx.receiver?.name,
      amount: normalizedTx.amount,
      currency: normalizedTx.currency || "ETB",
      date: normalizedTx.date,
      time: normalizedTx.time,
      imageUrl: input.filePath ? `/uploads/${input.filePath.split("/").pop()}` : undefined,
      receiptUrl: receiptUrl || undefined,
      normalizedTransaction: normalizedTx as any,
      fraudSignals: fraudSignals as any,
      timeline: timeline as any,
      domainValidation: domainValidationResult as any,
      riskAssessment: riskAssessment as any,
      isDuplicate: duplicateInfo.isDuplicate,
      receiptHash,
    } as any,
  });

  const totalDuration = Date.now() - startTime;
  logger.info(`✨ V2 Verification process complete for ${verificationRecord.id} in ${totalDuration}ms (Verdict: ${verdict})`);

  return {
    verificationId: verificationRecord.id,
    status: verdict,
    confidence: riskAssessment.totalScore,
    provider: detectedProviderId,
    transaction: normalizedTx,
    evidence: {
      ocr: { passed: true, confidence: Math.round(normalizedTx.extractionConfidence * 100), source: "AI/OCR" },
      official: officialResult ? { passed: officialResult.verified, confidence: officialResult.verified ? 100 : 0, source: "OFFICIAL_PORTAL" } : undefined,
    },
    riskChecks: riskAssessment.checks,
    fraudSignals,
    duplicateInfo,
    timeline,
    createdAt: new Date().toISOString(),
  };
}

export async function verifyV2Endpoint(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const file = req.file;
    const { text, url, transactionId, quickMode } = req.body;

    const input: EvidenceInput = {
      filePath: file?.path,
      mimeType: file?.mimetype,
      text,
      url,
      transactionId,
    };

    const isQuick = quickMode === "true" || quickMode === true;
    const queueResult = await addVerificationJobToQueue(userId, input, isQuick, processV2Verification);

    if (queueResult.status === "COMPLETED" && queueResult.result) {
      res.json({ success: true, message: "Verification completed", data: queueResult.result });
    } else {
      res.status(202).json({ success: true, message: "Verification enqueued", data: { jobId: queueResult.jobId } });
    }
  } catch (err: any) {
    logger.error(`❌ V2 Endpoint Error: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
}
