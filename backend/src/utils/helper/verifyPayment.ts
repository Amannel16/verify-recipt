import { logger } from "../logger/logger.js";

/**
 * M-Pesa payment verification helper.
 * Verifies a transaction by its ID against the M-Pesa portal.
 */
export interface MpesaVerifyResult {
  isValid: boolean;
  transactionId?: string;
  amount?: number;
  senderName?: string;
  receiverName?: string;
  date?: string;
  status?: string;
  error?: string;
  rawHtml?: string;
}

export async function verifyPayment(transactionId: string): Promise<MpesaVerifyResult> {
  try {
    // M-Pesa Ethiopia verification endpoint
    const url = `https://mpesa.safaricom.et/receipt/${transactionId}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "PayVerify-AI/1.0",
        Accept: "text/html,application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return {
        isValid: false,
        transactionId,
        error: `M-Pesa API responded with status: ${response.status}`,
      };
    }

    const html = await response.text();

    // Try JSON response first
    try {
      const json = JSON.parse(html);
      return {
        isValid: !!json.amount && !!json.status,
        transactionId: json.transactionId || json.reference || transactionId,
        amount: json.amount ? parseFloat(json.amount) : undefined,
        senderName: json.senderName || json.sender,
        receiverName: json.receiverName || json.receiver,
        date: json.date || json.transactionDate,
        status: json.status,
        rawHtml: html.substring(0, 5000),
      };
    } catch {
      // Parse HTML response
    }

    // HTML parsing fallback
    const extractField = (patterns: RegExp[]): string | undefined => {
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) return match[1].trim();
      }
      return undefined;
    };

    const amount = extractField([
      /amount[:\s]*(?:ETB)?\s*([\d,]+\.?\d*)/i,
      /class=["']amount["']>([^<]+)/i,
    ]);

    const sender = extractField([
      /(?:sender|from|payer)[:\s]*([^<\n&]+)/i,
    ]);

    const receiver = extractField([
      /(?:receiver|to|payee|merchant)[:\s]*([^<\n&]+)/i,
    ]);

    const date = extractField([
      /(?:date|time|timestamp)[:\s]*([^<\n&]+)/i,
    ]);

    const statusStr = extractField([
      /(?:status|state)[:\s]*([^<\n&]+)/i,
    ]);

    const isValid = !!amount && html.length > 200;

    return {
      isValid,
      transactionId,
      amount: amount ? parseFloat(amount.replace(/,/g, "")) : undefined,
      senderName: sender,
      receiverName: receiver,
      date,
      status: statusStr || (isValid ? "SUCCESS" : "FAILED"),
      rawHtml: html.substring(0, 5000),
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    logger.error(`M-Pesa verification failed for ${transactionId}: ${msg}`);
    return {
      isValid: false,
      transactionId,
      error: `M-Pesa verification failed: ${msg}`,
    };
  }
}
