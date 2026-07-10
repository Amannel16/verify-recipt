import { Router } from "express";
import authMiddleware from "@/src/middlewares/authenticator.js";
import { upgradePlan } from "./controller.js";
import { upload } from "@/src/utils/helper/multer.js";

const subscriptionRoutes = Router();

subscriptionRoutes.post("/upgrade", authMiddleware,upload("subscription").single("recrecieptImage"), upgradePlan);

export default subscriptionRoutes;
