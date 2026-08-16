import type { Request, Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { db } from "@/src/config/db.js";
import { logger } from "@/src/utils/logger/logger.js";
import {
  analyzeReceiptImage,
  type ReceiptAnalysisResult,
} from "./ai-engine.js";
import {
  scrapeReceiptUrl,
  type ScrapedReceiptData,
} from "./receipt-scraper.js";
import { extractReceiptUrl, detectProviderFromName, buildTelebirrReceiptUrl, buildAwashReceiptUrl } from "./url-extractor.js";
import { detectBankFromText } from "./bank-rules.js";
import {
  crossValidate,
  type CrossValidationResult,
} from "./cross-validator.js";
import {
  checkForDuplicates,
  generateReceiptHash,
} from "./duplicate-detector.js";
import { decodeQrCode } from "../../utils/helper/qr-decoder.js";
import {
  preprocessReceiptImage,
  cleanupTempImages,
} from "../../utils/helper/image-preprocessor.js";
import {
  validateDomain,
  type DomainValidationResult,
} from "./domain-validator.js";
import { calculateRiskScore, type RiskAssessment } from "./risk-scorer.js";
import { realTimeServiceEmiter } from "@/src/socket/service.js";
import { generateRandomFileName } from "@/src/utils/helper/randomfileNameGenerator.js";
import { uploadFile, getUrl, deleteFile } from "@/src/utils/rustfsClient.js";
import { dispatchWebhooksForUser } from "./webhook-dispatcher.js";

// ─────────────────────────────────────────────────────────────
// MAIN: Verify Receipt
// ─────────────────────────────────────────────────────────────

/**
 * Full verification pipeline:
 * 1. Upload & validate image
 * 2. AI extraction (Gemini with fallback)
 * 3. URL detection & domain validation (SECURITY GATE)
 * 4. Scraping (only if domain is trusted)
 * 5. Cross-validation (AI vs scraped)
 * 6. Duplicate detection
 * 7. Risk scoring (centralized)
 * 8. Save to database
 */
export async function verifyReceipt(
  req: Request,
  res: Response,
): Promise<void> {
  const startTime = Date.now();
  let preprocessedImages: any = null;

  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    // Check usage limits
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    if (
      user.plan === "FREE" &&
      user.verificationsUsed >= user.verificationsLimit
    ) {
      res.status(403).json({
        success: false,
        message:
          "Verification limit reached. Upgrade to Pro for unlimited verifications.",
      });
      return;
    }

    // Step 1: Validate uploaded file
    const file = req.file;
    if (!file) {
      res.status(400).json({
        success: false,
        message:
          "No receipt image uploaded. Please upload a JPEG, PNG, or WebP image.",
      });
      return;
    }

    const imagePath = file.path;
    const key = generateRandomFileName();
    await uploadFile(key, imagePath);
    const imageUrl = key;

    logger.info(
      `📷 Receipt uploaded: ${file.filename} (${Math.round(file.size / 1024)}KB) -> ${key}`,
    );

    // Step 1.5: Image Preprocessing (Sharp)
    logger.info("🖼️ Step 1.5: Preprocessing uploaded image...");
    preprocessedImages = await preprocessReceiptImage(imagePath);

    // Step 2 & 3: Run AI extraction (OCR) and QR detection in parallel
    logger.info("🤖 Running AI extraction and QR code detection in parallel...");
    const [aiResult, qrUrlResult] = await Promise.all([
      analyzeReceiptImage(imagePath, preprocessedImages),
      decodeQrCode(preprocessedImages.original),
    ]);

    // Step 3: URL detection (QR Code & text extraction)
    logger.info("🔗 Step 3: Detecting receipt URL...");
    let scrapedData: ScrapedReceiptData | null = null;
    let crossValidation: CrossValidationResult | null = null;
    let domainValidation: DomainValidationResult | null = null;
    let receiptUrl = aiResult.receiptUrl || qrUrlResult || null;

    // If QR code was not found on original, try optimized thresholded variant
    if (!receiptUrl) {
      logger.info("📸 QR not found on original. Trying optimized thresholded variant...");
      const thresholdedQrUrl = await decodeQrCode(preprocessedImages.thresholded);
      if (thresholdedQrUrl) {
        receiptUrl = thresholdedQrUrl;
        logger.info(
          `📸 Decoded verification URL from receipt QR Code (Thresholded): ${receiptUrl}`,
        );
      }
    } else if (qrUrlResult) {
      logger.info(
        `📸 Decoded verification URL from receipt QR Code (Original): ${receiptUrl}`,
      );
    }

    // Try to extract URL from AI's extracted text if not directly found
    if (!receiptUrl && aiResult.rawExtractedText) {
      const urlResult = extractReceiptUrl(aiResult.rawExtractedText);
      if (urlResult) {
        receiptUrl = urlResult.url;
      }
    }

    // Also check request body for manually provided URL
    if (!receiptUrl && req.body.receiptUrl) {
      receiptUrl = req.body.receiptUrl;
    }

    // Telebirr receipt screenshots do NOT display full verification URLs directly on screen.
    // If detected bank is Telebirr and transactionId is available, auto-construct the official portal URL:
    // https://transactioninfo.ethiotelecom.et/receipt/<ID>
    const detectedProvider =
      detectProviderFromName(aiResult.paymentMethod || "") ||
      detectBankFromText(aiResult.rawExtractedText || "");

    if (!receiptUrl && detectedProvider === "telebirr" && aiResult.transactionId) {
      receiptUrl = buildTelebirrReceiptUrl(aiResult.transactionId);
      logger.info(
        `📱 Telebirr receipt screenshot detected — auto-constructed verification URL: ${receiptUrl}`,
      );
    } else if (!receiptUrl && detectedProvider === "awash" && aiResult.transactionId) {
      receiptUrl = buildAwashReceiptUrl(aiResult.transactionId);
      logger.info(
        `📱 Awash receipt screenshot detected — auto-constructed verification URL: ${receiptUrl}`,
      );
    }

    // ── Step 3.5: DOMAIN VALIDATION (Security Gate) ──
    const urlWasFound = !!receiptUrl;

    if (receiptUrl) {
      logger.info(`🔒 Step 3.5: Validating domain for URL: ${receiptUrl}`);

      // Detect the bank provider from AI extraction
      const detectedBank =
        detectProviderFromName(aiResult.paymentMethod || "") || null;
      domainValidation = validateDomain(receiptUrl, detectedBank);

      if (domainValidation.isTrusted && !domainValidation.hasBankMismatch) {
        // ✅ Domain is trusted and matches the detected bank — safe to scrape
        logger.info(`✅ Domain trusted. Proceeding to scrape: ${receiptUrl}`);

        try {
          const provider =
            domainValidation.matchedProvider || detectedBank || "unknown";
          const receiptId = aiResult.transactionId || "";

          scrapedData = await scrapeReceiptUrl(receiptUrl, provider, receiptId);

          if (scrapedData && scrapedData.isValid) {
            // Step 4: Cross-validate AI extraction vs scraped data
            logger.info("🔄 Step 4: Running cross-validation...");
            const isMessageReceipt = /sms|ussd|paid|received|debited|credited|telebirr|cbe birr|m-pesa/i.test(aiResult.rawExtractedText || "");
            crossValidation = crossValidate(aiResult, scrapedData, isMessageReceipt);

            // Populate missing/unknown sender details from official verified portal URL
            const isUnknownSender =
              !aiResult.senderName ||
              /unknown|telebirr user|n\/a|^$/i.test(aiResult.senderName.trim());
            if (isUnknownSender && scrapedData.senderName) {
              logger.info(
                `💡 Populating missing sender from official URL portal: ${scrapedData.senderName}`,
              );
              aiResult.senderName = scrapedData.senderName;
              if (scrapedData.senderAccount && !aiResult.senderAccount) {
                aiResult.senderAccount = scrapedData.senderAccount;
              }
            }

            // Populate missing/unknown receiver details from official verified portal URL
            const isUnknownReceiver =
              !aiResult.receiverName ||
              /unknown|n\/a|^$/i.test(aiResult.receiverName.trim());
            if (isUnknownReceiver && scrapedData.receiverName) {
              logger.info(
                `💡 Populating missing receiver from official URL portal: ${scrapedData.receiverName}`,
              );
              aiResult.receiverName = scrapedData.receiverName;
              if (scrapedData.receiverAccount && !aiResult.receiverAccount) {
                aiResult.receiverAccount = scrapedData.receiverAccount;
              }
            }
          } else {
            logger.warn(
              "⚠️ URL scraping returned invalid data — skipping cross-validation",
            );
          }
        } catch (error) {
          logger.error("URL scraping failed:", error);
        }
      } else if (
        domainValidation.isTrusted &&
        domainValidation.hasBankMismatch
      ) {
        // ⚠️ Domain is trusted but belongs to a different bank — scrape with caution
        logger.warn(
          `⚠️ Domain is trusted but bank mismatch detected. OCR: "${detectedBank}", URL: "${domainValidation.matchedProvider}". Scraping with caution.`,
        );

        try {
          const provider = domainValidation.matchedProvider || "unknown";
          const receiptId = aiResult.transactionId || "";

          scrapedData = await scrapeReceiptUrl(receiptUrl, provider, receiptId);

          if (scrapedData && scrapedData.isValid) {
            logger.info(
              "🔄 Step 4: Running cross-validation (bank mismatch context)...",
            );
            const isMessageReceipt = /sms|ussd|paid|received|debited|credited|telebirr|cbe birr|m-pesa/i.test(aiResult.rawExtractedText || "");
            crossValidation = crossValidate(aiResult, scrapedData, isMessageReceipt);

            // Populate missing sender/receiver if available
            const isUnknownSender =
              !aiResult.senderName ||
              /unknown|telebirr user|n\/a|^$/i.test(aiResult.senderName.trim());
            if (isUnknownSender && scrapedData.senderName) {
              aiResult.senderName = scrapedData.senderName;
              if (scrapedData.senderAccount && !aiResult.senderAccount) {
                aiResult.senderAccount = scrapedData.senderAccount;
              }
            }
            const isUnknownReceiver =
              !aiResult.receiverName ||
              /unknown|n\/a|^$/i.test(aiResult.receiverName.trim());
            if (isUnknownReceiver && scrapedData.receiverName) {
              aiResult.receiverName = scrapedData.receiverName;
              if (scrapedData.receiverAccount && !aiResult.receiverAccount) {
                aiResult.receiverAccount = scrapedData.receiverAccount;
              }
            }
          }
        } catch (error) {
          logger.error("URL scraping failed (bank mismatch context):", error);
        }
      } else {
        // 🚫 Domain is NOT trusted — DO NOT scrape
        logger.warn(
          `🚫 SECURITY: Refusing to scrape untrusted domain "${domainValidation.hostname}". ` +
            `This URL will NOT be followed. Penalties applied.`,
        );
        // scrapedData and crossValidation remain null — the risk scorer will apply penalties
      }
    } else {
      logger.info("ℹ️ No receipt URL detected — skipping URL verification");
    }

    // Step 5: Duplicate detection (using composite receipt hashing)
    logger.info("🔍 Step 5: Checking for duplicates...");
    const duplicateCheck = await checkForDuplicates(
      aiResult.transactionId,
      aiResult.amount,
      aiResult.senderName,
      aiResult.receiverName,
      aiResult.date,
      aiResult.paymentMethod,
      userId,
    );

    // Step 6: Centralized Risk Scoring
    logger.info("📊 Step 6: Running centralized risk assessment...");
    const riskAssessment: RiskAssessment = calculateRiskScore(
      aiResult.confidence,
      domainValidation,
      crossValidation,
      duplicateCheck,
      aiResult.date,
      aiResult.amount,
      urlWasFound,
    );

    const finalConfidence = riskAssessment.totalScore;
    const finalStatus = riskAssessment.verdict;

    // Collect all warnings and reasons
    const allWarnings: string[] = [...aiResult.warnings];
    const allReasons: string[] = [...aiResult.reasons];

    // Add domain validation warnings
    if (domainValidation) {
      allWarnings.push(...domainValidation.warnings);
    }

    // Add duplicate warnings
    if (duplicateCheck.reasons.length > 0) {
      allWarnings.push(...duplicateCheck.reasons);
    }

    // Add cross-validation discrepancies
    if (crossValidation) {
      if (crossValidation.overallMatch === "MATCH") {
        allReasons.push(`✅ Cross-validation: ${crossValidation.summary}`);
      } else if (crossValidation.discrepancies.length > 0) {
        allWarnings.push(...crossValidation.discrepancies);
      }
    }

    // Add risk assessment summary
    allReasons.push(riskAssessment.summary);

    // Generate unique receipt signature hash for database duplicate checking
    const receiptHash = generateReceiptHash(
      aiResult.paymentMethod,
      aiResult.amount,
      aiResult.senderName,
      aiResult.receiverName,
      aiResult.date,
    );

    // Step 7: Save to database
    logger.info("💾 Step 7: Saving verification result...");
    const verification = await db.verification.create({
      data: {
        userId,
        status: finalStatus,
        confidence: finalConfidence,
        transactionId: aiResult.transactionId,
        transferReference: aiResult.transferReference,
        senderName: aiResult.senderName,
        senderAccount: aiResult.senderAccount,
        receiverName: aiResult.receiverName,
        receiverAccount: aiResult.receiverAccount,
        amount: aiResult.amount,
        fees: aiResult.fees,
        totalAmount: aiResult.totalAmount,
        currency: aiResult.currency,
        date: aiResult.date,
        time: aiResult.time,
        paymentMethod: aiResult.paymentMethod,
        reasons: allReasons,
        warnings: allWarnings,
        imageUrl,
        receiptUrl,
        scrapedData: scrapedData
          ? JSON.parse(JSON.stringify(scrapedData))
          : undefined,
        crossValidation: crossValidation
          ? JSON.parse(JSON.stringify(crossValidation))
          : undefined,
        domainValidation: domainValidation
          ? JSON.parse(JSON.stringify(domainValidation))
          : undefined,
        riskAssessment: JSON.parse(JSON.stringify(riskAssessment)),
        isDuplicate: duplicateCheck.isDuplicate,
        duplicateOf: duplicateCheck.duplicateOf,
        receiptHash,
      },
    });

    // Increment user's verification count
    await db.user.update({
      where: { id: userId },
      data: { verificationsUsed: { increment: 1 } },
    });

    const elapsed = Date.now() - startTime;
    logger.info(
      `✅ Verification complete: ${finalStatus} (${finalConfidence}%) in ${elapsed}ms — ID: ${verification.id}`,
    );

    // Step 8: Create and emit notification
    try {
      let notifTitle = "Receipt Processed";
      let notifType = "INFO";
      let notifMsg = `Receipt for ${aiResult.amount || 0} ETB has been processed.`;

      if (finalStatus === "APPROVED") {
        notifTitle = "Receipt Approved";
        notifType = "SUCCESS";
        notifMsg = `Receipt from ${aiResult.senderName || "Unknown Sender"} of ${aiResult.amount || 0} ETB was successfully verified.`;
      } else if (finalStatus === "SUSPICIOUS") {
        notifTitle = "Suspicious Receipt Detected";
        notifType = "WARNING";
        notifMsg = `Receipt for ${aiResult.amount || 0} ETB has been flagged as suspicious: ${riskAssessment.summary}`;
      } else if (finalStatus === "REJECTED") {
        notifTitle = "Fraud Alert: Receipt Rejected";
        notifType = "ALERT";
        notifMsg = `Receipt of ${aiResult.amount || 0} ETB has been rejected: ${riskAssessment.summary}`;
      }

      const notification = await db.notification.create({
        data: {
          userId,
          title: notifTitle,
          message: notifMsg,
          type: notifType,
        },
      });

      // Emit real-time notification
      await realTimeServiceEmiter(userId, "notification", notification);
      logger.info(
        `🔔 Notification created and sent to user: ${userId} for receipt ${verification.id}`,
      );

      // Dispatch Webhooks for Enterprise plan users
      dispatchWebhooksForUser(userId, {
        event: finalStatus === "REJECTED" ? "fraud.alert" : finalStatus === "SUSPICIOUS" ? "verification.suspicious" : "verification.completed",
        timestamp: new Date().toISOString(),
        data: {
          verificationId: verification.id,
          status: finalStatus,
          confidence: finalConfidence,
          amount: aiResult.amount,
          currency: aiResult.currency || "ETB",
          transactionId: aiResult.transactionId,
          paymentMethod: aiResult.paymentMethod,
          senderName: aiResult.senderName,
          receiverName: aiResult.receiverName,
          isDuplicate: duplicateCheck.isDuplicate,
          reasons: allReasons,
          warnings: allWarnings,
        },
      }).catch((whErr) => logger.error("Webhook dispatch error:", whErr));
    } catch (notifErr) {
      logger.error("Failed to create or emit notification:", notifErr);
    }

    res.status(201).json({
      success: true,
      message: `Receipt verification complete: ${finalStatus}`,
      data: {
        id: verification.id,
        status: finalStatus,
        confidence: finalConfidence,
        transactionId: aiResult.transactionId,
        transferReference: aiResult.transferReference,
        senderName: aiResult.senderName,
        senderAccount: aiResult.senderAccount,
        receiverName: aiResult.receiverName,
        receiverAccount: aiResult.receiverAccount,
        amount: aiResult.amount,
        fees: aiResult.fees,
        totalAmount: aiResult.totalAmount,
        currency: aiResult.currency,
        date: aiResult.date,
        time: aiResult.time,
        paymentMethod: aiResult.paymentMethod,
        reasons: allReasons,
        warnings: allWarnings,
        imageUrl: imageUrl ? await getUrl(imageUrl) : undefined,
        receiptUrl,
        scrapedData: scrapedData
          ? {
              isValid: scrapedData.isValid,
              senderName: scrapedData.senderName,
              receiverName: scrapedData.receiverName,
              amount: scrapedData.amount,
              transactionId: scrapedData.transactionId,
              date: scrapedData.date,
              status: scrapedData.status,
            }
          : null,
        crossValidation: crossValidation
          ? {
              overallMatch: crossValidation.overallMatch,
              crossValidationScore: crossValidation.crossValidationScore,
              fieldMatches: crossValidation.fieldMatches,
              discrepancies: crossValidation.discrepancies,
              summary: crossValidation.summary,
            }
          : null,
        domainValidation: domainValidation
          ? {
              isTrusted: domainValidation.isTrusted,
              isHttps: domainValidation.isHttps,
              isShortened: domainValidation.isShortened,
              hasBankMismatch: domainValidation.hasBankMismatch,
              matchedProvider: domainValidation.matchedProvider,
              hostname: domainValidation.hostname,
              warnings: domainValidation.warnings,
            }
          : null,
        riskAssessment: {
          totalScore: riskAssessment.totalScore,
          verdict: riskAssessment.verdict,
          checks: riskAssessment.checks,
          summary: riskAssessment.summary,
        },
        isDuplicate: duplicateCheck.isDuplicate,
        duplicateRiskLevel: duplicateCheck.riskLevel,
        processingTimeMs: elapsed,
      },
    });
  } catch (error) {
    logger.error("Receipt verification pipeline failed:", error);
    res.status(500).json({
      success: false,
      message: "Verification failed. Please try again.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    // Clean up temporary image variants
    if (preprocessedImages?.tempPaths?.length > 0) {
      await cleanupTempImages(preprocessedImages.tempPaths);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Get Verification History
// ─────────────────────────────────────────────────────────────

export async function getHistory(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const plan = user?.plan ?? "FREE";
    const whereCondition: any = { userId };

    // Plan-based date window restriction
    if (plan !== "ENTERPRISE") {
      const days = plan === "PRO" ? 90 : 30;
      const dateCutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      whereCondition.createdAt = { gte: dateCutoff };
    }

    logger.info(
      `Fetching verification history for user ${userId} [Plan: ${plan}] (page ${page}, limit ${limit})`,
    );

    const [verifications, total] = await Promise.all([
      db.verification.findMany({
        where: whereCondition,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.verification.count({ where: whereCondition }),
    ]);

    for (const verification of verifications) {
      if (verification.imageUrl) {
        verification.imageUrl = await getUrl(verification.imageUrl);
      }
    }

    logger.info(
      `Returned ${verifications.length} verifications for user ${userId}`,
    );

    res.json({
      success: true,
      message: "Verification history retrieved.",
      data: {
        verifications,
        plan,
        historyLimitDays: plan === "FREE" ? 30 : plan === "PRO" ? 90 : "unlimited",
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error("Get history failed:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve history." });
  }
}

// ─────────────────────────────────────────────────────────────
// Export Verification History (Pro & Enterprise Feature)
// ─────────────────────────────────────────────────────────────

export async function exportHistory(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { plan: true, businessName: true, email: true },
    });

    if (user?.plan === "FREE") {
      res.status(403).json({
        success: false,
        message: "PDF & Excel monthly reports export is locked on the Free plan. Upgrade to Pro Merchant or Enterprise to export verification logs.",
      });
      return;
    }

    const verifications = await db.verification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    const format = (req.query.format as string)?.toLowerCase() || "csv";

    // Format as CSV
    const headers = [
      "ID",
      "Date",
      "Time",
      "Status",
      "Confidence (%)",
      "Amount (ETB)",
      "Payment Method",
      "Transaction ID",
      "Sender Name",
      "Receiver Name",
      "Is Duplicate",
    ];

    const rows = verifications.map((v) => [
      v.id,
      v.date || v.createdAt.toISOString().split("T")[0],
      v.time || v.createdAt.toISOString().split("T")[1]?.substring(0, 5) || "",
      v.status,
      v.confidence,
      v.amount ?? 0,
      `"${v.paymentMethod || ""}"`,
      `"${v.transactionId || ""}"`,
      `"${v.senderName || ""}"`,
      `"${v.receiverName || ""}"`,
      v.isDuplicate ? "YES" : "NO",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Geba_Verification_Report_${user?.businessName || "Merchant"}_${Date.now()}.${format === "excel" ? "xlsx" : "csv"}"`,
    );

    res.status(200).send(csvContent);
  } catch (error) {
    logger.error("Export history failed:", error);
    res.status(500).json({ success: false, message: "Failed to export report." });
  }
}

// ─────────────────────────────────────────────────────────────
// Get Single Verification by ID
// ─────────────────────────────────────────────────────────────

export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = req.params.id as string;
    logger.info(`Looking up verification ${id} for user ${userId}`);
    const verification = await db.verification.findFirst({
      where: { id, userId },
    });

    if (!verification) {
      logger.warn(`Verification ${id} not found for user ${userId}`);
      res
        .status(404)
        .json({ success: false, message: "Verification not found." });
      return;
    }

    if (verification.imageUrl) {
      verification.imageUrl = await getUrl(verification.imageUrl);
    }

    logger.info(`Verification ${id} retrieved for user ${userId}`);

    res.json({
      success: true,
      message: "Verification retrieved.",
      data: verification,
    });
  } catch (error) {
    logger.error("Get verification failed:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve verification." });
  }
}

// ─────────────────────────────────────────────────────────────
// Delete Verification
// ─────────────────────────────────────────────────────────────

export async function deleteVerification(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = req.params.id as string;
    logger.info(`Deleting verification ${id} for user ${userId}`);
    const verification = await db.verification.findFirst({
      where: { id, userId },
    });

    if (!verification) {
      logger.warn(
        `Delete failed: verification ${id} not found for user ${userId}`,
      );
      res
        .status(404)
        .json({ success: false, message: "Verification not found." });
      return;
    }

    // Delete uploaded image file
    if (verification.imageUrl) {
      try {
        await deleteFile(verification.imageUrl);
      } catch (err) {
        logger.error(`Failed to delete file from rustfs: ${verification.imageUrl}`, err);
      }
    }

    await db.verification.delete({ where: { id } });

    logger.info(`Verification ${id} deleted for user ${userId}`);

    res.json({
      success: true,
      message: "Verification deleted.",
    });
  } catch (error) {
    logger.error("Delete verification failed:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete verification." });
  }
}

// ─────────────────────────────────────────────────────────────
// Get Verification Stats
// ─────────────────────────────────────────────────────────────

export async function getStats(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    logger.info(`Fetching verification stats for user ${userId}`);

    const [total, approved, suspicious, rejected, duplicates] =
      await Promise.all([
        db.verification.count({ where: { userId } }),
        db.verification.count({ where: { userId, status: "APPROVED" } }),
        db.verification.count({ where: { userId, status: "SUSPICIOUS" } }),
        db.verification.count({ where: { userId, status: "REJECTED" } }),
        db.verification.count({ where: { userId, isDuplicate: true } }),
      ]);

    logger.info(
      `Verification stats retrieved for user ${userId}: total=${total}, approved=${approved}, suspicious=${suspicious}, rejected=${rejected}, duplicates=${duplicates}`,
    );

    res.json({
      success: true,
      message: "Stats retrieved.",
      data: {
        total,
        approved,
        suspicious,
        rejected,
        duplicates,
        fraudAttempts: rejected + suspicious,
      },
    });
  } catch (error) {
    logger.error("Get stats failed:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve stats." });
  }
}
