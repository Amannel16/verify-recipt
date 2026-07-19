import { Request, Response, NextFunction } from "express";
import { logger } from "../logger/logger.js";

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

const catchAsync = (fn: AsyncHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch((error) => {
      logger.error(
        `Unhandled async error for ${req.method} ${req.originalUrl}:`,
        error,
      );
      next(error);
    });
  };
};

export default catchAsync;
