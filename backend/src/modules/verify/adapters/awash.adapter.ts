import { PaymentProviderAdapter, EvidenceInput, NormalizedTransaction } from "../types.js";
import { scrapeReceiptUrl } from "../receipt-scraper.js";
import { parseReceiptWithBankRules } from "../bank-rules.js";
import { parseSmsText } from "../sms-parser.js";

export class AwashProviderAdapter implements PaymentProviderAdapter {
  providerId = "awash";

  async detectEvidence(input: EvidenceInput): Promise<{ isSupported: boolean; confidence: number }> {
    const text = (input.text || "").toLowerCase();
    const url = (input.url || "").toLowerCase();

    if (url.includes("awashbank.com") || url.includes("awashpay.awashbank.com")) {
      return { isSupported: true, confidence: 0.95 };
    }
    if (
      text.includes("awash bank") ||
      text.includes("awashbank") ||
      text.includes("awash birr") ||
      text.includes("awashpay") ||
      text.includes("transferred to other bank") ||
      text.includes("ips bank transfer") ||
      text.includes("contact center 8980")
    ) {
      return { isSupported: true, confidence: 0.90 };
    }
    return { isSupported: false, confidence: 0 };
  }

  async extractTransaction(input: EvidenceInput): Promise<NormalizedTransaction> {
    if (input.text) {
      const parsedSms = parseSmsText(input.text);
      if (parsedSms) return parsedSms;

      const parsedRules = parseReceiptWithBankRules(input.text, "awash");
      return {
        provider: "awash",
        sourceType: input.type || "SMS_TEXT",
        transactionId: parsedRules.transactionId ?? undefined,
        amount: parsedRules.amount ?? undefined,
        currency: "ETB",
        sender: parsedRules.senderName ? { name: parsedRules.senderName, account: parsedRules.senderAccount ?? undefined } : undefined,
        receiver: parsedRules.receiverName ? { name: parsedRules.receiverName, account: parsedRules.receiverAccount ?? undefined } : undefined,
        date: parsedRules.date ?? undefined,
        time: parsedRules.time ?? undefined,
        extractionConfidence: parsedRules.confidence / 100,
      };
    }

    return { provider: "awash", sourceType: input.type || "UNKNOWN", extractionConfidence: 0.8 };
  }

  async buildReceiptVerificationUrl(transaction: NormalizedTransaction): Promise<string | null> {
    const id = transaction.transactionId || transaction.receiptId;
    if (!id) return null;
    return `https://awashpay.awashbank.com:8225/${id}`;
  }

  async verifyOfficialTransaction(transaction: NormalizedTransaction): Promise<{
    verified: boolean;
    data?: Partial<NormalizedTransaction>;
    rawHtml?: string;
    error?: string;
  }> {
    const url = transaction.receiptUrl || (await this.buildReceiptVerificationUrl(transaction));
    if (!url) return { verified: false, error: "No receipt URL for Awash" };

    const scraped = await scrapeReceiptUrl(url, "awash", transaction.transactionId || transaction.receiptId || "");
    if (!scraped || !scraped.isValid) return { verified: false, error: scraped?.error || "Awash lookup failed" };

    return {
      verified: true,
      data: {
        provider: "awash",
        transactionId: scraped.transactionId,
        amount: scraped.amount,
        sender: scraped.senderName ? { name: scraped.senderName, account: scraped.senderAccount } : undefined,
        receiver: scraped.receiverName ? { name: scraped.receiverName, account: scraped.receiverAccount } : undefined,
        date: scraped.date,
        status: scraped.status,
      },
      rawHtml: scraped.rawHtml,
    };
  }
}
