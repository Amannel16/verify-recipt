import { logger } from "../../utils/logger/logger.js";
import type { DomainValidationResult } from "./domain-validator.js";
import type { CrossValidationResult } from "./cross-validator.js";
import type { DuplicateCheckResult } from "./duplicate-detector.js";

// ─────────────────────────────────────────────────────────────
// Risk Assessment Types
// ─────────────────────────────────────────────────────────────

export interface RiskCheck {
  /** Human-readable name of the check */
  name: string;
  /** Points added (positive) or deducted (negative) */
  score: number;
  /** Whether this check passed, failed, or was skipped */
  status: "PASS" | "FAIL" | "SKIP" | "WARN";
  /** Explanation of why this score was assigned */
  detail: string;
}

export interface RiskAssessment {
  /** Final aggregated score (0–100, clamped) */
  totalScore: number;
  /** Classification based on totalScore */
  verdict: "APPROVED" | "SUSPICIOUS" | "REJECTED";
  /** All individual checks that contributed to the score */
  checks: RiskCheck[];
  /** Human-readable summary */
  summary: string;
}

// ─────────────────────────────────────────────────────────────
// Scoring Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Base confidence from AI extraction (used as the starting point).
 * The risk scorer adjusts this base score up or down based on security checks.
 */
const BASE_AI_WEIGHT = 1.0; // AI confidence is passed through at full weight

// ─────────────────────────────────────────────────────────────
// Risk Scoring Engine
// ─────────────────────────────────────────────────────────────

/**
 * Calculates a comprehensive risk score by evaluating all security signals.
 *
 * Starting from the AI's extraction confidence, applies bonuses and penalties:
 * - Domain trust checks (whitelist, HTTPS, shorteners, bank mismatch)
 * - Cross-validation results (portal confirmation of fields)
 * - Duplicate detection results
 * - Date validation (future dates, stale receipts)
 * - Amount validation (suspiciously small/large)
 *
 * @param aiConfidence - The raw confidence score (0–100) from AI extraction
 * @param domainValidation - Result from domain-validator (null if no URL found)
 * @param crossValidation - Result from cross-validator (null if scraping was skipped)
 * @param duplicateCheck - Result from duplicate-detector
 * @param dateStr - Transaction date string (for staleness/future checks)
 * @param amount - Transaction amount (for suspicious amount checks)
 * @param urlWasFound - Whether any URL was found in the receipt at all
 * @returns RiskAssessment with total score, verdict, and detailed check breakdown
 */
export function calculateRiskScore(
  aiConfidence: number,
  domainValidation: DomainValidationResult | null,
  crossValidation: CrossValidationResult | null,
  duplicateCheck: DuplicateCheckResult,
  dateStr: string | null,
  amount: number | null,
  urlWasFound: boolean,
): RiskAssessment {
  const checks: RiskCheck[] = [];
  let totalScore = Math.round(aiConfidence * BASE_AI_WEIGHT);

  // ── 1. AI Extraction Base Score ──
  checks.push({
    name: "AI Extraction Confidence",
    score: totalScore,
    status: totalScore >= 60 ? "PASS" : totalScore >= 30 ? "WARN" : "FAIL",
    detail: `AI extracted receipt data with ${aiConfidence}% confidence`,
  });

  // ── 2. Domain Trust Checks ──
  if (domainValidation) {
    // 2a. Trusted domain bonus
    if (domainValidation.isTrusted) {
      const bonus = 30;
      totalScore += bonus;
      checks.push({
        name: "Trusted Domain",
        score: bonus,
        status: "PASS",
        detail: `URL domain "${domainValidation.hostname}" is in the official bank whitelist (provider: ${domainValidation.matchedProvider})`,
      });
    } else {
      const penalty = -50;
      totalScore += penalty;
      checks.push({
        name: "Untrusted Domain",
        score: penalty,
        status: "FAIL",
        detail: `URL domain "${domainValidation.hostname}" is NOT in any trusted bank whitelist — possible fraud`,
      });
    }

    // 2b. HTTPS check
    if (!domainValidation.isHttps) {
      const penalty = -15;
      totalScore += penalty;
      checks.push({
        name: "No HTTPS",
        score: penalty,
        status: "FAIL",
        detail: "URL uses unencrypted HTTP — legitimate banks always use HTTPS",
      });
    }

    // 2c. Shortened URL check
    if (domainValidation.isShortened) {
      const penalty = -20;
      totalScore += penalty;
      checks.push({
        name: "Shortened URL",
        score: penalty,
        status: "FAIL",
        detail: `URL uses a public shortener (${domainValidation.hostname}) — bank receipts never use URL shorteners`,
      });
    }

    // 2d. Bank-domain mismatch check
    if (domainValidation.hasBankMismatch) {
      const penalty = -40;
      totalScore += penalty;
      checks.push({
        name: "Bank-Domain Mismatch",
        score: penalty,
        status: "FAIL",
        detail: `Receipt appears to be from "${domainValidation.detectedProvider}" but URL belongs to "${domainValidation.matchedProvider}"`,
      });
    }
  } else if (urlWasFound) {
    // URL was found but domain validation wasn't run (shouldn't happen normally)
    checks.push({
      name: "Domain Validation",
      score: 0,
      status: "SKIP",
      detail: "URL was found but domain validation was not performed",
    });
  } else {
    // No URL found at all — neutral (no bonus, no penalty)
    checks.push({
      name: "No URL Available",
      score: 0,
      status: "SKIP",
      detail: "No verification URL found in receipt — verification based on AI analysis only",
    });
  }

  // ── 3. Cross-Validation Checks ──
  if (crossValidation) {
    if (crossValidation.overallMatch === "MATCH") {
      // Portal confirms the receipt data
      const bonus = 15;
      totalScore += bonus;
      checks.push({
        name: "Portal Verification Match",
        score: bonus,
        status: "PASS",
        detail: crossValidation.summary,
      });

      // Individual field match bonuses
      for (const field of crossValidation.fieldMatches) {
        if (field.matches && field.aiValue != null && field.scrapedValue != null) {
          const fieldBonus = field.field === "Amount" ? 10 : 5;
          totalScore += fieldBonus;
          checks.push({
            name: `${field.field} Confirmed`,
            score: fieldBonus,
            status: "PASS",
            detail: `${field.field} matches between AI extraction and portal data (confidence: ${field.confidence}%)`,
          });
        }
      }
    } else if (crossValidation.overallMatch === "PARTIAL_MATCH") {
      const penalty = -10;
      totalScore += penalty;
      checks.push({
        name: "Partial Portal Match",
        score: penalty,
        status: "WARN",
        detail: crossValidation.summary,
      });
    } else if (crossValidation.overallMatch === "MISMATCH") {
      const penalty = -35;
      totalScore += penalty;
      checks.push({
        name: "Portal Verification Mismatch",
        score: penalty,
        status: "FAIL",
        detail: crossValidation.summary,
      });
    } else {
      checks.push({
        name: "Portal Verification",
        score: 0,
        status: "SKIP",
        detail: crossValidation.summary,
      });
    }
  }

  // ── 4. Duplicate Detection Checks ──
  if (duplicateCheck.isDuplicate) {
    const penalty = -30;
    totalScore += penalty;
    checks.push({
      name: "Duplicate Receipt",
      score: penalty,
      status: "FAIL",
      detail: duplicateCheck.reasons.join("; "),
    });
  } else if (duplicateCheck.riskLevel === "MEDIUM") {
    const penalty = -15;
    totalScore += penalty;
    checks.push({
      name: "Duplicate Risk (Medium)",
      score: penalty,
      status: "WARN",
      detail: duplicateCheck.reasons.join("; "),
    });
  } else if (duplicateCheck.riskLevel === "LOW") {
    checks.push({
      name: "Duplicate Risk (Low)",
      score: 0,
      status: "WARN",
      detail: duplicateCheck.reasons.join("; "),
    });
  }

  // ── 5. Date Validation ──
  if (dateStr) {
    try {
      const txnDate = new Date(dateStr);
      const now = new Date();

      if (!isNaN(txnDate.getTime())) {
        if (txnDate > now) {
          const penalty = -20;
          totalScore += penalty;
          checks.push({
            name: "Future Date",
            score: penalty,
            status: "FAIL",
            detail: `Transaction date "${dateStr}" is in the future — likely fraudulent`,
          });
        } else {
          const daysDiff = (now.getTime() - txnDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysDiff > 90) {
            const penalty = -10;
            totalScore += penalty;
            checks.push({
              name: "Stale Receipt",
              score: penalty,
              status: "WARN",
              detail: `Transaction is ${Math.round(daysDiff)} days old — receipts older than 90 days should be verified manually`,
            });
          } else if (daysDiff > 30) {
            const penalty = -5;
            totalScore += penalty;
            checks.push({
              name: "Aging Receipt",
              score: penalty,
              status: "WARN",
              detail: `Transaction is ${Math.round(daysDiff)} days old`,
            });
          }
        }
      }
    } catch {
      // Invalid date — non-critical, skip
    }
  }

  // ── 6. Amount Validation ──
  if (amount != null) {
    if (amount < 1) {
      const penalty = -10;
      totalScore += penalty;
      checks.push({
        name: "Suspicious Amount",
        score: penalty,
        status: "WARN",
        detail: `Amount is less than 1 ETB (${amount}) — suspiciously small`,
      });
    }

    if (amount > 500000) {
      const penalty = -5;
      totalScore += penalty;
      checks.push({
        name: "High-Value Transaction",
        score: penalty,
        status: "WARN",
        detail: `Amount exceeds 500,000 ETB (${amount}) — high-value transaction, extra scrutiny recommended`,
      });
    }
  }

  // ── Clamp and Classify ──
  totalScore = Math.max(0, Math.min(100, totalScore));

  let verdict: RiskAssessment["verdict"];
  if (duplicateCheck.isDuplicate) {
    verdict = "REJECTED";
  } else if (totalScore >= 75) {
    verdict = "APPROVED";
  } else if (totalScore >= 40) {
    verdict = "SUSPICIOUS";
  } else {
    verdict = "REJECTED";
  }

  // Build summary
  const passCount = checks.filter((c) => c.status === "PASS").length;
  const failCount = checks.filter((c) => c.status === "FAIL").length;
  const warnCount = checks.filter((c) => c.status === "WARN").length;

  const summary =
    verdict === "APPROVED"
      ? `✅ Receipt passed verification (score: ${totalScore}/100). ${passCount} checks passed, ${warnCount} warnings.`
      : verdict === "SUSPICIOUS"
        ? `⚠️ Receipt needs manual review (score: ${totalScore}/100). ${failCount} checks failed, ${warnCount} warnings.`
        : `❌ Receipt rejected (score: ${totalScore}/100). ${failCount} checks failed. ${
            duplicateCheck.isDuplicate ? "Duplicate receipt detected." : "Likely fraudulent."
          }`;

  logger.info(
    `📊 Risk assessment: ${verdict} (score: ${totalScore}/100, pass: ${passCount}, fail: ${failCount}, warn: ${warnCount})`
  );

  return {
    totalScore,
    verdict,
    checks,
    summary,
  };
}
