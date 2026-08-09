import { PaymentProviderAdapter, EvidenceInput, NormalizedTransaction } from "../types.js";
import { scrapeReceiptUrl } from "../receipt-scraper.js";

export class ZemenProviderAdapter implements PaymentProviderAdapter {
  providerId = "zemen";

  async detectEvidence(input: EvidenceInput): Promise<{ isSupported: boolean; confidence: number }> {
    const text = (input.text || "").toLowerCase();
    const url = (input.url || "").toLowerCase();

    if (url.includes("zemenbank.com")) return { isSupported: true, confidence: 0.95 };
    if (text.includes("zemen bank")) return { isSupported: true, confidence: 0.85 };
    return { isSupported: false, confidence: 0 };
  }

  async extractTransaction(input: EvidenceInput): Promise<NormalizedTransaction> {
    return { provider: "zemen", sourceType: input.type || "UNKNOWN", extractionConfidence: 0.8 };
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
    if (!transaction.receiptUrl) return { verified: false, error: "No receipt URL for Zemen Bank" };
    const scraped = await scrapeReceiptUrl(transaction.receiptUrl, "zemen", transaction.transactionId || "");
    if (!scraped || !scraped.isValid) return { verified: false, error: scraped?.error || "Zemen lookup failed" };

    return {
      verified: true,
      data: {
        provider: "zemen",
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
