import { Router } from "express";
import authMiddleware from "@/src/middlewares/authenticator.js";
import { receiptUpload } from "@/src/config/multer.js";
import {
  verifyReceipt,
  getHistory,
  getById,
  deleteVerification,
  getStats,
} from "./controller.js";

const verifyRoutes = Router();

// Verify a receipt (accepts image upload + optional transactionId in body)
verifyRoutes.post(
  "/receipt",
  authMiddleware,
  receiptUpload.single("receipt"),
  verifyReceipt,
);

// Get verification stats
verifyRoutes.get("/stats", authMiddleware, getStats);

// Get verification history (paginated)
verifyRoutes.get("/history", authMiddleware, getHistory);

verifyRoutes.get("/debug-history", async (req, res) => {
  try {
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
verifyRoutes.get("/:id", authMiddleware, getById);

// Delete a verification
verifyRoutes.delete("/:id", authMiddleware, deleteVerification);

export default verifyRoutes;
