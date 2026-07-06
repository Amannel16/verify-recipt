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

  if (!response.success || !response.data) {
    throw new Error(response.message || "Failed to analyze receipt");
  }

  const data = response.data;
  const status = ((data.status as string) ?? "SUSPICIOUS").toLowerCase() as VerificationStatus;

  return {
    id: (data.id as string) ?? "",
    status,
    confidence: (data.confidence as number) ?? 0,
    transactionId: (data.transactionId as string) ?? "N/A",
    senderName: (data.senderName as string) ?? "Unknown",
    receiverName: (data.receiverName as string) ?? "Unknown",
    amount: (data.amount as number) ?? 0,
    currency: (data.currency as string) ?? "ETB",
    date: (data.date as string) ?? new Date().toLocaleDateString(),
    time: (data.time as string) ?? new Date().toLocaleTimeString(),
    paymentMethod: (data.paymentMethod as string) ?? "Unknown",
    reasons: (data.reasons as string[]) ?? [],
    warnings: (data.warnings as string[]) ?? [],
    imageUrl: (data.imageUrl as string) ?? undefined,
    receiptUrl: (data.receiptUrl as string) ?? null,
    scrapedData: (data.scrapedData as ScrapedData) ?? null,
    crossValidation: (data.crossValidation as CrossValidationData) ?? null,
    isDuplicate: (data.isDuplicate as boolean) ?? false,
    duplicateRiskLevel: (data.duplicateRiskLevel as string) ?? "NONE",
    processingTimeMs: (data.processingTimeMs as number) ?? undefined,
  };
}
