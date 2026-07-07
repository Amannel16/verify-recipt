import { logger } from "../../utils/logger/logger.js";

// ─────────────────────────────────────────────────────────────
// Trusted Domain Whitelist
// ─────────────────────────────────────────────────────────────

/**
 * Official bank/wallet domains for Ethiopian financial institutions.
 * ONLY these domains are trusted for receipt verification scraping.
 * Any URL not matching these is treated as potentially fraudulent.
 */
const TRUSTED_DOMAINS: Record<string, string[]> = {
  cbe: [
    "cbe.com.et",
    "apps.cbe.com.et",
    "cbebirr.cbe.com.et",
    "combanketh.et",
    "www.cbe.com.et",
  ],
  telebirr: [
    "ethiotelecom.et",
    "transactioninfo.ethiotelecom.et",
    "telebirr.et",
    "www.ethiotelecom.et",
  ],
  dashen: [
    "dashenbanksc.com",
    "dashenbank.com.et",
    "ibank.dashenbank.com.et",
    "www.dashenbanksc.com",
    "www.dashenbank.com.et",
  ],
  abyssinia: [
    "bankofabyssinia.com",
    "boabank.com.et",
    "apollo.bankofabyssinia.com",
    "www.bankofabyssinia.com",
    "www.boabank.com.et",
  ],
  awash: [
    "awashbank.com",
    "awashbank.com.et",
    "ib.awashbank.com",
    "www.awashbank.com",
    "www.awashbank.com.et",
  ],
  zemen: [
    "zemenbank.com",
    "zemenbank.com.et",
    "www.zemenbank.com",
    "www.zemenbank.com.et",
  ],
  "m-pesa": [
    "mpesa.safaricom.et",
    "safaricom.et",
    "www.safaricom.et",
  ],
  oromia: [
    "coaboromia.com",
    "coaboromia.com.et",
    "www.coaboromia.com",
  ],
  abay: [
    "abaybank.com.et",
    "www.abaybank.com.et",
  ],
};

/**
 * Known URL shortener domains. Legitimate bank receipts should never use these.
 */
const SHORTENER_DOMAINS = [
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "rebrand.ly",
  "shorturl.at",
  "cutt.ly",
  "short.io",
  "tiny.cc",
  "lnkd.in",
  "rb.gy",
  "s.id",
];

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface DomainValidationResult {
  /** Whether the domain is in the trusted whitelist */
  isTrusted: boolean;
  /** Whether the URL uses HTTPS */
  isHttps: boolean;
  /** Whether the URL is a known shortener */
  isShortened: boolean;
  /** Whether the URL domain mismatches the bank detected by OCR/AI */
  hasBankMismatch: boolean;
  /** The bank provider the URL domain belongs to (if whitelisted) */
  matchedProvider: string | null;
  /** The bank provider detected by OCR/AI from the receipt image */
  detectedProvider: string | null;
  /** The raw hostname extracted from the URL */
  hostname: string;
  /** Human-readable warnings for the API response */
  warnings: string[];
  /** Total risk penalty points from domain checks (0–50+) */
  riskPenalty: number;
}

// ─────────────────────────────────────────────────────────────
// Core Functions
// ─────────────────────────────────────────────────────────────

/**
 * Normalizes a hostname by lowercasing and stripping a leading "www." prefix.
 * This prevents attackers from bypassing the whitelist with trivial variations.
 */
function normalizeDomain(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

/**
 * Extracts the hostname from a URL string safely.
 * Returns null if the URL is malformed.
 */
function extractHostname(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Checks if a hostname matches any entry in a bank's trusted domain list.
 * Matching is exact after normalization — no substring matching allowed.
 * This prevents look-alike domains like "cbebank.com.et" from passing.
 */
function findTrustedProvider(hostname: string): string | null {
  const normalized = normalizeDomain(hostname);

  for (const [provider, domains] of Object.entries(TRUSTED_DOMAINS)) {
    for (const trustedDomain of domains) {
      const normalizedTrusted = normalizeDomain(trustedDomain);
      // Exact match or subdomain of a trusted domain
      if (normalized === normalizedTrusted || normalized.endsWith(`.${normalizedTrusted}`)) {
        return provider;
      }
    }
  }
  return null;
}

/**
 * Detects if a URL uses a known public URL shortener.
 */
function isKnownShortener(hostname: string): boolean {
  const normalized = normalizeDomain(hostname);
  return SHORTENER_DOMAINS.some(
    (shortener) => normalized === shortener || normalized.endsWith(`.${shortener}`)
  );
}

/**
 * Comprehensive domain validation for a receipt URL.
 *
 * Performs the following checks:
 * 1. HTTPS enforcement — rejects plain HTTP
 * 2. Shortened URL detection — flags bit.ly, tinyurl, etc.
 * 3. Trusted domain whitelist — checks against official bank domains
 * 4. Bank-domain mismatch — verifies URL belongs to the same bank detected by OCR
 *
 * @param url - The receipt verification URL to validate
 * @param detectedBank - The bank provider detected by AI/OCR from the receipt image (e.g. "cbe", "telebirr")
 * @returns DomainValidationResult with trust status, warnings, and risk penalty
 */
export function validateDomain(url: string, detectedBank: string | null): DomainValidationResult {
  const result: DomainValidationResult = {
    isTrusted: false,
    isHttps: true,
    isShortened: false,
    hasBankMismatch: false,
    matchedProvider: null,
    detectedProvider: detectedBank,
    hostname: "",
    warnings: [],
    riskPenalty: 0,
  };

  // Parse the URL
  const hostname = extractHostname(url);
  if (!hostname) {
    result.warnings.push("🚫 URL is malformed and cannot be parsed");
    result.riskPenalty = 50;
    logger.warn(`🔒 Domain validation FAILED: malformed URL "${url}"`);
    return result;
  }

  result.hostname = hostname;

  // 1. HTTPS check
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      result.isHttps = false;
      result.warnings.push("🔓 URL uses HTTP instead of HTTPS — no transport encryption");
      result.riskPenalty += 15;
      logger.warn(`🔒 Domain validation: HTTP detected (no TLS) for "${hostname}"`);
    }
  } catch {
    // Already handled above
  }

  // 2. Shortened URL check
  if (isKnownShortener(hostname)) {
    result.isShortened = true;
    result.warnings.push(`🔗 URL uses a public shortener (${hostname}) — bank receipts should not use URL shorteners`);
    result.riskPenalty += 20;
    logger.warn(`🔒 Domain validation: shortened URL detected "${hostname}"`);
  }

  // 3. Trusted domain whitelist check
  const matchedProvider = findTrustedProvider(hostname);
  if (matchedProvider) {
    result.isTrusted = true;
    result.matchedProvider = matchedProvider;
    logger.info(`🔒 Domain validation PASSED: "${hostname}" is trusted (provider: ${matchedProvider})`);
  } else {
    result.isTrusted = false;
    result.warnings.push(`🚫 Domain "${hostname}" is NOT in the trusted bank whitelist — receipt URL may be fraudulent`);
    result.riskPenalty += 50;
    logger.warn(`🔒 Domain validation FAILED: "${hostname}" is not whitelisted`);
  }

  // 4. Bank-domain mismatch check
  if (matchedProvider && detectedBank && matchedProvider !== detectedBank.toLowerCase()) {
    result.hasBankMismatch = true;
    result.warnings.push(
      `⚠️ Bank mismatch: Receipt appears to be from "${detectedBank}" but URL domain belongs to "${matchedProvider}"`
    );
    result.riskPenalty += 40;
    logger.warn(
      `🔒 Domain validation: Bank mismatch! OCR says "${detectedBank}" but URL is "${matchedProvider}" (${hostname})`
    );
  }

  logger.info(
    `🔒 Domain validation summary: trusted=${result.isTrusted}, https=${result.isHttps}, shortened=${result.isShortened}, bankMismatch=${result.hasBankMismatch}, penalty=${result.riskPenalty}`
  );

  return result;
}

/**
 * Simple boolean: is this URL's domain in any bank's trusted whitelist?
 */
export function isTrustedDomain(url: string): boolean {
  const hostname = extractHostname(url);
  if (!hostname) return false;
  return findTrustedProvider(hostname) !== null;
}

/**
 * Quick check: does this URL use HTTPS?
 */
export function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
