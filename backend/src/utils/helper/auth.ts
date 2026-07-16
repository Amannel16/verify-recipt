import jwt, { type SignOptions } from "jsonwebtoken";
import appConfig from "@/src/config/app_configs.js";

export type JwtExpiresIn = NonNullable<SignOptions["expiresIn"]>;

export function signTokenOptions(expiresIn: JwtExpiresIn): SignOptions {
  return { expiresIn };
}
import { UnauthenticatedError } from "@/src/utils/error/custom_error_handler.js";
import type { User } from "@/src/types/express.js";

const { ACCESS_TOKEN_SECRET } = appConfig;

// BMLA User type is already a subset, but we explicitly omit sensitive fields for consistency
export type SafeUser = Omit<
  User,
  | "password"
>;

export function verifyAccessToken(token: string): SafeUser {
  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET!) as {
      user: SafeUser;
    };
    if (!payload.user) throw new Error("No user in token");
    return payload.user;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    throw new UnauthenticatedError(
      "Invalid or expired token",
      "verifyAccessToken",
      { originalError: errorMessage },
    );
  }
}
