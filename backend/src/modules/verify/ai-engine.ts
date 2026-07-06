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
  receiptUrl?: string | null;
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
  "fraudIndicators": ["indicator1"] or [],
  "receiptUrl": "any verification URL visible on the receipt (e.g. https://apps.cbe.com.et/..., https://transactioninfo.ethiotelecom.et/..., etc.) or null"
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
        const generationConfig: Record<string, any> = {
          temperature: 0.1,
          max_output_tokens: 800,
        };

        if (apiVersion === "v1beta") {
          generationConfig.responseMimeType = "application/json";
        }

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
            signal: AbortSignal.timeout(15000), // 15 seconds timeout
          },
        );

        if (response.ok) {
          break;
        }

        errorText = await response.text();
        logger.warn(`Gemini API attempt ${attempts} (model: ${model}) failed with status ${response.status}: ${errorText}`);

        if (response.status === 429) {
          // Check if we can fall back to 2.0-flash-lite
          if (model === "gemini-2.0-flash") {
            logger.info("Rate limited on gemini-2.0-flash. Switching to fallback model: gemini-2.0-flash-lite");
            model = "gemini-2.0-flash-lite";
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
        
        // If it was a network/fetch error, try switching to 2.0-flash-lite or wait
        if (model === "gemini-2.0-flash") {
          model = "gemini-2.0-flash-lite";
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
      receiptUrl?: string | null;
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
        receiptUrl: parsed.receiptUrl ?? null,
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
// Local OCR text extraction fallback (Tesseract.js)
// ─────────────────────────────────────────────────────────────────────────────

async function analyzeWithLocalOCR(
  imagePath: string,
): Promise<ReceiptAnalysisResult | null> {
  try {
    logger.info("🔍 Falling back to local OCR text extraction (Tesseract.js)...");
    const Tesseract = (await import("tesseract.js")).default;

    const result = await Tesseract.recognize(imagePath, "eng");
    const text = result.data.text;

    if (!text || text.trim().length === 0) {
      return null;
    }

    logger.info("📄 Local OCR Text successfully extracted. Running Regex parsing...");

    // 1. Transaction ID patterns
    let transactionId: string | null = null;
    let transferReference: string | null = null;

    const cbeTxMatch = text.match(/\b(FT\d{10,20})\b/i);
    const telebirrTxMatch = text.match(/\b(TX[A-Z0-9]{8,15})\b/i) || text.match(/\b(?:Transaction No|Txn Ref)[:.\s]+([A-Z0-9]{10,18})/i);
    const dashenTxMatch = text.match(/\b(IPSS[A-Z0-9]{8,15})\b/i) || text.match(/\b(\d{2}IPSS[A-Z0-9]{8,15})\b/i);

    if (cbeTxMatch) transactionId = cbeTxMatch[1].toUpperCase();
    else if (telebirrTxMatch) transactionId = telebirrTxMatch[1];
    else if (dashenTxMatch) {
      transactionId = dashenTxMatch[0];
      transferReference = dashenTxMatch[0];
    } else {
      const genTxMatch = text.match(/(?:txn ref|reference no|transaction id|ref no|transaction ref)[:\s]*([A-Z0-9_-]{8,24})/i);
      if (genTxMatch) transactionId = genTxMatch[1];
    }

    // 2. Local parser state
    let amount: number | null = null;
    let senderName: string | null = null;
    let receiverName: string | null = null;

    // Helper name cleaner
    const cleanName = (val: string): string => {
      return val
        .replace(/[^a-zA-Z\s.-]/g, "") // Remove numbers, slashes, other characters
        .replace(/\b(?:account|no|number|date|time|ref|txn|method|status|success|fee|birr|etb|to|from|by|payer|receiver|payee|credited|party|beneficiary|holder)\b.*/gi, "") // Cut off trailing labels
        .replace(/\s+/g, " ")
        .trim();
    };

    // Split text into lines for granular parsing
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const candidateAmounts: Array<{ val: number; hasLabel: boolean }> = [];
    const accountHolders: string[] = [];

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      // Amount Extraction (Skip lines mentioning bank balance)
      const isBalanceLine = lowerLine.includes("balance") || lowerLine.includes("bal") || lowerLine.includes("avail") || lowerLine.includes("rem ");
      
      if (!isBalanceLine) {
        // Look for amount labels
        const labelMatch = line.match(/(?:transferred amount|transaction amount|total paid|amount|total amount|sum|total|net amount|paid)[:\s]*(?:etb|birr)?\s*([\d,]+\.\d{2})/i);
        if (labelMatch?.[1]) {
          const val = parseFloat(labelMatch[1].replace(/,/g, ""));
          if (!isNaN(val) && val > 0) {
            candidateAmounts.push({ val, hasLabel: true });
          }
        } else {
          // Look for generic currency amounts
          const genMatch = line.match(/(?:etb|birr)\s*([\d,]+\.\d{2})/i) || line.match(/([\d,]+\.\d{2})\s*(?:etb|birr)/i);
          if (genMatch?.[1]) {
            const val = parseFloat(genMatch[1].replace(/,/g, ""));
            if (!isNaN(val) && val > 0) {
              candidateAmounts.push({ val, hasLabel: false });
            }
          }
        }
      }

      // Name Extraction (Payer/Sender)
      const senderMatch = line.match(/^\s*(?:from|sender|payer|source\s*name|paid\s*by|source|payer\s*name|transfer\s*from|sender's\s*name|debited\s*from)[：:;\-.\s|Il1]+(.+)$/i);
      if (senderMatch?.[1] && !senderName) {
        const cleaned = cleanName(senderMatch[1]);
        if (cleaned.length > 2) senderName = cleaned;
      }

      // Name Extraction (Receiver/Payee)
      const receiverMatch = line.match(/^\s*(?:to|receiver|payee|beneficiary|credited\s*party|beneficiary\s*name|paid\s*to|credited\s*party\s*name|transfer\s*to|receiver's\s*name|for|paid\s*for)[：:;\-.\s|Il1]+(.+)$/i);
      if (receiverMatch?.[1] && !receiverName) {
        const cleaned = cleanName(receiverMatch[1]);
        if (cleaned.length > 2) receiverName = cleaned;
      }

      // Account Holder Name Match
      const holderMatch = line.match(/^\s*(?:account\s*holder\s*name|holder\s*name)[：:;\-.\s|Il1]+(.+)$/i);
      if (holderMatch?.[1]) {
        const cleaned = cleanName(holderMatch[1]);
        if (cleaned.length > 2) {
          accountHolders.push(cleaned);
        }
      }
    }

    // Resolve Dashen bank style multiple holder names
    if (accountHolders.length >= 2) {
      if (!senderName) senderName = accountHolders[0];
      if (!receiverName) receiverName = accountHolders[1];
    } else if (accountHolders.length === 1) {
      if (!senderName) senderName = accountHolders[0];
      else if (!receiverName) receiverName = accountHolders[0];
    }

    // Resolve Amount
    const strongCandidates = candidateAmounts.filter(c => c.hasLabel);
    if (strongCandidates.length > 0) {
      amount = strongCandidates[0].val;
    } else if (candidateAmounts.length > 0) {
      amount = candidateAmounts[0].val;
    }

    // 4. Detected payment method
    let paymentMethod: string | null = null;
    const lowerText = text.toLowerCase();
    if (lowerText.includes("telebirr")) paymentMethod = "telebirr";
    else if (lowerText.includes("commercial bank") || lowerText.includes("cbe")) paymentMethod = "CBE";
    else if (lowerText.includes("dashen")) paymentMethod = "Dashen Bank";
    else if (lowerText.includes("abyssinia") || lowerText.includes("boa")) paymentMethod = "Bank of Abyssinia";
    else if (lowerText.includes("awash")) paymentMethod = "Awash Bank";
    else if (lowerText.includes("zemen")) paymentMethod = "Zemen Bank";
    else if (lowerText.includes("m-pesa") || lowerText.includes("safaricom")) paymentMethod = "M-Pesa";

    // 5. Date and Time
    let date: string | null = null;
    let time: string | null = null;
    const dateMatch = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dateMatch) {
      date = dateMatch[0];
    }
    const timeMatch = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
    if (timeMatch) {
      time = timeMatch[0];
    }

    // 6. Verification URL pattern
    let receiptUrl: string | null = null;
    const urlMatch = text.match(/https?:\/\/[^\s<>"]+/i);
    if (urlMatch) {
      receiptUrl = urlMatch[0].replace(/[.,;:!?)]+$/, "");
    }

    const reasons = ["Successfully extracted text locally using Tesseract OCR fallback"];
    const warnings = ["⚠️ Local OCR fallback used — name extraction accuracy might be lower"];

    return {
      status: transactionId && amount ? "APPROVED" : "SUSPICIOUS",
      confidence: transactionId && amount ? 60 : 40,
      transactionId,
      transferReference,
      senderName,
      receiverName,
      amount,
      currency: "ETB",
      date,
      time,
      paymentMethod,
      reasons,
      warnings,
      rawExtractedText: text,
      receiptUrl,
    };
  } catch (error) {
    logger.error("Local OCR text extraction failed:", error);
    return null;
  }
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

  // Fall back to local OCR analysis (Tesseract.js)
  const localOcrResult = await analyzeWithLocalOCR(imagePath);
  if (localOcrResult) {
    if (geminiError) {
      localOcrResult.warnings.push(`⚠️ Gemini API rate-limited: ${geminiError}`);
    }
    logger.info(
      `📷 Local OCR analysis complete: ${localOcrResult.status} (${localOcrResult.confidence}%)`,
    );
    return localOcrResult;
  }

  // Fall back to rule-based analysis (file metadata only)
  const ruleResult = analyzeWithRules(imagePath);
  if (geminiError) {
    ruleResult.warnings.push(`⚠️ AI Extraction Failed: ${geminiError}`);
  }
  logger.info(
    `📐 Rule-based analysis complete: ${ruleResult.status} (${ruleResult.confidence}%)`,
  );
  return ruleResult;
}
