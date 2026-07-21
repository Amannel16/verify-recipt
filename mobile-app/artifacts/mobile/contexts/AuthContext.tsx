import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/utils/api";

export type BusinessType =
  | "Retail"
  | "Restaurant"
  | "E-commerce"
  | "Services"
  | "Healthcare"
  | "Education"
  | "Other";

export type Plan = "free" | "pro" | "enterprise";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  businessName: string;
  phoneNumber: string;
  email: string;
  businessType: BusinessType;
  plan: Plan;
  verificationsUsed: number;
  verificationsLimit: number;
  joinedAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (data: SignUpData) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  upgradePlan: (plan: Plan) => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface SignUpData {
  fullName: string;
  businessName: string;
  email: string;
  password: string;
  businessType: BusinessType;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_KEY = "payverify_session";

// Helper to normalize backend user shape to frontend User shape
function normalizeUser(backendUser: Record<string, unknown>): User {
  const firstName = (backendUser.firstName as string) ?? "";
  const lastName = (backendUser.lastName as string) ?? "";
  const plan = ((backendUser.plan as string) ?? "FREE").toLowerCase() as Plan;

  return {
    id: (backendUser.id as string) ?? "",
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    businessName: (backendUser.businessName as string) ?? "",
    phoneNumber: (backendUser.phoneNumber as string) ?? "",
    email: (backendUser.email as string) ?? "",
    businessType: (backendUser.businessType as BusinessType) ?? "Other",
    plan,
    verificationsUsed: (backendUser.verificationsUsed as number) ?? 0,
    verificationsLimit: (backendUser.verificationsLimit as number) ?? 20,
    joinedAt: (backendUser.createdAt as string) ?? new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Handle unauthorized globally (session expiration)
    api.onUnauthorized = () => {
      setUser(null);
      AsyncStorage.removeItem(SESSION_KEY);
    };

    loadSession();

    return () => {
      api.onUnauthorized = undefined;
    };
  }, []);

  async function loadSession() {
    try {
      // Try to load cached session first (for instant UI)
      const sessionJson = await AsyncStorage.getItem(SESSION_KEY);
      if (sessionJson) {
        setUser(JSON.parse(sessionJson));
        // Resolve loading immediately so cached dashboard displays while we refresh
        setLoading(false);
      } else {
        // No cached session - user is not logged in.
        // Don't wait for backend request to fail to show the login screen!
        setUser(null);
        setLoading(false);
        return;
      }

      // Then try to refresh from backend in the background
      const response = await api.get<Record<string, unknown>>("/user/profile");
      if (response.success && response.data) {
        const freshUser = normalizeUser(response.data);
        setUser(freshUser);
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(freshUser));
      } else if (response.message && response.message.toLowerCase().includes("token")) {
        // Token is expired or invalid, clear the session
        setUser(null);
        await AsyncStorage.removeItem(SESSION_KEY);
      }
    } catch (e) {
      // Offline or backend unavailable — use cached session
    } finally {
      setLoading(false);
    }
  }

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const response = await api.post<{
        user: Record<string, unknown>;
        accessToken: string;
      }>("/user/login", { email, password }, false);

      if (!response.success || !response.data) {
        return { success: false, error: response.message || "Login failed" };
      }

      const { user: backendUser, accessToken } = response.data;
      await api.setToken(accessToken);

      const normalizedUser = normalizeUser(backendUser);
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(normalizedUser));
      setUser(normalizedUser);

      return { success: true };
    } catch (e) {
      return { success: false, error: "Something went wrong. Please try again." };
    }
  }, []);

  const signUp = useCallback(async (data: SignUpData) => {
    try {
      const nameParts = data.fullName.trim().split(" ");
      const firstName = nameParts[0] ?? data.fullName;
      const lastName = nameParts.slice(1).join(" ") || "-";

      const response = await api.post<{
        user: Record<string, unknown>;
        accessToken: string;
      }>(
        "/user/register",
        {
          firstName,
          lastName,
          email: data.email,
          password: data.password,
          businessName: data.businessName,
          businessType: data.businessType,
        },
        false,
      );

      if (!response.success || !response.data) {
        return { success: false, error: response.message || "Registration failed" };
      }

      const { user: backendUser, accessToken } = response.data;
      await api.setToken(accessToken);

      const normalizedUser = normalizeUser(backendUser);
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(normalizedUser));
      setUser(normalizedUser);

      return { success: true };
    } catch (e) {
      return { success: false, error: "Something went wrong. Please try again." };
    }
  }, []);

  const signOut = useCallback(async () => {
    await api.clearToken();
    await AsyncStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (data: Partial<User>) => {
    if (!user) return;

    // Optimistic update
    const updated = { ...user, ...data };
    setUser(updated);
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(updated));

    // Sync with backend
    try {
      const response = await api.put<Record<string, unknown>>("/user/profile", {
        firstName: data.firstName ?? user.firstName,
        lastName: data.lastName ?? user.lastName,
        phoneNumber: data.phoneNumber,
        businessName: data.businessName,
        businessType: data.businessType,
      });

      if (response.success && response.data) {
        const fresh = normalizeUser(response.data);
        setUser(fresh);
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
      }
    } catch {
      // Keep optimistic update on failure
    }
  }, [user]);

  const upgradePlan = useCallback(async (plan: Plan) => {
    try {
      const response = await api.post<{
        user: Record<string, unknown>;
      }>("/subscription/upgrade", { plan: plan.toUpperCase() });

      if (response.success && response.data?.user) {
        const fresh = normalizeUser(response.data.user);
        setUser(fresh);
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
      }
    } catch {
      // Fallback: update locally
      const limits: Record<Plan, number> = { free: 20, pro: 999999, enterprise: 999999 };
      await updateProfile({ plan, verificationsLimit: limits[plan] } as Partial<User>);
    }
  }, [updateProfile]);

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get<Record<string, unknown>>("/user/profile");
      if (response.success && response.data) {
        const freshUser = normalizeUser(response.data);
        setUser(freshUser);
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(freshUser));
      }
    } catch {
      // Ignore — use cached
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, updateProfile, upgradePlan, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
