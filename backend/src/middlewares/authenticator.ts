import { UnauthenticatedError } from "@/src/utils/error/custom_error_handler.js";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { SafeUser } from "../utils/helper/auth.js";
import appConfig from "../config/app_configs.js";

const { ACCESS_TOKEN_SECRET } = appConfig;
export default async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const accessToken =
      req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];
    if (!accessToken) {
      throw new UnauthenticatedError(
        "Please log in to access this resource",
        "AuthMiddleware",
      );
    }
    try {
      const accessToken =
        req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];
      if (!accessToken) {
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
          throw new UnauthenticatedError(
            "Session expired. Please log in again",
            "AuthMiddleware",
          );
        }
        if (error instanceof jwt.JsonWebTokenError) {
          throw new UnauthenticatedError(
            "Invalid token. Please log in again",
            "AuthMiddleware",
          );
        }
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
