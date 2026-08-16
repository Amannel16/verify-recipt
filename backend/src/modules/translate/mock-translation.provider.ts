import type {
  ITranslationProvider,
  SupportedLanguage,
  TranslationResult,
} from "./translation-provider.interface.js";

/**
 * Built-in offline Translation Provider with a rich English ↔ Amharic dictionary
 * and rule-based fallback engine.
 */
export class MockAmharicTranslationProvider implements ITranslationProvider {
  public readonly name = "GebaAmharicNMT-v1.0 (Offline Rules)";

  // Comprehensive phrase dictionary
  private dictionaryEnToAm: Record<string, string> = {
    "hello": "ሰላም",
    "hello, how are you?": "ሰላም፤ እንደምን አለህ?",
    "hello, how are you": "ሰላም፤ እንደምን አለህ?",
    "how are you?": "እንደምን አለህ?",
    "how are you": "እንደምን አለህ?",
    "good morning": "እንደምን አደርክ",
    "good afternoon": "እንደምን ዋልክ",
    "good evening": "እንደምን አመሸህ",
    "good night": "መልካም ሌሊት",
    "thank you": "አመሰግናለሁ",
    "thank you very much": "በጣም አመሰግናለሁ",
    "please": "እባክዎን",
    "yes": "አዎ",
    "no": "አይደለም",
    "sorry": "ይቅርታ",
    "excuse me": "ይቅርታ",
    "goodbye": "ደህና ሁን",
    "welcome": "እንኳን ደህና መጣህ",
    "what is your name?": "ስምህ ማን ነው?",
    "what is your name": "ስምህ ማን ነው?",
    "my name is": "ስሜ",
    "where are you from?": "ከየት ነህ?",
    "i am fine": "ደህና ነኝ",
    "how much is this?": "ይህ ስንት ነው?",
    "payment received": "ክፍያ ተቀብሏል",
    "payment verified": "ክፍያው ተረጋግጧል",
    "receipt": "ደረሰኝ",
    "bank transfer": "የባንክ ማስተላለፍ",
    "account number": "የሂሳብ ቁጥር",
    "transaction success": "ግብይቱ ተሳክቷል",
    "system error": "የስርዓት ስህተት",
  };

  private dictionaryAmToEn: Record<string, string> = {
    "ሰላም": "Hello",
    "ሰላም፤ እንደምን አለህ?": "Hello, how are you?",
    "ሰላም፤ እንደምን አለህ": "Hello, how are you?",
    "እንደምን አለህ?": "How are you?",
    "እንደምን አለህ": "How are you?",
    "እንደምን አደርክ": "Good morning",
    "እንደምን ዋልክ": "Good afternoon",
    "እንደምን አመሸህ": "Good evening",
    "መልካም ሌሊት": "Good night",
    "አመሰግናለሁ": "Thank you",
    "በጣም አመሰግናለሁ": "Thank you very much",
    "እባክዎን": "Please",
    "አዎ": "Yes",
    "አይደለም": "No",
    "ይቅርታ": "Sorry",
    "ደህና ሁን": "Goodbye",
    "እንኳን ደህና መጣህ": "Welcome",
    "ስምህ ማን ነው?": "What is your name?",
    "ስሜ": "My name is",
    "ከየት ነህ?": "Where are you from?",
    "ደህና ነኝ": "I am fine",
    "ይህ ስንት ነው?": "How much is this?",
    "ክፍያ ተቀብሏል": "Payment received",
    "ክፍያው ተረጋግጧል": "Payment verified",
    "ደረሰኝ": "Receipt",
    "የባንክ ማስተላለፍ": "Bank transfer",
    "የሂሳብ ቁጥር": "Account number",
    "ግብይቱ ተሳክቷል": "Transaction succeeded",
    "የስርዓት ስህተት": "System error",
  };

  // Word-by-word mappings
  private wordMapEnToAm: Record<string, string> = {
    "hello": "ሰላም",
    "good": "መልካም",
    "morning": "ጥዋት",
    "night": "ሌሊት",
    "thank": "አመሰግናለሁ",
    "you": "አንተ",
    "water": "ውሃ",
    "food": "ምግብ",
    "house": "ቤት",
    "money": "ገንዘብ",
    "bank": "ባንክ",
    "payment": "ክፍያ",
    "success": "ስኬት",
    "verified": "የተረጋገጠ",
    "receipt": "ደረሰኝ",
    "today": "ዛሬ",
    "tomorrow": "ነገ",
    "yesterday": "ትናንት",
    "friend": "ጓደኛ",
    "love": "ፍቅር",
  };

  private wordMapAmToEn: Record<string, string> = {
    "ሰላም": "hello",
    "መልካም": "good",
    "ጥዋት": "morning",
    "ሌሊት": "night",
    "አመሰግናለሁ": "thank you",
    "ውሃ": "water",
    "ምግብ": "food",
    "ቤት": "house",
    "ገንዘብ": "money",
    "ባንክ": "bank",
    "ክፍያ": "payment",
    "ስኬት": "success",
    "የተረጋገጠ": "verified",
    "ደረሰኝ": "receipt",
    "ዛሬ": "today",
    "ነገ": "tomorrow",
    "ትናንት": "yesterday",
    "ጓደኛ": "friend",
    "ፍቅር": "love",
  };

  public async translate(
    text: string,
    sourceLang: SupportedLanguage,
    targetLang: SupportedLanguage
  ): Promise<TranslationResult> {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    if (sourceLang === targetLang) {
      return {
        translatedText: trimmed,
        detectedLanguage: sourceLang,
        engine: this.name,
      };
    }

    if (sourceLang === "en" && targetLang === "am") {
      // 1. Direct phrase lookup
      if (this.dictionaryEnToAm[lower]) {
        return {
          translatedText: this.dictionaryEnToAm[lower],
          detectedLanguage: "en",
          engine: this.name,
        };
      }

      // 2. Word-by-word substitution fallback
      const words = trimmed.split(/\s+/);
      const translatedWords = words.map((w) => {
        const cleanWord = w.toLowerCase().replace(/[^a-z0-9]/g, "");
        const punctuation = w.replace(/[a-zA-Z0-9]/g, "");
        const mapped = this.wordMapEnToAm[cleanWord];
        return mapped ? mapped + punctuation : w;
      });

      const resultText = translatedWords.join(" ");

      return {
        translatedText: resultText,
        detectedLanguage: "en",
        engine: this.name,
      };
    }

    if (sourceLang === "am" && targetLang === "en") {
      // 1. Direct phrase lookup
      if (this.dictionaryAmToEn[trimmed]) {
        return {
          translatedText: this.dictionaryAmToEn[trimmed],
          detectedLanguage: "am",
          engine: this.name,
        };
      }

      // 2. Word-by-word substitution fallback
      const words = trimmed.split(/\s+/);
      const translatedWords = words.map((w) => {
        const cleanWord = w.replace(/[^\u1200-\u137F]/g, "");
        const punctuation = w.replace(/[\u1200-\u137F]/g, "");
        const mapped = this.wordMapAmToEn[cleanWord];
        return mapped ? mapped + punctuation : w;
      });

      const resultText = translatedWords.join(" ");

      return {
        translatedText: resultText.charAt(0).toUpperCase() + resultText.slice(1),
        detectedLanguage: "am",
        engine: this.name,
      };
    }

    return {
      translatedText: trimmed,
      detectedLanguage: sourceLang,
      engine: this.name,
    };
  }
}
