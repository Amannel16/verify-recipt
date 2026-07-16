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

    if (!user) {
      throw new UnauthenticatedError(
        "Please log in to continue",
        "authorize middleware",
      );
    }

    logger.info(`allowedRoles: ${allowedRoles}`);

    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenError(
        "You don't have permission to perform this action",
        "authorize middleware",
      );
    }

    next();
  };
}
