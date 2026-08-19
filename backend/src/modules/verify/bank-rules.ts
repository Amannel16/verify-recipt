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
    keywords: ["commercial bank of ethiopia", "cbe", "combanketh"]
  },
  {
    provider: "cbebirr",
    displayName: "CBEBirr",
    keywords: ["cbebirr", "cbe birr", "cbepay1.cbe.com.et"]
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
  if (!val) return "";
  let s = val
    .replace(/\s*[-_]?ETB[-_]?\s*/gi, " ")
    .replace(/\s*[-_]?Birr[-_]?\s*/gi, " ")
    .replace(/[^a-zA-Z0-9\s.&'-]/g, " ")
    .replace(/(?:\s+|\s*:\s*)(?:Account|No|Number|Date|Time|Ref|Txn|Method|Status|Success|Fee|Birr|ETB|Payer|Receiver|Payee|Amount)\s*:.*/gi, "")
    .replace(/\s+(?:Account|Date|Time|Ref|Txn|Status|Fee|Birr|ETB)$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

/**
 * Detects which bank provider the receipt belongs to based on keywords and signature layouts.
 */
/**
 * Detects which bank provider the receipt belongs to based on keywords and signature layouts.
 */
export function detectBankFromText(text: string): string {
  if (!text) return "generic";
  const lowerText = text.toLowerCase();
  
  // 1. Dashen Bank (has priority because it can be used for Telebirr/CBE transfers)
  if (
    lowerText.includes("dashen bank") ||
    lowerText.includes("db superapp") ||
    lowerText.includes("dashen super app") ||
    lowerText.includes("receipts.dashenbanksc.com") ||
    lowerText.includes("dashen") ||
    lowerText.includes("amole") ||
    lowerText.includes("ipss")
  ) {
    logger.info("🏦 Detected bank provider: Dashen Bank (via signature layout)");
    return "dashen";
  }

  // 1.5. CBEBirr special signatures or SMS
  if (
    lowerText.includes("awash bank") ||
    lowerText.includes("awashbank") ||
    lowerText.includes("awash birr") ||
    lowerText.includes("awashpay") ||
    lowerText.includes("awashpay.awashbank.com") ||
    lowerText.includes("ib.awashbank.com") ||
    lowerText.includes("transferred to other bank") ||
    (lowerText.includes("transferred to") && lowerText.includes("commercial bank of ethiopia"))
  ) {
    logger.info("🏦 Detected bank provider: Awash Bank (via signature layout)");
    return "awash";
  }
  
  // 6. General templates
  for (const template of BANK_TEMPLATES) {
    if (template.provider === "cbe" || template.provider === "telebirr" || template.provider === "dashen" || template.provider === "m-pesa" || template.provider === "awash") continue;

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
  const dateMatch = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (dateMatch) {
    fields.date = dateMatch[0];
  } else {
    // ISO date format YYYY-MM-DD
    const isoDateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoDateMatch) {
      fields.date = isoDateMatch[0];
    } else {
      // Text-based dates like "Jun 29, 2026" or "Jun 15, 2026"
      const textDateMatch = text.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s*(\d{4})/i);
      if (textDateMatch) fields.date = textDateMatch[0];
    }
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
  if (provider === "cbebirr") {
    // 0. CBEBirr
    const txMatch = text.match(/\b(DH[A-Z0-9]{8,15})\b/i) || text.match(/\b(FT[A-Z0-9]{8,22})\b/i) ||
      text.match(/(?:txn id|transaction id|ref no|transaction ref|receipt number|order id)[:\s]*([a-z0-9]+)/i);
    if (txMatch) fields.transactionId = txMatch[1].toUpperCase();

    const amtMatch = text.match(/(?:etb|birr)\s*([\d,]+(?:\.\d{1,2})?)\s+debited/i) ||
      text.match(/transferred\s+([\d,]+(?:\.\d{1,2})?)\s*(?:br|etb|birr)/i) ||
      text.match(/made\s+([\d,]+(?:\.\d{1,2})?)\s*(?:br|etb|birr)\.?\s*transfer/i) ||
      text.match(/(?:paid amount|total paid amount|amount paid)[\s:;]*([\d,]+(?:\.\d{1,2})?)/i) ||
      text.match(/(?:amount|transferred amount|total)[^\d\n\r]*([\d,]+(?:\.\d{1,2})?)/i) ||
      text.match(/(?:amount|transferred amount|total)[\s:;]*(?:etb|birr)?[\s:;]*([\d,]+\.\d{2})/i) ||
      text.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:etb|birr)/i);
    if (amtMatch) fields.amount = parseFloat(amtMatch[1].replace(/,/g, ""));

    const senderMatch = text.match(/debited\s+from\s+([A-Za-z\s.-]+?)\s+for/i) ||
      text.match(/Dear\s+([A-Za-z\s.-]+?),?\s+you\s+have/i) ||
      text.match(/(?:sender|payer|customer name|from|debit account)[\s:;]+([A-Za-z0-9\s.*()-]+?)(?:\n|\r|$)/i);
    if (senderMatch) fields.senderName = cleanName(senderMatch[1]);

    const receiverMatch = text.match(/for\s+([A-Za-z\s.-]+?)\s+on\s+\d{1,2}\s+[A-Za-z]{3}/i) ||
      text.match(/to\s+\d{10,16}-([A-Za-z\s.-]+?)\s+on/i) ||
      text.match(/transfer\s+to\s+([A-Za-z\s.-]+?)\s+by/i) ||
      text.match(/(?:receiver|payee|to|receiver name|credit account)[\s:;]+([A-Za-z0-9\s.*()-]+?)(?:\n|\r|$)/i);
    if (receiverMatch) fields.receiverName = cleanName(receiverMatch[1]);

    const dateMatch = text.match(/on\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/i) ||
      text.match(/on\s+(\d{2}-\d{2}-\d{4})/i);
    if (dateMatch) {
       fields.date = dateMatch[1];
    }
  } else if (provider === "cbe") {
    // 1. Commercial Bank of Ethiopia (CBE) - Dual Receipt Type Support (SMS & App Screenshot)

    // Transaction ID & Receipt Token
    const txMatch = text.match(/\b(FT[A-Z0-9]{8,22})\b/i) ||
      text.match(/(?:with\s+Transaction\s+ID|Transaction\s+ID|Txn\s+ID|Ref)[:\s]*([A-Z0-9]{8,22})/i) ||
      text.match(/m[b]?reciept\.cbe\.com\.et\/(v2-[A-Za-z0-9_-]+)/i) ||
      text.match(/m[b]?receipt\.cbe\.com\.et\/(v2-[A-Za-z0-9_-]+)/i);

    if (txMatch) {
      const rawTx = txMatch[1].trim();
      fields.transactionId = rawTx.startsWith("v2-") ? rawTx : rawTx.toUpperCase();
      if (!rawTx.startsWith("v2-")) {
        fields.transferReference = fields.transactionId;
      }
    }

    // --- STRUCTURAL PATTERN MATCH 1: CBE Mobile App Transaction Summary Screen (Image 2) ---
    // "You have sucessfully transferred 300 ETB from your account 1********8096 Amanuel Andemo Angello for KALEAB MEBRATU HAILESELASSIE with Dashen Bank account number 5********6011 ."
    const appSummaryMatch = text.match(
      /transferred\s*([\d,]+(?:\.\d{1,2})?)\s*(?:ETB|Birr|Br\.?)?\s+from\s+(?:your\s+)?account\s+([0-9*]{8,18})\s+(.+?)\s+for\s+(.+?)\s+with\s+(.+?)\s+account\s+(?:number\s+)?([0-9*]{8,18})/i
    );

    if (appSummaryMatch) {
      fields.amount = parseFloat(appSummaryMatch[1].replace(/,/g, ""));
      fields.senderAccount = appSummaryMatch[2];
      fields.senderName = cleanName(appSummaryMatch[3]);
      fields.receiverName = cleanName(appSummaryMatch[4]);
      if (appSummaryMatch[6]) {
        fields.receiverAccount = appSummaryMatch[6];
      }
    }

    // --- STRUCTURAL PATTERN MATCH 1B: CBE Mobile App Wallet / M-Pesa Transfer ---
    // "You have successfully transferred 100 ETB from Amanuel Andemo Angello-ETB-1********8096 for Amanuel Andemo Angello's M-pessa wallet on Aug 16, 2026 01:39 PM with Transaction ID: FT262285PFLC."
    const appWalletMatch = text.match(
      /transferred\s*([\d,]+(?:\.\d{1,2})?)\s*(?:ETB|Birr|Br\.?)?\s+from\s+([A-Za-z\s.-]+?)(?:-ETB-|-Birr-|-ETB\b|-account\s*|\s+account\s*)([A-Za-z0-9*]{4,18})\s+for\s+(.+?)(?=\s+on|\s+with|\s*$)/i
    );

    if (appWalletMatch) {
      if (!fields.amount) fields.amount = parseFloat(appWalletMatch[1].replace(/,/g, ""));
      if (!fields.senderName) fields.senderName = cleanName(appWalletMatch[2]);
      if (!fields.senderAccount) fields.senderAccount = appWalletMatch[3];
      if (!fields.receiverName) fields.receiverName = cleanName(appWalletMatch[4]);
    }

    // --- STRUCTURAL PATTERN MATCH 2: CBE Mobile Banking SMS Message (Image 1) ---
    // "Dear Amanuel Andemo Angello You have successfully transferred ETB1000.00 from account 1********8096 to account 1********2413 (Eyerusalem Tadesse Sharew)."
    const smsSummaryMatch = text.match(
      /Dear\s+([A-Za-z\s.-]+?)\s+You\s+have\s+successfully\s+transferred\s*(?:ETB|Br\.?)?\s*([\d,]+(?:\.\d{1,2})?)\s+from\s+account\s+([0-9*]{8,18})\s+to\s+account\s+([0-9*]{8,18})\s*\(([^)]+)\)/i
    );

    if (smsSummaryMatch) {
      if (!fields.senderName) fields.senderName = cleanName(smsSummaryMatch[1]);
      if (!fields.amount) fields.amount = parseFloat(smsSummaryMatch[2].replace(/,/g, ""));
      if (!fields.senderAccount) fields.senderAccount = smsSummaryMatch[3];
      if (!fields.receiverAccount) fields.receiverAccount = smsSummaryMatch[4];
      if (!fields.receiverName) fields.receiverName = cleanName(smsSummaryMatch[5]);
    }

    // --- FALLBACK REGEX MATCHERS ---

    // Amount Fallbacks
    if (!fields.amount) {
      const debitedMatch = text.match(/(?:etb|birr)\s*([\d,]+(?:\.\d{1,2})?)\s+has\s+been\s+debited/i);
      const smsDebitAmtMatch = text.match(/(?:debit\s+transaction\s+of|debited)\s+(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
      const transferredMatch = text.match(/transferred\s*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
      const amtMatch = text.match(/(?:transferred amount|amount|total paid|paid)[:\s]*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
        text.match(/(?:etb|birr)\s*([\d,]+(?:\.\d{1,2})?)/i);

      if (debitedMatch) {
        fields.amount = parseFloat(debitedMatch[1].replace(/,/g, ""));
      } else if (smsDebitAmtMatch) {
        fields.amount = parseFloat(smsDebitAmtMatch[1].replace(/,/g, ""));
      } else if (transferredMatch) {
        fields.amount = parseFloat(transferredMatch[1].replace(/,/g, ""));
      } else if (amtMatch) {
        fields.amount = parseFloat(amtMatch[1].replace(/,/g, ""));
      }
    }

    // Total Amount Debited
    const totalMatch = text.match(/(?:total amount debited|total amount|total debited)[:\s]*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
      text.match(/with\s+total\s+of\s*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
      text.match(/total\s+of\s+(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);

    if (totalMatch) fields.totalAmount = parseFloat(totalMatch[1].replace(/,/g, ""));

    // Fees: Service Charge + VAT (15%) + Disaster Recovery (5%)
    let feeSum = 0;
    const feeMatch = text.match(/service\s*charge\s*(?:of)?[:\s]*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (feeMatch) feeSum += parseFloat(feeMatch[1].replace(/,/g, ""));

    const vatMatch = text.match(/vat\s*(?:\(15%\))?\s*(?:of)?[:\s]*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (vatMatch) feeSum += parseFloat(vatMatch[1].replace(/,/g, ""));

    const drrfMatch = text.match(/(?:disaster\s+recovery|drrf)\s*(?:\(5%\))?\s*(?:of)?[:\s]*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (drrfMatch) feeSum += parseFloat(drrfMatch[1].replace(/,/g, ""));

    if (feeSum > 0) fields.fees = feeSum;

    // --- STRUCTURAL PATTERN MATCH 3: CBE Official PDF / Web Portal Receipt ---
    const pdfPayerMatch = text.match(/(?:Payer|Customer Name)[:\s]+([A-Za-z\s.-]+?)(?=\s+Account[:\s]+(?:[A-Za-z0-9]*\*{2,}[A-Za-z0-9]+|[0-9]{8,18})|\s+(?:Receiver|Payment|Reason|Transferred|Service|VAT|Disaster|Total|Region|City)|$)/i);
    const pdfPayerAccMatch = text.match(/(?:Payer|Customer Name)[:\s]+[A-Za-z\s.-]+?\s+Account[:\s]+([A-Za-z0-9*]{4,18})/i) ||
                             text.match(/Payer\s+Account[:\s]+([A-Za-z0-9*]{4,18})/i);
    if (pdfPayerMatch && !fields.senderName) fields.senderName = cleanName(pdfPayerMatch[1]);
    if (pdfPayerAccMatch) fields.senderAccount = pdfPayerAccMatch[1];

    const pdfReceiverMatch = text.match(/Receiver[:\s]+([A-Za-z0-9\s.&'-]+?)(?=\s+Account:\s*[A-Za-z0-9*]{4,18}|\s+(?:Payment Type|Payment Date|Reference|Reason|Transferred|Service|VAT|Disaster|Total)|$)/i);
    const pdfReceiverAccMatch = text.match(/Receiver[:\s]+[\s\S]+?\s+Account:\s*([A-Za-z0-9*]{4,18})/i);
    if (pdfReceiverMatch && !fields.receiverName) fields.receiverName = cleanName(pdfReceiverMatch[1]);
    if (pdfReceiverAccMatch) fields.receiverAccount = pdfReceiverAccMatch[1];

    // Names & Accounts Fallbacks
    if (!fields.senderName) {
      const smsSenderMatch = text.match(/Dear\s+([A-Za-z\s.-]+?)\s+(?:You\s+have|A\s+debit|ETB)/i) ||
        text.match(/from\s+([A-Za-z\s.-]+?)(?:-ETB-|-Birr-|-account|\s+account|\s+to|\s+for)/i) ||
        text.match(/(?:from|sender|payer|customer name|source name|debited from)[:\s]+([A-Za-z\s.-]+)/i);
      if (smsSenderMatch?.[1]) fields.senderName = cleanName(smsSenderMatch[1]);
    }

    if (!fields.receiverName) {
      const smsReceiverMatch = text.match(/to\s+(?:account\s+)?([0-9*]{8,18})\s*\(([^)]+)\)/i) ||
        text.match(/for\s+(.+?)(?=\s+on|\s+with|\s+account|\s+wallet|\s+ref|\s+transaction|\s*$)/i) ||
        text.match(/for\s+([A-Za-z\s.-]+?)\s+with/i) ||
        text.match(/(?:to|receiver|payee|beneficiary|credited party)[:\s]+([A-Za-z0-9\s.&'-]+)/i);
      if (smsReceiverMatch?.[2]) {
        fields.receiverName = cleanName(smsReceiverMatch[2]);
        if (!fields.receiverAccount) fields.receiverAccount = smsReceiverMatch[1];
      } else if (smsReceiverMatch?.[1]) {
        fields.receiverName = cleanName(smsReceiverMatch[1]);
      }
    }

    if (!fields.senderAccount) {
      const cbeAccMatch = text.match(/(?:from\s+your\s+account|from\s+account|account|ETB-)\s*([15][0-9*]{4,17})/i);
      if (cbeAccMatch) fields.senderAccount = cbeAccMatch[1];
    }

  } else if (provider === "telebirr") {
    // 2. telebirr
    const txMatch = 
      text.match(/(?:transaction\s+(?:number|id|no|ref|reference)|txn\s+(?:id|no|ref))[:\s]*([A-Z0-9]{8,30})/i) ||
      text.match(/transaction\s+number\s+is\s+([A-Z0-9]{6,25})/i) ||
      text.match(/\/receipt\/([A-Z0-9]+)/i) ||
      text.match(/\b(2[0-9]{13,22})\b/) ||
      text.match(/\b(DGO[A-Z0-9]{6,15})\b/i) ||
      text.match(/\b(DH[A-Z0-9]{6,15})\b/i) ||
      text.match(/\b(TX[A-Z0-9]{6,15})\b/i);
    if (txMatch) fields.transactionId = (txMatch[1] || txMatch[0]).trim().toUpperCase();

    const signMatch = text.match(/(?:-|\+)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:ETB|Birr|Br\.?)/i) ||
      text.match(/(?:-|\+)?\s*([\d,]+\.\d{2})/i);
    const smsTransferredMatch = text.match(/transferred\s+(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)\s+to/i);
    const amtMatch = text.match(/(?:total paid amount|amount|paid amount|net amount|transferred amount)[:\s]*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    
    if (smsTransferredMatch) {
      fields.amount = parseFloat(smsTransferredMatch[1].replace(/,/g, ""));
    } else if (signMatch) {
      fields.amount = parseFloat(signMatch[1].replace(/,/g, ""));
    } else if (amtMatch) {
      fields.amount = parseFloat(amtMatch[1].replace(/,/g, ""));
    }

    // Telebirr SMS Service Fee & VAT
    const feeMatch = text.match(/service\s+fee\s+is\s+(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const vatMatch = text.match(/vat\s+(?:on\s+the\s+service\s+fee\s+)?is\s+(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    let feeSum = 0;
    if (feeMatch) feeSum += parseFloat(feeMatch[1].replace(/,/g, ""));
    if (vatMatch) feeSum += parseFloat(vatMatch[1].replace(/,/g, ""));
    if (feeSum > 0) fields.fees = feeSum;

    // Receiver & Sender Name
    const paidToMatch = text.match(/(?:paid to|recipient|receiver|to|payee|credited party name)[:\s]+([A-Za-z0-9\s.&'-]+?)(?=\s+(?:Transaction|Time|Type|ID|No|Number|Date|Amount|Fee|Status|\d{8,})|[\r\n]|$)/i);
    const smsReceiverMatch = text.match(/to\s+([A-Za-z0-9\s.*()]+?)\s+on\s+\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/i);
    
    if (paidToMatch?.[1]) {
      fields.receiverName = cleanName(paidToMatch[1]);
    } else if (smsReceiverMatch?.[1]) {
      fields.receiverName = cleanName(smsReceiverMatch[1].replace(/\(\d+.*?\)/, ""));
    }

    const smsSenderMatch = text.match(/Dear\s+([A-Za-z\s.-]+?)(?:\s+You\s+have|\s+transferred|\s*,|\s*\n)/i);
    const senderMatch = text.match(/(?:payer name|paid by|from|sender)[:\s]+([A-Za-z0-9\s.&'-]+?)(?=\s+(?:Transaction|Time|Type|ID|No|Number|Date|Amount|Fee|Status|\d{8,})|[\r\n]|$)/i);
    
    if (smsSenderMatch?.[1]) {
      fields.senderName = cleanName(smsSenderMatch[1]);
    } else if (senderMatch?.[1]) {
      fields.senderName = cleanName(senderMatch[1]);
    }

    // Telebirr App Screen Date & Time Extraction
    const dateTimeMatch = text.match(/(?:transaction time|date & time|date|time)[:\s]*(\d{2,4}[/-]\d{1,2}[/-]\d{1,4}\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i) ||
      text.match(/(\d{2}[/-]\d{2}[/-]\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?)/);
    if (dateTimeMatch?.[1]) {
      const parts = dateTimeMatch[1].trim().split(/\s+/);
      if (parts[0]) fields.date = parts[0];
      if (parts[1]) fields.time = parts.slice(1).join(" ");
    }

  } else if (provider === "dashen") {
    // 3. Dashen Bank (Amole / IPSS / DB SuperApp SMS)
    const smsTxMatch = text.match(/with\s+transaction\s+reference\s+([A-Za-z0-9]{8,26})/i) ||
      text.match(/\/receipt\/([A-Za-z0-9]+)/i);
    if (smsTxMatch) {
      fields.transactionId = smsTxMatch[1].toUpperCase();
      fields.transferReference = smsTxMatch[1].toUpperCase();
    }

    const smsSenderMatch = text.match(/Dear\s+([A-Za-z\s.-]+?),?\s+you\s+have\s+successfully\s+transferred/i);
    if (smsSenderMatch?.[1]) fields.senderName = cleanName(smsSenderMatch[1]);

    const smsSenderAcc = text.match(/from\s+your\s+account\s+([0-9*]{8,18})/i);
    if (smsSenderAcc?.[1]) fields.senderAccount = smsSenderAcc[1];

    const smsReceiverMatch = text.match(/to\s+([A-Za-z0-9\s.+]+?)\s+on\s+\d{4}-\d{2}-\d{2}/i);
    if (smsReceiverMatch?.[1]) {
      const recText = smsReceiverMatch[1];
      const phoneMatch = recText.match(/(\+?\d{10,13})/);
      if (phoneMatch) fields.receiverAccount = phoneMatch[1];
      fields.receiverName = cleanName(recText.replace(/\+?\d{10,13}/, "").replace(/account/i, ""));
    }

    const smsAmtMatch = text.match(/transferred\s+(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)\s+from/i);
    if (smsAmtMatch) fields.amount = parseFloat(smsAmtMatch[1].replace(/,/g, ""));

    const dashenCharge = text.match(/service\s+charge\s+is\s+(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i) || 
                         text.match(/Service-Charge(?:[\s:;]+)?(?:ETB|Birr)?\s*([\d,]+(?:\.\d{1,2})?)/i) || 
                         text.match(/Service Charge(?:[\s:;]+)?(?:ETB|Birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const dashenVat = text.match(/vat\s*(?:\(15%\))?\s*(?:is|:)?\s*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const dashenDrrf = text.match(/(?:drrf|Disaster Risk Response Fund Fee)\s*(?:\(5%\))?\s*(?:is|:)?\s*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    
    let dashenFeeSum = 0;
    if (dashenCharge) dashenFeeSum += parseFloat(dashenCharge[1].replace(/,/g, ""));
    if (dashenVat) dashenFeeSum += parseFloat(dashenVat[1].replace(/,/g, ""));
    if (dashenDrrf) dashenFeeSum += parseFloat(dashenDrrf[1].replace(/,/g, ""));
    if (dashenFeeSum > 0) fields.fees = dashenFeeSum;

    // Regex extraction for App Receipts
    const appSenderMatch = text.match(/(?:Sender|Payer)(?:\s+Name)?[\s:;]+([^\n\r]+?)(?=(?:\n|\r|$|Sender Account|Payer Account|Service Type|Transaction Channel|Transaction Date))/i);
    if (appSenderMatch && !fields.senderName) fields.senderName = cleanName(appSenderMatch[1]);
    
    const appReceiverMatch = text.match(/(?:Receiver|Reciever|Recipient|Beneficiary)(?:\s+Name)?[\s:;]+([^\n\r]+?)(?=(?:\n|\r|$|Beneficiary Bank|Institution|Instituton|Receiver Account|Reciever Account|Recipient Account|Budget|Transaction Date))/i);
    if (appReceiverMatch && !fields.receiverName) fields.receiverName = cleanName(appReceiverMatch[1]);

    const appDateMatch = text.match(/(?:Transaction Date|Date)[\s:;]+([A-Za-z]{3}\s+\d{1,2},?\s*\d{4})/i) || text.match(/(?:Transaction Date|Date)[\s:;]+(\d{4}-\d{2}-\d{2})/i);
    if (appDateMatch) fields.date = appDateMatch[1];

    const appSenderAccMatch = text.match(/(?:Sender Account|Sender Acc)(?: Number)?[\s:;]+([A-Za-z0-9*+-]+)(?:\n|\r|$|Service Type|Transaction Channel|Recipient Account|Receiver Name)/i);
    if (appSenderAccMatch && !fields.senderAccount) fields.senderAccount = appSenderAccMatch[1].trim();

    const appReceiverAccMatch = text.match(/(?:Receiver Account|Recipient Account|Beneficiary Account)(?: Number)?[\s:;]+([A-Za-z0-9*+-]+)(?:\n|\r|$|Beneficiary Bank|Institution Name|Transaction Reference|Transfer Reference|Budget|Recipient Name|Receiver Name)/i);
    if (appReceiverAccMatch && !fields.receiverAccount) fields.receiverAccount = appReceiverAccMatch[1].trim();

    const appTxMatch = text.match(/(?:Transaction Reference|Transaction Ref|Txn Ref)[\s:;]+([A-Za-z0-9]+)(?:\n|\r|$|Transfer Reference|Service Charge|VAT|Date)/i) || 
                       text.match(/\b(IPSS[A-Z0-9]{8,26})\b/i);
    if (appTxMatch && !fields.transactionId) {
      fields.transactionId = appTxMatch[1].toUpperCase();
      fields.transferReference = appTxMatch[1].toUpperCase();
    }

    const ftRefMatch = text.match(/(?:FT Ref|Transfer Reference)[\s:;]+([A-Za-z0-9]+)(?:\n|\r|$|Transaction Date|Transaction Reference)/i);
    if (ftRefMatch && !fields.transferReference) {
      fields.transferReference = ftRefMatch[1].toUpperCase();
      if (!fields.transactionId) fields.transactionId = ftRefMatch[1].toUpperCase();
    }

    if (!fields.amount) {
      const amtMatch = text.match(/(?:Transaction Amount|Amount|Total)[:\s]*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i) || 
                       text.match(/(?:Successfully paid|Paid)!?[\s\S]{0,100}?(?:^|\n|\r| )([\d,]+(?:\.\d{1,2})?)\s*\(?(?:ETB|Birr)\)?/i) ||
                       text.match(/(?:^|\n|\r| )([\d,]+(?:\.\d{1,2})?)\s*\(?ETB\)?/i);
      const signMatch = text.match(/(?:-|\+)?\s*([\d,]+\.\d{2})\s*\(?etb\)?/i);
      
      if (amtMatch) {
        fields.amount = parseFloat(amtMatch[1].replace(/,/g, ""));
      } else if (signMatch) {
        fields.amount = parseFloat(signMatch[1].replace(/,/g, ""));
      }
    }

  } else if (provider === "m-pesa") {
    // 4. M-Pesa (Safaricom)
    const txMatch = text.match(/(?:transaction\s+number\s+is|transaction\s+number)\s+([A-Z0-9]{6,25})/i) ||
      text.match(/\/receipt\/([A-Z0-9]+)/i);
    if (txMatch) fields.transactionId = txMatch[1].toUpperCase();

    const receiverMatch = text.match(/Dear\s+([A-Za-z\s.-]+?),?\s+you\s+have\s+(?:received|bought)/i);
    if (receiverMatch?.[1]) fields.receiverName = cleanName(receiverMatch[1]);

    const senderMatch = text.match(/from\s+([A-Za-z0-9\s.-]+?)\s+on\s+\d{1,2}/i);
    if (senderMatch?.[1]) fields.senderName = cleanName(senderMatch[1]);

    const amtMatch = text.match(/(?:received|bought\s+a\s+Safaricom\s+bundle\s+of)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:birr|etb)?/i) ||
      text.match(/([\d,]+(?:\.\d{1,2})?)\s+Birr/i);
    if (amtMatch) fields.amount = parseFloat(amtMatch[1].replace(/,/g, ""));

  } else if (provider === "abyssinia") {
    // 5. Bank of Abyssinia
    const txMatch = text.match(/(?:transaction reference|ref no|txn ref)[:\s]*([A-Z0-9]{8,22})/i)
      || text.match(/\b(FT[A-Z0-9]{8,20})\b/i);
    if (txMatch) fields.transactionId = txMatch[1].toUpperCase();

    const amtMatch = text.match(/(?:transferred amount|amount|total)[:\s]*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (amtMatch) fields.amount = parseFloat(amtMatch[1].replace(/,/g, ""));

    const senderMatch = text.match(/(?:source account name|sender|from)[:\s]+([A-Za-z\s.-]+)/i);
    if (senderMatch?.[1]) fields.senderName = cleanName(senderMatch[1]);

    const receiverMatch = text.match(/(?:receiver name|receiver's name|to|payee)[:\s]+([A-Za-z\s.-]+)/i);
    if (receiverMatch?.[1]) fields.receiverName = cleanName(receiverMatch[1]);

  } else if (provider === "awash") {
    // 6. Awash Bank (App Confirmation View & SMS Message View)
    
    // --- Transaction ID / Receipt Token ---
    const awashTxMatch = text.match(/(?:transaction id|txid|txn id|ref no|transaction ref)[:\s]*([A-Z0-9_-]{8,25})/i) ||
      text.match(/awashpay\.awashbank\.com:?\d*\/(?:verify\/)?(-?[A-Z0-9]{8,15}-[A-Z0-9]{6,10})/i) ||
      text.match(/\b(\d{14,16})\b/) ||
      text.match(/\b(AWS[A-Z0-9]{8,18})\b/i);

    if (awashTxMatch) {
      fields.transactionId = awashTxMatch[1].trim();
      fields.transferReference = fields.transactionId;
    }

    // --- Amount ---
    const smsAmtMatch = text.match(/transferred(?:\s+to\s+other\s+bank)?\s+(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
      text.match(/ETB\s*([\d,]+(?:\.\d{1,2})?)\s+To\s+[0-9*]{8,18}/i);
    const appAmtMatch = text.match(/(?:amount)[:\s]*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
      text.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:etb|birr)/i);

    if (smsAmtMatch) {
      fields.amount = parseFloat(smsAmtMatch[1].replace(/,/g, ""));
    } else if (appAmtMatch) {
      fields.amount = parseFloat(appAmtMatch[1].replace(/,/g, ""));
    }

    // --- Charge, VAT, EDRRF ---
    const chargeMatch = text.match(/(?:charge|with charge of)[:\s]*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const vatMatch = text.match(/vat[:\s]*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const edrrfMatch = text.match(/edrrf[:\s]*(?:etb|birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);

    let feeSum = 0;
    if (chargeMatch) feeSum += parseFloat(chargeMatch[1].replace(/,/g, ""));
    if (vatMatch) feeSum += parseFloat(vatMatch[1].replace(/,/g, ""));
    if (edrrfMatch) feeSum += parseFloat(edrrfMatch[1].replace(/,/g, ""));
    if (feeSum > 0) fields.fees = feeSum;

    // --- Sender Name & Account ---
    const appSenderMatch = text.match(/(?:sender name|payer name|source name|from)[:\s]+([^\r\n]+)/i);
    const smsSenderMatch = text.match(/Dear\s+([A-Za-z\s.-]+?)\s*,/i);

    if (appSenderMatch?.[1]) {
      fields.senderName = cleanName(appSenderMatch[1]);
    } else if (smsSenderMatch?.[1]) {
      const sName = cleanName(smsSenderMatch[1]);
      if (!/customer/i.test(sName)) {
        fields.senderName = sName;
      }
    }

    const appSenderAcc = text.match(/(?:sender account|sender acc|source account)[:\s]+([0-9*]{8,18})/i);
    if (appSenderAcc?.[1]) {
      fields.senderAccount = appSenderAcc[1];
    }

    // --- Receiver (Beneficiary) Name & Account ---
    const smsReceiverWithAccMatch = text.match(/To\s+([0-9*]{8,18})\s*\(([^)]+)\)/i);
    const appReceiverMatch = text.match(/(?:beneficiary name|beneficiary|receiver name|payee name|to)[:\s]+([A-Za-z\s.-]+)/i);
    const appReceiverAcc = text.match(/(?:beneficiary account|beneficiary acc|receiver account)[:\s]+([0-9*]{8,18})/i);

    if (smsReceiverWithAccMatch) {
      fields.receiverAccount = smsReceiverWithAccMatch[1];
      fields.receiverName = cleanName(smsReceiverWithAccMatch[2]);
    } else {
      if (appReceiverMatch?.[1]) fields.receiverName = cleanName(appReceiverMatch[1]);
      if (appReceiverAcc?.[1]) fields.receiverAccount = appReceiverAcc[1];
    }

    // --- Date & Time ---
    const appTimeMatch = text.match(/(?:transaction time|date & time|time)[:\s]*(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?)/i) ||
      text.match(/(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i);
    if (appTimeMatch) {
      const parts = appTimeMatch[1].trim().split(/\s+/);
      if (parts[0]) fields.date = parts[0];
      if (parts[1]) fields.time = parts.slice(1).join(" ");
    }
  } else {
    // 7. Generic / Fallback Parser
    const genericTxMatch = text.match(/\b(FT\d{10,20})\b/i)
      || text.match(/\b(TX[A-Z0-9]{8,15})\b/i)
      || text.match(/\b(IPSS[A-Z0-9]{8,15})\b/i)
      || text.match(/(?:txn ref|reference no|transaction id|ref no|transaction ref)[:\s]*([A-Z0-9_-]{8,24})/i);
    if (genericTxMatch) fields.transactionId = (genericTxMatch[1] || genericTxMatch[0]).toUpperCase();

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
