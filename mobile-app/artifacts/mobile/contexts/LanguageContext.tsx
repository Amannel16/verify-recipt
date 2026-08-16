import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { LanguageCode, translations } from "@/constants/translations";

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  t: (key: string) => string;
}

const LANGUAGE_STORAGE_KEY = "@geba_app_language";

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("en");

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((saved) => {
        if (saved === "en" || saved === "am") {
          setLanguageState(saved as LanguageCode);
        }
      })
      .catch((err) => {
        console.error("Failed to load language preference", err);
      });
  }, []);

  const setLanguage = async (lang: LanguageCode) => {
    setLanguageState(lang);
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch (err) {
      console.error("Failed to save language preference", err);
    }
  };

  const t = (key: string): string => {
    const dict = translations[language] || translations["en"];
    return dict[key] || translations["en"][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      language: "en",
      setLanguage: async () => {},
      t: (key: string) => translations["en"][key] || key,
    };
  }
  return context;
}
