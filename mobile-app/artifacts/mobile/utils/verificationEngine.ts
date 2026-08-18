import { api } from "@/utils/api";
import type { VerificationStatus } from "@/contexts/VerificationContext";

// ─────────────────────────────────────────────────────────────
// Types for Cross-Validation & Scraped Data
// ─────────────────────────────────────────────────────────────

export interface FieldMatch {
  field: string;
  aiValue: string | number | null;
  scrapedValue: string | number | null;
  matches: boolean;
  confidence: number;
  note?: string;
}

export interface CrossValidationData {
  overallMatch: "MATCH" | "PARTIAL_MATCH" | "MISMATCH" | "UNABLE_TO_VERIFY";
  crossValidationScore: number;
  fieldMatches: FieldMatch[];
  discrepancies: string[];
  summary: string;
}

export interface ScrapedData {
  isValid: boolean;
  senderName?: string;
  receiverName?: string;
  amount?: number;
  transactionId?: string;
  date?: string;
  status?: string;
}

export interface AnalysisResult {
  id: string;
  status: VerificationStatus;
  confidence: number;
  transactionId: string;
  senderName: string;
  receiverName: string;
  amount: number;
  currency: string;
  date: string;
  time: string;
  paymentMethod: string;
  reasons: string[];
  warnings: string[];
  imageUrl?: string;
  receiptUrl?: string | null;
  scrapedData?: ScrapedData | null;
  crossValidation?: CrossValidationData | null;
  isDuplicate?: boolean;
  duplicateRiskLevel?: string;
  processingTimeMs?: number;
}

/**
 * Analyzes a receipt image by uploading it to the backend API.
 * The backend performs AI analysis (Gemini Vision or rule-based),
 * URL scraping, cross-validation, and duplicate detection.
 */
export async function analyzeReceipt(
  imageUri: string,
  transactionId?: string,
): Promise<AnalysisResult> {
  // Upload image and verify in one request to /verify/receipt
  const additionalFields: Record<string, string> = {};
  if (transactionId) {
    additionalFields.transactionId = transactionId;
  }

  const response = await api.uploadFile<Record<string, unknown>>(
    "/verify/receipt",
    imageUri,
    "receipt",
    additionalFields,
  );

  if (!response.success || !response.data || typeof response.data !== "object") {
    throw new Error(response.message || "Failed to analyze receipt");
  }

  const data = response.data as Record<string, any>;
  const status = ((data.status as string) ?? "SUSPICIOUS").toLowerCase() as VerificationStatus;

  const normTx = (data.transaction as any) || (data.normalizedTransaction as any);
  const scraped = (data.scrapedData as any) || (data.official as any);
  const crossVal = (data.crossValidation as any);

  const rawTxId = (data.transactionId as string) || normTx?.transactionId || scraped?.transactionId;
  const cleanTxId = (rawTxId && !rawTxId.startsWith("v2-")) ? rawTxId : (normTx?.transactionId || "N/A");

  function cleanValue(val: unknown): string | null {
    if (typeof val !== "string") return null;
    const trimmed = val.trim();
    if (!trimmed || /^(?:unknown|n\/a|—|-)$/i.test(trimmed)) return null;
    return trimmed;
  }

  const senderName =
    cleanValue(data.senderName) ||
    cleanValue(normTx?.sender?.name) ||
    cleanValue(scraped?.senderName) ||
    cleanValue(scraped?.sender?.name) ||
    cleanValue(crossVal?.fieldMatches?.find((f: any) => f.field === "Sender Name")?.scrapedValue) ||
    cleanValue(crossVal?.fieldMatches?.find((f: any) => f.field === "Sender Name")?.aiValue) ||
    "Unknown";

  const receiverName =
    cleanValue(data.receiverName) ||
    cleanValue(normTx?.receiver?.name) ||
    cleanValue(scraped?.receiverName) ||
    cleanValue(scraped?.receiver?.name) ||
    cleanValue(crossVal?.fieldMatches?.find((f: any) => f.field === "Receiver Name")?.scrapedValue) ||
    cleanValue(crossVal?.fieldMatches?.find((f: any) => f.field === "Receiver Name")?.aiValue) ||
    "Unknown";

  const rawReasons = Array.isArray(data.reasons) ? data.reasons : [];
  const rawWarnings = Array.isArray(data.warnings) ? data.warnings : [];

  return {
    id: (data.id as string) ?? (data.verificationId as string) ?? "",
    status,
    confidence: (data.confidence as number) ?? 0,
    transactionId: cleanTxId,
    senderName,
    receiverName,
    amount: (data.amount as number) ?? normTx?.amount ?? scraped?.amount ?? 0,
    currency: (data.currency as string) ?? normTx?.currency ?? "ETB",
    date: (data.date as string) ?? normTx?.date ?? scraped?.date ?? new Date().toLocaleDateString(),
    time: (data.time as string) ?? normTx?.time ?? new Date().toLocaleTimeString(),
    paymentMethod: (data.paymentMethod as string) ?? normTx?.provider?.toUpperCase() ?? "CBE",
    reasons: rawReasons.filter((r: any) => typeof r === "string" && !/gemini|api failure|api key|vision/i.test(r)),
    warnings: rawWarnings.filter((w: any) => typeof w === "string" && !/gemini|api failure|api key|vision/i.test(w)),
    imageUrl: (data.imageUrl as string) ?? undefined,
    receiptUrl: (data.receiptUrl as string) ?? null,
    scrapedData: (data.scrapedData as ScrapedData) ?? null,
    crossValidation: (data.crossValidation as CrossValidationData) ?? null,
    isDuplicate: (data.isDuplicate as boolean) ?? false,
    duplicateRiskLevel: (data.duplicateRiskLevel as string) ?? "NONE",
    processingTimeMs: (data.processingTimeMs as number) ?? undefined,
  };
}
