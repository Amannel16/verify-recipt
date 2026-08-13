import { db } from "../../config/db.js";
import { logger } from "../../utils/logger/logger.js";
import type {
  ITranslationProvider,
  SupportedLanguage,
  TranslationRequest,
  TranslationResponsePayload,
} from "./translation-provider.interface.js";
import { MockAmharicTranslationProvider } from "./mock-translation.provider.js";
import { GeminiTranslationProvider } from "./gemini-translation.provider.js";


export class TranslationService {
  private mockProvider: ITranslationProvider;
  private geminiProvider: ITranslationProvider;

  constructor() {
    this.mockProvider = new MockAmharicTranslationProvider();
    this.geminiProvider = new GeminiTranslationProvider();
  }

  /**
   * Detect language based on Ethiopic character presence (\u1200-\u137F)
   */
  public detectLanguage(text: string): SupportedLanguage {
    const ethiopicRegex = /[\u1200-\u137F\u2D80-\u2DDF\u1380-\u139F]/;
    return ethiopicRegex.test(text) ? "am" : "en";
  }

  /**
   * Translates text bi-directionally between English and Amharic
   */
  public async translate(
    request: TranslationRequest
  ): Promise<TranslationResponsePayload> {
    const { inputText } = request;
    let { sourceLanguage, targetLanguage } = request;

    // 1. Input Validation
    if (!inputText || typeof inputText !== "string") {
      throw new Error("inputText is required and must be a non-empty string.");
    }

    const trimmedInput = inputText.trim();
    if (trimmedInput.length === 0) {
      throw new Error("inputText cannot be empty or whitespace only.");
    }

    if (trimmedInput.length > 5000) {
      throw new Error("inputText exceeds maximum allowed length of 5000 characters.");
    }

    // 2. Auto-detect source language if missing or requested as 'auto'
    const detectedLanguage = this.detectLanguage(trimmedInput);
    if (!sourceLanguage || sourceLanguage === "auto") {
      sourceLanguage = detectedLanguage;
    }

    // Validate sourceLanguage
    if (sourceLanguage !== "en" && sourceLanguage !== "am") {
      throw new Error(`Unsupported sourceLanguage: '${sourceLanguage}'. Supported codes: 'en', 'am', 'auto'.`);
    }

    // 3. Default target language resolution
    if (!targetLanguage) {
      targetLanguage = sourceLanguage === "en" ? "am" : "en";
    }

    // Validate targetLanguage
    if (targetLanguage !== "en" && targetLanguage !== "am") {
      throw new Error(`Unsupported targetLanguage: '${targetLanguage}'. Supported codes: 'en', 'am'.`);
    }

    // 4. Select Translation Provider
    const preferredEngine = (process.env.TRANSLATION_PROVIDER || "mock").toLowerCase();
    let provider: ITranslationProvider = this.mockProvider;

    if (preferredEngine === "gemini" && (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) {
      provider = this.geminiProvider;
    }

    let result;
    try {
      result = await provider.translate(trimmedInput, sourceLanguage, targetLanguage);
    } catch (error) {
      logger.warn(`Primary provider (${provider.name}) failed. Falling back to MockAmharicTranslationProvider:`, error);
      result = await this.mockProvider.translate(trimmedInput, sourceLanguage, targetLanguage);
    }

    // 5. Persist translation record to database
    let translationRecord;
    try {
      const prismaClient = db as any;
      translationRecord = await prismaClient.translation.create({
        data: {
          sourceLanguage,
          targetLanguage,
          inputText: trimmedInput,
          translatedText: result.translatedText,
          detectedLanguage,
          engine: result.engine,
        },
      });
    } catch (dbError) {
      logger.error("Failed to persist translation record to database:", dbError);
      // Fallback in-memory object generation if DB write fails
      translationRecord = {
        id: `t_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        sourceLanguage,
        targetLanguage,
        inputText: trimmedInput,
        translatedText: result.translatedText,
        detectedLanguage,
        engine: result.engine,
        createdAt: new Date(),
      };
    }

    return {
      id: translationRecord.id,
      sourceLanguage: sourceLanguage as SupportedLanguage,
      targetLanguage: targetLanguage as SupportedLanguage,
      inputText: trimmedInput,
      translatedText: result.translatedText,
      detectedLanguage,
      engine: result.engine,
      createdAt: translationRecord.createdAt || new Date(),
    };
  }
}
