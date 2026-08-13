import { Router } from "express";
import {
  handlePostFeedback,
  handleGetFeedback,
  handleExportFeedback,
} from "./feedback.controller.js";
import { feedbackRateLimiter } from "../../middlewares/rate-limiter.js";

const feedbackRouter = Router();

// GET /feedback/export - JSON export format for future analysis
feedbackRouter.get("/export", handleExportFeedback);

// POST /feedback - Submit feedback linked to translationId
feedbackRouter.post("/", feedbackRateLimiter, handlePostFeedback);

// GET /feedback - List feedback records with filters
feedbackRouter.get("/", handleGetFeedback);

export default feedbackRouter;
