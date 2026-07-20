import { Router } from "express";
import { getAllPayments, rejectPayment, upgradePlan, verifyPayment } from "./controller.js";
import { upload } from "@/src/utils/helper/multer.js";
import authMiddleware from "@/src/middlewares/authenticator.js";
import { authorize } from "@/src/middlewares/authorizer.js";
import { ROLE } from "@prisma/client";

const subscriptionRoutes = Router();

subscriptionRoutes.post("/upgrade", authMiddleware, upload("subscription").single("recieptImage"), upgradePlan);

subscriptionRoutes.get("/payments", authMiddleware, authorize([ROLE.ADMIN]), getAllPayments);
subscriptionRoutes.put("/payments/:id/verify", authMiddleware, authorize([ROLE.ADMIN]), verifyPayment);
subscriptionRoutes.put("/payments/:id/reject", authMiddleware, authorize([ROLE.ADMIN]), rejectPayment);

export default subscriptionRoutes;
