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

  async parsePDF(text: string): Promise<NormalizedTransaction | null> {
    if (!text || (!/cbebirr/i.test(text) && !/cbe birr/i.test(text))) return null;

    const amountMatch = text.match(/(?:paid amount|total paid amount|amount paid)[\s:;]*([\d,]+(?:\.\d{1,2})?)/i) ||
      text.match(/(?:amount|transferred amount|total)[^\d\n\r]*([\d,]+(?:\.\d{1,2})?)/i) ||
      text.match(/(?:amount|transferred amount|total)[\s:;]*(?:etb|birr)?[\s:;]*([\d,]+\.\d{2})/i) ||
      text.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:etb|birr)/i);
      
    const txMatch = text.match(/\b(DH[A-Z0-9]{8,15})\b/i) || text.match(/\b(FT[A-Z0-9]{8,22})\b/i) ||
      text.match(/(?:txn id|transaction id|ref no|transaction ref|receipt number|order id)[:\s]*([a-z0-9]+)/i);
      
    const senderMatch = text.match(/debited\s+from\s+([A-Za-z\s.-]+?)\s+for/i) ||
      text.match(/Dear\s+([A-Za-z\s.-]+?),?\s+you\s+have/i) ||
      text.match(/(?:customer name|sender name|payer name)[\s:;]+([A-Za-z0-9\s.*()-]+?)(?:\n|\r|$)/i) ||
      text.match(/(?:sender|payer|from|debit account)[\s:;]+([A-Za-z0-9\s.*()-]+?)(?:\n|\r|$)/i);
      
    const receiverMatch = text.match(/for\s+([A-Za-z\s.-]+?)\s+on\s+\d{1,2}\s+[A-Za-z]{3}/i) ||
      text.match(/to\s+\d{10,16}-([A-Za-z\s.-]+?)\s+on/i) ||
      text.match(/transfer\s+to\s+([A-Za-z\s.-]+?)\s+by/i) ||
      text.match(/(?:receiver name|payee name)[\s:;]+([A-Za-z0-9\s.*()-]+?)(?:\n|\r|$)/i) ||
      text.match(/(?:receiver|payee|to)[\s:;]+([A-Za-z0-9\s.*()-]+?)(?:\n|\r|$)/i) ||
      text.match(/(?:credit account)[\s:;]+([A-Za-z0-9\s.*()-]+?)(?:\n|\r|$)/i);
      
    const dateMatch = text.match(/(?:date|payment date|transaction date)[:\s]*([\d\/\-:\sA-Za-z]+?)(?:\n|\r|$)/i) ||
      text.match(/on\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/i) ||
      text.match(/on\s+(\d{2}-\d{2}-\d{4})/i) ||
      text.match(/(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2})/i);

    return {
      provider: "cbebirr",
      sourceType: "PDF_RECEIPT",
      amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : undefined,
      transactionId: txMatch ? txMatch[1].toUpperCase() : undefined,
      sender: { name: senderMatch ? senderMatch[1].trim() : undefined },
      receiver: { name: receiverMatch ? receiverMatch[1].trim() : undefined },
      date: dateMatch ? dateMatch[1].trim() : undefined,
      extractionConfidence: 0.85,
    };
  }
}
