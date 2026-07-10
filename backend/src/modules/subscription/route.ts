import { Router } from "express";
import authMiddleware from "@/src/middlewares/authenticator.js";
import { upgradePlan } from "./controller.js";

const subscriptionRoutes = Router();

subscriptionRoutes.post("/upgrade", authMiddleware, upgradePlan);

export default subscriptionRoutes;
