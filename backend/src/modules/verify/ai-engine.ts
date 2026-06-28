import fs from "node:fs";
import path from "node:path";
import { logger } from "@/src/utils/logger/logger.js";
import appConfig from "@/src/config/app_configs.js";

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
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini Vision API integration (optional — works when GEMINI_API_KEY is set)
// ─────────────────────────────────────────────────────────────────────────────

async function analyzeWithGemini(
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
- **CBE**: Look for "Commercial Bank of Ethiopia" or "CBE" logos/text. The transaction reference (Txn Ref / Ref No) usually starts with "FT" (e.g., FT23..., FT24...).
- **CBE Birr**: Look for "CBE Birr" branding, yellow/green colors, or similar layout.
- **Bank of Abyssinia (BoA)**: Look for "Bank of Abyssinia", "BoA", or "Apollo" branding.
- **Dashen Bank**: Look for "Dashen Bank", "Dashen", or "Dashen Bank Super App" branding. Dashen receipts usually list both a Transaction Reference (e.g., "075IPSS...") and a Transfer Reference / IPSS Reference (e.g., "IPSS...").
- **M-Pesa**: Look for "M-Pesa" or "Safaricom" branding.

Analyze the image for signs of image tampering or fraud:
- Check if the transaction ID/references, amount, fees, total, sender/receiver names, or accounts font style, weight, or size matches the surrounding text (often forged screenshots have a different font, pixelation, or slightly blurry values on these key fields).
- Look for mismatched colors, pixelation, or boxy artifacts around the transaction ID/references, amount/fees/total, or dates/names (signs of copy-pasting/erasing/editing).
- Check if the text is perfectly aligned or if modified numbers look slightly skewed, rotated, or out of line.
- Validate whether standard elements for the identified bank or wallet are present (e.g., CBE, telebirr, BoA, Dashen, M-Pesa, etc. must show transaction/transfer reference, sender name/account, receiver name/account, transaction amount, fees, total amount, date, and status).
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
  "fraudIndicators": ["indicator1"] or []
}`;

    let model = "gemini-2.0-flash";
    let attempts = 0;
    const maxAttempts = 3;
    let response: any = null;
    let errorText = "";

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const apiVersion = model.includes("1.5") ? "v1" : "v1beta";
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
              generationConfig: {
                temperature: 0.1,
                max_output_tokens: 800,
                response_mime_type: "application/json",
              },
            }),
            signal: AbortSignal.timeout(15000), // 15 seconds timeout
          },
        );

        if (response.ok) {
          break;
        }

        errorText = await response.text();
        logger.warn(`Gemini API attempt ${attempts} (model: ${model}) failed with status ${response.status}: ${errorText}`);

        if (response.status === 429) {
          // Check if we can fall back to 1.5-flash
          if (model === "gemini-2.0-flash") {
            logger.info("Rate limited on gemini-2.0-flash. Switching to fallback model: gemini-1.5-flash");
            model = "gemini-1.5-flash";
            // Do not wait if it's the first failure and we switch model
            continue;
          }

          let delay = 3000;
          try {
            const parsedError = JSON.parse(errorText);
            const retryDelayStr = parsedError?.error?.details?.find((d: any) => d["@type"]?.includes("RetryInfo"))?.retryDelay;
            if (retryDelayStr) {
              const seconds = parseFloat(retryDelayStr.replace("s", ""));
              if (!isNaN(seconds)) {
                delay = Math.min(seconds * 1000 + 500, 10000);
              }
            }
          } catch (_) {}

          logger.info(`Rate limited on ${model}. Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          // For non-429 client errors (e.g. 400, 403), don't retry
          if (response.status < 500) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (err: any) {
        errorText = err.message || String(err);
        logger.error(`Gemini API attempt ${attempts} (model: ${model}) threw exception: ${errorText}`);
        
        // If it was a network/fetch error, try switching to 1.5-flash or wait
        if (model === "gemini-2.0-flash") {
          model = "gemini-1.5-flash";
          continue;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (!response || !response.ok) {
      return { result: null, error: `Gemini API (model: ${model}) failed after ${attempts} attempts. Last error (${response?.status || "network"}): ${errorText}` };
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      logger.error(`Gemini (${model}) returned empty response`);
      return { result: null, error: `Gemini API (${model}) returned an empty response` };
    }

    // Parse JSON from response (handle potential markdown wrapping)
    let cleanText = text.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleanText) as {
      transactionId?: string | null;
      transferReference?: string | null;
      senderName?: string | null;
      senderAccount?: string | null;
      receiverName?: string | null;
      receiverAccount?: string | null;
      amount?: number | null;
      fees?: number | null;
      totalAmount?: number | null;
      currency?: string;
      date?: string | null;
      time?: string | null;
      paymentMethod?: string | null;
      isLikelyGenuine?: boolean;
      confidenceScore?: number;
      extractedText?: string;
      analysisReasons?: string[];
      warnings?: string[];
      fraudIndicators?: string[];
    };

    // Determine status based on Gemini's analysis
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
      ...fraudIndicators.map((f) => `⚠️ Fraud indicator: ${f}`),
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
        rawExtractedText: parsed.extractedText,
        transferReference: parsed.transferReference ?? null,
        senderAccount: parsed.senderAccount ?? null,
        receiverAccount: parsed.receiverAccount ?? null,
        fees: parsed.fees ?? null,
        totalAmount: parsed.totalAmount ?? null,
      }
    };
  } catch (error) {
    logger.error("Gemini analysis failed:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { result: null, error: `Gemini execution error: ${errorMsg}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule-based analysis engine (always available as fallback)
// ─────────────────────────────────────────────────────────────────────────────

interface FileMetadata {
  sizeKB: number;
  extension: string;
  exists: boolean;
}

function getFileMetadata(imagePath: string): FileMetadata {
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
  let score = 50; // Start at neutral

  // 1. File existence and validity
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

  // 2. File size analysis
  if (metadata.sizeKB < 5) {
    score -= 30;
    warnings.push("Image file is suspiciously small — may be corrupted or a placeholder");
  } else if (metadata.sizeKB < 20) {
    score -= 15;
    warnings.push("Image file is very small — may be low quality or compressed");
  } else if (metadata.sizeKB > 50 && metadata.sizeKB < 8000) {
    score += 10;
    reasons.push("Image file size is within normal range for a photo receipt");
  } else if (metadata.sizeKB >= 8000) {
    score -= 5;
    warnings.push("Image file is unusually large");
  }

  // 3. File type check
  const validTypes = [".jpg", ".jpeg", ".png", ".webp", ".heic"];
  if (validTypes.includes(metadata.extension)) {
    score += 5;
    reasons.push(`Valid image format: ${metadata.extension}`);
  } else {
    score -= 20;
    warnings.push(`Unusual file format: ${metadata.extension}`);
  }

  // 4. JPEG-specific checks (read raw bytes for basic structure validation)
  if (metadata.extension === ".jpg" || metadata.extension === ".jpeg") {
    try {
      const fd = fs.openSync(imagePath, "r");
      const headerBuf = Buffer.alloc(4);
      fs.readSync(fd, headerBuf, 0, 4, 0);
      fs.closeSync(fd);

      // Check JPEG magic bytes (FF D8 FF)
      if (headerBuf[0] === 0xff && headerBuf[1] === 0xd8 && headerBuf[2] === 0xff) {
        score += 5;
        reasons.push("JPEG header structure is valid");
      } else {
        score -= 25;
        warnings.push("File claims to be JPEG but header bytes are invalid — possible tampering");
      }
    } catch {
      // Ignore read errors
    }
  }

  // 5. PNG-specific checks
  if (metadata.extension === ".png") {
    try {
      const fd = fs.openSync(imagePath, "r");
      const headerBuf = Buffer.alloc(8);
      fs.readSync(fd, headerBuf, 0, 8, 0);
      fs.closeSync(fd);

      // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
      if (
        headerBuf[0] === 0x89 &&
        headerBuf[1] === 0x50 &&
        headerBuf[2] === 0x4e &&
        headerBuf[3] === 0x47
      ) {
        score += 5;
        reasons.push("PNG header structure is valid");
      } else {
        score -= 25;
        warnings.push("File claims to be PNG but header bytes are invalid — possible tampering");
      }
    } catch {
      // Ignore read errors
    }
  }

  // 6. General heuristic additions
  reasons.push("Rule-based image analysis completed");
  reasons.push("For enhanced AI-powered analysis, configure a Gemini API key");

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine status
  let status: "APPROVED" | "SUSPICIOUS" | "REJECTED";
  if (score >= 65) {
    status = "APPROVED";
    reasons.unshift("Image passes basic validation checks");
  } else if (score >= 35) {
    status = "SUSPICIOUS";
    warnings.unshift("Image requires manual review — some checks raised concerns");
  } else {
    status = "REJECTED";
    warnings.unshift("Image failed multiple validation checks — likely fraudulent or corrupted");
  }

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
): Promise<ReceiptAnalysisResult> {
  logger.info(`🔍 Analyzing receipt image: ${imagePath}`);

  // Try Gemini first (if API key is configured)
  const { result: geminiResult, error: geminiError } = await analyzeWithGemini(imagePath);
  if (geminiResult) {
    logger.info(
      `🤖 Gemini analysis complete: ${geminiResult.status} (${geminiResult.confidence}%)`,
    );
    return geminiResult;
  }

  // Fall back to rule-based analysis
  const ruleResult = analyzeWithRules(imagePath);
  if (geminiError) {
    ruleResult.warnings.push(`⚠️ AI Extraction Failed: ${geminiError}`);
  }
  logger.info(
    `📐 Rule-based analysis complete: ${ruleResult.status} (${ruleResult.confidence}%)`,
  );
  return ruleResult;
}
