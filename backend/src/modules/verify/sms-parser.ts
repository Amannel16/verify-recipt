import { NormalizedTransaction } from "./types.js";
import { providerRegistry } from "./provider-registry.js";
import { logger } from "../../utils/logger/logger.js";

export function parseSmsText(smsText: string): NormalizedTransaction | null {
  if (!smsText || typeof smsText !== "string") return null;

  const text = smsText.trim();
  logger.info(`📱 Parsing SMS text (${text.length} chars)...`);

  // Detect provider from SMS content
  const providers = providerRegistry.getAllProviders();
  let matchedProvider = "unknown";

  for (const provider of providers) {
    if (provider.smsPatterns.some((pattern) => pattern.test(text))) {
      matchedProvider = provider.id;
      break;
    }
  }

  // Common extraction regexes
  const amountMatch = text.match(/(?:ETB|Br\.?|USD)\s*([0-9,]+\.?[0-9]*)/i) ||
                      text.match(/([0-9,]+\.?[0-9]*)\s*(?:ETB|Br\.?|Birr)/i);

  const txIdMatch = text.match(/(?:txid|txn|trans\.?\s*id|id|ref\.?\s*no|ref):?\s*([A-Z0-9]{8,18})/i) ||
                    text.match(/([A-Z0-9]{10,16})/);

  const senderMatch = text.match(/from\s+([A-Za-z\s]+?)(?:\.|\,|$|\s+account|\s+to)/i);
  const receiverMatch = text.match(/to\s+([A-Za-z\s]+?)(?:\.|\,|$|\s+account|\s+for)/i);
  const dateMatch = text.match(/([0-9]{2}\/[0-9]{2}\/[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/);
  const timeMatch = text.match(/([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?\s*(?:AM|PM)?)/i);

  const parsedAmount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : undefined;

  return {
    provider: matchedProvider !== "unknown" ? matchedProvider : undefined,
    sourceType: "SMS_TEXT",
    transactionId: txIdMatch ? txIdMatch[1] : undefined,
    amount: parsedAmount,
    currency: "ETB",
    sender: senderMatch ? { name: senderMatch[1].trim() } : undefined,
    receiver: receiverMatch ? { name: receiverMatch[1].trim() } : undefined,
    date: dateMatch ? dateMatch[1] : undefined,
    time: timeMatch ? timeMatch[1] : undefined,
    extractionConfidence: matchedProvider !== "unknown" ? 0.90 : 0.65,
  };
}
