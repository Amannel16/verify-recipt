import { db } from "@/src/config/db.js";
import { logger } from "@/src/utils/logger/logger.js";
import { Plan, PaymentStatus } from "@prisma/client";

export async function upgradePlanRepository(
  userId: string,
  plan: Plan,
  receiptImage: string,
  receiptUrl: string,
) {
  logger.info(
    `Creating subscription payment record for user ${userId} and plan ${plan}`,
  );
  return await db.payment.create({
    data: {
      userId,
      plan,
      recieptImage: receiptImage,
      receiptUrl,
      status: "PENDING",
    },
  });
}

export async function getAllPaymentsRepository(status?: PaymentStatus) {
  logger.info(`Querying subscription payments with status ${status || "all"}`);
  return await db.payment.findMany({
    where: status ? { status } : undefined,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          businessName: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function approvePaymentRepository(id: string) {
  try {
    return await db.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id },
      });

      if (!payment) {
        throw new Error("Payment not found");
      }

      if (payment.status !== "PENDING") {
        throw new Error("Payment has already been processed");
      }

      const updatedPayment = await tx.payment.update({
        where: { id },
        data: { status: "APPROVED" },
      });

      const limits: Record<string, number> = {
        FREE: 20,
        PRO: 999999,
        ENTERPRISE: 999999,
      };

      const updatedUser = await tx.user.update({
        where: { id: payment.userId },
        data: {
          plan: payment.plan,
          verificationsLimit: limits[payment.plan.toUpperCase()] ?? 20,
        },
      });

      logger.info(
        `Approved subscription payment ${id} for user ${payment.userId}`,
      );
      return { payment: updatedPayment, user: updatedUser };
    });
  } catch (error) {
    logger.error(`Failed to approve subscription payment ${id}:`, error);
    throw error;
  }
}

export async function rejectPaymentRepository(id: string) {
  try {
    const payment = await db.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.status !== "PENDING") {
      throw new Error("Payment has already been processed");
    }

    const rejectedPayment = await db.payment.update({
      where: { id },
      data: { status: "REJECTED" },
    });

    logger.info(
      `Rejected subscription payment ${id} for user ${payment.userId}`,
    );
    return rejectedPayment;
  } catch (error) {
    logger.error(`Failed to reject subscription payment ${id}:`, error);
    throw error;
  }
}

export async function verifyPlanRepository(id: string) {
  logger.info(`Verifying subscription plan payment ${id}`);
  const payment = await db.payment.findUnique({
    where: { id },
  });
  if (!payment) {
    throw new Error("Payment not found");
  }

  const limits: Record<string, number> = {
    FREE: 20,
    PRO: 999999,
    ENTERPRISE: 999999,
  };
  const updatedUser = await db.user.update({
    where: { id: payment.userId },
    data: {
      plan: payment.plan,
      verificationsLimit: limits[payment.plan.toUpperCase()] ?? 20,
    },
  });

  logger.info(
    `Subscription plan verified for user ${payment.userId} with plan ${payment.plan}`,
  );
  return updatedUser;
}
