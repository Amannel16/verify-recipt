import { db } from "../../config/db.js";
import { logger } from "../../utils/logger/logger.js";

export interface CreateFeedbackInput {
  translationId: string;
  rating: number;
  isHelpful: boolean;
  comment?: string;
  flagReason?: string;
  clientIp?: string;
}

export interface FeedbackFilterOptions {
  translationId?: string;
  flagReason?: string;
  isHelpful?: boolean;
  page?: number;
  limit?: number;
}

// In-memory store fallback when PostgreSQL database is unreachable
const memoryFeedbackStore: any[] = [];

export class FeedbackService {
  /**
   * Submit feedback linked to a translation ID
   */
  public async submitFeedback(input: CreateFeedbackInput) {
    const { translationId, rating, isHelpful, comment, flagReason, clientIp } = input;

    // Validation
    if (!translationId || typeof translationId !== "string") {
      throw new Error("translationId is required.");
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error("rating must be an integer between 1 and 5.");
    }

    if (typeof isHelpful !== "boolean") {
      throw new Error("isHelpful must be a boolean value.");
    }

    if (comment && comment.length > 1000) {
      throw new Error("comment exceeds maximum allowed length of 1000 characters.");
    }

    const validFlagReasons = ["inaccurate", "wrong_tone", "grammar_issue", "offensive", "other"];
    if (flagReason && !validFlagReasons.includes(flagReason)) {
      throw new Error(`Invalid flagReason '${flagReason}'. Allowed values: ${validFlagReasons.join(", ")}`);
    }

    const prismaClient = db as any;

    // Check if translation exists in DB (if stored)
    let existingTranslation = null;
    try {
      existingTranslation = await prismaClient.translation.findUnique({
        where: { id: translationId },
      });
    } catch (err) {
      logger.warn("Could not query translation table for validation:", err);
    }

    // Persist feedback
    try {
      const feedbackRecord = await prismaClient.translationFeedback.create({
        data: {
          translationId,
          rating,
          isHelpful,
          comment: comment ? comment.trim() : null,
          flagReason: flagReason || null,
          clientIp: clientIp || null,
        },
      });

      return {
        id: feedbackRecord.id,
        translationId: feedbackRecord.translationId,
        rating: feedbackRecord.rating,
        comment: feedbackRecord.comment,
        isHelpful: feedbackRecord.isHelpful,
        flagReason: feedbackRecord.flagReason,
        createdAt: feedbackRecord.createdAt,
        translation: existingTranslation
          ? {
              sourceLanguage: existingTranslation.sourceLanguage,
              targetLanguage: existingTranslation.targetLanguage,
              inputText: existingTranslation.inputText,
              translatedText: existingTranslation.translatedText,
              engine: existingTranslation.engine,
            }
          : null,
      };
    } catch (dbError) {
      logger.error("Failed to store feedback in database, storing in memory fallback:", dbError);
      const fallbackRecord = {
        id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        translationId,
        rating,
        comment: comment ? comment.trim() : null,
        isHelpful,
        flagReason: flagReason || null,
        clientIp: clientIp || null,
        createdAt: new Date(),
        translation: null,
      };
      memoryFeedbackStore.unshift(fallbackRecord);
      return fallbackRecord;
    }
  }

  /**
   * Get feedback records with optional filtering & pagination
   */
  public async getFeedback(options: FeedbackFilterOptions) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.translationId) {
      where.translationId = options.translationId;
    }
    if (options.flagReason) {
      where.flagReason = options.flagReason;
    }
    if (typeof options.isHelpful === "boolean") {
      where.isHelpful = options.isHelpful;
    }

    const prismaClient = db as any;

    try {
      const [feedbacks, total] = await Promise.all([
        prismaClient.translationFeedback.findMany({
          where,
          take: limit,
          skip,
          orderBy: { createdAt: "desc" },
          include: {
            translation: true,
          },
        }),
        prismaClient.translationFeedback.count({ where }),
      ]);

      return {
        feedback: feedbacks.map((f: any) => ({
          id: f.id,
          translationId: f.translationId,
          rating: f.rating,
          comment: f.comment,
          isHelpful: f.isHelpful,
          flagReason: f.flagReason,
          createdAt: f.createdAt,
          translation: f.translation
            ? {
                sourceLanguage: f.translation.sourceLanguage,
                targetLanguage: f.translation.targetLanguage,
                inputText: f.translation.inputText,
                translatedText: f.translation.translatedText,
                engine: f.translation.engine,
              }
            : null,
        })),
        pagination: {
          total,
          page,
          pageSize: limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    } catch (dbError) {
      logger.error("Failed to query feedback from database, reading memory fallback:", dbError);

      let filtered = memoryFeedbackStore;
      if (options.translationId) {
        filtered = filtered.filter((f) => f.translationId === options.translationId);
      }
      if (options.flagReason) {
        filtered = filtered.filter((f) => f.flagReason === options.flagReason);
      }
      if (typeof options.isHelpful === "boolean") {
        filtered = filtered.filter((f) => f.isHelpful === options.isHelpful);
      }

      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + limit);

      return {
        feedback: paginated,
        pagination: {
          total,
          page,
          pageSize: limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    }
  }

  /**
   * Export all feedback in JSON format for offline dataset analysis & ML training
   */
  public async exportFeedbackDataset() {
    const prismaClient = db as any;
    try {
      const records = await prismaClient.translationFeedback.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          translation: true,
        },
      });

      return {
        exportVersion: "1.0",
        generatedAt: new Date().toISOString(),
        totalCount: records.length,
        dataset: records.map((r: any) => ({
          feedbackId: r.id,
          translationId: r.translationId,
          rating: r.rating,
          isHelpful: r.isHelpful,
          flagReason: r.flagReason,
          userComment: r.comment,
          createdAt: r.createdAt,
          inputText: r.translation?.inputText ?? null,
          translatedText: r.translation?.translatedText ?? null,
          sourceLanguage: r.translation?.sourceLanguage ?? null,
          targetLanguage: r.translation?.targetLanguage ?? null,
          detectedLanguage: r.translation?.detectedLanguage ?? null,
          engine: r.translation?.engine ?? null,
        })),
      };
    } catch (err) {
      logger.error("Error exporting feedback dataset from database, exporting memory fallback:", err);
      return {
        exportVersion: "1.0",
        generatedAt: new Date().toISOString(),
        totalCount: memoryFeedbackStore.length,
        dataset: memoryFeedbackStore.map((r: any) => ({
          feedbackId: r.id,
          translationId: r.translationId,
          rating: r.rating,
          isHelpful: r.isHelpful,
          flagReason: r.flagReason,
          userComment: r.comment,
          createdAt: r.createdAt,
          inputText: null,
          translatedText: null,
          sourceLanguage: null,
          targetLanguage: null,
          detectedLanguage: null,
          engine: null,
        })),
      };
    }
  }
}
