import crypto from "node:crypto";
import { db } from "@/src/config/db.js";
import { logger } from "@/src/utils/logger/logger.js";

// ─────────────────────────────────────────────────────────────
// Duplicate Detection Types
// ─────────────────────────────────────────────────────────────

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateOf: string | null;
  riskLevel: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  reasons: string[];
  matchingRecords: Array<{
    id: string;
    transactionId: string | null;
    amount: number | null;
    senderName: string | null;
    createdAt: Date;
  }>;
}

// ─────────────────────────────────────────────────────────────
// Receipt Hashing Helper
// ─────────────────────────────────────────────────────────────

/**
 * Generates a unique SHA-256 hash for a receipt based on normalized core parameters.
 * Combines: bank (paymentMethod), amount, senderName, receiverName, and date.
 */
export function generateReceiptHash(
  paymentMethod: string | null,
  amount: number | null,
  senderName: string | null,
  receiverName: string | null,
  date: string | null
): string | null {
  // If we don't have a payment method, amount, and date, we can't create a reliable hash
  if (!paymentMethod || amount == null || !date) {
    return null;
  }

  const clean = (str: string | null | undefined): string => {
    if (!str) return "";
    return str.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  };

  const normBank = clean(paymentMethod);
  const normAmount = amount.toFixed(2);
  const normSender = clean(senderName);
  const normReceiver = clean(receiverName);
  const normDate = clean(date);

  const combinedString = `${normBank}|${normAmount}|${normSender}|${normReceiver}|${normDate}`;
  
  return crypto
    .createHash("sha256")
    .update(combinedString)
    .digest("hex");
}

// ─────────────────────────────────────────────────────────────
// Duplicate Detection Engine
// ─────────────────────────────────────────────────────────────

/**
 * Checks for duplicate or previously-seen receipts using multiple levels:
 * 1. Exact transaction ID match
 * 2. Normalized receipt parameter SHA-256 hash match
 * 3. Similar amount + sender within a time window
 */
export async function checkForDuplicates(
  transactionId: string | null,
  amount: number | null,
  senderName: string | null,
  receiverName: string | null,
  date: string | null,
  paymentMethod: string | null,
  userId: string,
): Promise<DuplicateCheckResult> {
  const result: DuplicateCheckResult = {
    isDuplicate: false,
    duplicateOf: null,
    riskLevel: "NONE",
    reasons: [],
    matchingRecords: [],
  };

  try {
    // 1. Check exact transaction ID match (strongest signal)
    if (transactionId && transactionId !== "N/A" && transactionId.length > 3) {
      const exactMatches = await db.verification.findMany({
        where: {
          transactionId,
          userId,
        },
        select: {
          id: true,
          transactionId: true,
          amount: true,
          senderName: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      if (exactMatches.length > 0) {
        result.isDuplicate = true;
        result.duplicateOf = exactMatches[0].id;
        result.riskLevel = "HIGH";
        result.reasons.push(
          `⚠️ This transaction ID "${transactionId}" has been submitted ${exactMatches.length} time(s) before.`,
        );
        result.matchingRecords.push(...exactMatches);

        logger.warn(
          `🔴 Duplicate detected: Transaction ID "${transactionId}" already exists (${exactMatches.length} matches)`,
        );
        return result;
      }
    }

    // 2. Check receipt hash match (SHA-256 of combined parameters)
    const receiptHash = generateReceiptHash(paymentMethod, amount, senderName, receiverName, date);
    if (receiptHash) {
      const hashMatches = await db.verification.findMany({
        where: {
          receiptHash,
          userId,
        },
        select: {
          id: true,
          transactionId: true,
          amount: true,
          senderName: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      if (hashMatches.length > 0) {
        result.isDuplicate = true;
        result.duplicateOf = hashMatches[0].id;
        result.riskLevel = "HIGH";
        result.reasons.push(
          `⚠️ Duplicate screenshot detected via receipt signature match (amount: ${amount} ETB, date: ${date}).`,
        );
        result.matchingRecords.push(...hashMatches);

        logger.warn(
          `🔴 Duplicate detected: Receipt hash "${receiptHash}" already exists (${hashMatches.length} matches)`,
        );
        return result;
      }
    }

    // 3. Check same amount + similar sender within 24 hours (heuristic check)
    if (amount != null && amount > 0) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const recentSameAmount = await db.verification.findMany({
        where: {
          userId,
          amount: {
            gte: amount - 0.01,
            lte: amount + 0.01,
          },
          createdAt: {
            gte: oneDayAgo,
          },
        },
        select: {
          id: true,
          transactionId: true,
          amount: true,
          senderName: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      if (recentSameAmount.length > 0) {
        // Check if sender name matches any of the recent records
        const senderMatches = senderName
          ? recentSameAmount.filter(
              (r) =>
                r.senderName &&
                r.senderName.toLowerCase().includes(senderName.toLowerCase().substring(0, 5)),
            )
          : [];

        if (senderMatches.length > 0) {
          result.isDuplicate = true;
          result.duplicateOf = senderMatches[0].id;
          result.riskLevel = "HIGH";
          result.reasons.push(
            `⚠️ Found ${senderMatches.length} recent receipt(s) with same amount (${amount} ETB) and similar sender within 24 hours.`,
          );
          result.matchingRecords.push(...senderMatches);
        } else if (recentSameAmount.length >= 2) {
          result.riskLevel = "MEDIUM";
          result.reasons.push(
            `⚠️ Found ${recentSameAmount.length} receipts with the same amount (${amount} ETB) in the last 24 hours.`,
          );
          result.matchingRecords.push(...recentSameAmount.slice(0, 3));
        } else {
          result.riskLevel = "LOW";
          result.reasons.push(
            `ℹ️ One recent receipt with the same amount (${amount} ETB) found in the last 24 hours.`,
          );
          result.matchingRecords.push(...recentSameAmount);
        }
      }
    }

    // 4. Check for suspiciously round amounts (common in fraud)
    if (amount != null && amount > 0) {
      const isRound = amount % 1000 === 0 && amount >= 5000;
      if (isRound) {
        if (result.riskLevel === "NONE") result.riskLevel = "LOW";
        result.reasons.push(
          `ℹ️ Amount (${amount} ETB) is a suspiciously round number — may warrant extra scrutiny.`,
        );
      }
    }
  } catch (error) {
    logger.error("Duplicate detection failed:", error);
    result.reasons.push("⚠️ Duplicate detection encountered an error — proceeding with caution.");
  }

  return result;
}
