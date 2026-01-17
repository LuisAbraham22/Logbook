import { EditorView } from "@codemirror/view";
import type { ThemeKind } from "./types";

// Build a CodeMirror theme that reads from our CSS tokens.
export const createEditorTheme = (kind: ThemeKind) => {
  return EditorView.theme(
    {
      // Base editor surface + text.
      "&": {
        color: "var(--lb-editor-text)",
        backgroundColor: "var(--lb-editor-bg)",
      },
      // Text caret and selection colors.
      ".cm-content": {
        caretColor: "var(--lb-editor-caret)",
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: "var(--lb-editor-caret)",
      },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
        backgroundColor: "var(--lb-editor-selection)",
      },
      // Active line highlight to subtly guide focus.
      ".cm-activeLine": {
        backgroundColor: "var(--lb-editor-line)",
      },
      // Gutter styling (even if line numbers are disabled).
      ".cm-gutters": {
        backgroundColor: "var(--lb-editor-gutter-bg)",
        color: "var(--lb-editor-gutter-text)",
        border: "none",
      },
    },
    // CodeMirror needs to know if the theme is dark for defaults.
    { dark: kind === "dark" },
  );
};
