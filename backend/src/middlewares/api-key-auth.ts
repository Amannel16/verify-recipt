import type { Request, Response, NextFunction } from "express";
import { db } from "../config/db.js";
import { logger } from "../utils/logger/logger.js";

declare global {
  namespace Express {
    interface Request {
      apiKeyUser?: any;
    }
  }
}

export async function apiKeyAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const apiKeyHeader = req.headers["x-api-key"] as string;

  if (!apiKeyHeader) {
    next();
    return;
  }

  try {
    const apiKeyRecord = await (db as any).apiKey.findUnique({
      where: { key: apiKeyHeader },
      include: { user: true },
    });

    if (!apiKeyRecord) {
      res.status(401).json({
        success: false,
        message: "Invalid API Key header provided.",
      });
      return;
    }

    if (apiKeyRecord.user.plan !== "ENTERPRISE") {
      res.status(403).json({
        success: false,
        message: "API Key access requires an active Enterprise Plan.",
      });
      return;
    }

    // Attach user to request
    const { password: _, ...safeUser } = apiKeyRecord.user;
    req.user = safeUser;
    req.apiKeyUser = safeUser;

    // Update last used timestamp asynchronously
    (db as any).apiKey
      .update({
        where: { id: apiKeyRecord.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((err: unknown) => logger.error("Failed to update API key lastUsedAt:", err));

    next();
  } catch (error) {
    logger.error("API Key authentication error:", error);
    res.status(500).json({ success: false, message: "API key authentication failure." });
  }
}
