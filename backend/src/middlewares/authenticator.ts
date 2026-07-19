import { UnauthenticatedError } from "@/src/utils/error/custom_error_handler.js";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { SafeUser } from "../utils/helper/auth.js";
import appConfig from "../config/app_configs.js";
import { logger } from "../utils/logger/logger.js";

const { ACCESS_TOKEN_SECRET } = appConfig;
export default async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const requestContext = `${req.method} ${req.originalUrl}`;
    const accessToken =
      req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];
    if (!accessToken) {
      logger.warn(
        `Authentication failed for ${requestContext}: missing access token`,
      );
      throw new UnauthenticatedError(
        "Please log in to access this resource",
        "AuthMiddleware",
      );
    }
    try {
      const accessToken =
        req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];
      if (!accessToken) {
        logger.warn(
          `Authentication failed for ${requestContext}: missing access token`,
        );
        throw new UnauthenticatedError(
          "Please log in to access this resource",
          "AuthMiddleware",
        );
      }

      const token = accessToken;
      let payload: { user: SafeUser; sessionId?: string };
      try {
        payload = jwt.verify(token, ACCESS_TOKEN_SECRET) as {
          user: SafeUser;
          sessionId?: string;
        };
      } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
          logger.warn(
            `Authentication failed for ${requestContext}: expired token`,
          );
          throw new UnauthenticatedError(
            "Session expired. Please log in again",
            "AuthMiddleware",
          );
        }
        if (error instanceof jwt.JsonWebTokenError) {
          logger.warn(
            `Authentication failed for ${requestContext}: invalid token`,
          );
          throw new UnauthenticatedError(
            "Invalid token. Please log in again",
            "AuthMiddleware",
          );
        }
        logger.error(`Authentication failed for ${requestContext}:`, error);
        throw error;
      }

      const user = payload.user;
      if (!user) {
        throw new UnauthenticatedError(
          "Your session is invalid. Please log in again",
          "AuthMiddleware",
        );
      }

      req.user = user;
      logger.info(
        `Authenticated request for user ${user.id} (${user.email}) on ${requestContext}`,
      );
      return next();
    } catch (error) {
      return next(error);
    }
  } catch (error) {
    return next(error);
  }
}

export async function optAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const accessToken =
      req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];
    if (!accessToken) {
      return next();
    }

    const token = accessToken;

    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET) as {
      user: SafeUser;
    };

    const user = payload.user;
    if (!user) {
      return next();
    }

    req.user = user;
    return next();
  } catch {
    return next();
  }
}
