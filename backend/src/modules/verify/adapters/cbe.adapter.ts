import { PaymentProviderAdapter, EvidenceInput, NormalizedTransaction } from "../types.js";
import { scrapeReceiptUrl } from "../receipt-scraper.js";

export class CbeProviderAdapter implements PaymentProviderAdapter {
  providerId = "cbe";

  async detectEvidence(input: EvidenceInput): Promise<{ isSupported: boolean; confidence: number }> {
    const text = (input.text || "").toLowerCase();
    const url = (input.url || "").toLowerCase();

    if (url.includes("cbe.com.et") || url.includes("combanketh.et") || url.includes("mbreciept") || url.includes("mreciept")) {
      return { isSupported: true, confidence: 0.95 };
    }
    if (text.includes("commercial bank of ethiopia") || text.includes("cbe birr") || text.includes("banking with cbe") || text.includes("mbreciept")) {
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
    if (targetId.startsWith("v2-")) return `https://mbreciept.cbe.com.et/${targetId}`;
    return `https://mbreciept.cbe.com.et/receipt/${targetId}`;
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
        totalAmount: scraped.totalAmount,
        fee: scraped.fees,
        sender: { name: scraped.senderName, account: scraped.senderAccount },
        receiver: { name: scraped.receiverName, account: scraped.receiverAccount },
        date: scraped.date,
        status: scraped.status,
        paymentMethod: scraped.paymentType || "CBE",
      },
      rawHtml: scraped.rawHtml,
    };
  }

  async parseSMS(text: string): Promise<NormalizedTransaction | null> {
    if (!text || !/cbe/i.test(text)) return null;

    const urlMatch = text.match(/(https?:\/\/m[b]?reciept\.cbe\.com\.et\/[^\s"'<>]+)/i);
    const receiptUrl = urlMatch ? urlMatch[1].replace(/[.,;:!?)]+$/, "") : undefined;
    const tokenMatch = receiptUrl ? (receiptUrl.includes("/v2-") ? "v2-" + receiptUrl.split("/v2-").pop() : receiptUrl.split("/").pop()) : undefined;

    const txMatch = text.match(/\b(FT[A-Z0-9]{8,22})\b/i) || (tokenMatch ? [null, tokenMatch] : null);
    
    // Amount extraction
    const amtMatch = text.match(/transferred\s*(?:ETB|Br\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
      text.match(/(?:ETB|Br\.?)\s*([\d,]+(?:\.\d{1,2})?)/i);

    const totalAmtMatch = text.match(/with\s+total\s+of\s*(?:ETB|Br\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
      text.match(/(?:total amount|total debited)[:\s]*(?:ETB|Br\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i);

    // Fee components: Service charge, VAT, Disaster recovery
    let feeSum = 0;
    const scMatch = text.match(/service\s*charge\s*(?:of)?[:\s]*(?:etb|br\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (scMatch) feeSum += parseFloat(scMatch[1].replace(/,/g, ""));

    const vatMatch = text.match(/vat\s*(?:\(15%\))?\s*(?:of)?[:\s]*(?:etb|br\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (vatMatch) feeSum += parseFloat(vatMatch[1].replace(/,/g, ""));

    const drMatch = text.match(/(?:disaster\s+recovery|drrf)\s*(?:\(5%\))?\s*(?:of)?[:\s]*(?:etb|br\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (drMatch) feeSum += parseFloat(drMatch[1].replace(/,/g, ""));

    const senderMatch = text.match(/Dear\s+([A-Za-z\s.-]+?)\s+You\s+have/i);
    const senderAccMatch = text.match(/from\s+account\s+([A-Za-z0-9*]{4,18})/i);
    const receiverMatch = text.match(/to\s+(?:account\s+)?([A-Za-z0-9*]{4,18})\s*\(([^)]+)\)/i) ||
                          text.match(/for\s+(.+?)\s+with\s+(?:.+?\s+)?account/i);

    let recName = receiverMatch?.[2]?.trim() || receiverMatch?.[1]?.trim();
    let recAcc = receiverMatch?.[2] ? receiverMatch[1] : undefined;

    if (!recName) {
      const fallbackRec = text.match(/(?:to|receiver|payee|beneficiary)[:\s]+([A-Za-z0-9\s.&'-]+?)(?=\s+account|\s*$)/i);
      if (fallbackRec?.[1]) recName = fallbackRec[1].trim();
    }

    return {
      provider: "cbe",
      sourceType: "SMS_TEXT",
      transactionId: txMatch ? txMatch[1] : undefined,
      receiptId: tokenMatch,
      receiptUrl,
      amount: amtMatch ? parseFloat(amtMatch[1].replace(/,/g, "")) : undefined,
      totalAmount: totalAmtMatch ? parseFloat(totalAmtMatch[1].replace(/,/g, "")) : undefined,
      fee: feeSum > 0 ? feeSum : undefined,
      currency: "ETB",
      sender: senderMatch ? { name: senderMatch[1].trim(), account: senderAccMatch ? senderAccMatch[1] : undefined } : undefined,
      receiver: recName ? { name: recName, account: recAcc } : undefined,
      extractionConfidence: 0.95,
    };
  }
}
