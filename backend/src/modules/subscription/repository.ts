import { db } from "@/src/config/db.js";
import { Plan, PaymentStatus } from "@prisma/client";

export async function upgradePlanRepository(userId:string, plan:Plan,receiptImage:string,receiptUrl:string) {
     return await db.payment.create({
        data: {
            userId,
            plan,
            recieptImage:receiptImage,
            receiptUrl,
            status: "PENDING",
        },
    });
}

export async function getAllPaymentsRepository(status?: PaymentStatus) {
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
                }
            }
        },
        orderBy: {
            createdAt: "desc",
        },
    });
}

export async function approvePaymentRepository(id: string) {
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

        return { payment: updatedPayment, user: updatedUser };
    });
}

export async function rejectPaymentRepository(id: string) {
    const payment = await db.payment.findUnique({
        where: { id },
    });

    if (!payment) {
        throw new Error("Payment not found");
    }

    if (payment.status !== "PENDING") {
        throw new Error("Payment has already been processed");
    }

    return await db.payment.update({
        where: { id },
        data: { status: "REJECTED" },
    });
}

export async function verifyPlanRepository(id:string) {
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
     return await db.user.update({
                where: { id: payment.userId },
                data: {
                    plan: payment.plan,
                    verificationsLimit: limits[payment.plan.toUpperCase()] ?? 20,
                },
            });
}