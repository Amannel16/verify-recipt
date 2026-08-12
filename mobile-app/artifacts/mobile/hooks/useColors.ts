import { useTheme } from "@/contexts/ThemeContext";

/**
 * Returns the design tokens for the current color scheme.
 *
 * Automatically updates when the user toggles dark/light mode
 * or when the system theme changes.
 */
export function useColors() {
  const { colors } = useTheme();
  return colors;
}

