import { PaymentProviderAdapter, EvidenceInput, NormalizedTransaction } from "../types.js";
import { scrapeReceiptUrl } from "../receipt-scraper.js";

export class MpesaProviderAdapter implements PaymentProviderAdapter {
  providerId = "m-pesa";

  async detectEvidence(input: EvidenceInput): Promise<{ isSupported: boolean; confidence: number }> {
    const text = (input.text || "").toLowerCase();
    const url = (input.url || "").toLowerCase();

    if (url.includes("safaricom.et") || url.includes("mpesa")) return { isSupported: true, confidence: 0.95 };
    if (text.includes("m-pesa") || text.includes("safaricom")) return { isSupported: true, confidence: 0.85 };
    return { isSupported: false, confidence: 0 };
  }

  async extractTransaction(input: EvidenceInput): Promise<NormalizedTransaction> {
    return { provider: "m-pesa", sourceType: input.type || "UNKNOWN", extractionConfidence: 0.8 };
  }

  async buildReceiptVerificationUrl(_transaction: NormalizedTransaction): Promise<string | null> {
    return null;
  }

  async verifyOfficialTransaction(transaction: NormalizedTransaction): Promise<{
    verified: boolean;
    data?: Partial<NormalizedTransaction>;
    rawHtml?: string;
    error?: string;
  }> {
    if (!transaction.receiptUrl) return { verified: false, error: "No receipt URL for M-Pesa" };
    const scraped = await scrapeReceiptUrl(transaction.receiptUrl, "m-pesa", transaction.transactionId || "");
    if (!scraped || !scraped.isValid) return { verified: false, error: scraped?.error || "M-Pesa lookup failed" };

    return {
      verified: true,
      data: {
        provider: "m-pesa",
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
