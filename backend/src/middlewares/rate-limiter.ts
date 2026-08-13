import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger/logger.js";

interface RateLimitStore {
  count: number;
  resetTime: number;
}

/**
 * In-memory sliding window rate-limiter middleware.
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message: string;
}) {
  const store = new Map<string, RateLimitStore>();

  // Periodically clean up expired keys every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of store.entries()) {
      if (now > value.resetTime) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown-ip";

    const now = Date.now();
    const clientRecord = store.get(ip);

    if (!clientRecord || now > clientRecord.resetTime) {
      store.set(ip, {
        count: 1,
        resetTime: now + options.windowMs,
      });
      return next();
    }

    clientRecord.count += 1;

    if (clientRecord.count > options.max) {
      const retryAfterSeconds = Math.ceil((clientRecord.resetTime - now) / 1000);
      logger.warn(`⛔ Rate limit exceeded for IP ${ip} on ${req.method} ${req.originalUrl}`);
      
      res.setHeader("Retry-After", retryAfterSeconds.toString());
      res.status(429).json({
        success: false,
        message: options.message,
        retryAfterSeconds,
      });
      return;
    }

    next();
  };
}

// 1. Strict rate limiter for authentication routes (login / register)
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // max 15 login/register attempts per 15 minutes per IP
  message: "Too many login/registration attempts. Please try again after 15 minutes.",
});

// 2. Verification upload rate limiter
export const verifyRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // max 20 verification requests per minute per IP
  message: "Verification rate limit exceeded. Please wait a minute before verifying more receipts.",
});

// 3. General API rate limiter
export const generalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // max 300 requests per 15 minutes
  message: "Too many requests to Geba AI API. Please slow down.",
});

// 4. Translation rate limiter
export const translateRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // max 30 translation requests per minute per IP
  message: "Translation rate limit exceeded. Please wait a minute before making more requests.",
});

// 5. Feedback rate limiter (anti-spam)
export const feedbackRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // max 10 feedback submissions per minute per IP
  message: "Feedback submission rate limit exceeded. Please try again in a minute.",
});

