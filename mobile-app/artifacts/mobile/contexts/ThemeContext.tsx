import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme as useDeviceColorScheme, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import colors from "@/constants/colors";

export type ThemeMode = "system" | "light" | "dark";

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  colorScheme: "light" | "dark";
  colors: typeof colors.light & { radius: number };
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const THEME_STORAGE_KEY = "@geba_theme_mode";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const deviceColorScheme = useDeviceColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (saved === "light" || saved === "dark" || saved === "system") {
          setThemeModeState(saved as ThemeMode);
        }
      })
      .catch((err) => {
        console.error("Failed to load theme preference", err);
      });
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (err) {
      console.error("Failed to save theme preference", err);
    }
  };

  const toggleTheme = async () => {
    const effectiveIsDark =
      themeMode === "system" ? deviceColorScheme === "dark" : themeMode === "dark";
    const nextMode: ThemeMode = effectiveIsDark ? "light" : "dark";
    await setThemeMode(nextMode);
  };

  const isDark =
    themeMode === "system"
      ? deviceColorScheme === "dark"
      : themeMode === "dark";

  const colorScheme: "light" | "dark" = isDark ? "dark" : "light";

  const palette = isDark ? colors.dark : colors.light;
  const currentColors = { ...palette, radius: colors.radius };

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const root = document.documentElement;
      if (isDark) {
        root.classList.add("dark");
        document.body.style.backgroundColor = colors.dark.background;
        document.body.style.color = colors.dark.foreground;
      } else {
        root.classList.remove("dark");
        document.body.style.backgroundColor = colors.light.background;
        document.body.style.color = colors.light.foreground;
      }
    }
  }, [isDark]);

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        isDark,
        colorScheme,
        colors: currentColors,
        setThemeMode,
        toggleTheme,
      }}
    >
      <StatusBar style={isDark ? "light" : "dark"} animated />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      themeMode: "system",
      isDark: false,
      colorScheme: "light",
      colors: { ...colors.light, radius: colors.radius },
      setThemeMode: async () => {},
      toggleTheme: async () => {},
    };
  }
  return context;
}
