import { Router } from "express";
import authMiddleware from "@/src/middlewares/authenticator.js";
import { logger } from "@/src/utils/logger/logger.js";
import {
  verifyReceipt,
  getHistory,
  getById,
  deleteVerification,
  getStats,
} from "./controller.js";
import { upload } from "@/src/utils/helper/multer.js";

const verifyRoutes = Router();

// Verify a receipt (accepts image upload + optional transactionId in body)
verifyRoutes.post(
  "/receipt",
  authMiddleware,
  (req, _res, next) => {
    logger.info(
      `Receipt verification request received for user ${req.user?.id || "unknown"}`,
    );
    next();
  },
  upload("receipts").single("receipt"),
  verifyReceipt,
);

// Get verification stats
verifyRoutes.get(
  "/stats",
  authMiddleware,
  (req, _res, next) => {
    logger.info(
      `Verification stats requested by user ${req.user?.id || "unknown"}`,
    );
    next();
  },
  getStats,
);

// Get verification history (paginated)
verifyRoutes.get(
  "/history",
  authMiddleware,
  (req, _res, next) => {
    logger.info(
      `Verification history requested by user ${req.user?.id || "unknown"}`,
    );
    next();
  },
  getHistory,
);

verifyRoutes.get("/debug-history", async (req, res) => {
  try {
    logger.info("Debug verification history endpoint called");
    const { db } = await import("@/src/config/db.js");
    const lastVerifications = await db.verification.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    res.json(lastVerifications);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single verification by ID
verifyRoutes.get(
  "/:id",
  authMiddleware,
  (req, _res, next) => {
    logger.info(
      `Verification lookup requested for id ${req.params.id} by user ${req.user?.id || "unknown"}`,
    );
    next();
  },
  getById,
);

// Delete a verification
verifyRoutes.delete(
  "/:id",
  authMiddleware,
  (req, _res, next) => {
    logger.info(
      `Verification deletion requested for id ${req.params.id} by user ${req.user?.id || "unknown"}`,
    );
    next();
  },
  deleteVerification,
);

export default verifyRoutes;
