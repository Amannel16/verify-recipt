import { PaymentProviderAdapter, EvidenceInput, NormalizedTransaction } from "../types.js";
import { scrapeReceiptUrl } from "../receipt-scraper.js";

export class TelebirrProviderAdapter implements PaymentProviderAdapter {
  providerId = "telebirr";

  async detectEvidence(input: EvidenceInput): Promise<{ isSupported: boolean; confidence: number }> {
    const text = (input.text || "").toLowerCase();
    const url = (input.url || "").toLowerCase();

    if (url.includes("ethiotelecom.et") || url.includes("telebirr.et")) {
      return { isSupported: true, confidence: 0.95 };
    }
    if (text.includes("telebirr") || text.includes("ethio telecom")) {
      return { isSupported: true, confidence: 0.85 };
    }
    return { isSupported: false, confidence: 0 };
  }

  async extractTransaction(input: EvidenceInput): Promise<NormalizedTransaction> {
    return {
      provider: "telebirr",
      sourceType: input.type || "UNKNOWN",
      extractionConfidence: 0.8,
    };
  }

  async buildReceiptVerificationUrl(transaction: NormalizedTransaction): Promise<string | null> {
    if (!transaction.transactionId) return null;
    return `https://transactioninfo.ethiotelecom.et/receipt/${transaction.transactionId}`;
  }

  async verifyOfficialTransaction(transaction: NormalizedTransaction): Promise<{
    verified: boolean;
    data?: Partial<NormalizedTransaction>;
    rawHtml?: string;
    error?: string;
  }> {
    const url = transaction.receiptUrl || (await this.buildReceiptVerificationUrl(transaction));
    if (!url) {
      return { verified: false, error: "No receipt verification URL available for Telebirr" };
    }

    const scraped = await scrapeReceiptUrl(url, "telebirr", transaction.transactionId || "");
    if (!scraped || !scraped.isValid) {
      return { verified: false, error: scraped?.error || "Telebirr official portal lookup failed" };
    }

    return {
      verified: true,
      data: {
        provider: "telebirr",
        transactionId: scraped.transactionId,
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
    if (!text || !/telebirr/i.test(text)) return null;
    const amountMatch = text.match(/(?:paid|received|transfer)\s+(?:ETB|Br\.?)\s*([0-9,]+\.?[0-9]*)/i);
    const txMatch = text.match(/(?:transaction id|txid):?\s*([A-Z0-9]+)/i);

    return {
      provider: "telebirr",
      sourceType: "SMS_TEXT",
      amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : undefined,
      transactionId: txMatch ? txMatch[1] : undefined,
      extractionConfidence: 0.85,
    };
  }
}
