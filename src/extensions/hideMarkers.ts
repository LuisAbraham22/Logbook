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

class BulletWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-list-bullet";
    span.textContent = "•";
    return span;
  }
}

class OrderedListWidget extends WidgetType {
  constructor(private num: string) { super(); }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-list-number";
    span.textContent = this.num;
    return span;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(private checked: boolean, private pos: number) { super(); }
  
  eq(other: CheckboxWidget) {
    return this.checked === other.checked && this.pos === other.pos;
  }

  toDOM(view: EditorView) {
    const span = document.createElement("span");
    span.className = `cm-checkbox ${this.checked ? "cm-checkbox-checked" : ""}`;
    span.innerHTML = this.checked
      ? `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd"><path d="M.5 12.853c0 2.2 1.447 3.647 3.647 3.647h7.706c2.2 0 3.647-1.447 3.647-3.647V3.147C15.5 .947 14.053-.5 11.853-.5H4.147C1.947-.5.5.947.5 3.147v9.706z" fill="var(--lb-editor-bg, #fff)"/><rect x=".5" y=".5" width="15" height="15" rx="4" stroke="currentColor" fill="var(--lb-editor-bg, #fff)"/><path d="M12.526 4.615L6.636 9.58l-2.482-.836c-.19-.06-.408.003-.518.15-.116.15-.106.352.026.495l2.722 2.91c.086.09.21.144.34.144h.046c.12-.013.234-.07.307-.156l6.1-7.125c.143-.166.123-.407-.046-.548-.164-.138-.435-.14-.604 0z" fill="var(--lb-accent, #7c8aff)"/></g></svg>`
      : `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd"><rect x=".5" y=".5" width="15" height="15" rx="4" stroke="currentColor" fill="var(--lb-editor-bg, #fff)"/></g></svg>`;
    
    span.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const newText = this.checked ? "[ ]" : "[x]";
      view.dispatch({
        changes: { from: this.pos, to: this.pos + 3, insert: newText }
      });
    });
    
    return span;
  }

  ignoreEvent() { return false; }
}

const hideDecoration = Decoration.replace({
  widget: new HiddenMarkerWidget(),
});

const bulletDecoration = Decoration.replace({
  widget: new BulletWidget(),
});

const checkboxDecoration = (checked: boolean, pos: number) => Decoration.replace({
  widget: new CheckboxWidget(checked, pos),
});

const orderedListDecoration = (num: string) => Decoration.replace({
  widget: new OrderedListWidget(num),
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

        // List items: - item, * item, 1. item (but not tasks, handled separately)
        if (node.name === "ListItem") {
          // Skip if this contains a Task (handled below)
          let hasTask = false;
          let child = node.node.firstChild;
          while (child) {
            if (child.name === "Task") {
              hasTask = true;
              break;
            }
            child = child.nextSibling;
          }
          
          if (!hasTask) {
            child = node.node.firstChild;
            while (child) {
              if (child.name === "ListMark") {
                const markText = view.state.sliceDoc(child.from, child.to).trim();
                const cursorInMarker = isCursorInRange(view, child.from, child.to);
                if (!cursorInMarker) {
                  if (/^\d+\.$/.test(markText)) {
                    decos.push({ from: child.from, to: child.to + 1, deco: orderedListDecoration(markText) });
                  } else {
                    decos.push({ from: child.from, to: child.to + 1, deco: bulletDecoration });
                  }
                }
                break;
              }
              child = child.nextSibling;
            }
          }
        }

        // Task list: - [ ] or - [x]
        if (node.name === "Task") {
          let taskMarker: { from: number; to: number } | null = null;
          let listMark: { from: number; to: number } | null = null;
          
          const parent = node.node.parent;
          if (parent?.name === "ListItem") {
            let sibling = parent.firstChild;
            while (sibling) {
              if (sibling.name === "ListMark") {
                listMark = { from: sibling.from, to: sibling.to };
                break;
              }
              sibling = sibling.nextSibling;
            }
          }
          
          let child = node.node.firstChild;
          while (child) {
            if (child.name === "TaskMarker") {
              taskMarker = { from: child.from, to: child.to };
              break;
            }
            child = child.nextSibling;
          }
          
          if (taskMarker) {
            const rangeStart = listMark ? listMark.from : taskMarker.from;
            const cursorInMarker = isCursorInRange(view, rangeStart, taskMarker.to - 1);
            
            if (!cursorInMarker) {
              if (listMark) {
                decos.push({ from: listMark.from, to: listMark.to + 1, deco: hideDecoration });
              }
              const text = view.state.sliceDoc(taskMarker.from, taskMarker.to);
              const checked = text.includes("x") || text.includes("X");
              decos.push({ from: taskMarker.from, to: taskMarker.to, deco: checkboxDecoration(checked, taskMarker.from) });
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
