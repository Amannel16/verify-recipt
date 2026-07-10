// ─────────────────────────────────────────────────────────────
// Upgrade Plan

import { db } from "@/src/config/db.js";
import catchAsync from "@/src/utils/helper/catch_async.js";
import { logger } from "@/src/utils/logger/logger.js";
import type { Request, Response } from "express";

// ─────────────────────────────────────────────────────────────
export const upgradePlan = catchAsync(async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const { plan } = req.body;
        const validPlans = ["FREE", "PRO", "ENTERPRISE"];

        if (!plan || !validPlans.includes(plan.toUpperCase())) {
            res.status(400).json({
                success: false,
                message: "Invalid plan. Choose FREE, PRO, or ENTERPRISE.",
            });
            return;
        }

        const limits: Record<string, number> = {
            FREE: 20,
            PRO: 999999,
            ENTERPRISE: 999999,
        };

        const user = await db.user.update({
            where: { id: userId },
            data: {
                plan: plan.toUpperCase(),
                verificationsLimit: limits[plan.toUpperCase()] ?? 20,
            },
        });

        const { password: _, ...safeUser } = user;
        res.json({
            success: true,
            message: `Plan upgraded to ${plan.toUpperCase()}.`,
            data: { user: safeUser },
        });
    } catch (error) {
        logger.error("Plan upgrade failed:", error);
        res.status(500).json({ success: false, message: "Failed to upgrade plan." });
    }
});