import { logger } from "@/src/utils/logger/logger.js";
import type { ReceiptAnalysisResult } from "./ai-engine.js";
import type { ScrapedReceiptData } from "./receipt-scraper.js";

// ─────────────────────────────────────────────────────────────
// Cross-Validation Types
// ─────────────────────────────────────────────────────────────

export interface FieldMatch {
  field: string;
  aiValue: string | number | null;
  scrapedValue: string | number | null;
  matches: boolean;
  confidence: number; // 0–100
  note?: string;
}

export interface CrossValidationResult {
  overallMatch: "MATCH" | "PARTIAL_MATCH" | "MISMATCH" | "UNABLE_TO_VERIFY";
  crossValidationScore: number; // 0–100
  fieldMatches: FieldMatch[];
  discrepancies: string[];
  summary: string;
}

// ─────────────────────────────────────────────────────────────
// Fuzzy String Matching (Levenshtein Distance)
// ─────────────────────────────────────────────────────────────

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // deletion
        dp[i][j - 1] + 1,       // insertion
        dp[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return dp[m][n];
}

// ─────────────────────────────────────────────────────────────
// Fuzzy String Matching Helpers (Levenshtein, Jaro-Winkler, Dice)
// ─────────────────────────────────────────────────────────────

function jaroSimilarity(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  if (m === 0 && n === 0) return 1;
  if (m === 0 || n === 0) return 0;

  const matchWindow = Math.max(0, Math.floor(Math.max(m, n) / 2) - 1);
  const s1Matches = new Array(m).fill(false);
  const s2Matches = new Array(n).fill(false);

  let matches = 0;
  for (let i = 0; i < m; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(n - 1, i + matchWindow);
    for (let j = start; j <= end; j++) {
      if (!s2Matches[j] && s1[i] === s2[j]) {
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < m; i++) {
    if (s1Matches[i]) {
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) {
        transpositions++;
      }
      k++;
    }
  }

  const t = transpositions / 2;
  return (matches / m + matches / n + (matches - t) / matches) / 3;
}

function jaroWinklerSimilarity(s1: string, s2: string): number {
  const jaro = jaroSimilarity(s1, s2);
  if (jaro < 0.7) return jaro;

  let prefix = 0;
  const maxPrefix = Math.min(4, s1.length, s2.length);
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) {
      prefix++;
    } else {
      break;
    }
  }

  const p = 0.1;
  return jaro + prefix * p * (1 - jaro);
}

function diceTokenSimilarity(s1: string, s2: string): number {
  const tokens1 = s1.split(" ").filter(Boolean);
  const tokens2 = s2.split(" ").filter(Boolean);

  if (tokens1.length === 0 && tokens2.length === 0) return 1;
  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  let intersection = 0;
  for (const t of set1) {
    if (set2.has(t)) {
      intersection++;
    }
  }

  return (2 * intersection) / (set1.size + set2.size);
}

/**
 * Computes a similarity score (0–100) between two strings combining Levenshtein,
 * Jaro-Winkler, and Dice Token similarity to address abbreviations and word-order changes.
 */
function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0;

  // Normalize: lowercase, trim, collapse whitespace, remove honorifics
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/\b(mr|mrs|ms|dr|ato|w\/ro|w\/rt)\b\.?/gi, "")
      .replace(/\s+/g, " ")
      .trim();

  const normA = normalize(a);
  const normB = normalize(b);

  if (normA === normB) return 100;
  if (normA.length === 0 || normB.length === 0) return 0;

  // 1. Levenshtein-based similarity
  const distance = levenshteinDistance(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  const levSim = maxLen > 0 ? (maxLen - distance) / maxLen : 0;

  // 2. Jaro-Winkler similarity
  const jwSim = jaroWinklerSimilarity(normA, normB);

  // 3. Dice Token similarity (handles swapped token orders gracefully)
  const diceSim = diceTokenSimilarity(normA, normB);

  // Average the similarities: 40% JW, 30% Levenshtein, 30% Dice
  const averageSim = (jwSim * 0.40 + levSim * 0.30 + diceSim * 0.30) * 100;

  return Math.max(0, Math.min(100, Math.round(averageSim)));
}

/**
 * Compares two amounts with tolerance for minor rounding differences.
 */
function amountMatch(
  aiAmount: number | null | undefined,
  scrapedAmount: number | null | undefined,
  tolerance = 0.50,
): { matches: boolean; confidence: number } {
  if (aiAmount == null || scrapedAmount == null) {
    return { matches: false, confidence: 0 };
  }

  const diff = Math.abs(aiAmount - scrapedAmount);

  if (diff === 0) {
    return { matches: true, confidence: 100 };
  }

  if (diff <= tolerance) {
    return { matches: true, confidence: 95 };
  }

  // Percentage-based tolerance for larger amounts (within 0.5%)
  const percentDiff = (diff / Math.max(aiAmount, scrapedAmount)) * 100;
  if (percentDiff <= 0.5) {
    return { matches: true, confidence: 85 };
  }

  return { matches: false, confidence: Math.max(0, 100 - Math.round(percentDiff * 10)) };
}

// ─────────────────────────────────────────────────────────────
// Main Cross-Validation Function
// ─────────────────────────────────────────────────────────────

/**
 * Cross-validates AI-extracted receipt data against URL-scraped data.
 * Compares sender, receiver, amount, and transaction ID fields.
 * Returns a detailed match result with per-field analysis.
 */
export function crossValidate(
  aiData: ReceiptAnalysisResult,
  scrapedData: ScrapedReceiptData,
): CrossValidationResult {
  logger.info("🔄 Running cross-validation: AI data vs scraped data");

  const fieldMatches: FieldMatch[] = [];
  const discrepancies: string[] = [];

  // 1. Sender Name comparison
  const senderSimilarity = nameSimilarity(aiData.senderName, scrapedData.senderName);
  const senderMatches = senderSimilarity >= 70;
  fieldMatches.push({
    field: "Sender Name",
    aiValue: aiData.senderName,
    scrapedValue: scrapedData.senderName ?? null,
    matches: senderMatches,
    confidence: senderSimilarity,
    note: senderSimilarity >= 90
      ? "Names match closely"
      : senderSimilarity >= 70
        ? "Names partially match (may be a name variation)"
        : senderSimilarity > 0
          ? "Names differ significantly"
          : "One or both sender names missing",
  });
  if (!senderMatches && aiData.senderName && scrapedData.senderName) {
    discrepancies.push(
      `Sender mismatch: AI extracted "${aiData.senderName}" but URL shows "${scrapedData.senderName}"`,
    );
  }

  // 2. Receiver Name comparison
  const receiverSimilarity = nameSimilarity(aiData.receiverName, scrapedData.receiverName);
  const receiverMatches = receiverSimilarity >= 70;
  fieldMatches.push({
    field: "Receiver Name",
    aiValue: aiData.receiverName,
    scrapedValue: scrapedData.receiverName ?? null,
    matches: receiverMatches,
    confidence: receiverSimilarity,
    note: receiverSimilarity >= 90
      ? "Names match closely"
      : receiverSimilarity >= 70
        ? "Names partially match"
        : receiverSimilarity > 0
          ? "Names differ significantly"
          : "One or both receiver names missing",
  });
  if (!receiverMatches && aiData.receiverName && scrapedData.receiverName) {
    discrepancies.push(
      `Receiver mismatch: AI extracted "${aiData.receiverName}" but URL shows "${scrapedData.receiverName}"`,
    );
  }

  // 3. Amount comparison
  const amtResult = amountMatch(aiData.amount, scrapedData.amount);
  fieldMatches.push({
    field: "Amount",
    aiValue: aiData.amount,
    scrapedValue: scrapedData.amount ?? null,
    matches: amtResult.matches,
    confidence: amtResult.confidence,
    note: amtResult.matches
      ? amtResult.confidence === 100
        ? "Exact amount match"
        : "Amount matches within rounding tolerance"
      : aiData.amount != null && scrapedData.amount != null
        ? `Amount differs: ${aiData.amount} vs ${scrapedData.amount} ETB`
        : "One or both amounts missing",
  });
  if (!amtResult.matches && aiData.amount != null && scrapedData.amount != null) {
    discrepancies.push(
      `Amount mismatch: AI extracted ${aiData.amount} ETB but URL shows ${scrapedData.amount} ETB`,
    );
  }

  // 4. Transaction ID comparison
  const txnIdMatch =
    aiData.transactionId != null &&
    scrapedData.transactionId != null &&
    aiData.transactionId.toLowerCase() === scrapedData.transactionId.toLowerCase();
  fieldMatches.push({
    field: "Transaction ID",
    aiValue: aiData.transactionId,
    scrapedValue: scrapedData.transactionId ?? null,
    matches: txnIdMatch,
    confidence: txnIdMatch ? 100 : 0,
    note: txnIdMatch
      ? "Transaction IDs match exactly"
      : "Transaction IDs differ or one is missing",
  });
  if (!txnIdMatch && aiData.transactionId && scrapedData.transactionId) {
    discrepancies.push(
      `Transaction ID mismatch: "${aiData.transactionId}" vs "${scrapedData.transactionId}"`,
    );
  }

  // 5. Compute overall score
  // Weights: Amount (40%), Sender (25%), Receiver (25%), TxnID (10%)
  const weights = { amount: 0.40, sender: 0.25, receiver: 0.25, txnId: 0.10 };

  let totalWeight = 0;
  let weightedScore = 0;

  // Only count fields where both AI and scraped data are present
  if (aiData.amount != null && scrapedData.amount != null) {
    weightedScore += amtResult.confidence * weights.amount;
    totalWeight += weights.amount;
  }
  if (aiData.senderName && scrapedData.senderName) {
    weightedScore += senderSimilarity * weights.sender;
    totalWeight += weights.sender;
  }
  if (aiData.receiverName && scrapedData.receiverName) {
    weightedScore += receiverSimilarity * weights.receiver;
    totalWeight += weights.receiver;
  }
  if (aiData.transactionId && scrapedData.transactionId) {
    weightedScore += (txnIdMatch ? 100 : 0) * weights.txnId;
    totalWeight += weights.txnId;
  }

  const crossValidationScore =
    totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

  // Determine overall match status
  let overallMatch: CrossValidationResult["overallMatch"];
  if (totalWeight === 0) {
    overallMatch = "UNABLE_TO_VERIFY";
  } else if (crossValidationScore >= 80) {
    overallMatch = "MATCH";
  } else if (crossValidationScore >= 50) {
    overallMatch = "PARTIAL_MATCH";
  } else {
    overallMatch = "MISMATCH";
  }

  // Summary text
  const matchedFields = fieldMatches.filter((f) => f.matches).length;
  const comparableFields = fieldMatches.filter(
    (f) => f.aiValue != null && f.scrapedValue != null,
  ).length;

  const summary =
    overallMatch === "MATCH"
      ? `✅ Cross-validation passed: ${matchedFields}/${comparableFields} fields match between AI extraction and URL verification.`
      : overallMatch === "PARTIAL_MATCH"
        ? `⚠️ Partial match: ${matchedFields}/${comparableFields} fields match. Review the discrepancies below.`
        : overallMatch === "MISMATCH"
          ? `❌ Cross-validation failed: Only ${matchedFields}/${comparableFields} fields match. This receipt may be tampered with.`
          : `ℹ️ Unable to cross-validate: Insufficient data from URL scraping for comparison.`;

  logger.info(
    `🔄 Cross-validation result: ${overallMatch} (score: ${crossValidationScore}, ${matchedFields}/${comparableFields} fields match)`,
  );

  return {
    overallMatch,
    crossValidationScore,
    fieldMatches,
    discrepancies,
    summary,
  };
}
