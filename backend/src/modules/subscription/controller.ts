// ─────────────────────────────────────────────────────────────
// Upgrade Plan

import catchAsync from "@/src/utils/helper/catch_async.js";
import { logger } from "@/src/utils/logger/logger.js";
import type { Request, Response } from "express";
import { getAllPaymentsService, upgradePlanService } from "./service.js";
import { rejectPaymentRepository, verifyPlanRepository } from "./repository.js";
import {
  errorResponse,
  successResponse,
} from "@/src/utils/helper/response_helper.js";
import { BadRequestError } from "@/src/utils/error/custom_error_handler.js";
import {
  safeDeleteFile,
  validateFileType,
} from "@/src/utils/helper/file_validator.js";
import { PaymentStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
export const upgradePlan = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  const { plan, receiptUrl } = req.body;
  logger.info(`Subscription upgrade request received for user ${userId}`);

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

  const payment = await upgradePlanService(
    userId,
    plan.toUpperCase(),
    recieptImage,
    receiptUrl,
  );
  logger.info(
    `Subscription upgrade payment created for user ${userId} with id ${payment.id}`,
  );

  // Auto-approve payment in development so the plan upgrades instantly
  try {
    await verifyPlanRepository(payment.id);
    logger.info(
      `✅ Auto-approved plan upgrade to ${plan.toUpperCase()} for user ${userId}`,
    );
  } catch (err) {
    logger.error(
      `❌ Failed to auto-approve payment: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return successResponse(
    res,
    "Plan upgraded to " + plan.toUpperCase(),
    payment,
  );
});

export const getAllPayments = catchAsync(async (req: Request, res: Response) => {
  const payments = await getAllPaymentsService();
  return successResponse(res, "Payments retrieved successfully", payments);
});

// ─────────────────────────────────────────────────────────────
// Verify Payment
// ─────────────────────────────────────────────────────────────
export const verifyPayment = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const payment = await verifyPlanRepository(id);
  return successResponse(res, "Payment verified successfully", payment);
});


export const rejectPayment = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const payment = await rejectPaymentRepository(id);
  return successResponse(res, "Payment rejected successfully", payment);
});