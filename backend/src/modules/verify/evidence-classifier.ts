import { EvidenceInput, EvidenceType } from "./types.js";
import { logger } from "../../utils/logger/logger.js";

export function classifyEvidence(input: EvidenceInput): EvidenceType {
  // 1. Explicitly provided type takes precedence
  if (input.type && input.type !== "UNKNOWN") {
    return input.type;
  }

  // 2. URL inputs
  if (input.url || (input.text && /^https?:\/\//i.test(input.text.trim()))) {
    if (/qr/i.test(input.url || input.text || "")) {
      return "QR_CODE";
    }
    return "RECEIPT_URL";
  }

  // 3. Raw SMS text detection
  if (input.text) {
    const text = input.text.trim();
    const smsKeywords = [
      /paid\s+etb/i,
      /received\s+etb/i,
      /credited\s+to/i,
      /debited\s+from/i,
      /m-pesa/i,
      /telebirr transfer/i,
      /cbe birr/i,
    ];
    if (smsKeywords.some((regex) => regex.test(text))) {
      return "SMS_TEXT";
    }

    // USSD text detection
    if (/\*847\#|\*127\#|\*996\#|\*815\#|\*901\#|\*733\#/i.test(text) || /ussd/i.test(text)) {
      return "USSD_SCREENSHOT";
    }

    // Raw Transaction ID or Reference Number
    if (/^[A-Z0-9]{8,18}$/i.test(text)) {
      return "TRANSACTION_ID";
    }
  }

  // 4. File MIME type inspection
  if (input.mimeType) {
    if (input.mimeType.includes("pdf")) {
      return "PDF_RECEIPT";
    }
  }

  if (input.filePath) {
    if (/\.pdf$/i.test(input.filePath)) {
      return "PDF_RECEIPT";
    }
  }

  // 5. Default fallback to screenshot / photo
  const defaultType: EvidenceType = "MOBILE_BANKING_SCREENSHOT";
  logger.info(`🏷️ Auto-classified evidence input as: ${defaultType}`);
  return defaultType;
}
