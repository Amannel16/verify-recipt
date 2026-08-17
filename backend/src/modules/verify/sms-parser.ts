import { NormalizedTransaction } from "./types.js";
import { providerRegistry } from "./provider-registry.js";
import { parseReceiptWithBankRules, detectBankFromText } from "./bank-rules.js";
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

  if (matchedProvider === "unknown") {
    matchedProvider = detectBankFromText(text);
  }

  // Use bank-specific rules engine for rich field extraction
  const parsedRules = parseReceiptWithBankRules(text, matchedProvider !== "unknown" ? matchedProvider : "generic");

  const urlMatch = text.match(/(https?:\/\/[^\s"'<>]+)/i);
  const receiptUrl = urlMatch ? urlMatch[1].replace(/[.,;:!?)]+$/, "") : undefined;

  return {
    provider: matchedProvider !== "unknown" ? matchedProvider : undefined,
    sourceType: "SMS_TEXT",
    transactionId: parsedRules.transactionId ?? undefined,
    receiptUrl: receiptUrl,
    amount: parsedRules.amount ?? undefined,
    totalAmount: parsedRules.totalAmount ?? undefined,
    fee: parsedRules.fees ?? undefined,
    currency: "ETB",
    sender: parsedRules.senderName ? { name: parsedRules.senderName, account: parsedRules.senderAccount ?? undefined } : undefined,
    receiver: parsedRules.receiverName ? { name: parsedRules.receiverName, account: parsedRules.receiverAccount ?? undefined } : undefined,
    date: parsedRules.date ?? undefined,
    time: parsedRules.time ?? undefined,
    extractionConfidence: matchedProvider !== "unknown" ? 0.95 : 0.65,
  };
}
