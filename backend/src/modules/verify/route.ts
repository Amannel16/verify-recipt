import { Router, type Request, type Response, type NextFunction } from "express";
import authMiddleware from "@/src/middlewares/authenticator.js";
import { apiKeyAuthMiddleware } from "@/src/middlewares/api-key-auth.js";
import { logger } from "@/src/utils/logger/logger.js";
import {
  verifyReceipt,
  getHistory,
  exportHistory,
  getById,
  deleteVerification,
  getStats,
} from "./controller.js";
import { upload } from "@/src/utils/helper/multer.js";

const verifyRoutes = Router();

// Middleware supporting either standard JWT session OR X-API-Key header authentication
const dualAuth = [apiKeyAuthMiddleware, authMiddleware];

// Verify a receipt (accepts image upload + optional transactionId in body)
verifyRoutes.post(
  "/receipt",
  dualAuth,
  (req: Request, _res: Response, next: NextFunction) => {
    logger.info(
      `Receipt verification request received for user ${req.user?.id || "unknown"}`,
    );
    next();
  },
  upload("receipts").single("receipt"),
  verifyReceipt,
);

// Export verification reports (PDF / Excel - Pro & Enterprise feature)
verifyRoutes.get(
  "/export",
  dualAuth,
  (req: Request, _res: Response, next: NextFunction) => {
    logger.info(
      `Verification export requested by user ${req.user?.id || "unknown"}`,
    );
    next();
  },
  exportHistory,
);

// Get verification stats
verifyRoutes.get(
  "/stats",
  dualAuth,
  (req: Request, _res: Response, next: NextFunction) => {
    logger.info(
      `Verification stats requested by user ${req.user?.id || "unknown"}`,
    );
    next();
  },
  getStats,
);

// Get verification history (paginated, plan-restricted)
verifyRoutes.get(
  "/history",
  dualAuth,
  (req: Request, _res: Response, next: NextFunction) => {
    logger.info(
      `Verification history requested by user ${req.user?.id || "unknown"}`,
    );
    next();
  },
  getHistory,
);

verifyRoutes.get("/debug-history", async (_req: Request, res: Response) => {
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
  dualAuth,
  (req: Request, _res: Response, next: NextFunction) => {
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
  dualAuth,
  (req: Request, _res: Response, next: NextFunction) => {
    logger.info(
      `Verification deletion requested for id ${req.params.id} by user ${req.user?.id || "unknown"}`,
    );
    next();
  },
  deleteVerification,
);

export default verifyRoutes;
