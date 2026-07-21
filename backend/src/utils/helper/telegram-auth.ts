
import { ROLE } from "@prisma/client";
import crypto from "crypto";

export interface TelegramAuthData {
  id: string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface TelegramSignupData extends TelegramAuthData {
  role: ROLE;
}

/**
 * Verifies the integrity of the data received from Telegram Login Widget.
 */
export function verifyTelegramAuth(
  data: TelegramAuthData,
  botToken: string,
  allowedTimeSeconds = 86400
): boolean {
  if (!botToken) {
    throw new Error("Bot token is required for Telegram auth verification");
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - data.auth_date > allowedTimeSeconds) {
    return false;
  }

  const VALID_KEYS = ["id", "first_name", "last_name", "username", "photo_url", "auth_date"];

  const keys = Object.keys(data).filter((key) => {
    const val = data[key as keyof TelegramAuthData];
    return key !== "hash" && VALID_KEYS.includes(key) && val !== undefined && val !== null;
  });
  
  keys.sort();

  const dataCheckArr = keys.map((key) => `${key}=${data[key as keyof TelegramAuthData]}`);
  const dataCheckString = dataCheckArr.join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();

  const hmac = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return hmac === data.hash;
}

/**
 * Verifies the integrity of the data received from Telegram Mini App (initData).
 * Returns the parsed user object if valid, otherwise returns undefined.
 */
export function verifyTelegramWebAppAuth(
  initData: string,
  botToken: string,
  allowedTimeSeconds = 86400
): any | undefined {
  if (!botToken) {
    throw new Error("Bot token is required for Telegram auth verification");
  }

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get("hash");
  const authDate = parseInt(urlParams.get("auth_date") || "0", 10);

  if (!hash || !authDate) {
    return undefined;
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > allowedTimeSeconds) {
    return undefined;
  }

  const dataCheckArr: string[] = [];
  urlParams.forEach((value, key) => {
    if (key !== "hash") {
      dataCheckArr.push(`${key}=${value}`);
    }
  });
  dataCheckArr.sort();
  const dataCheckString = dataCheckArr.join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) {
    return undefined;
  }

  // Parse user data if valid
  const userJson = urlParams.get("user");
  if (userJson) {
    try {
      return JSON.parse(userJson);
    } catch (e) {
      return undefined;
    }
  }

  return undefined;
}
