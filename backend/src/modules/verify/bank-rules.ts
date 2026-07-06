import { logger } from "../../utils/logger/logger.js";

export interface ExtractedFields {
  transactionId: string | null;
  transferReference: string | null;
  senderName: string | null;
  senderAccount: string | null;
  receiverName: string | null;
  receiverAccount: string | null;
  amount: number | null;
  fees: number | null;
  totalAmount: number | null;
  date: string | null;
  time: string | null;
  paymentMethod: string;
  confidence: number; // score 0-100 based on extracted critical fields
}

export interface BankTemplate {
  provider: string;
  displayName: string;
  keywords: string[];
}

const BANK_TEMPLATES: BankTemplate[] = [
  {
    provider: "cbe",
    displayName: "CBE",
    keywords: ["commercial bank of ethiopia", "cbe", "cbebirr", "cbe birr", "cbe mobile", "combanketh"]
  },
  {
    provider: "telebirr",
    displayName: "telebirr",
    keywords: ["telebirr", "ethio telecom", "transaction info", "ethiotelecom"]
  },
  {
    provider: "dashen",
    displayName: "Dashen Bank",
    keywords: ["dashen", "dashen bank", "amole", "ipss", "dashen bank super app"]
  },
  {
    provider: "abyssinia",
    displayName: "Bank of Abyssinia",
    keywords: ["abyssinia", "bank of abyssinia", "boa", "apollo"]
  },
  {
    provider: "awash",
    displayName: "Awash Bank",
    keywords: ["awash bank", "awash"]
  },
  {
    provider: "zemen",
    displayName: "Zemen Bank",
    keywords: ["zemen bank", "zemen"]
  },
  {
    provider: "m-pesa",
    displayName: "M-Pesa",
    keywords: ["m-pesa", "safaricom", "mpesa"]
  }
];

/**
 * Normalizes text extracted from names (removing common prefix noise/labels).
 */
export function cleanName(val: string): string {
  return val
    .replace(/[^a-zA-Z\s.-]/g, "") // Keep only letters, spaces, dots, dashes
    .replace(/\b(?:account|no|number|date|time|ref|txn|method|status|success|fee|birr|etb|to|from|by|payer|receiver|payee|credited|party|beneficiary|holder|transferred|amount)\b.*/gi, "") // Chop off trailing keywords
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detects which bank provider the receipt belongs to based on keywords and signature layouts.
 */
export function detectBankFromText(text: string): string {
  if (!text) return "generic";
  const lowerText = text.toLowerCase();
  
  // 1. Telebirr special signature layout (e.g. Zemen Gebeya screenshot layout)
  if (
    lowerText.includes("telebirr") || 
    (lowerText.includes("transaction number") && lowerText.includes("transaction to") && lowerText.includes("transaction time"))
  ) {
    logger.info("🏦 Detected bank provider: telebirr (via signature layout)");
    return "telebirr";
  }

  // 2. Commercial Bank of Ethiopia (CBE) special signatures
  if (
    lowerText.includes("commercial bank of ethiopia") || 
    lowerText.includes("cbe") || 
    lowerText.includes("cbebirr") ||
    lowerText.includes("combanketh") ||
    (lowerText.includes("debited from") && lowerText.includes("for")) ||
    /\bFT[A-Z0-9]{10,22}\b/i.test(text)
  ) {
    logger.info("🏦 Detected bank provider: CBE (via signature layout)");
    return "cbe";
  }
  
  // 3. General templates
  for (const template of BANK_TEMPLATES) {
    if (template.provider === "cbe" || template.provider === "telebirr") continue;

    for (const keyword of template.keywords) {
      if (lowerText.includes(keyword)) {
        logger.info(`🏦 Detected bank provider: ${template.displayName} (matched keyword: "${keyword}")`);
        return template.provider;
      }
    }
  }
  
  logger.info("🏦 No specific bank keyword match. Defaulting to generic parser.");
  return "generic";
}

/**
 * Parses raw text using bank-specific regex patterns.
 */
export function parseReceiptWithBankRules(text: string, provider: string): ExtractedFields {
  const fields: ExtractedFields = {
    transactionId: null,
    transferReference: null,
    senderName: null,
    senderAccount: null,
    receiverName: null,
    receiverAccount: null,
    amount: null,
    totalAmount: null,
    fees: null,
    date: null,
    time: null,
    paymentMethod: "unknown",
    confidence: 0
  };

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const lowerText = text.toLowerCase();

  // Standard date/time parsers
  const dateMatch = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dateMatch) {
    fields.date = dateMatch[0];
  } else {
    // Text-based dates like "Jun 29, 2026" or "Jun 15, 2026"
    const textDateMatch = text.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s*(\d{4})/i);
    if (textDateMatch) fields.date = textDateMatch[0];
  }

  const timeMatch = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (timeMatch) fields.time = timeMatch[0];

  // Map display names
  const template = BANK_TEMPLATES.find(t => t.provider === provider);
  fields.paymentMethod = template ? template.displayName : "Other Bank";

  // Collect candidate accounts and holder names
  const accountHolders: string[] = [];
  const accounts: string[] = [];

  for (const line of lines) {
    const holderMatch = line.match(/(?:account holder name|holder name|customer name)[:\s]+(.+)/i);
    if (holderMatch?.[1]) {
      const name = cleanName(holderMatch[1]);
      if (name.length > 2) accountHolders.push(name);
    }
    
    // Look for account numbers: 10-16 digits or masked accounts
    const accMatch = line.match(/\b(\d{1,4}\**\d{3,12}|\d{10,16})\b/);
    if (accMatch) {
      accounts.push(accMatch[1]);
    }
  }

  // --- BANK SPECIFIC REGEX PARSING TIER ---
  if (provider === "cbe") {
    // 1. CBE (Commercial Bank of Ethiopia)
    const txMatch = text.match(/\b(FT[A-Z0-9]{8,22})\b/i);
    if (txMatch) fields.transactionId = txMatch[1].toUpperCase();

    // Base Amount parsing
    const debitedMatch = text.match(/(?:etb|birr)\s*([\d,]+(?:\.\d{1,2})?)\s+has\s+been\s+debited/i);
    const smsMatch = text.match(/transferred\s+to\s+other\s+bank\s+(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const amtMatch = text.match(/(?:transferred amount|amount|total paid|paid)[:\s]*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i)
      || text.match(/(?:etb|birr)\s*([\d,]+(?:\.\d{1,2})?)/i);

    if (debitedMatch) {
      fields.amount = parseFloat(debitedMatch[1].replace(/,/g, ""));
    } else if (smsMatch) {
      fields.amount = parseFloat(smsMatch[1].replace(/,/g, ""));
    } else if (amtMatch) {
      fields.amount = parseFloat(amtMatch[1].replace(/,/g, ""));
    }

    // Total Amount parsing
    const totalMatch = text.match(/(?:total amount debited|total amount|total debited)[:\s]*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (totalMatch) fields.totalAmount = parseFloat(totalMatch[1].replace(/,/g, ""));

    // Service Charge (Fees) parsing
    const feeMatch = text.match(/(?:service charge|fee|charge)[:\s]*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (feeMatch) fields.fees = parseFloat(feeMatch[1].replace(/,/g, ""));

    // Names parsing
    const sentenceMatch = text.match(/debited\s+from\s+([A-Za-z\s.-]+?)(?:\s+etb-\d+|\s+account)?\s+for\s+([A-Za-z\s.-]+?)(?:\s+etb-\d+|\s+account)?\s+(?:on|with)/i);
    const smsReceiverMatch = text.match(/to\s+\d{8,16}\s*\(([^)]+)\)/i);
    const senderMatch = text.match(/(?:from|sender|payer|debited from|source name)[:\s]+([A-Za-z\s.-]+)/i);
    const receiverMatch = text.match(/(?:to|receiver|payee|beneficiary|credited party)[:\s]+([A-Za-z\s.-]+)/i);

    if (sentenceMatch) {
      fields.senderName = cleanName(sentenceMatch[1]);
      fields.receiverName = cleanName(sentenceMatch[2]);
    } else {
      if (senderMatch?.[1]) fields.senderName = cleanName(senderMatch[1]);
      if (receiverMatch?.[1]) fields.receiverName = cleanName(receiverMatch[1]);
    }

    if (smsReceiverMatch?.[1] && !fields.receiverName) {
      fields.receiverName = cleanName(smsReceiverMatch[1]);
    }

  } else if (provider === "telebirr") {
    // 2. telebirr
    const txMatch = text.match(/\b(TX[A-Z0-9]{8,15})\b/i) 
      || text.match(/(?:transaction number|transaction no|txn ref|ref no|txn id)[:\s]*([A-Z0-9]{8,18})/i);
    if (txMatch) fields.transactionId = (txMatch[1] || txMatch[0]).toUpperCase();

    const signMatch = text.match(/(?:-|\+)?\s*([\d,]+\.\d{2})\s*\(?etb\)?/i);
    const amtMatch = text.match(/(?:total paid amount|amount|paid amount|net amount)[:\s]*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    
    if (signMatch) {
      fields.amount = parseFloat(signMatch[1].replace(/,/g, ""));
    } else if (amtMatch) {
      fields.amount = parseFloat(amtMatch[1].replace(/,/g, ""));
    }

    const toMatch = text.match(/(?:transaction to|credited party name|to|receiver|payee)[:\s]+([A-Za-z\s.-]+)/i);
    if (toMatch?.[1]) fields.receiverName = cleanName(toMatch[1]);

    const senderMatch = text.match(/(?:payer name|from|sender)[:\s]+([A-Za-z\s.-]+)/i);
    if (senderMatch?.[1]) fields.senderName = cleanName(senderMatch[1]);

  } else if (provider === "dashen") {
    // 3. Dashen Bank (Amole / IPSS / new confirmation screens)
    // Run robust line-substring parsing loop
    for (const line of lines) {
      const lowerLine = line.toLowerCase();

      // Sender Name extraction
      if (lowerLine.includes("sender name")) {
        const val = line.substring(lowerLine.indexOf("sender name") + 11)
          .replace(/^[：:;\-.\s|Il1!+=]+/g, "").trim();
        if (val) fields.senderName = cleanName(val);
      }

      // Recipient / Receiver Name extraction
      if (lowerLine.includes("recipient name") || lowerLine.includes("receiver name") || lowerLine.includes("recipient's name")) {
        const idx = lowerLine.includes("recipient's name") ? lowerLine.indexOf("recipient's name") + 16 :
                    (lowerLine.includes("recipient name") ? lowerLine.indexOf("recipient name") + 14 : lowerLine.indexOf("receiver name") + 13);
        const val = line.substring(idx).replace(/^[：:;\-.\s|Il1!+=]+/g, "").trim();
        if (val) fields.receiverName = cleanName(val);
      }

      // Sender Account
      if (lowerLine.includes("sender account") || lowerLine.includes("sender acc")) {
        const idx = lowerLine.includes("sender account") ? lowerLine.indexOf("sender account") + 14 : lowerLine.indexOf("sender acc") + 10;
        const val = line.substring(idx).replace(/^[：:;\-.\s|Il1!+=]+/g, "").replace(/\s+/g, "").trim();
        if (val) fields.senderAccount = val;
      }

      // Recipient Account
      if (lowerLine.includes("recipient account") || lowerLine.includes("recipient acc") || lowerLine.includes("recipient acct") || lowerLine.includes("receiver account") || lowerLine.includes("receiver acc")) {
        const idx = lowerLine.includes("recipient account") ? lowerLine.indexOf("recipient account") + 17 :
                    lowerLine.includes("recipient acc") ? lowerLine.indexOf("recipient acc") + 13 :
                    lowerLine.includes("recipient acct") ? lowerLine.indexOf("recipient acct") + 14 :
                    lowerLine.includes("receiver account") ? lowerLine.indexOf("receiver account") + 16 :
                    lowerLine.indexOf("receiver acc") + 12;
        const val = line.substring(idx).replace(/^[：:;\-.\s|Il1!+=]+/g, "").replace(/\s+/g, "").trim();
        if (val) fields.receiverAccount = val;
      }

      // FT Ref (Transaction Reference 1)
      if (lowerLine.includes("ft ref") || lowerLine.includes("ref no")) {
        const idx = lowerLine.includes("ft ref") ? lowerLine.indexOf("ft ref") + 6 : lowerLine.indexOf("ref no") + 6;
        const val = line.substring(idx).replace(/^[：:;\-.\s|Il1!+=]+/g, "").replace(/\s+/g, "").trim();
        if (val && val.length > 5) {
          fields.transactionId = val.toUpperCase();
          fields.transferReference = val.toUpperCase();
        }
      }

      // Transaction Ref (Transaction Reference 2)
      if (lowerLine.includes("transaction ref") || lowerLine.includes("transaction reference") || lowerLine.includes("txn ref")) {
        const idx = lowerLine.includes("transaction reference") ? lowerLine.indexOf("transaction reference") + 21 :
                    lowerLine.includes("transaction ref") ? lowerLine.indexOf("transaction ref") + 15 :
                    lowerLine.indexOf("txn ref") + 7;
        const val = line.substring(idx).replace(/^[：:;\-.\s|Il1!+=]+/g, "").replace(/\s+/g, "").trim();
        if (val && val.length > 5) {
          fields.transactionId = val.toUpperCase();
          if (!fields.transferReference) fields.transferReference = val.toUpperCase();
        }
      }

      // Service Charge
      if (lowerLine.includes("service-charge") || lowerLine.includes("service charge")) {
        const idx = lowerLine.includes("service-charge") ? lowerLine.indexOf("service-charge") + 14 : lowerLine.indexOf("service charge") + 14;
        const val = line.substring(idx).replace(/^[：:;\-.\s|Il1!+=]+/g, "").trim();
        const numMatch = val.match(/^([\d,]+(?:\.\d{1,2})?)/);
        if (numMatch) {
          fields.fees = parseFloat(numMatch[1].replace(/,/g, ""));
        }
      }
    }

    // If Transaction ID not found in line-substring loop, use regex backup
    if (!fields.transactionId) {
      const txMatch = text.match(/\b(IPSS[A-Z0-9]{8,26})\b/i) 
        || text.match(/\b(\d{2,4}IPSS[A-Z0-9]{8,26})\b/i);
      if (txMatch) {
        fields.transactionId = txMatch[0].toUpperCase();
        fields.transferReference = txMatch[0].toUpperCase();
      }
    }

    // Amount: e.g. "2,000.00 (ETB)" or "amount: 250.00"
    const signMatch = text.match(/(?:-|\+)?\s*([\d,]+\.\d{2})\s*\(?etb\)?/i);
    const amtMatch = text.match(/(?:transaction amount|amount|total)[:\s]*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    
    if (signMatch) {
      fields.amount = parseFloat(signMatch[1].replace(/,/g, ""));
    } else if (amtMatch) {
      fields.amount = parseFloat(amtMatch[1].replace(/,/g, ""));
    }

  } else if (provider === "abyssinia") {
    // 4. Bank of Abyssinia
    const txMatch = text.match(/(?:transaction reference|ref no|txn ref)[:\s]*([A-Z0-9]{8,22})/i)
      || text.match(/\b(FT[A-Z0-9]{8,20})\b/i);
    if (txMatch) fields.transactionId = txMatch[1].toUpperCase();

    const amtMatch = text.match(/(?:transferred amount|amount|total)[:\s]*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (amtMatch) fields.amount = parseFloat(amtMatch[1].replace(/,/g, ""));

    const senderMatch = text.match(/(?:source account name|sender|from)[:\s]+([A-Za-z\s.-]+)/i);
    if (senderMatch?.[1]) fields.senderName = cleanName(senderMatch[1]);

    const receiverMatch = text.match(/(?:receiver name|receiver's name|to|payee)[:\s]+([A-Za-z\s.-]+)/i);
    if (receiverMatch?.[1]) fields.receiverName = cleanName(receiverMatch[1]);

  } else {
    // 5. Generic / Fallback Parser
    const txMatch = text.match(/\b(FT\d{10,20})\b/i)
      || text.match(/\b(TX[A-Z0-9]{8,15})\b/i)
      || text.match(/\b(IPSS[A-Z0-9]{8,15})\b/i)
      || text.match(/(?:txn ref|reference no|transaction id|ref no|transaction ref)[:\s]*([A-Z0-9_-]{8,24})/i);
    if (txMatch) fields.transactionId = (txMatch[1] || txMatch[0]).toUpperCase();

    const amtMatch = text.match(/(?:transferred amount|transaction amount|total paid|amount|total amount|sum|total|net amount|paid)[:\s]*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i)
      || text.match(/(?:etb|birr)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (amtMatch) fields.amount = parseFloat(amtMatch[1].replace(/,/g, ""));

    const senderMatch = text.match(/(?:from|sender|payer|source name|paid by|source|payer name|transfer from|debited from)[:\s]+([A-Za-z\s.-]+)/i);
    if (senderMatch?.[1]) fields.senderName = cleanName(senderMatch[1]);

    const receiverMatch = text.match(/(?:to|receiver|payee|beneficiary|credited party|beneficiary name|paid to|transfer to|receiver's name)[:\s]+([A-Za-z\s.-]+)/i);
    if (receiverMatch?.[1]) fields.receiverName = cleanName(receiverMatch[1]);
  }

  // Backup names and account numbers from candidate lists
  if (!fields.senderName && accountHolders.length > 0) {
    fields.senderName = accountHolders[0];
  }
  if (!fields.receiverName && accountHolders.length > 1) {
    fields.receiverName = accountHolders[1];
  }

  if (accounts.length > 0 && !fields.senderAccount) fields.senderAccount = accounts[0];
  if (accounts.length > 1 && !fields.receiverAccount) fields.receiverAccount = accounts[1];

  if (fields.amount != null && fields.totalAmount == null) {
    fields.totalAmount = fields.amount + (fields.fees ?? 0);
  }

  // --- CONFIDENCE SCORING ENGINE ---
  let score = 0;
  if (fields.transactionId) score += 40;
  if (fields.amount) score += 30;
  if (fields.senderName) score += 15;
  if (fields.receiverName) score += 15;

  fields.confidence = score;

  logger.info(`📊 Rules-based extraction complete for ${provider}. Confidence: ${fields.confidence}% (TxId: ${fields.transactionId}, Amount: ${fields.amount})`);

  return fields;
}
