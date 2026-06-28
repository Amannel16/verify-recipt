import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { api } from "@/utils/api";

export type VerificationStatus = "approved" | "suspicious" | "rejected";

export interface VerificationRecord {
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
  imageUri?: string;
  createdAt: string;
  userId: string;
}

interface VerificationContextType {
  verifications: VerificationRecord[];
  loading: boolean;
  addVerification: (record: Omit<VerificationRecord, "userId">) => Promise<void>;
  deleteVerification: (id: string) => Promise<void>;
  refreshVerifications: () => Promise<void>;
  getStats: () => {
    total: number;
    approved: number;
    rejected: number;
    suspicious: number;
    fraudAttempts: number;
  };
}

const VerificationContext = createContext<VerificationContextType | null>(null);

const STORAGE_KEY = "payverify_verifications";

// Normalize backend verification to frontend shape
function normalizeVerification(v: Record<string, unknown>): VerificationRecord {
  const status = ((v.status as string) ?? "SUSPICIOUS").toLowerCase() as VerificationStatus;
  return {
    id: (v.id as string) ?? "",
    status,
    confidence: (v.confidence as number) ?? 0,
    transactionId: (v.transactionId as string) ?? "N/A",
    senderName: (v.senderName as string) ?? "Unknown",
    receiverName: (v.receiverName as string) ?? "Unknown",
    amount: (v.amount as number) ?? 0,
    currency: (v.currency as string) ?? "ETB",
    date: (v.date as string) ?? "",
    time: (v.time as string) ?? "",
    paymentMethod: (v.paymentMethod as string) ?? "Unknown",
    reasons: (v.reasons as string[]) ?? [],
    warnings: (v.warnings as string[]) ?? [],
    imageUri: (v.imageUrl as string) ?? (v.imageUri as string) ?? undefined,
    createdAt: (v.createdAt as string) ?? new Date().toISOString(),
    userId: (v.userId as string) ?? "",
  };
}

export function VerificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadVerifications(user.id);
    } else {
      setVerifications([]);
    }
  }, [user?.id]);

  async function loadVerifications(userId: string) {
    setLoading(true);
    try {
      // Load cached first for instant UI
      const cached = await AsyncStorage.getItem(`${STORAGE_KEY}_${userId}`);
      if (cached) {
        setVerifications(JSON.parse(cached));
      }

      // Fetch from backend
      const response = await api.get<{
        verifications: Record<string, unknown>[];
        pagination: unknown;
      }>("/verify/history");

      if (response.success && response.data?.verifications) {
        const normalized = response.data.verifications.map(normalizeVerification);
        setVerifications(normalized);
        await AsyncStorage.setItem(
          `${STORAGE_KEY}_${userId}`,
          JSON.stringify(normalized),
        );
      }
    } catch (e) {
      // Use cached data on failure
    } finally {
      setLoading(false);
    }
  }

  const addVerification = useCallback(
    async (record: Omit<VerificationRecord, "userId">) => {
      if (!user) return;

      // The record comes from the API response (already saved server-side)
      // Just add it to the local state
      const full: VerificationRecord = { ...record, userId: user.id };
      setVerifications((prev) => {
        const updated = [full, ...prev];
        AsyncStorage.setItem(
          `${STORAGE_KEY}_${user.id}`,
          JSON.stringify(updated),
        );
        return updated;
      });
    },
    [user],
  );

  const deleteVerification = useCallback(
    async (id: string) => {
      if (!user) return;

      // Delete from backend
      try {
        await api.delete(`/verify/${id}`);
      } catch {
        // Continue with local deletion even if backend fails
      }

      setVerifications((prev) => {
        const updated = prev.filter((v) => v.id !== id);
        AsyncStorage.setItem(
          `${STORAGE_KEY}_${user.id}`,
          JSON.stringify(updated),
        );
        return updated;
      });
    },
    [user],
  );

  const refreshVerifications = useCallback(async () => {
    if (user) {
      await loadVerifications(user.id);
    }
  }, [user]);

  const getStats = useCallback(() => {
    const total = verifications.length;
    const approved = verifications.filter((v) => v.status === "approved").length;
    const rejected = verifications.filter((v) => v.status === "rejected").length;
    const suspicious = verifications.filter((v) => v.status === "suspicious").length;
    const fraudAttempts = rejected + suspicious;
    return { total, approved, rejected, suspicious, fraudAttempts };
  }, [verifications]);

  return (
    <VerificationContext.Provider
      value={{
        verifications,
        loading,
        addVerification,
        deleteVerification,
        refreshVerifications,
        getStats,
      }}
    >
      {children}
    </VerificationContext.Provider>
  );
}

export function useVerifications() {
  const ctx = useContext(VerificationContext);
  if (!ctx) throw new Error("useVerifications must be used inside VerificationProvider");
  return ctx;
}
