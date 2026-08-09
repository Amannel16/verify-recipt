import { ProviderFingerprint, ProviderCandidate, EvidenceInput } from "./types.js";
import { providerRegistry } from "./provider-registry.js";
import { logger } from "../../utils/logger/logger.js";

export async function detectProviderFingerprint(
  input: EvidenceInput,
  rawExtractedText?: string,
  url?: string,
): Promise<ProviderFingerprint> {
  const providers = providerRegistry.getAllProviders();
  const candidates: ProviderCandidate[] = [];

  const textToAnalyze = (rawExtractedText || input.text || "").toLowerCase();
  const urlToAnalyze = (url || input.url || "").toLowerCase();

  for (const provider of providers) {
    let score = 0;
    const reasons: string[] = [];

    // 1. URL Signals (Highest Weight: 0.50)
    if (urlToAnalyze) {
      for (const domain of provider.officialDomains) {
        if (urlToAnalyze.includes(domain.toLowerCase())) {
          score += 0.50;
          reasons.push(`URL matches official domain: ${domain}`);
          break;
        }
      }
    }

    // 2. Text/Keyword Signals (Weight: 0.35)
    for (const alias of provider.aliases) {
      if (textToAnalyze.includes(alias.toLowerCase())) {
        score += 0.35;
        reasons.push(`Text contains provider alias: "${alias}"`);
        break;
      }
    }

    // 3. Transaction ID Format Signals (Weight: 0.15)
    if (input.transactionId || rawExtractedText) {
      const searchTarget = input.transactionId || rawExtractedText || "";
      for (const pattern of provider.txIdPatterns) {
        if (pattern.test(searchTarget)) {
          score += 0.15;
          reasons.push(`Transaction ID matches provider pattern ${pattern}`);
          break;
        }
      }
    }

    // 4. SMS Signal (Weight: 0.25)
    if (input.type === "SMS_TEXT" || input.type === "SMS_SCREENSHOT") {
      for (const smsPattern of provider.smsPatterns) {
        if (smsPattern.test(textToAnalyze)) {
          score += 0.25;
          reasons.push(`SMS text matches provider template`);
          break;
        }
      }
    }

    // 5. USSD Signal (Weight: 0.20)
    if (input.type === "USSD_SCREENSHOT") {
      for (const ussdPattern of provider.ussdPatterns) {
        if (ussdPattern.test(textToAnalyze)) {
          score += 0.20;
          reasons.push(`USSD text matches provider pattern`);
          break;
        }
      }
    }

    // Clamp score to [0, 1]
    const finalScore = Math.min(1.0, score);
    if (finalScore > 0) {
      candidates.push({
        provider: provider.id,
        confidence: Math.round(finalScore * 100) / 100,
        reasons,
      });
    }
  }

  // Sort candidates by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);

  const topProvider = candidates.length > 0 ? candidates[0].provider : null;
  const topConfidence = candidates.length > 0 ? candidates[0].confidence : 0;

  logger.info(`🔍 Provider Fingerprint Detection: topProvider=${topProvider} (${Math.round(topConfidence * 100)}%)`);

  return {
    candidates,
    topProvider,
    topConfidence,
  };
}
