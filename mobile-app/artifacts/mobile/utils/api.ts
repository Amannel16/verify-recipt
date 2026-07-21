import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://217.217.249.150:7001";

const TOKEN_KEY = "payverify_access_token";

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: unknown;
}

class ApiClient {
  private baseUrl: string;
  public onUnauthorized?: () => void;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  async setToken(token: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  }

  async clearToken(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }

  async request<T>(
    method: string,
    endpoint: string,
    options?: {
      body?: Record<string, unknown> | FormData;
      requireAuth?: boolean;
      isFormData?: boolean;
    },
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}/api${endpoint}`;
    const headers: Record<string, string> = {};

    // Add auth token if needed
    if (options?.requireAuth !== false) {
      const token = await this.getToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    // Set content type (unless FormData which sets its own)
    if (!options?.isFormData) {
      headers["Content-Type"] = "application/json";
    }

    let bodyContent: string | FormData | undefined;
    if (options?.body) {
      if (options.isFormData) {
        bodyContent = options.body as FormData;
      } else {
        bodyContent = JSON.stringify(options.body);
      }
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: bodyContent,
      });

      const data = (await response.json()) as ApiResponse<T>;

      if (!response.ok) {
        // Handle 401 — token expired
        if (response.status === 401) {
          await this.clearToken();
          if (this.onUnauthorized) {
            this.onUnauthorized();
          }
        }
        return {
          success: false,
          message: data.message || `Request failed with status ${response.status}`,
          error: data.error,
        };
      }

      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network error";
      console.error(`API Error [${method} ${endpoint}]:`, message);
      return {
        success: false,
        message: `Network error: ${message}. Make sure the backend is running.`,
      };
    }
  }

  // Convenience methods
  get<T>(endpoint: string, requireAuth = true) {
    return this.request<T>("GET", endpoint, { requireAuth });
  }

  post<T>(endpoint: string, body?: Record<string, unknown>, requireAuth = true) {
    return this.request<T>("POST", endpoint, { body, requireAuth });
  }

  put<T>(endpoint: string, body?: Record<string, unknown>, requireAuth = true) {
    return this.request<T>("PUT", endpoint, { body, requireAuth });
  }

  delete<T>(endpoint: string, requireAuth = true) {
    return this.request<T>("DELETE", endpoint, { requireAuth });
  }

  // File upload
  async uploadFile<T>(
    endpoint: string,
    fileUri: string,
    fieldName = "receipt",
    additionalFields?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();

    // Decode and normalize URI
    let cleanUri = decodeURIComponent(fileUri);
    if (Platform.OS === "android" && !cleanUri.startsWith("file://") && cleanUri.startsWith("file:")) {
      cleanUri = cleanUri.replace("file:", "file://");
    }

    // Get filename and type from URI
    const uriParts = cleanUri.split("/");
    const fileName = uriParts[uriParts.length - 1] ?? "receipt.jpg";
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "jpg";
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      heic: "image/heic",
    };

    formData.append(fieldName, {
      uri: cleanUri,
      name: fileName,
      type: mimeTypes[ext] ?? "image/jpeg",
    } as unknown as Blob);

    if (additionalFields) {
      for (const [key, value] of Object.entries(additionalFields)) {
        formData.append(key, value);
      }
    }

    return this.request<T>("POST", endpoint, {
      body: formData,
      isFormData: true,
      requireAuth: true,
    });
  }
}

export const api = new ApiClient(API_BASE_URL);
export { TOKEN_KEY };
