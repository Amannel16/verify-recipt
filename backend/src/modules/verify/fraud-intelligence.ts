import { db } from "../../config/db.js";
import { FraudSignal, DuplicateInfo, NormalizedTransaction } from "./types.js";
import { logger } from "../../utils/logger/logger.js";

export async function analyzeFraudSignals(
  userId: string,
  tx: NormalizedTransaction,
  receiptHash?: string,
): Promise<{ fraudSignals: FraudSignal[]; duplicateInfo: DuplicateInfo }> {
  const fraudSignals: FraudSignal[] = [];
  let isDuplicate = false;
  let duplicateOfId: string | undefined = undefined;
  let hashMatch = false;
  let txIdMatch = false;
  let replayDetected = false;
  let velocityAlert = false;

  // 1. Exact / Perceptual Hash Duplicate Check
  if (receiptHash) {
    const existingByHash = await db.verification.findFirst({
      where: { receiptHash, userId: { not: userId } },
    });
    if (existingByHash) {
      isDuplicate = true;
      hashMatch = true;
      duplicateOfId = existingByHash.id;
      fraudSignals.push({
        type: "IMAGE_HASH_DUPLICATE",
        severity: "CRITICAL",
        description: "Identical image hash submitted by a different user/account",
        metadata: { existingVerificationId: existingByHash.id },
      });
    }
  }

  // 2. Transaction Replay Check (same provider + transactionId submitted across different users)
  if (tx.provider && tx.transactionId) {
    const existingTx = await db.verification.findFirst({
      where: {
        provider: tx.provider,
        transactionId: tx.transactionId,
        userId: { not: userId },
      } as any,
    });

    if (existingTx) {
      isDuplicate = true;
      txIdMatch = true;
      replayDetected = true;
      duplicateOfId = existingTx.id;
      fraudSignals.push({
        type: "TRANSACTION_REPLAY",
        severity: "CRITICAL",
        description: `Transaction ID ${tx.transactionId} (${tx.provider}) was already claimed by another user`,
        metadata: { originalVerificationId: existingTx.id },
      });
    }
  }

  // 3. 24-Hour Velocity Check (multiple transactions with exact same amount & sender within 24h)
  if (tx.amount && tx.sender?.name) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await db.verification.count({
      where: {
        userId,
        amount: tx.amount,
        senderName: { equals: tx.sender.name, mode: "insensitive" },
        createdAt: { gte: twentyFourHoursAgo },
      },
    });

    if (recentCount >= 3) {
      velocityAlert = true;
      fraudSignals.push({
        type: "VELOCITY_ANOMALY",
        severity: "HIGH",
        description: `High submission velocity: ${recentCount} receipts with identical amount (${tx.amount} ETB) & sender in 24 hours`,
        metadata: { velocityCount: recentCount },
      });
    }
  }

  // 4. Suspicious Round Amount Check (e.g. exactly 10,000 ETB)
  if (tx.amount && tx.amount >= 10000 && tx.amount % 1000 === 0) {
    fraudSignals.push({
      type: "SUSPICIOUS_ROUND_AMOUNT",
      severity: "LOW",
      description: `Large round transaction amount (${tx.amount} ETB)`,
    });
  }

  logger.info(
    `🛡️ Fraud Analysis complete: signalsCount=${fraudSignals.length}, isDuplicate=${isDuplicate}, replay=${replayDetected}`
  );

  return {
    fraudSignals,
    duplicateInfo: {
      isDuplicate,
      duplicateOfId,
      hashMatch,
      txIdMatch,
      replayDetected,
      velocityAlert,
      details: fraudSignals.map((s) => s.description).join("; ") || "No duplicate anomalies detected",
    },
  };
}
