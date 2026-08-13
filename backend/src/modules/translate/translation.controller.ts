import type { Request, Response } from "express";
import { TranslationService } from "./translation.service.js";
import { logger } from "../../utils/logger/logger.js";

const translationService = new TranslationService();

export async function handleTranslate(req: Request, res: Response): Promise<void> {
  try {
    const { inputText, sourceLanguage, targetLanguage } = req.body || {};

    if (!inputText || typeof inputText !== "string" || inputText.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: "INVALID_INPUT",
        message: "Field 'inputText' is required and cannot be empty.",
      });
      return;
    }

    if (inputText.length > 5000) {
      res.status(400).json({
        success: false,
        error: "TEXT_TOO_LONG",
        message: "Field 'inputText' exceeds maximum length of 5000 characters.",
      });
      return;
    }

    const result = await translationService.translate({
      inputText,
      sourceLanguage,
      targetLanguage,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error("Error in handleTranslate controller:", error);
    
    if (
      error.message?.includes("Unsupported") ||
      error.message?.includes("exceeds") ||
      error.message?.includes("required")
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
      error: "TRANSLATION_FAILED",
      message: "An unexpected error occurred during translation.",
    });
  }
}
