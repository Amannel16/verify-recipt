// ─────────────────────────────────────────────────────────────
// Upgrade Plan

import catchAsync from "@/src/utils/helper/catch_async.js";
import { logger } from "@/src/utils/logger/logger.js";
import type { Request, Response } from "express";
import { upgradePlanService, getAllPaymentsService, approvePaymentService, rejectPaymentService } from "./service.js";
import { errorResponse, successResponse } from "@/src/utils/helper/response_helper.js";
import { BadRequestError } from "@/src/utils/error/custom_error_handler.js";
import { safeDeleteFile, validateFileType } from "@/src/utils/helper/file_validator.js";
import { PaymentStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
export const upgradePlan = catchAsync(async (req: Request, res: Response) => {

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  const { plan, receiptUrl } = req.body;

  const file = req.file;
  let recieptImage = "";
  if (file) {
    const isValid = await validateFileType(file.path, [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/svg+xml",
      "application/pdf",
    ]);

    if (!isValid) {
      await safeDeleteFile(file.path);
      throw new BadRequestError(
        "Image must be valid format.",
        "upgradePlanController.upgradePlan",
      );
    }

    recieptImage = `/uploads/subscription/${file.filename}`;
  }

  const payment = await upgradePlanService(userId, plan.toUpperCase(), recieptImage, receiptUrl);


  return successResponse(res, "Plan upgraded to " + plan.toUpperCase(), payment)

});

export const getAllPayments = catchAsync(async (req: Request, res: Response) => {
  const status = req.query.status as PaymentStatus | undefined;
  const payments = await getAllPaymentsService(status);
  return successResponse(res, "Retrieved subscription upgrade list", payments);
});

export const approvePayment = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    throw new BadRequestError("Payment request ID is required.", "approvePayment");
  }
  const paymentId = Array.isArray(id) ? id[0] : id;
  const result = await approvePaymentService(paymentId);
  return successResponse(res, "Subscription approved successfully", result);
});

export const rejectPayment = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    throw new BadRequestError("Payment request ID is required.", "rejectPayment");
  }
  const paymentId = Array.isArray(id) ? id[0] : id;
  const result = await rejectPaymentService(paymentId);
  return successResponse(res, "Subscription rejected successfully", result);
});