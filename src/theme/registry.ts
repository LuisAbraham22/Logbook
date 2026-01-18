import darkNotes from "./themes/dark-notes.json";
import linen from "./themes/linen.json";
import midnight from "./themes/midnight.json";
import type { ThemeDefinition } from "./types";

export const THEMES: ThemeDefinition[] = [
  darkNotes as ThemeDefinition,
  midnight as ThemeDefinition,
  linen as ThemeDefinition,
];

export const DEFAULT_THEME_ID = "dark-notes";

export type ThemeId = ThemeDefinition["id"];

export const getThemeById = (themeId?: ThemeId) => {
  return THEMES.find((theme) => theme.id === themeId) ?? THEMES[0];
};
