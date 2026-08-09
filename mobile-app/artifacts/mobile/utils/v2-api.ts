import { api } from "./api";

export interface V2VerificationPayload {
  fileUri?: string;
  text?: string;
  url?: string;
  transactionId?: string;
  quickMode?: boolean;
}

export interface V2VerificationResponse {
  verificationId: string;
  status: "VERIFIED" | "HIGH_CONFIDENCE" | "SUSPICIOUS" | "HIGH_RISK" | "REJECTED" | "UNVERIFIABLE";
  confidence: number;
  provider?: string;
  transaction?: {
    transactionId?: string;
    amount?: number;
    currency?: string;
    sender?: { name?: string };
    receiver?: { name?: string };
    date?: string;
  };
  evidence?: Record<string, any>;
  riskChecks?: { name: string; score: number; status: string; detail: string }[];
  fraudSignals?: { type: string; severity: string; description: string }[];
  timeline?: { stage: string; status: string; durationMs: number }[];
  createdAt: string;
}

export async function verifyV2Evidence(payload: V2VerificationPayload): Promise<V2VerificationResponse> {
  let response;

  if (payload.fileUri) {
    response = await api.uploadFile<V2VerificationResponse>(
      "/v2/verify",
      payload.fileUri,
      "receipt",
      {
        ...(payload.text ? { text: payload.text } : {}),
        ...(payload.url ? { url: payload.url } : {}),
        ...(payload.transactionId ? { transactionId: payload.transactionId } : {}),
        quickMode: String(payload.quickMode ?? true),
      }
    );
  } else {
    response = await api.post<V2VerificationResponse>("/v2/verify", {
      text: payload.text,
      url: payload.url,
      transactionId: payload.transactionId,
      quickMode: payload.quickMode ?? true,
    });
  }

  if (!response.success || !response.data) {
    throw new Error(response.message || "V2 Verification request failed");
  }

  return response.data;
}
