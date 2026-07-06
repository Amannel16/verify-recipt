import { logger } from "@/src/utils/logger/logger.js";

/**
 * Known Ethiopian bank/wallet receipt URL patterns.
 * Used to detect and extract verification URLs from AI-extracted text or image OCR output.
 */
const URL_PATTERNS: Array<{
  provider: string;
  patterns: RegExp[];
  buildUrl?: (match: RegExpMatchArray) => string;
}> = [
  {
    provider: "cbe",
    patterns: [
      /https?:\/\/(?:apps\.)?cbe\.com\.et\/[^\s"'<>]+/gi,
      /https?:\/\/(?:www\.)?combanketh\.et\/[^\s"'<>]+/gi,
    ],
  },
  {
    provider: "telebirr",
    patterns: [
      /https?:\/\/transactioninfo\.ethiotelecom\.et\/[^\s"'<>]+/gi,
      /https?:\/\/(?:www\.)?ethiotelecom\.et\/[^\s"'<>]+/gi,
    ],
  },
  {
    provider: "dashen",
    patterns: [
      /https?:\/\/(?:www\.)?(?:dashenbank|amoleapp)\.com(?:\.et)?\/[^\s"'<>]+/gi,
      /https?:\/\/ibank\.dashenbank\.com\.et\/[^\s"'<>]+/gi,
    ],
  },
  {
    provider: "abyssinia",
    patterns: [
      /https?:\/\/(?:www\.)?bankofabyssinia\.com\/[^\s"'<>]+/gi,
      /https?:\/\/(?:www\.)?boabank\.com\.et\/[^\s"'<>]+/gi,
      /https?:\/\/apollo\.bankofabyssinia\.com\/[^\s"'<>]+/gi,
    ],
  },
  {
    provider: "awash",
    patterns: [
      /https?:\/\/(?:www\.)?awashbank\.com(?:\.et)?\/[^\s"'<>]+/gi,
      /https?:\/\/ib\.awashbank\.com\/[^\s"'<>]+/gi,
    ],
  },
  {
    provider: "zemen",
    patterns: [
      /https?:\/\/(?:www\.)?zemenbank\.com(?:\.et)?\/[^\s"'<>]+/gi,
    ],
  },
  {
    provider: "m-pesa",
    patterns: [
      /https?:\/\/(?:www\.)?mpesa\.safaricom\.et\/[^\s"'<>]+/gi,
    ],
  },
  {
    provider: "oromia",
    patterns: [
      /https?:\/\/(?:www\.)?coaboromia\.com(?:\.et)?\/[^\s"'<>]+/gi,
    ],
  },
  {
    provider: "abay",
    patterns: [
      /https?:\/\/(?:www\.)?abaybank\.com\.et\/[^\s"'<>]+/gi,
    ],
  },
];

export interface ExtractedUrl {
  url: string;
  provider: string;
  receiptId: string;
}

/**
 * Extracts receipt verification URLs from text content (AI OCR output or raw text).
 * Returns the first valid URL found with its detected provider.
 */
export function extractReceiptUrl(text: string): ExtractedUrl | null {
  if (!text || text.trim().length === 0) return null;

  for (const { provider, patterns } of URL_PATTERNS) {
    for (const pattern of patterns) {
      // Reset regex state
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (match) {
        const url = match[0].replace(/[.,;:!?)]+$/, ""); // Clean trailing punctuation
        const receiptId = extractReceiptIdFromUrl(url);

        logger.info(`🔗 Detected ${provider} receipt URL: ${url}`);
        return { url, provider, receiptId };
      }
    }
  }

  // Fallback: detect any generic URL in the text
  const genericUrlMatch = text.match(/https?:\/\/[^\s"'<>]{10,}/gi);
  if (genericUrlMatch) {
    const url = genericUrlMatch[0].replace(/[.,;:!?)]+$/, "");
    const provider = detectProviderFromUrl(url);
    const receiptId = extractReceiptIdFromUrl(url);

    logger.info(`🔗 Detected generic receipt URL (provider: ${provider}): ${url}`);
    return { url, provider, receiptId };
  }

  return null;
}

/**
 * Extracts a receipt/transaction ID from a URL path.
 */
function extractReceiptIdFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/").filter(Boolean);

    // The last path segment is often the receipt ID
    const lastSegment = pathParts[pathParts.length - 1];
    if (lastSegment && /^[A-Za-z0-9_-]{4,}$/.test(lastSegment)) {
      return lastSegment;
    }

    // Check query parameters
    const txnId =
      parsed.searchParams.get("transactionId") ||
      parsed.searchParams.get("txnId") ||
      parsed.searchParams.get("ref") ||
      parsed.searchParams.get("id") ||
      parsed.searchParams.get("receiptId");

    if (txnId) return txnId;
  } catch {
    // Invalid URL
  }

  return "";
}

/**
 * Detects the bank/wallet provider from a URL domain.
 */
function detectProviderFromUrl(url: string): string {
  const lower = url.toLowerCase();

  if (lower.includes("cbe.com.et") || lower.includes("combanketh")) return "cbe";
  if (lower.includes("ethiotelecom") || lower.includes("telebirr")) return "telebirr";
  if (lower.includes("dashenbank") || lower.includes("amoleapp")) return "dashen";
  if (lower.includes("bankofabyssinia") || lower.includes("boabank") || lower.includes("apollo")) return "abyssinia";
  if (lower.includes("awashbank")) return "awash";
  if (lower.includes("zemenbank")) return "zemen";
  if (lower.includes("mpesa") || lower.includes("safaricom")) return "m-pesa";
  if (lower.includes("coaboromia")) return "oromia";
  if (lower.includes("abaybank")) return "abay";

  return "unknown";
}

/**
 * Detects the bank/wallet provider from a payment method name (from AI extraction).
 */
export function detectProviderFromName(paymentMethod: string): string {
  if (!paymentMethod) return "unknown";
  const lower = paymentMethod.toLowerCase();

  if (lower.includes("cbe") && !lower.includes("birr")) return "cbe";
  if (lower.includes("cbe birr")) return "cbe";
  if (lower.includes("telebirr")) return "telebirr";
  if (lower.includes("dashen")) return "dashen";
  if (lower.includes("abyssinia") || lower.includes("boa")) return "abyssinia";
  if (lower.includes("awash")) return "awash";
  if (lower.includes("zemen")) return "zemen";
  if (lower.includes("m-pesa") || lower.includes("mpesa")) return "m-pesa";
  if (lower.includes("oromia") || lower.includes("cooperative")) return "oromia";
  if (lower.includes("abay")) return "abay";

  return "unknown";
}
