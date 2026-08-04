import type { Request, Response, NextFunction } from "express";

/**
 * Security headers middleware to harden HTTP responses against common web vulnerabilities.
 */
export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Hide server technology
  res.removeHeader("X-Powered-By");

  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking / framing
  res.setHeader("X-Frame-Options", "DENY");

  // Enable browser XSS filter
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Control referrer information sent in HTTP headers
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Enforce HTTPS HSTS in production environments
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  next();
}
