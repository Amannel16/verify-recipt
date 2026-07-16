import { Router } from "express";
import { upgradePlan, getAllPayments, approvePayment, rejectPayment } from "./controller.js";
import { upload } from "@/src/utils/helper/multer.js";
import { authorize } from "@/src/middlewares/authorizer.js";
import authMiddleware from "@/src/middlewares/authenticator.js";

const subscriptionRoutes = Router();

subscriptionRoutes.post("/upgrade", authMiddleware, upload("subscription").single("recieptImage"), upgradePlan);

// Admin-only endpoints
subscriptionRoutes.get("/payments", authMiddleware, authorize(["ADMIN"]), getAllPayments);
subscriptionRoutes.post("/payments/:id/approve", authMiddleware, authorize(["ADMIN"]), approvePayment);
subscriptionRoutes.post("/payments/:id/reject", authMiddleware, authorize(["ADMIN"]), rejectPayment);

export default subscriptionRoutes;
