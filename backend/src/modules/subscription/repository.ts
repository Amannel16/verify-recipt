import { db } from "@/src/config/db.js";
import { Plan } from "@prisma/client";

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