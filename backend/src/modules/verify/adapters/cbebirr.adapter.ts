import { PaymentProviderAdapter, EvidenceInput, NormalizedTransaction } from "../types.js";
import { scrapeReceiptUrl } from "../receipt-scraper.js";

export class CbebirrProviderAdapter implements PaymentProviderAdapter {
  providerId = "cbebirr";

  async detectEvidence(input: EvidenceInput): Promise<{ isSupported: boolean; confidence: number }> {
    const text = (input.text || "").toLowerCase();
    const url = (input.url || "").toLowerCase();

    if (url.includes("cbepay1.cbe.com.et") || url.includes("cbebirr")) {
      return { isSupported: true, confidence: 0.95 };
    }
    if (text.includes("cbebirr") || text.includes("cbe birr")) {
      return { isSupported: true, confidence: 0.85 };
    }
    return { isSupported: false, confidence: 0 };
  }

  async extractTransaction(input: EvidenceInput): Promise<NormalizedTransaction> {
    return {
      provider: "cbebirr",
      sourceType: input.type || "UNKNOWN",
      extractionConfidence: 0.8,
    };
  }

  async buildReceiptVerificationUrl(transaction: NormalizedTransaction): Promise<string | null> {
    const targetId = transaction.receiptId || transaction.transactionId;
    if (!targetId) return null;
    if (targetId.startsWith("http://") || targetId.startsWith("https://")) return targetId;
    return `https://cbepay1.cbe.com.et/aureceipt?TID=${targetId}`;
  }

  async verifyOfficialTransaction(transaction: NormalizedTransaction): Promise<{
    verified: boolean;
    data?: Partial<NormalizedTransaction>;
    rawHtml?: string;
    error?: string;
  }> {
    const url = transaction.receiptUrl || (await this.buildReceiptVerificationUrl(transaction));
    if (!url) {
      return { verified: false, error: "No receipt verification URL available for CBEBirr" };
    }

    const inputId = transaction.receiptId || transaction.transactionId || "";
    const scraped = await scrapeReceiptUrl(url, "cbebirr", inputId);
    if (!scraped || !scraped.isValid) {
      return { verified: false, error: scraped?.error || "CBEBirr official portal lookup failed" };
    }

    return {
      verified: true,
      data: {
        provider: "cbebirr",
        receiptId: scraped.receiptId || transaction.receiptId,
        transactionId: scraped.transactionId || transaction.transactionId,
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
    if (!text || (!/cbebirr/i.test(text) && !/cbe birr/i.test(text))) return null;

    // Match "transferred 85.00Br. to" or "50.00Br. transfer to MPESA"
    const amountMatch = text.match(/(?:transferred|made)\s+([\d,]+(?:\.\d{1,2})?)\s*(?:Br|ETB|Br\.)/i) ||
                        text.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:Br|ETB|Br\.)\s*transfer/i);
    // Match "Txn ID DH901KUF6VC"
    const txMatch = text.match(/(?:Txn ID|transaction id):?\s*([A-Z0-9]+)/i);

    return {
      provider: "cbebirr",
      sourceType: "SMS_TEXT",
      amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : undefined,
      transactionId: txMatch ? txMatch[1] : undefined,
      extractionConfidence: 0.85,
    };
  }
}
