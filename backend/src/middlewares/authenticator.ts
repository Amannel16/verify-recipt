import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import appConfig from "@/src/config/app_configs.js";
import { logger } from "@/src/utils/logger/logger.js";

export interface AuthPayload {
  userId: string;
  email: string;
}

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/**
 * JWT authentication middleware.
 * Extracts and verifies the Bearer token from the Authorization header.
 */
export default function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Authentication required. Please provide a valid token.",
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Invalid authorization format.",
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, appConfig.ACCESS_TOKEN_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`Token expired for request to ${req.path}`);
      res.status(401).json({
        success: false,
        message: "Token expired. Please log in again.",
      });
      return;
    }

    logger.warn(`Invalid token for request to ${req.path}`);
    res.status(401).json({
      success: false,
      message: "Invalid token.",
    });
  }
}
