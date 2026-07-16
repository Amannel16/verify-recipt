import { Router } from "express";
import { upgradePlan } from "./controller.js";
import { upload } from "@/src/utils/helper/multer.js";
import { authorize } from "@/src/middlewares/authorizer.js";
import authMiddleware from "@/src/middlewares/authenticator.js";

const subscriptionRoutes = Router();

subscriptionRoutes.post("/upgrade", authMiddleware, upload("subscription").single("recieptImage"), upgradePlan);

export default subscriptionRoutes;
