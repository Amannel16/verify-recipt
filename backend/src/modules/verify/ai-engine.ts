import fs from "node:fs";
import path from "node:path";
import { logger } from "@/src/utils/logger/logger.js";
import appConfig from "@/src/config/app_configs.js";
import { detectBankFromText, parseReceiptWithBankRules } from "./bank-rules.js";
import { preprocessReceiptImage, type PreprocessedImages } from "@/src/utils/helper/image-preprocessor.js";

export interface ReceiptAnalysisResult {
  status: "APPROVED" | "SUSPICIOUS" | "REJECTED";
  confidence: number;
  transactionId: string | null;
  senderName: string | null;
  receiverName: string | null;
  amount: number | null;
  currency: string;
  date: string | null;
  time: string | null;
  paymentMethod: string | null;
  reasons: string[];
  warnings: string[];
  rawExtractedText?: string;
  transferReference?: string | null;
  senderAccount?: string | null;
  receiverAccount?: string | null;
  fees?: number | null;
  totalAmount?: number | null;
  receiptUrl?: string | null;
  ocrConfidence?: number;
  usedVision?: boolean; // Flag to indicate whether Gemini Vision was used
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini Vision API integration (Tier 2 Fallback)
// ─────────────────────────────────────────────────────────────────────────────

async function analyzeWithGeminiVision(
  imagePath: string,
): Promise<{ result: ReceiptAnalysisResult | null; error?: string }> {
  const apiKey = appConfig.GEMINI_API_KEY;
  if (!apiKey) {
    logger.info("🤖 Gemini API key not configured — using rule-based engine");
    return { result: null, error: "Gemini API key is not configured in the backend .env" };
  }

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");
    const ext = path.extname(imagePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".heic": "image/heic",
    };
    const mimeType = mimeMap[ext] ?? "image/jpeg";

    const prompt = `You are a payment receipt verification AI specialized in Ethiopian wallets and bank transfer screenshots. Analyze this receipt image/screenshot and extract the payment information.

First, identify the receipt format:
- **telebirr**: Look for "telebirr" logo, Ethio Telecom branding, or transaction references typically starting with "TX" or long numeric strings.
- **CBE**: Look for "Commercial Bank of Ethiopia" or "CBE" logos/text. The transaction reference (Txn Ref / Ref No) usually starts with "FT".
- **CBE Birr**: Look for "CBE Birr" branding, yellow/green colors, or similar layout.
- **Bank of Abyssinia (BoA)**: Look for "Bank of Abyssinia", "BoA", or "Apollo" branding.
- **Dashen Bank**: Look for "Dashen Bank", "Dashen", or "Dashen Bank Super App" branding. Dashen receipts usually list both a Transaction Reference (e.g., "075IPSS...") and a Transfer Reference / IPSS Reference (e.g., "IPSS...").
- **M-Pesa**: Look for "M-Pesa" or "Safaricom" branding.

Analyze the image for signs of image tampering or fraud:
- Check if the transaction ID/references, amount, fees, total, sender/receiver names, or accounts font style, weight, or size matches the surrounding text.
- Look for mismatched colors, pixelation, or boxy artifacts around the transaction ID/references, amount/fees/total, or dates/names.
- Check if the text is perfectly aligned or if modified numbers look slightly skewed, rotated, or out of line.
- Validate whether standard elements for the identified bank or wallet are present.
- Cross-reference the top-bar time of the phone screen (if visible) with the transaction timestamp; the transaction time cannot be in the future relative to the phone's time.

RESPOND ONLY WITH A JSON OBJECT (no markdown, no code fences), using this exact structure:
{
  "transactionId": "extracted transaction/reference ID or null",
  "transferReference": "extracted transfer reference (e.g. IPSS reference for Dashen) or null",
  "senderName": "sender/payer name or null",
  "senderAccount": "sender account number or null",
  "receiverName": "receiver/payee/merchant name or null",
  "receiverAccount": "receiver account number or null",
  "amount": numeric base amount or null,
  "fees": numeric transfer/payment fees or null,
  "totalAmount": numeric total amount (amount + fees) or null,
  "currency": "currency code (ETB, USD, etc.) or ETB if unclear",
  "date": "transaction date as string or null",
  "time": "transaction time as string or null",
  "paymentMethod": "detected payment method ('telebirr', 'CBE', 'CBE Birr', 'Bank of Abyssinia', 'Dashen Bank', 'M-Pesa', or other bank name)",
  "isLikelyGenuine": true or false,
  "confidenceScore": 0-100 integer (reduce drastically if tampering is detected),
  "extractedText": "all readable text from the image",
  "analysisReasons": ["reason1", "reason2"],
  "warnings": ["warning1"] or [],
  "fraudIndicators": ["indicator1"] or [],
  "receiptUrl": "any verification URL visible on the receipt or null"
}`;

    let model = "gemini-2.0-flash";
    let attempts = 0;
    const maxAttempts = 3;
    let response: any = null;
    let errorText = "";

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const apiVersion = "v1beta";
        const generationConfig: Record<string, any> = {
          temperature: 0.1,
          max_output_tokens: 800,
          responseMimeType: "application/json",
        };

        response = await fetch(
          `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: prompt },
                    {
                      inline_data: {
                        mime_type: mimeType,
                        data: base64Image,
                      },
                    },
                  ],
                },
              ],
              generationConfig,
            }),
            signal: AbortSignal.timeout(18000), // 18 seconds timeout
          },
        );

        if (response.ok) {
          break;
        }

        errorText = await response.text();
        logger.warn(`Gemini Vision API attempt ${attempts} (model: ${model}) failed: ${errorText}`);

        if (response.status === 429) {
          if (model === "gemini-2.0-flash") {
            logger.info("Rate limited on gemini-2.0-flash. Switching to fallback model: gemini-2.0-flash-lite");
            model = "gemini-2.0-flash-lite";
            continue;
          }
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } else {
          if (response.status < 500) break;
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (err: any) {
        errorText = err.message || String(err);
        logger.error(`Gemini Vision API attempt ${attempts} threw exception: ${errorText}`);
        if (model === "gemini-2.0-flash") {
          model = "gemini-2.0-flash-lite";
          continue;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (!response || !response.ok) {
      return { result: null, error: `Gemini Vision failed after ${attempts} attempts. Last error: ${errorText}` };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      logger.error(`Gemini Vision returned empty response`);
      return { result: null, error: "Gemini Vision returned an empty response" };
    }

    let cleanText = text.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleanText);

    let status: "APPROVED" | "SUSPICIOUS" | "REJECTED";
    const confidence = parsed.confidenceScore ?? 50;
    const fraudIndicators = parsed.fraudIndicators ?? [];

    if (parsed.isLikelyGenuine && confidence >= 75 && fraudIndicators.length === 0) {
      status = "APPROVED";
    } else if (confidence >= 40 && fraudIndicators.length <= 2) {
      status = "SUSPICIOUS";
    } else {
      status = "REJECTED";
    }

    const reasons = parsed.analysisReasons ?? [];
    const warnings = [
      ...(parsed.warnings ?? []),
      ...fraudIndicators.map((f: string) => `⚠️ Fraud indicator: ${f}`),
    ];

    return {
      result: {
        status,
        confidence,
        transactionId: parsed.transactionId ?? null,
        senderName: parsed.senderName ?? null,
        receiverName: parsed.receiverName ?? null,
        amount: parsed.amount ?? null,
        currency: parsed.currency ?? "ETB",
        date: parsed.date ?? null,
        time: parsed.time ?? null,
        paymentMethod: parsed.paymentMethod ?? null,
        reasons,
        warnings,
        rawExtractedText: parsed.extractedText || "",
        transferReference: parsed.transferReference ?? null,
        senderAccount: parsed.senderAccount ?? null,
        receiverAccount: parsed.receiverAccount ?? null,
        fees: parsed.fees ?? null,
        totalAmount: parsed.totalAmount ?? null,
        receiptUrl: parsed.receiptUrl ?? null,
        usedVision: true,
      }
    };
  } catch (error) {
    logger.error("Gemini Vision analysis failed:", error);
    return { result: null, error: String(error) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini Text-Only API integration (Tier 1 Intelligent Routing)
// ─────────────────────────────────────────────────────────────────────────────

async function analyzeWithGeminiTextOnly(
  ocrText: string,
  detectedBank: string,
): Promise<{ result: ReceiptAnalysisResult | null; error?: string }> {
  const apiKey = appConfig.GEMINI_API_KEY;
  if (!apiKey) {
    return { result: null, error: "Gemini API key is not configured" };
  }

  try {
    const prompt = `You are a payment receipt validator AI. Analyze the following raw OCR text extracted from an Ethiopian payment receipt screenshot (Detected Provider: ${detectedBank}). 
Clean up errors, parse the fields, and determine if this is a genuine transaction.

OCR Text:
"""
${ocrText}
"""

RESPOND ONLY WITH A JSON OBJECT (no markdown, no code fences), using this exact structure:
{
  "transactionId": "extracted transaction/reference ID or null",
  "transferReference": "extracted transfer reference ID or null",
  "senderName": "sender/payer name or null",
  "senderAccount": "sender account number or null",
  "receiverName": "receiver/payee/merchant name or null",
  "receiverAccount": "receiver account number or null",
  "amount": numeric base amount or null,
  "fees": numeric transfer/payment fees or null,
  "totalAmount": numeric total amount or null,
  "currency": "currency code (ETB, USD, etc.) or ETB if unclear",
  "date": "transaction date as string or null",
  "time": "transaction time as string or null",
  "paymentMethod": "detected payment method ('telebirr', 'CBE', 'CBE Birr', 'Bank of Abyssinia', 'Dashen Bank', 'M-Pesa', or other bank name)",
  "isLikelyGenuine": true or false,
  "confidenceScore": 0-100 integer (reduce if the text looks heavily corrupted or contradictory),
  "analysisReasons": ["reason1", "reason2"],
  "warnings": ["warning1"] or [],
  "receiptUrl": "any verification URL visible in the OCR text or null"
}`;

    const model = "gemini-2.0-flash-lite";
    const apiVersion = "v1beta";
    const generationConfig = {
      temperature: 0.1,
      max_output_tokens: 800,
      responseMimeType: "application/json",
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig,
        }),
        signal: AbortSignal.timeout(12000), // 12 seconds timeout
      },
    );

    if (!response.ok) {
      const err = await response.text();
      return { result: null, error: `Gemini Lite failed with status ${response.status}: ${err}` };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return { result: null, error: "Empty response from Gemini Lite" };
    }

    let cleanText = text.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleanText);

    let status: "APPROVED" | "SUSPICIOUS" | "REJECTED";
    const confidence = parsed.confidenceScore ?? 50;

    if (parsed.isLikelyGenuine && confidence >= 75) {
      status = "APPROVED";
    } else if (confidence >= 45) {
      status = "SUSPICIOUS";
    } else {
      status = "REJECTED";
    }

    return {
      result: {
        status,
        confidence,
        transactionId: parsed.transactionId ?? null,
        senderName: parsed.senderName ?? null,
        receiverName: parsed.receiverName ?? null,
        amount: parsed.amount ?? null,
        currency: parsed.currency ?? "ETB",
        date: parsed.date ?? null,
        time: parsed.time ?? null,
        paymentMethod: parsed.paymentMethod ?? detectedBank,
        reasons: parsed.analysisReasons ?? [],
        warnings: parsed.warnings ?? [],
        rawExtractedText: ocrText,
        transferReference: parsed.transferReference ?? null,
        senderAccount: parsed.senderAccount ?? null,
        receiverAccount: parsed.receiverAccount ?? null,
        fees: parsed.fees ?? null,
        totalAmount: parsed.totalAmount ?? null,
        receiptUrl: parsed.receiptUrl ?? null,
        usedVision: false,
      }
    };
  } catch (error) {
    logger.error("Gemini Text-Only analysis failed:", error);
    return { result: null, error: String(error) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Pass OCR Strategy
// ─────────────────────────────────────────────────────────────────────────────

export async function performMultiPassOCR(
  images: PreprocessedImages
): Promise<{ text: string; confidence: number }> {
  try {
    logger.info("🔍 Running Multi-Pass OCR Strategy across preprocessed variants...");
    const Tesseract = (await import("tesseract.js")).default;

    // --- Pass 1: Original Image ---
    logger.info("  [Pass 1/4] Running OCR on Original...");
    const res1 = await Tesseract.recognize(images.original, "eng");
    const conf1 = res1.data.confidence;
    const text1 = res1.data.text;

    // High confidence short-circuit (saves server CPU and time)
    if (conf1 >= 90 && text1.trim().length > 50) {
      logger.info(`✨ Pass 1 (Original) has high OCR confidence: ${conf1}%. Skipping other passes.`);
      return { text: text1, confidence: conf1 };
    }

    // --- Pass 2: Grayscale Normalized ---
    logger.info("  [Pass 2/4] Running OCR on Grayscale Normalized...");
    const res2 = await Tesseract.recognize(images.grayscaleNormalized, "eng");
    const conf2 = res2.data.confidence;
    const text2 = res2.data.text;

    // --- Pass 3: Sharpened ---
    logger.info("  [Pass 3/4] Running OCR on Sharpened...");
    const res3 = await Tesseract.recognize(images.sharpened, "eng");
    const conf3 = res3.data.confidence;
    const text3 = res3.data.text;

    // --- Pass 4: Thresholded ---
    logger.info("  [Pass 4/4] Running OCR on Thresholded...");
    const res4 = await Tesseract.recognize(images.thresholded, "eng");
    const conf4 = res4.data.confidence;
    const text4 = res4.data.text;

    const passes = [
      { text: text1, confidence: conf1, name: "Original" },
      { text: text2, confidence: conf2, name: "Grayscale Normalized" },
      { text: text3, confidence: conf3, name: "Sharpened" },
      { text: text4, confidence: conf4, name: "Thresholded" }
    ];

    // Pick highest confidence pass
    passes.sort((a, b) => b.confidence - a.confidence);
    const best = passes[0];

    logger.info(`📈 Multi-Pass OCR completed. Best variant: "${best.name}" with confidence ${best.confidence}%`);
    return { text: best.text, confidence: best.confidence };
  } catch (error) {
    logger.error("❌ Multi-Pass OCR failed:", error);
    return { text: "", confidence: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule-based analysis engine (always available as metadata fallback)
// ─────────────────────────────────────────────────────────────────────────────

function getFileMetadata(imagePath: string) {
  try {
    const stats = fs.statSync(imagePath);
    return {
      sizeKB: Math.round(stats.size / 1024),
      extension: path.extname(imagePath).toLowerCase(),
      exists: true,
    };
  } catch {
    return { sizeKB: 0, extension: "", exists: false };
  }
}

function analyzeWithRules(imagePath: string): ReceiptAnalysisResult {
  const metadata = getFileMetadata(imagePath);
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 50;

  if (!metadata.exists) {
    return {
      status: "REJECTED",
      confidence: 0,
      transactionId: null,
      senderName: null,
      receiverName: null,
      amount: null,
      currency: "ETB",
      date: null,
      time: null,
      paymentMethod: null,
      reasons: ["Image file not found or inaccessible"],
      warnings: ["Cannot process verification without a valid image"],
    };
  }

  if (metadata.sizeKB < 5) {
    score -= 30;
    warnings.push("Image file is suspiciously small — may be corrupted or a placeholder");
  } else if (metadata.sizeKB < 20) {
    score -= 15;
    warnings.push("Image file is very small — may be low quality or compressed");
  } else if (metadata.sizeKB > 50 && metadata.sizeKB < 8000) {
    score += 10;
    reasons.push("Image file size is within normal range");
  }

  const validTypes = [".jpg", ".jpeg", ".png", ".webp", ".heic"];
  if (validTypes.includes(metadata.extension)) {
    score += 5;
    reasons.push(`Valid image format: ${metadata.extension}`);
  } else {
    score -= 20;
    warnings.push(`Unusual file format: ${metadata.extension}`);
  }

  score = Math.max(0, Math.min(100, score));
  let status: "APPROVED" | "SUSPICIOUS" | "REJECTED" = "SUSPICIOUS";
  if (score >= 65) status = "APPROVED";
  else if (score < 35) status = "REJECTED";

  return {
    status,
    confidence: score,
    transactionId: null,
    senderName: null,
    receiverName: null,
    amount: null,
    currency: "ETB",
    date: null,
    time: null,
    paymentMethod: null,
    reasons,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main analysis function
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeReceiptImage(
  imagePath: string,
  preprocessedImages?: PreprocessedImages
): Promise<ReceiptAnalysisResult> {
  logger.info(`🔍 Starting analysis of receipt: ${imagePath}`);
  
  let cleanupPaths: string[] = [];
  let images = preprocessedImages;

  // 1. Trigger preprocessing on-the-fly if not provided
  if (!images) {
    const prepped = await preprocessReceiptImage(imagePath);
    images = prepped;
    cleanupPaths = prepped.tempPaths;
  }

  try {
    // 2. Perform Multi-Pass OCR
    const ocrResult = await performMultiPassOCR(images);
    const rawText = ocrResult.text;
    const ocrConfidence = ocrResult.confidence;

    if (rawText && rawText.trim().length > 10) {
      // 3. Detect bank & run rule-based regex parsing
      const bank = detectBankFromText(rawText);
      const parsedFields = parseReceiptWithBankRules(rawText, bank);

      // Heuristic OCR check: If we have transactionId + amount with high confidence,
      // and we are confident in the regex, we can route to Text-Only Gemini first (Tier 1)
      // which is 60-90% cheaper than Gemini Vision.
      if (parsedFields.confidence >= 70 && ocrConfidence > 75) {
        logger.info(`⚡ High OCR parsing confidence (${parsedFields.confidence}%). Routing to Gemini Lite (Tier 1 Text-Only)...`);
        const liteResult = await analyzeWithGeminiTextOnly(rawText, bank);
        
        if (liteResult?.result) {
          logger.info(`✅ Gemini Lite successfully processed receipt (confidence: ${liteResult.result.confidence}%)`);
          liteResult.result.ocrConfidence = ocrConfidence;
          return liteResult.result;
        }
        logger.warn("⚠️ Gemini Lite extraction failed/null. Falling back to Gemini Vision.");
      }

      // If rules matching is not enough or Gemini Lite failed, we try Gemini Vision (Tier 2)
      logger.info("🤖 Routing to Gemini Vision (Tier 2 Multimodal)...");
      const visionResult = await analyzeWithGeminiVision(images.original);
      if (visionResult.result) {
        visionResult.result.rawExtractedText = rawText;
        visionResult.result.ocrConfidence = ocrConfidence;
        return visionResult.result;
      }
      
      // Local OCR parsing fallback if Gemini fails completely
      logger.warn("⚠️ Gemini Vision failed. Falling back to local regex parsed output.");
      let status: "APPROVED" | "SUSPICIOUS" | "REJECTED" = "SUSPICIOUS";
      if (parsedFields.transactionId && parsedFields.amount) {
        status = "APPROVED";
      }
      return {
        status,
        confidence: parsedFields.confidence,
        transactionId: parsedFields.transactionId,
        transferReference: parsedFields.transferReference,
        senderName: parsedFields.senderName,
        senderAccount: parsedFields.senderAccount,
        receiverName: parsedFields.receiverName,
        receiverAccount: parsedFields.receiverAccount,
        amount: parsedFields.amount,
        fees: parsedFields.fees,
        totalAmount: parsedFields.totalAmount,
        currency: "ETB",
        date: parsedFields.date,
        time: parsedFields.time,
        paymentMethod: parsedFields.paymentMethod,
        reasons: ["Successfully parsed receipt using bank-specific local regex rules"],
        warnings: ["⚠️ Gemini API failure - fall back to regex matching. Text styling verification bypassed."],
        rawExtractedText: rawText,
        ocrConfidence,
        usedVision: false
      };
    }

    // 4. If OCR failed completely (extremely blurry/unreadable text), try Gemini Vision directly
    logger.info("🤖 OCR read no text. Sending image directly to Gemini Vision...");
    const visionResult = await analyzeWithGeminiVision(images.original);
    if (visionResult.result) {
      return visionResult.result;
    }

    // Ultimate fallback to rules
    const ruleResult = analyzeWithRules(images.original);
    ruleResult.warnings.push("⚠️ Extraction failed completely (OCR + Gemini Vision failed). Fallback to basic file metadata checks.");
    return ruleResult;

  } finally {
    // Clean up temporary preprocessed files if they were created on the fly
    if (cleanupPaths.length > 0) {
      logger.info(`🧹 Cleaning up ${cleanupPaths.length} temporary files...`);
      for (const p of cleanupPaths) {
        try {
          if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch (e) {
          // ignore
        }
      }
    }
  }
}
