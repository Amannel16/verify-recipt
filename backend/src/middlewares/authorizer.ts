import {
  UnauthenticatedError,
  ForbiddenError,
} from "@/src/utils/error/custom_error_handler.js";
import { logger } from "../utils/logger/logger.js";
import type { NextFunction, Request, Response } from "express";
import type { ROLE } from "@prisma/client";

export function authorize(allowedRoles: ROLE[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const requestContext = `${req.method} ${req.originalUrl}`;

    if (!user) {
      logger.warn(
        `Authorization failed for ${requestContext}: missing authenticated user`,
      );
      throw new UnauthenticatedError(
        "Please log in to continue",
        "authorize middleware",
      );
    }

    logger.info(
      `Authorization check for ${user.email} on ${requestContext}; allowed roles: ${allowedRoles.join(", ")}`,
    );

    if (!allowedRoles.includes(user.role)) {
      logger.warn(
        `Authorization denied for ${user.email} on ${requestContext}; role ${user.role} is not allowed`,
      );
      throw new ForbiddenError(
        "You don't have permission to perform this action",
        "authorize middleware",
      );
    }

    logger.info(`Authorization granted for ${user.email} on ${requestContext}`);
    next();
  };
}
