import type { Request, Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { db } from "@/src/config/db.js";
import { logger } from "@/src/utils/logger/logger.js";
import { analyzeReceiptImage, type ReceiptAnalysisResult } from "./ai-engine.js";
import { scrapeReceiptUrl, type ScrapedReceiptData } from "./receipt-scraper.js";
import { extractReceiptUrl, detectProviderFromName } from "./url-extractor.js";
import { crossValidate, type CrossValidationResult } from "./cross-validator.js";
import { checkForDuplicates, generateReceiptHash } from "./duplicate-detector.js";
import { decodeQrCode } from "../../utils/helper/qr-decoder.js";
import { preprocessReceiptImage, cleanupTempImages } from "../../utils/helper/image-preprocessor.js";

// ─────────────────────────────────────────────────────────────
// Supportive Validation Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Validates the transaction date is not too old or in the future.
 */
function validateTransactionDate(dateStr: string | null): {
  warnings: string[];
  penaltyScore: number;
} {
  const warnings: string[] = [];
  let penaltyScore = 0;

  if (!dateStr) return { warnings, penaltyScore };

  try {
    const txnDate = new Date(dateStr);
    const now = new Date();

    if (isNaN(txnDate.getTime())) return { warnings, penaltyScore };

    // Check if in the future
    if (txnDate > now) {
      warnings.push("⚠️ Transaction date is in the future — likely fraudulent");
      penaltyScore = 30;
    }

    // Check if too old (> 90 days)
    const daysDiff = (now.getTime() - txnDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 90) {
      warnings.push(`⚠️ Transaction is ${Math.round(daysDiff)} days old — receipts older than 90 days should be verified manually`);
      penaltyScore = 10;
    } else if (daysDiff > 30) {
      warnings.push(`ℹ️ Transaction is ${Math.round(daysDiff)} days old`);
      penaltyScore = 5;
    }
  } catch {
    // Invalid date format — non-critical
  }

  return { warnings, penaltyScore };
}

/**
 * Validates the transaction amount for suspicious patterns.
 */
function validateAmount(amount: number | null): {
  warnings: string[];
  penaltyScore: number;
} {
  const warnings: string[] = [];
  let penaltyScore = 0;

  if (amount == null) return { warnings, penaltyScore };

  // Extremely small amounts
  if (amount < 1) {
    warnings.push("⚠️ Amount is less than 1 ETB — suspiciously small");
    penaltyScore = 10;
  }

  // Extremely large amounts
  if (amount > 500000) {
    warnings.push("⚠️ Amount exceeds 500,000 ETB — high-value transaction, verify carefully");
    penaltyScore = 5;
  }

  return { warnings, penaltyScore };
}

// ─────────────────────────────────────────────────────────────
// MAIN: Verify Receipt
// ─────────────────────────────────────────────────────────────

/**
 * Full verification pipeline:
 * 1. Upload & validate image
 * 2. AI extraction (Gemini with fallback)
 * 3. URL detection & scraping
 * 4. Cross-validation (AI vs scraped)
 * 5. Duplicate detection
 * 6. Supportive validations
 * 7. Final confidence aggregation
 * 8. Save to database
 */
export async function verifyReceipt(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  let preprocessedImages: any = null;

  try {
    const userId = req.user?.userId;
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

    if (user.plan === "FREE" && user.verificationsUsed >= user.verificationsLimit) {
      res.status(403).json({
        success: false,
        message: "Verification limit reached. Upgrade to Pro for unlimited verifications.",
      });
      return;
    }

    // Step 1: Validate uploaded file
    const file = req.file;
    if (!file) {
      res.status(400).json({
        success: false,
        message: "No receipt image uploaded. Please upload a JPEG, PNG, or WebP image.",
      });
      return;
    }

    const imagePath = file.path;
    const imageUrl = `/uploads/${file.filename}`;

    logger.info(`📷 Receipt uploaded: ${file.filename} (${Math.round(file.size / 1024)}KB)`);

    // Step 1.5: Image Preprocessing (Sharp)
    logger.info("🖼️ Step 1.5: Preprocessing uploaded image...");
    preprocessedImages = await preprocessReceiptImage(imagePath);

    // Step 2: AI-powered receipt analysis (with multi-pass OCR & dual routing)
    logger.info("🤖 Step 2: Running AI extraction...");
    const aiResult: ReceiptAnalysisResult = await analyzeReceiptImage(imagePath, preprocessedImages);

    // Step 3: URL detection and scraping (QR Code & scraper fallback)
    logger.info("🔗 Step 3: Detecting receipt URL...");
    let scrapedData: ScrapedReceiptData | null = null;
    let crossValidation: CrossValidationResult | null = null;
    let receiptUrl = aiResult.receiptUrl || null;

    // Try to decode QR Code from optimized images if not found in text yet
    if (!receiptUrl) {
      logger.info("📸 Running hybrid QR detection on original image...");
      let qrUrl = await decodeQrCode(preprocessedImages.original);
      
      if (!qrUrl) {
        logger.info("📸 QR not found on original. Trying optimized thresholded variant...");
        qrUrl = await decodeQrCode(preprocessedImages.thresholded);
      }
      
      if (qrUrl) {
        receiptUrl = qrUrl;
        logger.info(`📸 Decoded verification URL from receipt QR Code: ${receiptUrl}`);
      }
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

    if (receiptUrl) {
      logger.info(`🌐 Step 3b: Scraping receipt from URL: ${receiptUrl}`);
      try {
        const provider =
          detectProviderFromName(aiResult.paymentMethod || "") || "unknown";
        const receiptId = aiResult.transactionId || "";

        scrapedData = await scrapeReceiptUrl(receiptUrl, provider, receiptId);

        if (scrapedData && scrapedData.isValid) {
          // Step 4: Cross-validate AI extraction vs scraped data
          logger.info("🔄 Step 4: Running cross-validation...");
          crossValidation = crossValidate(aiResult, scrapedData);
        } else {
          logger.warn("⚠️ URL scraping returned invalid data — skipping cross-validation");
        }
      } catch (error) {
        logger.error("URL scraping failed:", error);
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

    // Step 6: Supportive validations
    logger.info("✅ Step 6: Running supportive validations...");
    const dateValidation = validateTransactionDate(aiResult.date);
    const amountValidation = validateAmount(aiResult.amount);

    // Step 7: Final confidence aggregation
    logger.info("📊 Step 7: Aggregating final confidence score...");
    let finalConfidence = aiResult.confidence;
    let finalStatus = aiResult.status;
    const allWarnings = [...aiResult.warnings];
    const allReasons = [...aiResult.reasons];

    // Apply cross-validation impact
    if (crossValidation) {
      if (crossValidation.overallMatch === "MATCH") {
        finalConfidence = Math.min(100, finalConfidence + 15);
        allReasons.push(`✅ Cross-validation: ${crossValidation.summary}`);
      } else if (crossValidation.overallMatch === "PARTIAL_MATCH") {
        finalConfidence = Math.max(0, finalConfidence - 10);
        allWarnings.push(`⚠️ Cross-validation: ${crossValidation.summary}`);
        allWarnings.push(...crossValidation.discrepancies);
      } else if (crossValidation.overallMatch === "MISMATCH") {
        finalConfidence = Math.max(0, finalConfidence - 35);
        allWarnings.push(`❌ Cross-validation: ${crossValidation.summary}`);
        allWarnings.push(...crossValidation.discrepancies);
        if (finalStatus === "APPROVED") finalStatus = "SUSPICIOUS";
      }
    }

    // Apply duplicate detection impact
    if (duplicateCheck.isDuplicate) {
      finalConfidence = Math.max(0, finalConfidence - 40);
      allWarnings.push(...duplicateCheck.reasons);
      finalStatus = "REJECTED";
    } else if (duplicateCheck.riskLevel === "MEDIUM") {
      finalConfidence = Math.max(0, finalConfidence - 15);
      allWarnings.push(...duplicateCheck.reasons);
      if (finalStatus === "APPROVED") finalStatus = "SUSPICIOUS";
    } else if (duplicateCheck.riskLevel === "LOW") {
      allWarnings.push(...duplicateCheck.reasons);
    }

    // Apply date/amount validation penalties
    finalConfidence = Math.max(0, finalConfidence - dateValidation.penaltyScore);
    finalConfidence = Math.max(0, finalConfidence - amountValidation.penaltyScore);
    allWarnings.push(...dateValidation.warnings);
    allWarnings.push(...amountValidation.warnings);

    // Recalculate status based on final confidence
    if (finalConfidence >= 75 && finalStatus !== "REJECTED") {
      finalStatus = "APPROVED";
    } else if (finalConfidence >= 40 && finalStatus !== "REJECTED") {
      finalStatus = "SUSPICIOUS";
    } else if (finalConfidence < 40) {
      finalStatus = "REJECTED";
    }

    // Generate unique receipt signature hash for database duplicate checking
    const receiptHash = generateReceiptHash(
      aiResult.paymentMethod,
      aiResult.amount,
      aiResult.senderName,
      aiResult.receiverName,
      aiResult.date
    );

    // Step 8: Save to database
    logger.info("💾 Step 8: Saving verification result...");
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
        scrapedData: scrapedData ? JSON.parse(JSON.stringify(scrapedData)) : undefined,
        crossValidation: crossValidation
          ? JSON.parse(JSON.stringify(crossValidation))
          : undefined,
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
        imageUrl,
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
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [verifications, total] = await Promise.all([
      db.verification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.verification.count({ where: { userId } }),
    ]);

    res.json({
      success: true,
      message: "Verification history retrieved.",
      data: {
        verifications,
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
    res.status(500).json({ success: false, message: "Failed to retrieve history." });
  }
}

// ─────────────────────────────────────────────────────────────
// Get Single Verification by ID
// ─────────────────────────────────────────────────────────────

export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { id } = req.params;
    const verification = await db.verification.findFirst({
      where: { id, userId },
    });

    if (!verification) {
      res.status(404).json({ success: false, message: "Verification not found." });
      return;
    }

    res.json({
      success: true,
      message: "Verification retrieved.",
      data: verification,
    });
  } catch (error) {
    logger.error("Get verification failed:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve verification." });
  }
}

// ─────────────────────────────────────────────────────────────
// Delete Verification
// ─────────────────────────────────────────────────────────────

export async function deleteVerification(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { id } = req.params;
    const verification = await db.verification.findFirst({
      where: { id, userId },
    });

    if (!verification) {
      res.status(404).json({ success: false, message: "Verification not found." });
      return;
    }

    // Delete uploaded image file
    if (verification.imageUrl) {
      const imagePath = path.resolve("." + verification.imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await db.verification.delete({ where: { id } });

    res.json({
      success: true,
      message: "Verification deleted.",
    });
  } catch (error) {
    logger.error("Delete verification failed:", error);
    res.status(500).json({ success: false, message: "Failed to delete verification." });
  }
}

// ─────────────────────────────────────────────────────────────
// Get Verification Stats
// ─────────────────────────────────────────────────────────────

export async function getStats(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const [total, approved, suspicious, rejected, duplicates] = await Promise.all([
      db.verification.count({ where: { userId } }),
      db.verification.count({ where: { userId, status: "APPROVED" } }),
      db.verification.count({ where: { userId, status: "SUSPICIOUS" } }),
      db.verification.count({ where: { userId, status: "REJECTED" } }),
      db.verification.count({ where: { userId, isDuplicate: true } }),
    ]);

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
    res.status(500).json({ success: false, message: "Failed to retrieve stats." });
  }
}
