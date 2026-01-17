export type ThemeKind = "light" | "dark";

export type ThemeTokens = {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  accentText: string;
  editorBackground: string;
  editorText: string;
  editorCaret: string;
  editorSelection: string;
  editorLineHighlight: string;
  editorGutterBackground: string;
  editorGutterText: string;
};

export type ThemeDefinition = {
  id: string;
  label: string;
  kind: ThemeKind;
  tokens: ThemeTokens;
};
