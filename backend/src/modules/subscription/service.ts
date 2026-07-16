import { BadRequestError, NotFoundError } from "@/src/utils/error/custom_error_handler.js";
import { upgradePlanRepository, getAllPaymentsRepository, approvePaymentRepository, rejectPaymentRepository } from "./repository.js";
import { Plan, PaymentStatus } from "@prisma/client";

export async function upgradePlanService(userId:string, plan:Plan,receiptImage:string,receiptUrl:string) {
      const validPlans = ["FREE", "PRO", "ENTERPRISE"];

        if (!plan || !validPlans.includes(plan.toUpperCase())) {
            throw new BadRequestError("Invalid plan. Choose FREE, PRO, or ENTERPRISE.","upgradePlanService","upgradePlanService")
        }

       return await upgradePlanRepository(userId,plan,receiptImage,receiptUrl);
}

export async function getAllPaymentsService(status?: PaymentStatus) {
    if (status && !["PENDING", "APPROVED", "REJECTED"].includes(status)) {
        throw new BadRequestError("Invalid status filter.", "getAllPaymentsService", "getAllPaymentsService");
    }
    return await getAllPaymentsRepository(status);
}

export async function approvePaymentService(id: string) {
    try {
        return await approvePaymentRepository(id);
    } catch (error: any) {
        if (error.message === "Payment not found") {
            throw new NotFoundError(error.message, "approvePaymentService", "approvePaymentService");
        }
        throw new BadRequestError(error.message, "approvePaymentService", "approvePaymentService");
    }
}

export async function rejectPaymentService(id: string) {
    try {
        return await rejectPaymentRepository(id);
    } catch (error: any) {
        if (error.message === "Payment not found") {
            throw new NotFoundError(error.message, "rejectPaymentService", "rejectPaymentService");
        }
        throw new BadRequestError(error.message, "rejectPaymentService", "rejectPaymentService");
    }
}