import { PaymentProviderAdapter, EvidenceInput, NormalizedTransaction } from "../types.js";
import { scrapeReceiptUrl } from "../receipt-scraper.js";

export class CbeProviderAdapter implements PaymentProviderAdapter {
  providerId = "cbe";

  async detectEvidence(input: EvidenceInput): Promise<{ isSupported: boolean; confidence: number }> {
    const text = (input.text || "").toLowerCase();
    const url = (input.url || "").toLowerCase();

    if (url.includes("cbe.com.et") || url.includes("combanketh.et")) {
      return { isSupported: true, confidence: 0.95 };
    }
    if (text.includes("commercial bank of ethiopia") || text.includes("cbe birr")) {
      return { isSupported: true, confidence: 0.85 };
    }
    return { isSupported: false, confidence: 0 };
  }

  async extractTransaction(input: EvidenceInput): Promise<NormalizedTransaction> {
    return {
      provider: "cbe",
      sourceType: input.type || "UNKNOWN",
      extractionConfidence: 0.8,
    };
  }

  async buildReceiptVerificationUrl(transaction: NormalizedTransaction): Promise<string | null> {
    const targetId = transaction.receiptId || transaction.transactionId;
    if (!targetId) return null;
    if (targetId.startsWith("http://") || targetId.startsWith("https://")) return targetId;
    if (targetId.startsWith("v2-")) return `https://mreciept.cbe.com.et/${targetId}`;
    return `https://mreciept.cbe.com.et/receipt/${targetId}`;
  }

  async verifyOfficialTransaction(transaction: NormalizedTransaction): Promise<{
    verified: boolean;
    data?: Partial<NormalizedTransaction>;
    rawHtml?: string;
    error?: string;
  }> {
    const url = transaction.receiptUrl || (await this.buildReceiptVerificationUrl(transaction));
    if (!url) {
      return { verified: false, error: "No receipt verification URL available for CBE" };
    }

    const inputId = transaction.receiptId || transaction.transactionId || "";
    const scraped = await scrapeReceiptUrl(url, "cbe", inputId);
    if (!scraped || !scraped.isValid) {
      return { verified: false, error: scraped?.error || "CBE official portal lookup failed" };
    }

    return {
      verified: true,
      data: {
        provider: "cbe",
        receiptId: scraped.receiptId || transaction.receiptId,
        transactionId: scraped.transactionId || (transaction.transactionId?.startsWith("FT") ? transaction.transactionId : undefined),
        amount: scraped.amount,
        sender: { name: scraped.senderName, account: scraped.senderAccount },
        receiver: { name: scraped.receiverName, account: scraped.receiverAccount },
        date: scraped.date,
        status: scraped.status,
      },
      rawHtml: scraped.rawHtml,
    };
  }

  async parseSMS(text: string): Promise<NormalizedTransaction | null> {
    if (!text || !/cbe/i.test(text)) return null;
    const amountMatch = text.match(/(?:ETB|Br\.?)\s*([0-9,]+\.?[0-9]*)/i);
    const txMatch = text.match(/(?:tx|id|ref):?\s*([A-Z0-9]+)/i);

    return {
      provider: "cbe",
      sourceType: "SMS_TEXT",
      amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : undefined,
      transactionId: txMatch ? txMatch[1] : undefined,
      extractionConfidence: 0.85,
    };
  }
}
