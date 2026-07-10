import { BadRequestError } from "@/src/utils/error/custom_error_handler.js";
import { upgradePlanRepository } from "./repository.js";
import { Plan } from "@prisma/client";



export async function upgradePlanService(userId:string, plan:Plan,receiptImage:string,receiptUrl:string) {
      const validPlans = ["FREE", "PRO", "ENTERPRISE"];

        if (!plan || !validPlans.includes(plan.toUpperCase())) {
            throw new BadRequestError("Invalid plan. Choose FREE, PRO, or ENTERPRISE.","upgradePlanService","upgradePlanService")
           
        }

       return await upgradePlanRepository(userId,plan,receiptImage,receiptUrl);

}