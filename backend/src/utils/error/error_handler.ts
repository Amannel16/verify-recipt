/* eslint-disable no-useless-assignment */
import { logger } from "@/src/utils/logger/logger.js";
import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { errorResponse } from "../helper/response_helper.js";
import { CustomError } from "./custom_error_handler.js";
import { Prisma } from "@prisma/client";
const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  // Log the full error through the shared logger for development and monitoring
  logger.error(`[Error] ${req.method} ${req.path}:`, err);

  if (res.headersSent) {
    logger.error({ message: err.message, stack: err.stack, ip: req.ip });
    return;
  }

  if (err instanceof CustomError) {
    const errorDetails = err.serializeErrors();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { stack, ...sanitizedErrorDetails } = errorDetails;

    logger.error({
      message: errorDetails.message,
      statusCode: errorDetails.statusCode,
      comingFrom: errorDetails.comingFrom,
      status: errorDetails.status,
      stack: err.stack,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      requestId: req.headers["x-request-id"] || "N/A",
    });

    errorResponse(
      res,
      errorDetails.message,
      {
        ...sanitizedErrorDetails,
        message: errorDetails.message,
      },
      errorDetails.statusCode,
    );
    return;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error(`${err}`);
    let errorMessage = "database error occurred";
    let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
    const comingFrom = "keyWords.database";

    switch (err.code) {
      case "P2025":
        errorMessage = " Record not found";
        statusCode = StatusCodes.NOT_FOUND;
        break;
      case "P2002":
        errorMessage = "Conflict with existing record";
        statusCode = StatusCodes.BAD_REQUEST;
        break;
      case "P2003":
        errorMessage = "Validation error";
        statusCode = StatusCodes.BAD_REQUEST;
        break;
      default:
        errorMessage = "Database error occurred";
        statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
        break;
    }

    logger.error({
      message: errorMessage,
      statusCode: statusCode,
      comingFrom: comingFrom,
      stack: err.stack,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      requestId: req.headers["x-request-id"] || "N/A",
    });

    errorResponse(res, errorMessage, err.meta, statusCode);
    return;
  } else {
    logger.error({
      message: err.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      comingFrom: "Unknown",
      status: "error",
      stack: err.stack,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      requestId: req.headers["x-request-id"] || "N/A",
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { stack, ...sanitizedError } = err;
    errorResponse(
      res,
      "something went wrong",
      sanitizedError,
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
    return;
  }
};

export default errorHandler;
