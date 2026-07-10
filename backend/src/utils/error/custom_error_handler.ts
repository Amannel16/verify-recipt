import { StatusCodes } from "http-status-codes";

export interface ErrorType {
  message: string;
  statusCode: number;
  status: string;
  comingFrom: string;
  stack?: string | undefined;
  metadata?: unknown;
}

export abstract class CustomError extends Error {
  abstract statusCode: number;
  abstract status: string;
  comingFrom: string;
  metadata?: unknown;

  constructor(message: string, comingFrom: string, metadata?: unknown) {
    super(message);
    this.comingFrom = comingFrom;
    this.metadata = metadata;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor); // For better stack trace
  }

  serializeErrors(): ErrorType {
    return {
      message: this.message,
      statusCode: this.statusCode,
      status: this.status,
      comingFrom: this.comingFrom,
      stack: this.stack,
      metadata: this.metadata,
    };
  }
}

export class BadRequestError extends CustomError {
  statusCode = StatusCodes.BAD_REQUEST;
  status = "error";

  constructor(message: string, comingFrom: string, metadata?: unknown) {
    super(message, comingFrom, metadata);
  }
}

export class NotFoundError extends CustomError {
  statusCode = StatusCodes.NOT_FOUND;
  status = "error";

  constructor(message: string, comingFrom: string, metadata?: unknown) {
    super(message, comingFrom, metadata);
  }
}

export class UnauthenticatedError extends CustomError {
  statusCode = StatusCodes.UNAUTHORIZED;
  status = "error";

  constructor(message: string, comingFrom: string, metadata?: unknown) {
    super(message, comingFrom, metadata);
  }
}

export class ForbiddenError extends CustomError {
  statusCode = StatusCodes.FORBIDDEN;
  status = "error";

  constructor(message: string, comingFrom: string, metadata?: unknown) {
    super(message, comingFrom, metadata);
  }
}

export class InternalServerError extends CustomError {
  statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  status = "error";

  constructor(message: string, comingFrom: string, metadata?: unknown) {
    super(message, comingFrom, metadata);
  }
}

export class FileTooLargeError extends CustomError {
  statusCode = StatusCodes.REQUEST_TOO_LONG;
  status = "error";

  constructor(message: string, comingFrom: string, metadata?: unknown) {
    super(message, comingFrom, metadata);
  }
}

export class ResourceIsLockedError extends CustomError {
  statusCode = StatusCodes.LOCKED;
  status = "error";

  constructor(message: string, comingFrom: string, metadata?: unknown) {
    super(message, comingFrom, metadata);
  }
}

export class ConflictError extends CustomError {
  statusCode = StatusCodes.CONFLICT;
  status = "error";

  constructor(message: string, comingFrom: string, metadata?: unknown) {
    super(message, comingFrom, metadata);
  }
}
