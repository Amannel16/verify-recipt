import { NormalizedTransaction } from "./types.js";
import { providerRegistry } from "./provider-registry.js";
import { logger } from "../../utils/logger/logger.js";

export function parseUssdText(ussdText: string): NormalizedTransaction | null {
  if (!ussdText || typeof ussdText !== "string") return null;

  const text = ussdText.trim();
  logger.info(`📟 Parsing USSD text (${text.length} chars)...`);

  const providers = providerRegistry.getAllProviders();
  let matchedProvider = "unknown";

  for (const provider of providers) {
    if (provider.ussdPatterns.some((pattern) => pattern.test(text))) {
      matchedProvider = provider.id;
      break;
    }
  }

  const amountMatch = text.match(/(?:ETB|Br\.?)\s*([0-9,]+\.?[0-9]*)/i) ||
                      text.match(/([0-9,]+\.?[0-9]*)\s*(?:ETB|Br\.?)/i);
  const txIdMatch = text.match(/(?:ref|tx|id):?\s*([A-Z0-9]{8,18})/i);
  const receiverMatch = text.match(/to\s+([A-Za-z\s]+)/i);

  const parsedAmount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : undefined;

  return {
    provider: matchedProvider !== "unknown" ? matchedProvider : undefined,
    sourceType: "USSD_SCREENSHOT",
    transactionId: txIdMatch ? txIdMatch[1] : undefined,
    amount: parsedAmount,
    currency: "ETB",
    receiver: receiverMatch ? { name: receiverMatch[1].trim() } : undefined,
    extractionConfidence: matchedProvider !== "unknown" ? 0.85 : 0.60,
  };
}
