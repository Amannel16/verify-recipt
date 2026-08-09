import { Router } from "express";
import authMiddleware from "@/src/middlewares/authenticator.js";
import { verifyRateLimiter } from "@/src/middlewares/rate-limiter.js";
import { upload } from "@/src/utils/helper/multer.js";
import { verifyV2Endpoint } from "./v2-controller.js";
import { providerRegistry } from "./provider-registry.js";

const v2VerifyRoutes = Router();

// Multi-Evidence Verification endpoint
v2VerifyRoutes.post(
  "/",
  authMiddleware,
  verifyRateLimiter,
  upload("receipts").single("receipt"),
  verifyV2Endpoint
);

// Get supported provider registry list
v2VerifyRoutes.get("/providers", authMiddleware, (_req, res) => {
  const providers = providerRegistry.getAllProviders().map((p) => ({
    id: p.id,
    name: p.name,
    supportsQR: p.supportsQR,
    supportsSMS: p.supportsSMS,
    supportsUSSD: p.supportsUSSD,
    supportsOfficialVerification: p.supportsOfficialVerification,
  }));
  res.json({ success: true, data: providers });
});

export default v2VerifyRoutes;
