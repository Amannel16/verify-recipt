import { PaymentProviderAdapter, EvidenceInput, NormalizedTransaction } from "../types.js";
import { scrapeReceiptUrl } from "../receipt-scraper.js";

export class DashenProviderAdapter implements PaymentProviderAdapter {
  providerId = "dashen";

  async detectEvidence(input: EvidenceInput): Promise<{ isSupported: boolean; confidence: number }> {
    const text = (input.text || "").toLowerCase();
    const url = (input.url || "").toLowerCase();

    if (url.includes("dashenbanksc.com") || url.includes("dashenbank.com.et")) {
      return { isSupported: true, confidence: 0.95 };
    }
    if (text.includes("dashen bank") || text.includes("amole")) {
      return { isSupported: true, confidence: 0.85 };
    }
    return { isSupported: false, confidence: 0 };
  }

  async extractTransaction(input: EvidenceInput): Promise<NormalizedTransaction> {
    return { provider: "dashen", sourceType: input.type || "UNKNOWN", extractionConfidence: 0.8 };
  }

  async buildReceiptVerificationUrl(transaction: NormalizedTransaction): Promise<string | null> {
    if (!transaction.transactionId) return null;
    return `https://receipts.dashenbanksc.com/verify/${transaction.transactionId}`;
  }

  async verifyOfficialTransaction(transaction: NormalizedTransaction): Promise<{
    verified: boolean;
    data?: Partial<NormalizedTransaction>;
    rawHtml?: string;
    error?: string;
  }> {
    const url = transaction.receiptUrl || (await this.buildReceiptVerificationUrl(transaction));
    if (!url) return { verified: false, error: "No receipt URL for Dashen" };

    const scraped = await scrapeReceiptUrl(url, "dashen", transaction.transactionId || "");
    if (!scraped || !scraped.isValid) return { verified: false, error: scraped?.error || "Dashen lookup failed" };

    return {
      verified: true,
      data: {
        provider: "dashen",
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
