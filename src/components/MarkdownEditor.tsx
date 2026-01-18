import { minimalSetup } from "codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { Compartment, EditorState } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { syntaxTree, syntaxTreeAvailable, forceParsing, language } from "@codemirror/language";
import React, { useEffect, useRef } from "react";
import { createEditorTheme } from "../theme/editorTheme";
import type { ThemeDefinition } from "../theme/types";
import { hideMarkers } from "../extensions/hideMarkers";

type MarkdownEditorProps = {
  theme: ThemeDefinition;
};

export function MarkdownEditor({ theme }: MarkdownEditorProps): React.ReactElement {
  // Reference to the real DOM node; CodeMirror mounts into this.
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Keep a stable handle to the editor instance for cleanup/updates.
  const editorViewRef = useRef<EditorView | null>(null);
  const themeCompartmentRef = useRef(new Compartment());

  // CodeMirror needs a real DOM node to mount into, so we wait until
  // React renders the div, then create the EditorView inside useEffect.
  useEffect(() => {
    if (!containerRef.current || editorViewRef.current) {
      return;
    }

    const mdLang = markdown({ base: markdownLanguage, extensions: [GFM] });
    console.log("[Editor] markdown() returned:", mdLang);
    console.log("[Editor] mdLang.language:", mdLang.language);
    console.log("[Editor] mdLang.extension:", mdLang.extension);
    
    // Try using .extension explicitly instead of the LanguageSupport object
    const state = EditorState.create({
      doc: "## Test Heading\n\nSome **bold** text",
      extensions: [
        minimalSetup,
        EditorView.lineWrapping,
        keymap.of([indentWithTab]),
        mdLang.extension,  // Use the extension array directly
        hideMarkers,
        themeCompartmentRef.current.of(createEditorTheme(theme.kind)),
      ],
    });
    
    // Debug: check tree after creation
    setTimeout(() => {
      if (!editorViewRef.current) return;
      const view = editorViewRef.current;
      
      // Check if language is attached
      const lang = view.state.facet(language);
      console.log("[Editor] Language facet:", lang);
      
      // Force parsing to complete
      forceParsing(view, 10000, 1000);
      
      const available = syntaxTreeAvailable(view.state);
      const tree = syntaxTree(view.state);
      console.log("[Editor] Tree available:", available);
      console.log("[Editor] Tree after 500ms:", tree.length, "doc:", view.state.doc.length);
      console.log("[Editor] Top node:", tree.topNode);
      if (tree.length > 0) {
        tree.iterate({
          enter(node) {
            console.log("[Editor] Node:", node.name, node.from, node.to);
          }
        });
      }
    }, 500);

    const view = new EditorView({
      parent: containerRef.current,
      state,
    });

    view.focus();
    editorViewRef.current = view;

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      effects: themeCompartmentRef.current.reconfigure(
        createEditorTheme(theme.kind),
      ),
    });
  }, [theme.kind]);

  return <div ref={containerRef} className="editor-host" />;
}
