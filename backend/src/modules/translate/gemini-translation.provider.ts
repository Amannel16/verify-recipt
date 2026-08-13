import type {
  ITranslationProvider,
  SupportedLanguage,
  TranslationResult,
} from "./translation-provider.interface.js";
import { logger } from "../../utils/logger/logger.js";

/**
 * Gemini AI Neural Translation Provider for English ↔ Amharic
 */
export class GeminiTranslationProvider implements ITranslationProvider {
  public readonly name = "Gemini-2.0-Flash-NMT";
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  }

  public async translate(
    text: string,
    sourceLang: SupportedLanguage,
    targetLang: SupportedLanguage
  ): Promise<TranslationResult> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is not configured on the server.");
    }

    const sourceName = sourceLang === "en" ? "English" : "Amharic";
    const targetName = targetLang === "en" ? "English" : "Amharic";

    const prompt = `You are a professional English-Amharic translator.
Translate the following ${sourceName} text into accurate, natural ${targetName}.
Return ONLY a JSON object with this format:
{
  "translatedText": "the translation string here"
}

Text to translate:
"${text}"`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json",
            },
          }),
          signal: AbortSignal.timeout(15000),
        }
      );

      if (!response.ok) {
        const errBody = await response.text();
        logger.error(`Gemini Translation API error (${response.status}): ${errBody}`);
        throw new Error(`Gemini Translation API returned status ${response.status}`);
      }

      const data = (await response.json()) as any;
      const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!jsonText) {
        throw new Error("Empty candidate response from Gemini API");
      }

      const parsed = JSON.parse(jsonText);
      return {
        translatedText: parsed.translatedText || text,
        detectedLanguage: sourceLang,
        engine: this.name,
      };
    } catch (err: any) {
      logger.error("GeminiTranslationProvider translation failed:", err);
      throw err;
    }
  }
}
