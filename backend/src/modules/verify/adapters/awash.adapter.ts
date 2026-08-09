import { PaymentProviderAdapter, EvidenceInput, NormalizedTransaction } from "../types.js";
import { scrapeReceiptUrl } from "../receipt-scraper.js";

export class AwashProviderAdapter implements PaymentProviderAdapter {
  providerId = "awash";

  async detectEvidence(input: EvidenceInput): Promise<{ isSupported: boolean; confidence: number }> {
    const text = (input.text || "").toLowerCase();
    const url = (input.url || "").toLowerCase();

    if (url.includes("awashbank.com") || url.includes("awashpay.awashbank.com")) {
      return { isSupported: true, confidence: 0.95 };
    }
    if (text.includes("awash bank") || text.includes("awash birr")) {
      return { isSupported: true, confidence: 0.85 };
    }
    return { isSupported: false, confidence: 0 };
  }

  async extractTransaction(input: EvidenceInput): Promise<NormalizedTransaction> {
    return { provider: "awash", sourceType: input.type || "UNKNOWN", extractionConfidence: 0.8 };
  }

  async buildReceiptVerificationUrl(transaction: NormalizedTransaction): Promise<string | null> {
    if (!transaction.transactionId) return null;
    return `https://awashpay.awashbank.com/verify/${transaction.transactionId}`;
  }

  async verifyOfficialTransaction(transaction: NormalizedTransaction): Promise<{
    verified: boolean;
    data?: Partial<NormalizedTransaction>;
    rawHtml?: string;
    error?: string;
  }> {
    const url = transaction.receiptUrl || (await this.buildReceiptVerificationUrl(transaction));
    if (!url) return { verified: false, error: "No receipt URL for Awash" };

    const scraped = await scrapeReceiptUrl(url, "awash", transaction.transactionId || "");
    if (!scraped || !scraped.isValid) return { verified: false, error: scraped?.error || "Awash lookup failed" };

    return {
      verified: true,
      data: {
        provider: "awash",
        transactionId: scraped.transactionId,
        amount: scraped.amount,
        sender: { name: scraped.senderName },
        receiver: { name: scraped.receiverName },
        date: scraped.date,
        status: scraped.status,
      },
      rawHtml: scraped.rawHtml,
    };
  }
}
