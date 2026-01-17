import type { ThemeDefinition, ThemeTokens } from "./types";

// Map typed theme tokens to their CSS variable names.
const TOKEN_TO_CSS_VARIABLE: Record<keyof ThemeTokens, string> = {
  background: "--lb-bg",
  surface: "--lb-surface",
  text: "--lb-text",
  textMuted: "--lb-text-muted",
  border: "--lb-border",
  accent: "--lb-accent",
  accentText: "--lb-accent-contrast",
  editorBackground: "--lb-editor-bg",
  editorText: "--lb-editor-text",
  editorCaret: "--lb-editor-caret",
  editorSelection: "--lb-editor-selection",
  editorLineHighlight: "--lb-editor-line",
  editorGutterBackground: "--lb-editor-gutter-bg",
  editorGutterText: "--lb-editor-gutter-text",
};

// Apply a theme by writing every token into CSS variables.
export const applyTheme = (theme: ThemeDefinition) => {
  const root = document.documentElement;
  // Used for debugging or data-attribute styling if needed.
  root.dataset.theme = theme.id;

  // Write each token value into its CSS variable.
  (Object.keys(TOKEN_TO_CSS_VARIABLE) as Array<keyof ThemeTokens>).forEach(
    (token) => {
      const cssVariable = TOKEN_TO_CSS_VARIABLE[token];
      root.style.setProperty(cssVariable, theme.tokens[token]);
    },
  );
};
