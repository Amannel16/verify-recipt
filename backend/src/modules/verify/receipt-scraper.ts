import { verifyPayment as verifyMpesa } from "@/src/utils/helper/verifyPayment.js";
import { logger } from "@/src/utils/logger/logger.js";
import zlib from "node:zlib";

export interface ScrapedReceiptData {
  isValid: boolean;
  providerId: string;
  transactionId?: string;
  transferReference?: string;
  amount?: number;
  senderName?: string;
  receiverName?: string;
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
    // e.g. "09/09/2025, 10:20:00 AM" or "09/09/2025, 10:20:00 PM"
    const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)/i);
    if (match) {
      let [_, month, day, year, hourStr, minute, second, ampm] = match;
      let hour = parseInt(hourStr, 10);
      if (ampm.toUpperCase() === "PM" && hour < 12) hour += 12;
      if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), hour, parseInt(minute, 10), parseInt(second, 10));
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

async function scrapeCbeReceipt(url: string, providerId: string, receiptId: string): Promise<ScrapedReceiptData> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`CBE portal responded with status: ${response.status}`);
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  const text = extractTextFromPdf(buffer);
  
  const extractField = (pattern: RegExp): string | undefined => {
    const match = text.match(pattern);
    return match?.[1]?.trim();
  };

  const customerName = extractField(/Customer Name:\s*([^\r\n]+)/i);
  const paymentDate = extractField(/Payment Date & Time\s*([\d/:,\sAPMapm]+)/i);
  const referenceNo = extractField(/Reference No.*?([A-Z0-9]+)/i);
  const payer = extractField(/Payer\s+([A-Za-z\s]+)/i);
  const receiver = extractField(/Receiver\s+([A-Za-z\s]+)/i);
  const transferredAmount = extractField(/Transferred Amount\s+([\d,.]+)\s*ETB/i);

  const isValid = !!referenceNo && !!transferredAmount;

  return {
    isValid,
    providerId,
    transactionId: referenceNo || receiptId,
    amount: transferredAmount ? parseFloat(transferredAmount.replace(/,/g, "")) : undefined,
    senderName: payer || customerName,
    receiverName: receiver,
    date: paymentDate ? parseCbeDate(paymentDate) : undefined,
    status: isValid ? "SUCCESS" : "FAILED",
    rawHtml: text.substring(0, 5000)
  };
}

async function scrapeDashenReceipt(url: string, providerId: string, receiptId: string): Promise<ScrapedReceiptData> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Dashen portal responded with status: ${response.status}`);

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const text = extractTextFromPdf(buffer);

  const extractField = (pattern: RegExp): string | undefined => {
    const match = text.match(pattern);
    return match?.[1]?.trim();
  };

  const holderNames: string[] = [];
  const holderRegex = /Account Holder Name:\s*([^\r\n]+)/gi;
  let holderMatch;
  while ((holderMatch = holderRegex.exec(text)) !== null) {
    holderNames.push(holderMatch[1].trim());
  }

  const senderName = holderNames[0];
  const beneficiaryName = holderNames[1];

  const transferReference = extractField(/Transfer Reference:\s*([^\r\n]+)/i);
  const transactionReference = extractField(/Transaction Ref:\s*([^\r\n]+)/i);
  const transactionDate = extractField(/Date:\s*([^\r\n]+)/i);
  const amount = extractField(/Transaction Amount\s*([\d,.]+)\s*ETB/i);
  const total = extractField(/Total\s*([\d,.]+)\s*ETB/i);

  const finalAmount = amount || total;
  const isValid = !!transactionReference && !!finalAmount;

  return {
    isValid,
    providerId,
    transactionId: transactionReference || receiptId,
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

async function scrapeAwashReceipt(url: string, providerId: string, receiptId: string): Promise<ScrapedReceiptData> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Awash portal responded with status: ${response.status}`);

  const html = await response.text();
  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi);
  const data: Record<string, string> = {};

  if (trMatches) {
    for (const tr of trMatches) {
      const tdMatches = [...tr.matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi)];
      if (tdMatches.length === 3) {
        const key = tdMatches[0][1].replace(/<[^>]*>/g, "").trim().replace(/:$/, "").trim();
        const value = tdMatches[2][1].replace(/<[^>]*>/g, "").trim();
        data[key] = value;
      }
    }
  }

  const transactionId = data["Transaction ID"] || data["Transaction Ref"] || receiptId;
  const amountStr = data["Amount"];
  const senderName = data["Sender Name"];
  const receiverName = data["Beneficiary name"] || data["Beneficiary Name"];
  const dateStr = data["Transaction Time"] || data["Transaction Date"];

  const isValid = !!amountStr && !!transactionId;

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
    amount: amountStr ? parseFloat(amountStr.replace(/etb/i, "").replace(/,/g, "").trim()) : undefined,
    senderName,
    receiverName,
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
  const url = urlOrId.startsWith("http") ? urlOrId : `https://transactioninfo.ethiotelecom.et/receipt/${urlOrId}`;
  
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
      Accept: "text/html"
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) throw new Error(`Telebirr portal responded with status: ${response.status}`);

  const html = await response.text();

  function pickTelebirr(labelPattern: RegExp): string | undefined {
    const labelMatch = html.match(labelPattern);
    if (!labelMatch) return undefined;
    
    const labelIndex = html.indexOf(labelMatch[0]);
    const subHtml = html.substring(labelIndex);
    const tdMatch = subHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
    if (tdMatch) {
      return tdMatch[1].replace(/<[^>]*>/g, "").trim();
    }
    return undefined;
  }

  const payerName = pickTelebirr(/Payer\s*Name/i);
  const payerNumber = pickTelebirr(/Payer\s*telebirr/i);
  const creditedParty = pickTelebirr(/Credited\s*Party\s*name/i);
  const creditedPartyNumber = pickTelebirr(/Credited\s*party\s*account\s*no/i);
  const statusStr = pickTelebirr(/transaction\s*status/i);
  const totalPaid = pickTelebirr(/Total\s*Paid\s*Amount/i);

  const isValid = !!totalPaid && !!statusStr;

  return {
    isValid,
    providerId,
    transactionId: receiptId,
    amount: totalPaid ? parseFloat(totalPaid.replace(/etb/i, "").replace(/,/g, "").trim()) : undefined,
    senderName: payerName || payerNumber,
    receiverName: creditedParty || creditedPartyNumber,
    status: statusStr ? statusStr.toUpperCase() : "FAILED",
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
        "User-Agent": "PayVerify-AI/1.0",
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

