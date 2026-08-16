import type { Request, Response } from "express";
import { FeedbackService } from "./feedback.service.js";
import { logger } from "../../utils/logger/logger.js";

const feedbackService = new FeedbackService();

/**
 * Handle POST /feedback
 */
export async function handlePostFeedback(req: Request, res: Response): Promise<void> {
  try {
    const { translationId, rating, isHelpful, comment, flagReason } = req.body || {};

    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown-ip";

    const feedback = await feedbackService.submitFeedback({
      translationId,
      rating,
      isHelpful,
      comment,
      flagReason,
      clientIp,
    });

    res.status(201).json({
      success: true,
      message: "Feedback recorded successfully",
      data: feedback,
    });
  } catch (error: any) {
    logger.error("Error in handlePostFeedback controller:", error);

    if (
      error.message?.includes("required") ||
      error.message?.includes("must be") ||
      error.message?.includes("Invalid") ||
      error.message?.includes("exceeds")
    ) {
      res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: "FEEDBACK_SUBMISSION_FAILED",
      message: "Failed to record feedback.",
    });
  }
}

/**
 * Handle GET /feedback
 */
export async function handleGetFeedback(req: Request, res: Response): Promise<void> {
  try {
    const translationId = req.query.translationId as string | undefined;
    const flagReason = req.query.flagReason as string | undefined;
    const isHelpfulStr = req.query.isHelpful as string | undefined;
    const pageStr = req.query.page as string | undefined;
    const limitStr = req.query.limit as string | undefined;

    let isHelpful: boolean | undefined = undefined;
    if (isHelpfulStr === "true") isHelpful = true;
    if (isHelpfulStr === "false") isHelpful = false;

    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const limit = limitStr ? parseInt(limitStr, 10) : 20;

    const result = await feedbackService.getFeedback({
      translationId,
      flagReason,
      isHelpful,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error("Error in handleGetFeedback controller:", error);
    res.status(500).json({
      success: false,
      error: "FEEDBACK_FETCH_FAILED",
      message: "Failed to fetch feedback records.",
    });
  }
}

/**
 * Handle GET /feedback/export
 */
export async function handleExportFeedback(req: Request, res: Response): Promise<void> {
  try {
    const dataset = await feedbackService.exportFeedbackDataset();

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", 'attachment; filename="translation_feedback_dataset.json"');
    res.status(200).send(JSON.stringify(dataset, null, 2));
  } catch (error: any) {
    logger.error("Error in handleExportFeedback controller:", error);
    res.status(500).json({
      success: false,
      error: "EXPORT_FAILED",
      message: "Failed to export feedback dataset.",
    });
  }
}
