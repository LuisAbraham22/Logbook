import { useCallback, useEffect, useMemo, useState } from "react";
import { applyTheme } from "./applyTheme";
import {
  DEFAULT_THEME_ID,
  THEMES,
  ThemeId,
  getThemeById,
} from "./registry";

// Resolve a valid theme id from localStorage (or fall back).
const resolveStoredThemeId = (): ThemeId => {
  // Avoid touching window/localStorage during SSR.
  if (typeof window === "undefined") {
    return DEFAULT_THEME_ID;
  }

  // Read the stored id or fall back to the default.
  const stored = localStorage.getItem("logbook.theme") ?? DEFAULT_THEME_ID;
  // Ensure the id exists in our registry (fallback if it doesn't).
  return getThemeById(stored).id;
};

// Hook that owns theme state + side effects.
export const useTheme = () => {
  // Source of truth for which theme is active.
  const [themeId, setThemeId] = useState<ThemeId>(() => resolveStoredThemeId());
  // Get theme object from registry 
  // useMemo recomputes theme when `themeId` changes
  const theme = useMemo(() => getThemeById(themeId), [themeId]);

  // Persist theme id and push tokens into CSS variables.
  // useEffect runs the code in {} again when the theme is updated
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("logbook.theme", theme.id);
    }
    applyTheme(theme);
  }, [theme]);

  // Convenience label for UI later (settings menu, etc).
  const currentThemeLabel = useMemo(() => theme.label, [theme]);

  // Simple helper to cycle through the theme list.
  const cycleTheme = useCallback(() => {
    const currentIndex = THEMES.findIndex(
      (themeOption) => themeOption.id === themeId,
    );
    const nextTheme = THEMES[(currentIndex + 1) % THEMES.length];
    setThemeId(nextTheme.id);
  }, [themeId]);

  // Expose state and helpers for UI components.
  return {
    themeId,
    theme,
    themes: THEMES,
    currentThemeLabel,
    setThemeId,
    cycleTheme,
  };
};
