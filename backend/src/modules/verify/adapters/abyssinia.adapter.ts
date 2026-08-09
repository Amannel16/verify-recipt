import { PaymentProviderAdapter, EvidenceInput, NormalizedTransaction } from "../types.js";
import { scrapeReceiptUrl } from "../receipt-scraper.js";

export class AbyssiniaProviderAdapter implements PaymentProviderAdapter {
  providerId = "abyssinia";

  async detectEvidence(input: EvidenceInput): Promise<{ isSupported: boolean; confidence: number }> {
    const text = (input.text || "").toLowerCase();
    const url = (input.url || "").toLowerCase();

    if (url.includes("bankofabyssinia.com") || url.includes("boabank.com.et")) {
      return { isSupported: true, confidence: 0.95 };
    }
    if (text.includes("bank of abyssinia") || text.includes("apollo")) {
      return { isSupported: true, confidence: 0.85 };
    }
    return { isSupported: false, confidence: 0 };
  }

  async extractTransaction(input: EvidenceInput): Promise<NormalizedTransaction> {
    return { provider: "abyssinia", sourceType: input.type || "UNKNOWN", extractionConfidence: 0.8 };
  }

  async buildReceiptVerificationUrl(transaction: NormalizedTransaction): Promise<string | null> {
    if (!transaction.transactionId) return null;
    return `https://apollo.bankofabyssinia.com/receipt/${transaction.transactionId}`;
  }

  async verifyOfficialTransaction(transaction: NormalizedTransaction): Promise<{
    verified: boolean;
    data?: Partial<NormalizedTransaction>;
    rawHtml?: string;
    error?: string;
  }> {
    const url = transaction.receiptUrl || (await this.buildReceiptVerificationUrl(transaction));
    if (!url) return { verified: false, error: "No receipt URL for Abyssinia" };

    const scraped = await scrapeReceiptUrl(url, "abyssinia", transaction.transactionId || "");
    if (!scraped || !scraped.isValid) return { verified: false, error: scraped?.error || "Abyssinia lookup failed" };

    return {
      verified: true,
      data: {
        provider: "abyssinia",
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
