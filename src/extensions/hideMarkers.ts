/**
 * Hide Markdown Markers Extension
 *
 * This extension creates a Bear/Typora-like editing experience where:
 * 1. Markdown syntax markers (##, **, _, etc.) are hidden
 * 2. Text is styled to show formatting (headings are big, bold is bold, etc.)
 * 3. Markers become visible when the cursor is inside that line/construct
 */

import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { Range, RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

// ============================================================================
// Decoration Definitions
// ============================================================================

const headingDecorations: Record<number, Decoration> = {
  1: Decoration.mark({ class: "cm-heading cm-heading-1" }),
  2: Decoration.mark({ class: "cm-heading cm-heading-2" }),
  3: Decoration.mark({ class: "cm-heading cm-heading-3" }),
  4: Decoration.mark({ class: "cm-heading cm-heading-4" }),
  5: Decoration.mark({ class: "cm-heading cm-heading-5" }),
  6: Decoration.mark({ class: "cm-heading cm-heading-6" }),
};

const emphasisDeco = Decoration.mark({ class: "cm-emphasis" });
const strongDeco = Decoration.mark({ class: "cm-strong" });
const inlineCodeDeco = Decoration.mark({ class: "cm-inline-code" });
const strikeDeco = Decoration.mark({ class: "cm-strikethrough" });

class HiddenMarkerWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-hidden-marker";
    return span;
  }
}

const hideDecoration = Decoration.replace({
  widget: new HiddenMarkerWidget(),
});

// ============================================================================
// Cursor check utilities
// ============================================================================

function isCursorInRange(view: EditorView, from: number, to: number): boolean {
  for (const range of view.state.selection.ranges) {
    if (range.from <= to && range.to >= from) {
      return true;
    }
  }
  return false;
}

function isCursorOnLine(view: EditorView, pos: number): boolean {
  const line = view.state.doc.lineAt(pos);
  return isCursorInRange(view, line.from, line.to);
}

// ============================================================================
// Build decorations by walking syntax tree
// ============================================================================

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const tree = syntaxTree(view.state);
  
  // Debug logging
  console.log("[hideMarkers] Building decorations. Tree type:", tree.type.name, "length:", tree.length);

  // Collect all decorations first (unsorted)
  const decos: { from: number; to: number; deco: Decoration }[] = [];

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter(node) {
        console.log("[hideMarkers] Node:", node.name, node.from, "-", node.to);

        // ATX Headings: # Heading, ## Heading, etc.
        const headingMatch = node.name.match(/^ATXHeading(\d)$/);
        if (headingMatch) {
          const level = parseInt(headingMatch[1], 10);
          const headingDeco = headingDecorations[level];
          if (headingDeco) {
            decos.push({ from: node.from, to: node.to, deco: headingDeco });
          }

          // Find and hide the HeaderMark (##) when cursor not on line
          if (!isCursorOnLine(view, node.from)) {
            let child = node.node.firstChild;
            while (child) {
              if (child.name === "HeaderMark") {
                const hideEnd = Math.min(child.to + 1, node.to);
                decos.push({ from: child.from, to: hideEnd, deco: hideDecoration });
                break;
              }
              child = child.nextSibling;
            }
          }
        }

        // Emphasis: *text* or _text_
        if (node.name === "Emphasis") {
          const cursorIn = isCursorInRange(view, node.from, node.to);
          let firstMark: { from: number; to: number } | null = null;
          let lastMark: { from: number; to: number } | null = null;

          let child = node.node.firstChild;
          while (child) {
            if (child.name === "EmphasisMark") {
              if (!firstMark) firstMark = { from: child.from, to: child.to };
              lastMark = { from: child.from, to: child.to };
            }
            child = child.nextSibling;
          }

          if (firstMark && lastMark) {
            decos.push({ from: firstMark.to, to: lastMark.from, deco: emphasisDeco });
            if (!cursorIn) {
              decos.push({ from: firstMark.from, to: firstMark.to, deco: hideDecoration });
              decos.push({ from: lastMark.from, to: lastMark.to, deco: hideDecoration });
            }
          }
        }

        // Strong: **text** or __text__
        if (node.name === "StrongEmphasis") {
          const cursorIn = isCursorInRange(view, node.from, node.to);
          let firstMark: { from: number; to: number } | null = null;
          let lastMark: { from: number; to: number } | null = null;

          let child = node.node.firstChild;
          while (child) {
            if (child.name === "EmphasisMark") {
              if (!firstMark) firstMark = { from: child.from, to: child.to };
              lastMark = { from: child.from, to: child.to };
            }
            child = child.nextSibling;
          }

          if (firstMark && lastMark) {
            decos.push({ from: firstMark.to, to: lastMark.from, deco: strongDeco });
            if (!cursorIn) {
              decos.push({ from: firstMark.from, to: firstMark.to, deco: hideDecoration });
              decos.push({ from: lastMark.from, to: lastMark.to, deco: hideDecoration });
            }
          }
        }

        // Inline Code: `code`
        if (node.name === "InlineCode") {
          decos.push({ from: node.from, to: node.to, deco: inlineCodeDeco });

          if (!isCursorInRange(view, node.from, node.to)) {
            let firstMark: { from: number; to: number } | null = null;
            let lastMark: { from: number; to: number } | null = null;

            let child = node.node.firstChild;
            while (child) {
              if (child.name === "CodeMark") {
                if (!firstMark) firstMark = { from: child.from, to: child.to };
                lastMark = { from: child.from, to: child.to };
              }
              child = child.nextSibling;
            }

            if (firstMark && lastMark) {
              decos.push({ from: firstMark.from, to: firstMark.to, deco: hideDecoration });
              decos.push({ from: lastMark.from, to: lastMark.to, deco: hideDecoration });
            }
          }
        }

        // Strikethrough: ~~text~~
        if (node.name === "Strikethrough") {
          const cursorIn = isCursorInRange(view, node.from, node.to);
          let firstMark: { from: number; to: number } | null = null;
          let lastMark: { from: number; to: number } | null = null;

          let child = node.node.firstChild;
          while (child) {
            if (child.name === "StrikethroughMark") {
              if (!firstMark) firstMark = { from: child.from, to: child.to };
              lastMark = { from: child.from, to: child.to };
            }
            child = child.nextSibling;
          }

          if (firstMark && lastMark) {
            decos.push({ from: firstMark.to, to: lastMark.from, deco: strikeDeco });
            if (!cursorIn) {
              decos.push({ from: firstMark.from, to: firstMark.to, deco: hideDecoration });
              decos.push({ from: lastMark.from, to: lastMark.to, deco: hideDecoration });
            }
          }
        }
      },
    });
  }

  // Sort by from position (required by RangeSetBuilder)
  decos.sort((a, b) => a.from - b.from || a.to - b.to);

  // Add to builder in sorted order
  for (const { from, to, deco } of decos) {
    if (from < to) {
      builder.add(from, to, deco);
    }
  }

  return builder.finish();
}

// ============================================================================
// ViewPlugin
// ============================================================================

export const hideMarkers = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
