import { db } from "@/src/config/db.js";
import { Plan } from "@prisma/client";

export async function upgradePlanRepository(userId:string, plan:Plan) {
      const limits: Record<string, number> = {
            FREE: 20,
            PRO: 999999,
            ENTERPRISE: 999999,
        };
     return await db.user.update({
                where: { id: userId },
                data: {
                    plan: plan,
                    verificationsLimit: limits[plan.toUpperCase()] ?? 20,
                },
            });
}