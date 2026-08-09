/**
 * GEBA AI V2.0 — Core Domain & Evidence Types
 */

export type EvidenceType =
  | "BANK_RECEIPT"
  | "MOBILE_BANKING_SCREENSHOT"
  | "USSD_SCREENSHOT"
  | "SMS_SCREENSHOT"
  | "SMS_TEXT"
  | "QR_CODE"
  | "QR_SCREENSHOT"
  | "CAMERA_PHOTO"
  | "PDF_RECEIPT"
  | "TRANSACTION_ID"
  | "REFERENCE_NUMBER"
  | "RECEIPT_URL"
  | "MANUAL_TRANSACTION"
  | "UNKNOWN";

export type IdentifierType =
  | "TRANSACTION_ID"
  | "REFERENCE"
  | "TOKEN"
  | "RECEIPT_ID"
  | "AUTHORIZATION_CODE"
  | "UNKNOWN";

export interface TransactionIdentifier {
  provider: string;
  identifierType: IdentifierType;
  identifierValue: string;
}

export interface PartyInfo {
  name?: string;
  account?: string;
  phone?: string;
}

export interface NormalizedTransaction {
  provider?: string;
  receiptIssuer?: string;
  originProvider?: string;
  destinationInstitution?: string;
  paymentNetwork?: string;
  verificationAuthority?: string;

  transactionId?: string;
  referenceNumber?: string;

  sender?: PartyInfo;
  receiver?: PartyInfo;

  amount?: number;
  fee?: number;
  totalAmount?: number;
  currency?: string;

  date?: string;
  time?: string;

  paymentMethod?: string;
  status?: string;

  qrUrl?: string;
  receiptUrl?: string;

  sourceType: EvidenceType;
  extractionConfidence: number;
  fieldConfidence?: Record<string, number>;
}

export interface EvidenceInput {
  type?: EvidenceType;
  filePath?: string;
  fileBuffer?: Buffer;
  mimeType?: string;
  text?: string;
  url?: string;
  transactionId?: string;
  manualData?: Partial<NormalizedTransaction>;
  expectedMerchant?: {
    amount?: number;
    receiverName?: string;
    currency?: string;
    transactionId?: string;
    senderName?: string;
    phone?: string;
  };
}

export interface ProviderCandidate {
  provider: string;
  confidence: number;
  reasons: string[];
}

export interface ProviderFingerprint {
  candidates: ProviderCandidate[];
  topProvider: string | null;
  topConfidence: number;
}

export interface VerificationStageTimeline {
  stage: string;
  timestamp: string;
  durationMs: number;
  status: "SUCCESS" | "WARNING" | "FAILED" | "SKIPPED";
  detail?: string;
}

export type VerdictStatus =
  | "VERIFIED"
  | "HIGH_CONFIDENCE"
  | "SUSPICIOUS"
  | "HIGH_RISK"
  | "REJECTED"
  | "UNVERIFIABLE";

export interface RiskCheck {
  name: string;
  score: number;
  status: "PASS" | "FAIL" | "SKIP" | "WARN";
  detail: string;
}

export interface FraudSignal {
  type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  description: string;
  metadata?: Record<string, any>;
}

export interface DuplicateInfo {
  isDuplicate: boolean;
  duplicateOfId?: string;
  hashMatch?: boolean;
  txIdMatch?: boolean;
  replayDetected?: boolean;
  velocityAlert?: boolean;
  details?: string;
}

export interface EvidenceResult {
  passed: boolean;
  confidence: number;
  source: string;
  details?: Record<string, any>;
}

export interface V2VerificationResult {
  verificationId: string;
  status: VerdictStatus;
  confidence: number;
  provider?: string;
  transaction?: NormalizedTransaction;
  evidence: {
    ocr?: EvidenceResult;
    ai?: EvidenceResult;
    qr?: EvidenceResult;
    sms?: EvidenceResult;
    ussd?: EvidenceResult;
    official?: EvidenceResult;
    merchant?: EvidenceResult;
    forensic?: EvidenceResult;
  };
  riskChecks: RiskCheck[];
  fraudSignals: FraudSignal[];
  duplicateInfo?: DuplicateInfo;
  timeline: VerificationStageTimeline[];
  errors?: { code: string; message: string; retryable?: boolean }[];
  scrapedData?: any;
  crossValidation?: any;
  createdAt: string;
}

export interface PaymentProviderAdapter {
  providerId: string;
  detectEvidence(input: EvidenceInput): Promise<{ isSupported: boolean; confidence: number }>;
  extractTransaction(input: EvidenceInput): Promise<NormalizedTransaction>;
  decodeQR?(input: EvidenceInput): Promise<string | null>;
  validateDomain?(url: string): Promise<boolean>;
  buildReceiptVerificationUrl(transaction: NormalizedTransaction): Promise<string | null>;
  verifyOfficialTransaction(transaction: NormalizedTransaction): Promise<{
    verified: boolean;
    data?: Partial<NormalizedTransaction>;
    rawHtml?: string;
    error?: string;
  }>;
  parseSMS?(text: string): Promise<NormalizedTransaction | null>;
  parseUSSD?(text: string): Promise<NormalizedTransaction | null>;
}
