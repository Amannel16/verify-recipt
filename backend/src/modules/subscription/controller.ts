// ─────────────────────────────────────────────────────────────
// Upgrade Plan

import catchAsync from "@/src/utils/helper/catch_async.js";
import { logger } from "@/src/utils/logger/logger.js";
import type { Request, Response } from "express";
import { upgradePlanService } from "./service.js";
import { errorResponse, successResponse } from "@/src/utils/helper/response_helper.js";

// ─────────────────────────────────────────────────────────────
export const upgradePlan = catchAsync(async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const { plan } = req.body;
     

     
       const user = await upgradePlanService(userId, plan.toUpperCase());
       

        const { password: _, ...safeUser } = user;
      return successResponse(res,"Plan upgraded to "+plan.toUpperCase(),safeUser)
    } catch (error) {
        logger.error("Plan upgrade failed:", error);
        return errorResponse(res, "Failed to upgrade plan.");
    }
});