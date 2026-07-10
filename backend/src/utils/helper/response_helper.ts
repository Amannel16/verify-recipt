import type { Response } from "express";

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: unknown;
}

export const successResponse = <T>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = 200,
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  } as ApiResponse<T>);
};

export const errorResponse = (
  res: Response,
  message: string,
  error?: unknown,
  statusCode: number = 400,
): Response => {
  return res.status(statusCode).json({
    success: false,
    message,
    error: error,
  } as ApiResponse);
};
