export type SupportedLanguage = "en" | "am";

export interface TranslationRequest {
  inputText: string;
  sourceLanguage?: SupportedLanguage | "auto";
  targetLanguage?: SupportedLanguage;
}

export interface TranslationResponsePayload {
  id: string;
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  inputText: string;
  translatedText: string;
  detectedLanguage: SupportedLanguage;
  engine: string;
  createdAt: Date;
}

export interface TranslationResult {
  translatedText: string;
  detectedLanguage: SupportedLanguage;
  engine: string;
}

export interface ITranslationProvider {
  readonly name: string;
  translate(
    text: string,
    sourceLang: SupportedLanguage,
    targetLang: SupportedLanguage
  ): Promise<TranslationResult>;
}
