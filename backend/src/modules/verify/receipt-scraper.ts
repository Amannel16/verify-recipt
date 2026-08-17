import { verifyPayment as verifyMpesa } from "@/src/utils/helper/verifyPayment.js";
import { logger } from "@/src/utils/logger/logger.js";
import zlib from "node:zlib";

export interface ScrapedReceiptData {
  isValid: boolean;
  providerId: string;
  receiptId?: string;
  transactionId?: string;
  transferReference?: string;
  amount?: number;
  totalAmount?: number;
  fees?: number;
  senderName?: string;
  senderAccount?: string;
  receiverName?: string;
  receiverAccount?: string;
  paymentType?: string;
  reason?: string;
  amountInWords?: string;
  date?: string;
  status?: string;
  error?: string;
  rawHtml?: string;
}

// ==========================================
// Native PDF Text Extractor Utility
// ==========================================
export function extractTextFromPdf(pdfBuffer: Buffer): string {
  let fullText = "";
  let pos = 0;

  while (true) {
    const streamStart = pdfBuffer.indexOf("stream", pos);
    if (streamStart === -1) break;

    // The stream data starts after "stream" keyword and whitespace (typically \r\n or \n)
    let dataStart = streamStart + 6;
    while (dataStart < pdfBuffer.length && (pdfBuffer[dataStart] === 13 || pdfBuffer[dataStart] === 10)) {
      dataStart++;
    }

    const streamEnd = pdfBuffer.indexOf("endstream", dataStart);
    if (streamEnd === -1) break;

    let dataEnd = streamEnd;
    // Trim trailing whitespace before "endstream"
    while (dataEnd > dataStart && (pdfBuffer[dataEnd - 1] === 13 || pdfBuffer[dataEnd - 1] === 10 || pdfBuffer[dataEnd - 1] === 32)) {
      dataEnd--;
    }

    const chunk = pdfBuffer.subarray(dataStart, dataEnd);
    pos = streamEnd + 9;

    try {
      // Decompress FlateDecode stream
      const decompressed = zlib.inflateSync(chunk);
      const text = decompressed.toString("binary");

      // Check if it's a content stream with text operators
      if (text.includes("Tj") || text.includes("TJ") || text.includes("BT") || text.includes("ET")) {
        fullText += parsePdfStreamText(text) + "\n";
      }
    } catch (e) {
      // Ignore streams that fail to decompress or are not FlateDecoded
    }
  }

  return fullText;
}

function parsePdfStreamText(decompressed: string): string {
  let result = "";
  let inString = false;
  let escape = false;
  let parenDepth = 0;
  let currentString = "";

  for (let i = 0; i < decompressed.length; i++) {
    const char = decompressed[i];
    if (escape) {
      // Octal escape sequences: \ddd
      if (/[0-7]/.test(char)) {
        let octalStr = char;
        if (i + 1 < decompressed.length && /[0-7]/.test(decompressed[i + 1])) {
          octalStr += decompressed[i + 1];
          i++;
          if (i + 1 < decompressed.length && /[0-7]/.test(decompressed[i + 1])) {
            octalStr += decompressed[i + 1];
            i++;
          }
        }
        const charCode = parseInt(octalStr, 8);
        currentString += String.fromCharCode(charCode);
      } else {
        if (char === "n") currentString += "\n";
        else if (char === "r") currentString += "\r";
        else if (char === "t") currentString += "\t";
        else if (char === "b") currentString += "\b";
        else if (char === "f") currentString += "\f";
        else currentString += char;
      }
      escape = false;
    } else if (char === "\\") {
      escape = true;
    } else if (char === "(") {
      if (parenDepth === 0) {
        inString = true;
      } else {
        currentString += char;
      }
      parenDepth++;
    } else if (char === ")") {
      parenDepth--;
      if (parenDepth === 0) {
        inString = false;
        result += currentString + " ";
        currentString = "";
      } else if (parenDepth > 0) {
        currentString += char;
      }
    } else if (char === "<") {
      // Check if it's dictionary start "<<"
      if (i + 1 < decompressed.length && decompressed[i + 1] === "<") {
        i++; // skip dictionary start
        continue;
      }
      // Hex string start
      let hexStr = "";
      let j = i + 1;
      while (j < decompressed.length && decompressed[j] !== ">") {
        const h = decompressed[j];
        if (/[0-9a-fA-F]/.test(h)) {
          hexStr += h;
        }
        j++;
      }
      if (j < decompressed.length && decompressed[j] === ">") {
        let asciiStr = "";
        for (let k = 0; k < hexStr.length; k += 2) {
          const byteVal = parseInt(hexStr.substring(k, k + 2), 16);
          if (!isNaN(byteVal)) {
            asciiStr += String.fromCharCode(byteVal);
          }
        }
        result += asciiStr + " ";
        i = j; // move index to '>'
      }
    } else {
      if (inString) {
        currentString += char;
      }
    }
  }
  return result;
}

// ==========================================
// Date Parsers Helpers
// ==========================================
function parseCbeDate(dateStr: string): string | undefined {
  try {
    // Format 1: "09/09/2025, 10:20:00 AM" or "09/09/2025, 10:20 AM"
    const m1 = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)/i);
    if (m1) {
      let [_, month, day, year, hourStr, minute, secondStr, ampm] = m1;
      let hour = parseInt(hourStr, 10);
      if (ampm.toUpperCase() === "PM" && hour < 12) hour += 12;
      if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
      const second = secondStr ? parseInt(secondStr, 10) : 0;
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), hour, parseInt(minute, 10), second);
      return d.toISOString();
    }

    // Format 2: "Aug 16, 2026, 6:35 PM" or "August 16, 2026, 6:35:00 PM"
    const m2 = dateStr.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s*(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)/i);
    if (m2) {
      let [_, monthName, day, year, hourStr, minute, secondStr, ampm] = m2;
      const months: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
        january: 0, february: 1, march: 2, april: 3, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
      };
      const month = months[monthName.toLowerCase()] ?? 0;
      let hour = parseInt(hourStr, 10);
      if (ampm.toUpperCase() === "PM" && hour < 12) hour += 12;
      if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
      const second = secondStr ? parseInt(secondStr, 10) : 0;
      const d = new Date(parseInt(year, 10), month, parseInt(day, 10), hour, parseInt(minute, 10), second);
      return d.toISOString();
    }
  } catch (e) {
    // Ignore
  }
  return dateStr;
}

function parseDashenDate(dateStr: string): string | undefined {
  try {
    const match = dateStr.match(/([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)/i);
    if (match) {
      let [_, monthName, day, year, hourStr, minute, secondStr, ampm] = match;
      const months: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
        january: 0, february: 1, march: 2, april: 3, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
      };
      const month = months[monthName.toLowerCase()] ?? 0;
      let hour = parseInt(hourStr, 10);
      if (ampm.toUpperCase() === "PM" && hour < 12) hour += 12;
      if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
      const second = secondStr ? parseInt(secondStr, 10) : 0;
      const d = new Date(parseInt(year, 10), month, parseInt(day, 10), hour, parseInt(minute, 10), second);
      return d.toISOString();
    }
  } catch (e) {
    // Ignore
  }
  return dateStr;
}

function parseZemenDate(dateStr: string): string | undefined {
  try {
    const match = dateStr.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
    if (match) {
      const [_, day, monthName, year] = match;
      const months: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
      };
      const month = months[monthName.toLowerCase()] ?? 0;
      const d = new Date(parseInt(year, 10), month, parseInt(day, 10), 12, 0, 0);
      return d.toISOString();
    }
  } catch (e) {
    // Ignore
  }
  return dateStr;
}

// ==========================================
// Scraper Functions
// ==========================================

async function scrapeCbeReceipt(url: string, providerId: string, inputId: string): Promise<ScrapedReceiptData> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`CBE portal responded with status: ${response.status}`);
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  let rawText = extractTextFromPdf(buffer);
  if (!rawText || rawText.trim().length === 0) {
    rawText = buffer.toString("utf-8");
  }

  // Strip CSS <style> blocks, <script> blocks, and HTML tags to prevent font names (e.g. Color Emoji) from matching
  const cleanText = rawText
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  
  const extractField = (pattern: RegExp): string | undefined => {
    const match = cleanText.match(pattern);
    return match?.[1]?.trim();
  };

  const statusMatch = extractField(/Status[:\s]+([A-Z_]+)/i);
  const referenceNo = extractField(/(?:Reference No\.?\s*(?:\(VAT Invoice No\))?|VAT Receipt No|Txn Ref|Transaction Ref|Ref No|FT No)[:\s]*([A-Z0-9_-]+)/i) ||
                      extractField(/\b(FT[A-Z0-9]{8,18})\b/i);

  // Extract Payer & Sender Account
  const payerName = extractField(/Payer[:\s]+([A-Za-z\s.-]+?)(?=\s+Account:\s*[A-Za-z0-9*]{4,18}|\s+(?:Receiver|Payment|Payment Date|Reference|Reason|Transferred|Service|VAT|Disaster|Total|Amount)|$)/i) ||
                    extractField(/Customer Name[:\s]+([A-Za-z\s.-]+?)(?=\s+(?:Region|City|Sub City|Wereda|VAT|TIN|Branch|Payment|Payer|Amount)|$)/i);
  
  const senderAccount = extractField(/Payer[:\s]+[A-Za-z\s.-]+?\s+Account:\s*([A-Za-z0-9*]{4,18})/i) ||
                        extractField(/Account[:\s]+([15][0-9*]{4,15})/i);

  // Extract Receiver & Receiver Account
  const receiverName = extractField(/Receiver[:\s]+([A-Za-z0-9\s.&'-]+?)(?=\s+Account:\s*[A-Za-z0-9*]{4,18}|\s+(?:Payment Type|Payment Date|Reference|Reason|Transferred|Service|VAT|Disaster|Total|Amount)|$)/i);
  const receiverAccount = extractField(/Receiver[:\s]+[A-Za-z0-9\s.&'-]+?\s+Account:\s*([A-Za-z0-9*]{4,18})/i);

  // Extract Payment Type & Reason
  const paymentType = extractField(/Payment Type[:\s]+([A-Z0-9\s_-]+?)(?=\s+(?:Payment Date|Reference|Reason|Transferred|Service|VAT|Disaster|Total)|$)/i);
  const reason = extractField(/Reason\s*\/\s*Type of service[:\s]+([A-Za-z0-9\s_-]+?)(?=\s+(?:Transferred|Service|VAT|Disaster|Total)|$)/i);

  // Dates & Amounts
  const paymentDate = extractField(/Payment Date & Time[:\s]+([\d/:,\sAPMapm-]+)/i) ||
                      extractField(/(?:Transaction Date|Date)[:\s]+([\d/:,\sAPMapm-]+)/i);
  
  const transferredAmount = extractField(/Transferred Amount[:\s]+([\d,.]+)\s*(?:ETB|Birr)?/i) ||
                            extractField(/(?:Amount|Total)[:\s]+([\d,.]+)\s*(?:ETB|Birr)?/i);

  const totalDebitedAmount = extractField(/Total amount debited from customer's account[:\s]+([\d,.]+)\s*(?:ETB|Birr)?/i);

  // Fee Breakdown
  const serviceChargeStr = extractField(/Service Charge[:\s]+([\d,.]+)\s*(?:ETB|Birr)?/i);
  const vatStr = extractField(/VAT\s*(?:\(15%\))?[:\s]+([\d,.]+)\s*(?:ETB|Birr)?/i);
  const disasterRecoveryStr = extractField(/Disaster Recovery\s*(?:\(5%\))?[:\s]+([\d,.]+)\s*(?:ETB|Birr)?/i);

  let feeSum = 0;
  if (serviceChargeStr) feeSum += parseFloat(serviceChargeStr.replace(/,/g, ""));
  if (vatStr) feeSum += parseFloat(vatStr.replace(/,/g, ""));
  if (disasterRecoveryStr) feeSum += parseFloat(disasterRecoveryStr.replace(/,/g, ""));

  const amountInWords = extractField(/Amount in Word[:\s]+([A-Za-z\s]+?)(?=\s+(?:Payment|Payer|Customer|Total)|$)/i);

  // Extract receipt ID from URL token (e.g. "v2-hfHCxGiuGMJrEq78pDzZ")
  const urlToken = url.includes("/v2-") ? "v2-" + url.split("/v2-").pop() : url.split("/").pop();
  const cbeReceiptId = urlToken || inputId;
  const cbeTxId = referenceNo || (inputId.startsWith("FT") ? inputId : undefined);

  const statusStr = statusMatch ? statusMatch.toUpperCase() : (cleanText.toLowerCase().includes("completed") ? "COMPLETED" : "SUCCESS");
  const isValid = !!cbeTxId || !!cbeReceiptId || !!transferredAmount || cleanText.toLowerCase().includes("cbe");

  logger.info(`🏦 CBE Scraped Data: receiptId=${cbeReceiptId}, txId=${cbeTxId || "N/A"}, status=${statusStr}, amount=${transferredAmount}, total=${totalDebitedAmount}, fees=${feeSum}, sender=${payerName} (${senderAccount}), receiver=${receiverName} (${receiverAccount})`);

  return {
    isValid,
    providerId,
    receiptId: cbeReceiptId,
    transactionId: cbeTxId,
    amount: transferredAmount ? parseFloat(transferredAmount.replace(/,/g, "")) : undefined,
    totalAmount: totalDebitedAmount ? parseFloat(totalDebitedAmount.replace(/,/g, "")) : undefined,
    fees: feeSum > 0 ? feeSum : undefined,
    senderName: payerName,
    senderAccount,
    receiverName,
    receiverAccount,
    paymentType,
    reason,
    amountInWords,
    date: paymentDate ? parseCbeDate(paymentDate) : undefined,
    status: isValid ? statusStr : "FAILED",
    rawHtml: cleanText.substring(0, 5000)
  };
}

async function scrapeCbebirrReceipt(url: string, providerId: string, inputId: string): Promise<ScrapedReceiptData> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`CBEBirr portal responded with status: ${response.status}`);
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  let rawText = extractTextFromPdf(buffer);
  if (!rawText || rawText.trim().length === 0) {
    rawText = buffer.toString("utf-8");
  }

  const cleanText = rawText
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  
  const extractField = (pattern: RegExp): string | undefined => {
    const match = cleanText.match(pattern);
    return match?.[1]?.trim();
  };

  const referenceNo = extractField(/(?:Reference No|Txn Ref|Transaction Ref|Ref No|Txn ID)[:\s]*([A-Z0-9_-]+)/i) ||
                      extractField(/(DH[A-Z0-9]{8,14})/i);
  const customerName = extractField(/(?:Customer Name|Payer|Sender|From)[:\s]*([A-Za-z\s]+?)(?:\s+(?:To|Receiver|Payee|Amount|Date)|$)/i);
  const receiverName = extractField(/(?:Receiver|Payee|To|Beneficiary)[:\s]*([A-Za-z\s]+?)(?:\s+(?:Amount|Date|Ref|Status)|$)/i);
  const paymentDate = extractField(/(?:Payment Date & Time|Transaction Date|Date)[:\s]*([\d/:,\sAPMapm-]+)/i);
  const transferredAmount = extractField(/(?:Transferred Amount|Amount|Total)[:\s]*([\d,.]+)\s*(?:ETB|Birr)?/i);

  let urlToken: string | null = null;
  try {
    urlToken = url.includes("TID=") ? new URL(url).searchParams.get("TID") : null;
  } catch (e) {
    // Ignore URL parse error
  }
  const cbeReceiptId = urlToken || inputId;
  const cbeTxId = referenceNo || inputId;

  const isValid = !!cbeTxId || !!transferredAmount || cleanText.toLowerCase().includes("cbebirr") || cleanText.toLowerCase().includes("cbe");

  logger.info(`🏦 CBEBirr Scraped Data: receiptId=${cbeReceiptId}, txId=${cbeTxId || "N/A"}, amount=${transferredAmount}, sender=${customerName}, receiver=${receiverName}`);

  return {
    isValid,
    providerId,
    receiptId: cbeReceiptId,
    transactionId: cbeTxId,
    amount: transferredAmount ? parseFloat(transferredAmount.replace(/,/g, "")) : undefined,
    senderName: customerName,
    receiverName: receiverName,
    date: paymentDate ? parseCbeDate(paymentDate) : undefined,
    status: isValid ? "SUCCESS" : "FAILED",
    rawHtml: cleanText.substring(0, 5000)
  };
}

async function scrapeDashenReceipt(url: string, providerId: string, receiptId: string): Promise<ScrapedReceiptData> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Dashen portal responded with status: ${response.status}`);

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let text = extractTextFromPdf(buffer);
  if (!text || text.trim().length === 0) {
    text = buffer.toString("utf-8");
  }

  const extractField = (pattern: RegExp): string | undefined => {
    const match = text.match(pattern);
    return match?.[1]?.trim();
  };

  const holderNames: string[] = [];
  const holderRegex = /Account Holder Name:\s*([^\r\n<]+)/gi;
  let holderMatch;
  while ((holderMatch = holderRegex.exec(text)) !== null) {
    holderNames.push(holderMatch[1].trim());
  }

  const senderName = holderNames[0] || extractField(/(?:Sender|From)[:\s]*([^\r\n<]+)/i);
  const beneficiaryName = holderNames[1] || extractField(/(?:Beneficiary|Receiver|To)[:\s]*([^\r\n<]+)/i);

  const transferReference = extractField(/(?:Transfer Reference|Transfer Ref)[:\s]*([^\r\n<]+)/i);
  const transactionReference = extractField(/(?:Transaction Ref|Txn Ref|Reference)[:\s]*([^\r\n<]+)/i);
  const transactionDate = extractField(/Date:\s*([^\r\n<]+)/i);
  const amount = extractField(/Transaction Amount\s*([\d,.]+)\s*(?:ETB|Birr)?/i);
  const total = extractField(/Total\s*([\d,.]+)\s*(?:ETB|Birr)?/i);

  const finalAmount = amount || total;
  const finalTxId = transactionReference || (url.includes("/receipt/") ? url.split("/receipt/").pop() : "") || receiptId;
  const isValid = !!finalTxId || !!finalAmount || text.toLowerCase().includes("dashen");

  return {
    isValid,
    providerId,
    transactionId: finalTxId,
    transferReference,
    amount: finalAmount ? parseFloat(finalAmount.replace(/,/g, "")) : undefined,
    senderName,
    receiverName: beneficiaryName,
    date: transactionDate ? parseDashenDate(transactionDate) : undefined,
    status: isValid ? "SUCCESS" : "FAILED",
    rawHtml: text.substring(0, 5000)
  };
}

async function scrapeZemenReceipt(url: string, providerId: string, receiptId: string): Promise<ScrapedReceiptData> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Zemen portal responded with status: ${response.status}`);

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const text = extractTextFromPdf(buffer);

  const extractField = (pattern: RegExp): string | undefined => {
    const match = text.match(pattern);
    return match?.[1]?.trim();
  };

  const invoiceNo = extractField(/Invoice No\.?:\s*(\d+)/i);
  const date = extractField(/Date[:\s]+([0-9]{1,2}-[A-Za-z]{3}-[0-9]{4})/i);
  const payerName = extractField(/Payer name:\s*([A-Za-z\s]+)/i);
  const recipientName = extractField(/Recipient name:\s*([A-Za-z\s\.]+)/i);
  const referenceNo = extractField(/Reference No:\s*([A-Z0-9]+)/i);
  const totalAmountPaid = extractField(/Total Amount Paid ETB\s*([\d,]+\.\d{2})/i);
  const settledAmount = extractField(/ATM CASH WITHDRAWAL ETB\s*([\d,]+\.\d{2})/i);

  const finalAmount = totalAmountPaid || settledAmount;
  const isValid = !!referenceNo && !!finalAmount;

  return {
    isValid,
    providerId,
    transactionId: referenceNo || invoiceNo || receiptId,
    amount: finalAmount ? parseFloat(finalAmount.replace(/,/g, "")) : undefined,
    senderName: payerName,
    receiverName: recipientName,
    date: date ? parseZemenDate(date) : undefined,
    status: isValid ? "SUCCESS" : "FAILED",
    rawHtml: text.substring(0, 5000)
  };
}

async function scrapeAwashReceipt(urlOrId: string, providerId: string, receiptId: string): Promise<ScrapedReceiptData> {
  const url = urlOrId.startsWith("http")
    ? urlOrId
    : `https://awashpay.awashbank.com:8225/${urlOrId.trim()}`;

  logger.info(`📱 Scraping Awash receipt from official portal: ${url}`);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/json,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) throw new Error(`Awash portal responded with status: ${response.status}`);

  const html = await response.text();
  
  // Try JSON first
  try {
    const json = JSON.parse(html);
    if (json && (json.amount || json.transactionId || json.reference)) {
      return {
        isValid: true,
        providerId,
        transactionId: json.transactionId || json.reference || receiptId,
        amount: json.amount ? parseFloat(String(json.amount).replace(/,/g, "")) : undefined,
        senderName: json.senderName || json.payer || json.sender,
        senderAccount: json.senderAccount || json.sourceAccount,
        receiverName: json.receiverName || json.payee || json.receiver || json.beneficiaryName || json.beneficiary,
        receiverAccount: json.receiverAccount || json.beneficiaryAccount,
        date: json.date || json.transactionDate || json.transactionTime,
        status: "SUCCESS",
        rawHtml: html.substring(0, 5000)
      };
    }
  } catch (e) {
    // HTML fallback
  }

  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi);
  const data: Record<string, string> = {};

  if (trMatches) {
    for (const tr of trMatches) {
      const tdMatches = [...tr.matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi)];
      if (tdMatches.length >= 2) {
        const key = tdMatches[0][1].replace(/<[^>]*>/g, "").trim().replace(/:$/, "").trim();
        const value = tdMatches[tdMatches.length - 1][1].replace(/<[^>]*>/g, "").trim();
        if (key && value) {
          data[key] = value;
        }
      }
    }
  }

  // Regex extractors for div/span fallback
  const getValFromHtml = (pattern: RegExp): string | undefined => {
    for (const [k, v] of Object.entries(data)) {
      if (pattern.test(k) && v) return v;
    }
    const match = html.match(pattern);
    return match?.[1]?.replace(/<[^>]*>/g, "").trim();
  };

  const transactionId = data["Transaction ID"] || data["Transaction Ref"] || data["Reference No"] || getValFromHtml(/Transaction ID[:\s]*([A-Za-z0-9_-]+)/i) || receiptId;
  const amountStr = data["Amount"] || data["Transferred Amount"] || data["Total Amount"] || getValFromHtml(/Amount[:\s]*([\d,.]+\s*(?:ETB|Birr)?)/i);
  const senderName = data["Sender Name"] || data["Payer"] || data["From"] || getValFromHtml(/Sender Name[:\s]*([A-Za-z\s.-]+)/i);
  const senderAccount = data["Sender Account"] || data["Sender Acc"] || getValFromHtml(/Sender Account[:\s]*([0-9*]+)/i);
  const receiverName = data["Beneficiary name"] || data["Beneficiary Name"] || data["Receiver"] || data["To"] || getValFromHtml(/Beneficiary name[:\s]*([A-Za-z\s.-]+)/i);
  const receiverAccount = data["Beneficiary Account"] || data["Beneficiary Acc"] || data["Receiver Account"] || getValFromHtml(/Beneficiary Account[:\s]*([0-9*]+)/i);
  const dateStr = data["Transaction Time"] || data["Transaction Date"] || data["Date"] || getValFromHtml(/Transaction Time[:\s]*([\d\s:-]+(?:AM|PM)?)/i);

  const isValid = !!amountStr || !!transactionId || html.toLowerCase().includes("awash");

  let finalDate: string | undefined = undefined;
  if (dateStr) {
    try {
      finalDate = new Date(dateStr).toISOString();
    } catch {
      finalDate = dateStr;
    }
  }

  return {
    isValid,
    providerId,
    transactionId,
    amount: amountStr ? parseFloat(amountStr.replace(/etb/i, "").replace(/birr/i, "").replace(/,/g, "").trim()) : undefined,
    senderName,
    senderAccount,
    receiverName,
    receiverAccount,
    date: finalDate,
    status: isValid ? "SUCCESS" : "FAILED",
    rawHtml: html.substring(0, 5000)
  };
}

async function scrapeBoaReceipt(url: string, providerId: string, receiptId: string): Promise<ScrapedReceiptData> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`BOA portal responded with status: ${response.status}`);

  const html = await response.text();
  const data: Record<string, string> = {};

  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch) {
    try {
      const parsedNext = JSON.parse(nextDataMatch[1]);
      const slipDetails = parsedNext?.props?.pageProps?.slipDetails || parsedNext?.props?.pageProps?.details;
      if (slipDetails) {
        const transRef = slipDetails.transactionReference || slipDetails.ref || slipDetails.TransactionReference;
        const amount = slipDetails.transferredAmount || slipDetails.amount || slipDetails.TransferredAmount;
        const sender = slipDetails.sourceAccountName || slipDetails.senderName || slipDetails.SourceAccountName;
        const receiver = slipDetails.receiverName || slipDetails.ReceiverName;
        const dateStr = slipDetails.transactionDate || slipDetails.date || slipDetails.TransactionDate;

        const isValid = !!amount && !!transRef;
        return {
          isValid,
          providerId,
          transactionId: transRef || receiptId,
          amount: amount ? parseFloat(amount.toString().replace(/,/g, "")) : undefined,
          senderName: sender,
          receiverName: receiver,
          date: dateStr ? new Date(dateStr).toISOString() : undefined,
          status: isValid ? "SUCCESS" : "FAILED",
          rawHtml: html.substring(0, 5000)
        };
      }
    } catch (e) {
      // Fallback
    }
  }

  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi);
  if (trMatches) {
    for (const tr of trMatches) {
      const tdMatches = [...tr.matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi)];
      if (tdMatches.length === 2) {
        const key = tdMatches[0][1].replace(/<[^>]*>/g, "").trim().replace(/:$/, "").trim();
        const value = tdMatches[1][1].replace(/<[^>]*>/g, "").trim();
        data[key] = value;
      }
    }
  }

  const transRef = data["Transaction Reference"] || data["Transaction Ref"] || receiptId;
  const amountStr = data["Transferred Amount"] || data["Transferred amount"] || data["Amount"];
  const sender = data["Source Account Name"] || data["Sender Name"];
  const receiver = data["Receiver's Name"] || data["Receiver Name"];
  const dateStr = data["Transaction Date"] || data["Date"];

  const isValid = !!amountStr && !!transRef;
  let finalDate: string | undefined = undefined;
  if (dateStr) {
    try {
      finalDate = new Date(dateStr).toISOString();
    } catch {
      finalDate = dateStr;
    }
  }

  return {
    isValid,
    providerId,
    transactionId: transRef,
    amount: amountStr ? parseFloat(amountStr.replace(/etb/i, "").replace(/,/g, "").trim()) : undefined,
    senderName: sender,
    receiverName: receiver,
    date: finalDate,
    status: isValid ? "SUCCESS" : "FAILED",
    rawHtml: html.substring(0, 5000)
  };
}

async function scrapeTelebirrReceipt(urlOrId: string, providerId: string, receiptId: string): Promise<ScrapedReceiptData> {
  const url = urlOrId.startsWith("http")
    ? urlOrId
    : `https://transactioninfo.ethiotelecom.et/receipt/${urlOrId.trim().toUpperCase()}`;
  
  logger.info(`📱 Scraping Telebirr receipt from official portal: ${url}`);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) throw new Error(`Telebirr portal responded with status: ${response.status}`);

  const html = await response.text();

  // Extract all table row key-value pairs
  const data: Record<string, string> = {};
  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi);
  if (trMatches) {
    for (const tr of trMatches) {
      const tdMatches = [...tr.matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi)];
      if (tdMatches.length >= 2) {
        const key = tdMatches[0][1].replace(/<[^>]*>/g, "").trim();
        const value = tdMatches[1][1].replace(/<[^>]*>/g, "").trim();
        if (key && value) {
          data[key] = value;
        }
      }
    }
  }

  function getVal(pattern: RegExp): string | undefined {
    // 1. Check extracted table dictionary keys
    for (const [k, v] of Object.entries(data)) {
      if (pattern.test(k) && v) return v;
    }
    // 2. Fallback: Search nearby tags in raw HTML
    const labelMatch = html.match(pattern);
    if (!labelMatch) return undefined;
    const labelIndex = html.indexOf(labelMatch[0]);
    const subHtml = html.substring(labelIndex, labelIndex + 400);
    const tagMatches = [...subHtml.matchAll(/<(?:td|div|span|dd|p)[^>]*>([\s\S]*?)<\/(?:td|div|span|dd|p)>/gi)];
    for (const tm of tagMatches) {
      const val = tm[1].replace(/<[^>]*>/g, "").trim();
      if (val && !pattern.test(val) && val.length < 120) {
        return val;
      }
    }
    return undefined;
  }

  const payerName = getVal(/Payer\s*Name|የክፍያ\s*ስም/i);
  const payerNumber = getVal(/Payer\s*telebirr|የክፍያ\s*ቴሌብር/i);
  const creditedParty = getVal(/Credited\s*Party\s*name|የገንዘብ\s*ተቀባይ\s*ስም/i);
  const creditedPartyNumber = getVal(/Credited\s*party\s*account|የገንዘብ\s*ተቀባይ\s*ቴሌብር/i);
  const statusStr = getVal(/Transaction\s*status|የክፍያው\s*ሁኔታ/i);
  const settledAmount = getVal(/Settled\s*Amount|የተከፈለው\s*መጠን/i);
  const totalPaid = getVal(/Total\s*Paid\s*Amount|ጠቅላላ\s*የተከፈለ/i) || getVal(/Amount/i) || settledAmount;
  const scrapedTxId = getVal(/Invoice\s*No|Transaction\s*(?:number|no|id)|የክፍያ\s*ቁጥር/i);
  const paymentDateStr = getVal(/Payment\s*date|የክፍያ\s*ቀን/i);

  const finalTxId = receiptId || scrapedTxId || (url.split("/").pop() ?? "");
  const isValid = !!totalPaid || !!statusStr || !!payerName || html.toLowerCase().includes("telebirr");

  // Amount parsing
  let parsedAmount: number | undefined = undefined;
  if (totalPaid) {
    const numMatch = totalPaid.match(/([\d,]+\.?\d*)/);
    if (numMatch) {
      parsedAmount = parseFloat(numMatch[1].replace(/,/g, ""));
    }
  }

  // Date parsing: "03-08-2026 08:36:34" or "DD-MM-YYYY HH:mm:ss"
  let parsedDate: string | undefined = undefined;
  if (paymentDateStr) {
    try {
      const dateMatch = paymentDateStr.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
      if (dateMatch) {
        const [_, day, month, year, h, m, s] = dateMatch;
        const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(h, 10), parseInt(m, 10), parseInt(s, 10));
        parsedDate = d.toISOString();
      } else {
        parsedDate = new Date(paymentDateStr).toISOString();
      }
    } catch {
      parsedDate = paymentDateStr;
    }
  }

  return {
    isValid,
    providerId,
    transactionId: finalTxId,
    amount: parsedAmount,
    senderName: payerName,
    senderAccount: payerNumber,
    receiverName: creditedParty,
    receiverAccount: creditedPartyNumber,
    date: parsedDate,
    status: statusStr ? statusStr.toUpperCase() : (isValid ? "SUCCESS" : "FAILED"),
    rawHtml: html.substring(0, 5000)
  };
}

/**
 * Automatically scrapes receipt data from supported bank/wallet public receipt URLs.
 */
export async function scrapeReceiptUrl(
  url: string,
  providerId: string,
  receiptId: string,
): Promise<ScrapedReceiptData> {
  const result: ScrapedReceiptData = {
    isValid: false,
    providerId,
    transactionId: receiptId,
  };

  logger.info(`🌐 Running scraper for provider: ${providerId}, URL: ${url}`);

  const lowerProviderId = providerId.toLowerCase();

  // 1. M-Pesa custom scraper
  if (lowerProviderId === "m-pesa") {
    try {
      const mpesa = await verifyMpesa(receiptId);
      return {
        isValid: mpesa.isValid,
        providerId,
        transactionId: mpesa.transactionId,
        amount: mpesa.amount,
        senderName: mpesa.senderName,
        receiverName: mpesa.receiverName,
        date: mpesa.date,
        status: mpesa.status,
        error: mpesa.error,
        rawHtml: mpesa.rawHtml,
      };
    } catch (e) {
      return {
        ...result,
        error: e instanceof Error ? e.message : "M-Pesa scraper execution failed",
      };
    }
  }

  // 2. Ethiopian Banks Scrapers
  try {
    switch (lowerProviderId) {
      case "cbe":
        return await scrapeCbeReceipt(url, providerId, receiptId);
      case "cbebirr":
        return await scrapeCbebirrReceipt(url, providerId, receiptId);
      case "dashen":
        return await scrapeDashenReceipt(url, providerId, receiptId);
      case "zemen":
        return await scrapeZemenReceipt(url, providerId, receiptId);
      case "awash":
        return await scrapeAwashReceipt(url, providerId, receiptId);
      case "abyssinia":
        return await scrapeBoaReceipt(url, providerId, receiptId);
      case "telebirr":
        return await scrapeTelebirrReceipt(url, providerId, receiptId);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Scraper execution failed";
    logger.error(`Receipt scraper failed for ${url} (${providerId}): ${msg}`);
    return {
      ...result,
      error: `Scraper execution failed: ${msg}`,
    };
  }

  // 3. Generic fallback
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Geba-AI/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      },
      signal: AbortSignal.timeout(10000), // 10 seconds timeout
    });

    if (!response.ok) {
      return {
        ...result,
        error: `Receipt server returned status code: ${response.status}`,
      };
    }

    const html = await response.text();
    if (!html || html.trim().length === 0) {
      return {
        ...result,
        error: "Empty content returned from receipt URL",
      };
    }

    const normalizedHtml = html.toLowerCase();
    const isInvalid =
      normalizedHtml.includes("not found") ||
      normalizedHtml.includes("invalid") ||
      normalizedHtml.includes("error") ||
      normalizedHtml.includes("failed");

    const isValid = html.length > 200 && !isInvalid;

    const extractField = (patterns: RegExp[]): string | undefined => {
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) return match[1].trim();
      }
      return undefined;
    };

    const amountStr = extractField([
      /(?:Amount|amount|Total|total|ETB|Sum)[:\s]*(?:ETB|USD)?\s*([\d,]+\.?\d*)/i,
      /class=["']amount["']>([^<]+)/i,
      /<td>\s*(?:ETB)?\s*([\d,]+\.?\d*)\s*<\/td>/i
    ]);

    const sender = extractField([
      /(?:Sender|From|Paid By|payer|Transfered from|Customer name)[:\s]*([^<\n&]+)/i,
      /class=["']sender["']>([^<]+)/i,
      /<td>\s*From\s*<\/td>\s*<td>\s*([^<]+)\s*<\/td>/i
    ]);

    const receiver = extractField([
      /(?:Receiver|To|Paid To|payee|Merchant|Transfered to|Beneficiary name|Receiver name)[:\s]*([^<\n&]+)/i,
      /class=["']receiver["']>([^<]+)/i,
      /<td>\s*To\s*<\/td>\s*<td>\s*([^<]+)\s*<\/td>/i
    ]);

    const date = extractField([
      /(?:Date|Transaction Date|date|Time|Timestamp)[:\s]*([^<\n&]+)/i,
      /class=["']date["']>([^<]+)/i,
      /<td>\s*Date\s*<\/td>\s*<td>\s*([^<]+)\s*<\/td>/i
    ]);

    return {
      isValid,
      providerId,
      transactionId: receiptId,
      amount: amountStr ? parseFloat(amountStr.replace(/,/g, "")) : undefined,
      senderName: sender,
      receiverName: receiver,
      date,
      status: isValid ? "SUCCESS" : "FAILED",
      rawHtml: html.substring(0, 5000),
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown connection error";
    logger.error(`Receipt scraper failed for ${url}: ${msg}`);
    return {
      ...result,
      error: `Failed to query receipt link: ${msg}`,
    };
  }
}

