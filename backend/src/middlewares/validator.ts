import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ObjectSchema } from 'joi';
import { errorResponse } from '../utils/helper/response_helper.js';
import { logger } from '../utils/logger/logger.js';

export const validate = (schema: ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Record<string, string[]> = {};

    const { error } = schema.validate(
      {
        body: req.body,
        params: req.params,
        query: req.query,
        headers: req.headers,
      },
      { abortEarly: false, allowUnknown: true },
    );

    logger.error('error', error);

    if (error) {
      error.details.forEach((err) => {
        const field =
          err.path.length > 1
            ? err.path.slice(1).join('.')
            : err.path[0] || 'unknown';
        if (!errors[field]) errors[field] = [];
        errors[field].push(err.message);
      });

      errorResponse(res, 'Validation failed', errors, StatusCodes.BAD_REQUEST);
      return;
    }

    next();
  };
};
