# Tauri + CodeMirror 6 Migration Guide

Translating the Swift Markdown editor to a Tauri app with CodeMirror 6.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Tauri (Rust)                            │
│  • Window management                                            │
│  • File system access                                           │
│  • Native menus                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ IPC
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Web View (TypeScript)                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    CodeMirror 6                            │  │
│  │  • EditorView (rendering)                                  │  │
│  │  • EditorState (document + selections)                     │  │
│  │  • Decorations (syntax hiding)                             │  │
│  │  • @lezer/markdown (incremental parsing)                   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Concept Mapping

| Swift Concept | CodeMirror 6 Equivalent |
|---------------|------------------------|
| `LineNode` | Lezer syntax tree nodes |
| `NSRange` | `{from: number, to: number}` |
| `NSTextStorage` attributes | `Decoration.mark()` / `Decoration.replace()` |
| `textViewDidChangeSelection` | `EditorView.updateListener` |
| `styler.styleNode()` | `StateField` + `DecorationSet` |
| Binary search for line | `state.doc.lineAt(pos)` |
| Incremental parse | Built into Lezer |

## Project Setup

```bash
# Create Tauri project
npm create tauri-app@latest markdown-editor -- --template vanilla-ts
cd markdown-editor

# Install CodeMirror
npm install @codemirror/state @codemirror/view @codemirror/language
npm install @codemirror/lang-markdown @codemirror/language-data
npm install @lezer/markdown
```

## Core Implementation

### 1. Editor Setup (`src/editor.ts`)

```typescript
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { defaultKeymap } from "@codemirror/commands";
import { syntaxHiding } from "./syntax-hiding";

export function createEditor(parent: HTMLElement, initialDoc: string = "") {
  const state = EditorState.create({
    doc: initialDoc,
    extensions: [
      markdown(),
      syntaxHiding(),  // Our custom extension
      keymap.of(defaultKeymap),
      EditorView.lineWrapping,
      baseTheme,
    ],
  });

  return new EditorView({ state, parent });
}

const baseTheme = EditorView.theme({
  "&": {
    fontSize: "16px",
    fontFamily: "system-ui, sans-serif",
  },
  ".cm-content": {
    padding: "16px",
  },
  // Heading styles
  ".cm-heading-1": { fontSize: "2em", fontWeight: "bold" },
  ".cm-heading-2": { fontSize: "1.625em", fontWeight: "bold" },
  ".cm-heading-3": { fontSize: "1.375em", fontWeight: "600" },
  ".cm-heading-4": { fontSize: "1.125em", fontWeight: "600" },
  // Inline styles
  ".cm-strong": { fontWeight: "bold" },
  ".cm-emphasis": { fontStyle: "italic" },
  ".cm-inline-code": {
    fontFamily: "monospace",
    backgroundColor: "rgba(128, 128, 128, 0.15)",
    borderRadius: "3px",
    padding: "0 4px",
  },
  // Hidden syntax (when cursor not on line)
  ".cm-syntax-hidden": {
    fontSize: "0",
    color: "transparent",
  },
  // Visible syntax (when cursor on line)
  ".cm-syntax-visible": {
    color: "rgba(128, 128, 128, 0.6)",
  },
});
```

### 2. Syntax Hiding Extension (`src/syntax-hiding.ts`)

This is the core feature - hiding markdown syntax when cursor is elsewhere.

```typescript
import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { EditorState, Range } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

// Decoration to hide syntax markers
const hiddenSyntax = Decoration.mark({ class: "cm-syntax-hidden" });
const visibleSyntax = Decoration.mark({ class: "cm-syntax-visible" });

// Decoration for styled content
const headingDeco = (level: number) =>
  Decoration.mark({ class: `cm-heading-${level}` });
const strongDeco = Decoration.mark({ class: "cm-strong" });
const emphasisDeco = Decoration.mark({ class: "cm-emphasis" });
const inlineCodeDeco = Decoration.mark({ class: "cm-inline-code" });

export function syntaxHiding() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }

      update(update: ViewUpdate) {
        // Rebuild decorations when doc or selection changes
        if (update.docChanged || update.selectionSet) {
          this.decorations = this.buildDecorations(update.view);
        }
      }

      buildDecorations(view: EditorView): DecorationSet {
        const decorations: Range<Decoration>[] = [];
        const state = view.state;
        const cursorLine = state.doc.lineAt(state.selection.main.head).number;

        // Walk the syntax tree
        syntaxTree(state).iterate({
          enter: (node) => {
            const lineNum = state.doc.lineAt(node.from).number;
            const isCursorLine = lineNum === cursorLine;

            switch (node.name) {
              // ─────────────────────────────────────────────────
              // Headings: # through ######
              // ─────────────────────────────────────────────────
              case "ATXHeading1":
              case "ATXHeading2":
              case "ATXHeading3":
              case "ATXHeading4":
              case "ATXHeading5":
              case "ATXHeading6": {
                const level = parseInt(node.name.slice(-1));
                const line = state.doc.lineAt(node.from);
                const text = state.sliceDoc(node.from, node.to);
                
                // Find the "# " prefix
                const match = text.match(/^(#{1,6})\s/);
                if (match) {
                  const syntaxEnd = node.from + match[0].length;
                  
                  // Style the syntax (# marks)
                  decorations.push(
                    (isCursorLine ? visibleSyntax : hiddenSyntax).range(
                      node.from,
                      syntaxEnd
                    )
                  );
                  
                  // Style the content
                  if (syntaxEnd < node.to) {
                    decorations.push(
                      headingDeco(level).range(syntaxEnd, node.to)
                    );
                  }
                }
                break;
              }

              // ─────────────────────────────────────────────────
              // Bold: **text** or __text__
              // ─────────────────────────────────────────────────
              case "StrongEmphasis": {
                const text = state.sliceDoc(node.from, node.to);
                const marker = text.startsWith("**") ? "**" : "__";
                const markerLen = 2;

                // Opening marker
                decorations.push(
                  (isCursorLine ? visibleSyntax : hiddenSyntax).range(
                    node.from,
                    node.from + markerLen
                  )
                );
                // Content
                decorations.push(
                  strongDeco.range(
                    node.from + markerLen,
                    node.to - markerLen
                  )
                );
                // Closing marker
                decorations.push(
                  (isCursorLine ? visibleSyntax : hiddenSyntax).range(
                    node.to - markerLen,
                    node.to
                  )
                );
                break;
              }

              // ─────────────────────────────────────────────────
              // Italic: *text* or _text_
              // ─────────────────────────────────────────────────
              case "Emphasis": {
                // Opening marker
                decorations.push(
                  (isCursorLine ? visibleSyntax : hiddenSyntax).range(
                    node.from,
                    node.from + 1
                  )
                );
                // Content
                decorations.push(
                  emphasisDeco.range(node.from + 1, node.to - 1)
                );
                // Closing marker
                decorations.push(
                  (isCursorLine ? visibleSyntax : hiddenSyntax).range(
                    node.to - 1,
                    node.to
                  )
                );
                break;
              }

              // ─────────────────────────────────────────────────
              // Inline code: `text`
              // ─────────────────────────────────────────────────
              case "InlineCode": {
                // Opening backtick
                decorations.push(
                  (isCursorLine ? visibleSyntax : hiddenSyntax).range(
                    node.from,
                    node.from + 1
                  )
                );
                // Content
                decorations.push(
                  inlineCodeDeco.range(node.from + 1, node.to - 1)
                );
                // Closing backtick
                decorations.push(
                  (isCursorLine ? visibleSyntax : hiddenSyntax).range(
                    node.to - 1,
                    node.to
                  )
                );
                break;
              }

              // ─────────────────────────────────────────────────
              // Blockquote: > text
              // ─────────────────────────────────────────────────
              case "Blockquote": {
                // Find the > marker
                const text = state.sliceDoc(node.from, node.to);
                const match = text.match(/^>\s?/);
                if (match) {
                  decorations.push(
                    (isCursorLine ? visibleSyntax : hiddenSyntax).range(
                      node.from,
                      node.from + match[0].length
                    )
                  );
                }
                break;
              }

              // ─────────────────────────────────────────────────
              // List items: - or * or 1.
              // ─────────────────────────────────────────────────
              case "ListItem": {
                // List markers stay visible but muted
                const text = state.sliceDoc(node.from, node.to);
                const match = text.match(/^(\s*)([-*]|\d+\.)\s/);
                if (match) {
                  const markerStart = node.from + match[1].length;
                  const markerEnd = node.from + match[0].length;
                  decorations.push(
                    visibleSyntax.range(markerStart, markerEnd)
                  );
                }
                break;
              }
            }
          },
        });

        // Sort decorations by position (required by CodeMirror)
        decorations.sort((a, b) => a.from - b.from);
        return Decoration.set(decorations);
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
}
```

### 3. Main Entry (`src/main.ts`)

```typescript
import { createEditor } from "./editor";

const app = document.getElementById("app")!;
const editor = createEditor(app, `# Welcome to Markdown Editor

This is a **bold** statement and this is *italic*.

Here's some \`inline code\` for you.

## Features

- Live syntax hiding
- Fast incremental parsing
- Native-like performance

> This is a blockquote

\`\`\`javascript
const hello = "world";
\`\`\`
`);

// Expose for debugging
(window as any).editor = editor;
```

### 4. Styles (`src/style.css`)

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  width: 100%;
}

#app {
  display: flex;
  flex-direction: column;
}

.cm-editor {
  flex: 1;
  overflow: auto;
}

.cm-focused {
  outline: none;
}

/* Syntax hiding animation (optional) */
.cm-syntax-hidden {
  transition: font-size 0.1s, color 0.1s;
}
```

## Key Differences from Swift Implementation

### 1. No Manual Parsing Needed

Swift version:
```swift
lineNodes = parser.parseDocument(textView.string)  // 300ms for 22k lines!
```

CodeMirror version:
```typescript
syntaxTree(state).iterate({ ... })  // Incremental, cached, fast
```

Lezer (CodeMirror's parser) handles incremental parsing automatically. It only reparses changed regions.

### 2. Decorations vs Attributes

Swift version (modifies text storage):
```swift
textStorage.addAttributes([
    .font: NSFont.systemFont(ofSize: 0.01),
    .foregroundColor: NSColor.clear
], range: syntaxRange)
```

CodeMirror version (decorations are separate layer):
```typescript
Decoration.mark({ class: "cm-syntax-hidden" }).range(from, to)
```

Decorations don't modify the document - they're a visual overlay. This is cleaner and faster.

### 3. Cursor Tracking

Swift version:
```swift
func textViewDidChangeSelection(_ notification: Notification) {
    let newLineIndex = findLineIndex(for: newPosition)
    // ... manually track revealed lines
}
```

CodeMirror version:
```typescript
update(update: ViewUpdate) {
    if (update.selectionSet) {
        this.decorations = this.buildDecorations(update.view);
    }
}
```

CodeMirror's reactive update system handles this automatically.

### 4. No Scroll Jank

The scroll jank we fought in TextKit doesn't exist in CodeMirror because:
- Decorations don't change layout (just CSS classes)
- `font-size: 0` in CSS is handled by the browser's compositor
- No `scrollRangeToVisible` equivalent being called

## Performance Considerations

### What's Fast

1. **Incremental parsing** - Lezer only reparses changed text
2. **Viewport rendering** - CodeMirror only renders visible lines
3. **Decoration diffing** - Only changed decorations are updated
4. **CSS-based hiding** - Browser handles `font-size: 0` efficiently

### What to Watch

1. **Large documents** - Test with 20k+ lines
2. **Rapid typing** - Ensure decoration rebuilds are throttled
3. **Complex nesting** - Deep markdown nesting can slow tree walks

### Optimization: Viewport-Only Decorations

For very large documents, only decorate visible lines:

```typescript
buildDecorations(view: EditorView): DecorationSet {
    const decorations: Range<Decoration>[] = [];
    const { from, to } = view.viewport;  // Only visible range
    
    syntaxTree(view.state).iterate({
        from,
        to,
        enter: (node) => { ... }
    });
    
    return Decoration.set(decorations);
}
```

## Tauri Integration

### File Operations (`src-tauri/src/main.rs`)

```rust
use tauri::Manager;
use std::fs;

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_file, write_file])
        .run(tauri::generate_context!())
        .expect("error running app");
}
```

### TypeScript Side

```typescript
import { invoke } from "@tauri-apps/api/tauri";

async function openFile(path: string) {
    const content = await invoke<string>("read_file", { path });
    editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: content }
    });
}

async function saveFile(path: string) {
    const content = editor.state.doc.toString();
    await invoke("write_file", { path, content });
}
```

## Migration Checklist

- [ ] Set up Tauri project
- [ ] Install CodeMirror dependencies
- [ ] Implement `syntaxHiding` extension
- [ ] Add heading styles (h1-h6)
- [ ] Add inline styles (bold, italic, code)
- [ ] Add block styles (blockquote, list, code block)
- [ ] Test with large documents (20k+ lines)
- [ ] Add file open/save via Tauri
- [ ] Add keyboard shortcuts (Cmd+B, Cmd+I)
- [ ] Theme customization
- [ ] Dark mode support

## Node Names Reference (Lezer Markdown)

| Markdown | Lezer Node Name |
|----------|-----------------|
| `# H1` | `ATXHeading1` |
| `## H2` | `ATXHeading2` |
| `**bold**` | `StrongEmphasis` |
| `*italic*` | `Emphasis` |
| `` `code` `` | `InlineCode` |
| `> quote` | `Blockquote` |
| `- item` | `ListItem` (inside `BulletList`) |
| `1. item` | `ListItem` (inside `OrderedList`) |
| ` ``` ` | `FencedCode` |
| `[text](url)` | `Link` |
| `![alt](url)` | `Image` |

Use `console.log(node.name)` in the tree iterator to discover more.
