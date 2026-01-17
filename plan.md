# Logbook — Implementation Plan (Tauri + TypeScript, Local-first, Markdown-first)

**North Star:** Logbook is a daily-first personal workspace: it opens straight into **today’s daily note**, ready to type. Notes are **real Markdown files** in a vault (Obsidian-like). Tasks feel like **NotePlan/Things** but remain grounded in Markdown. UI stays minimal; powerful navigation happens via command palette and an optional drawer/library.

---

## 0) Hard constraints
1. **Local-first:** everything works offline.
2. **Markdown-first:** notes are `.md` files on disk, canonical truth.
3. **Vault-first:** user chooses a vault folder; files are readable/backupable outside the app.
4. **Minimal daily-first UX:** default window is today’s note, no permanent sidebar.
5. **Instant editor:** buttery typing, incremental parsing, no frame drops.
6. **Tauri:** Rust handles filesystem + indexing; TS handles editor UX.

---

## 1) Tech stack
### Frontend
- **Tauri UI:** React (or Solid/Svelte) + TypeScript
- **Editor:** **CodeMirror 6**
  - Markdown + GFM extensions
  - Decorations + widgets for live preview and hidden markers

### Backend (Rust via Tauri commands)
- Vault management + file IO (atomic writes)
- File watching (notify)
- SQLite + FTS5 indexing + search
- Task index (from Markdown lines / embedded IDs)
- Optional: export rendering (HTML/PDF) later

---

## 2) Vault + file conventions
### Vault layout (recommended)
Logbook Vault/
Daily/
Weekly/
Notes/
Projects/
Attachments/
Exports/
.logbook/          (index/db/cache)
### Daily notes
- Path: `Daily/YYYY-MM-DD.md`
- Auto-created on open if missing
- Template applied on creation

### Stable IDs (optional but recommended for task reliability)
- Task lines get IDs:
  - `- [ ] Call plumber ^t:UUID`
- IDs are hidden by default in the editor.

---

## 3) Core UX spec (daily-first)
### On launch
- Open **Today’s Daily Note** (create if missing)
- Cursor focused and ready to type
- Minimal header: date + tiny status indicators

### Navigation (minimal, powerful)
- **Cmd+K** Command Palette: open/create/search everything
- **Cmd+J** Jump to date (open daily)
- Optional **Drawer** (slide-over): Recents / Search / Jump to date
- **Library window** (secondary): browse notes/collections (Craft-like)

### Execution views (panels, not full screens)
- Today / This Week as slide-in panels
- Manual ordering for Today tasks
- Tasks can be created inside daily note or captured into Inbox

---

# Milestones (editor first)

## Milestone 0 — Repo + scaffolding
**Deliverables**
- Tauri app skeleton (frontend + Rust backend)
- App shell with:
  - Daily window route
  - Command palette skeleton
- Basic settings storage (vault path)

**Steps**
1. Create Tauri project with TS frontend
2. Pick UI framework (React recommended) and wire routing
3. Build minimal daily window shell + header
4. Add settings store schema (vault path, theme, toggles)
5. Stub command palette and shortcuts

**Acceptance**
- App launches to a placeholder daily editor screen.

---

## Milestone 1 — Vault creation + daily note open/create (Rust)
**Deliverables**
- "Choose/Create Vault" flow
- Create vault folder structure
- Open/create today's daily note file
- Atomic write API (safe saves)

**Steps**
1. Add vault picker UI + Tauri command: `choose_vault()`
2. Validate path + create folder structure in `init_vault(path)`
3. Persist vault path in settings and reload on launch
4. Add `read_note(path)` and `write_note_atomic(path, contents)` with error mapping
5. Implement `open_daily(date) -> {path, contents}` (create if missing + template)

**Acceptance**
- Opening the app always yields a daily note file on disk and loads it.

---

## Milestone 2 — Editor V1 (CodeMirror 6) with instant typing
**Deliverables**
- CodeMirror editor wired to file contents
- Debounced save to disk (e.g., 300–600ms)
- No lag while typing, stable selection

**Steps**
1. Install CM6 and create `MarkdownEditor` component
2. Load file content into editor state and preserve selection
3. Implement change listener -> debounce -> `write_note_atomic`
4. Add save status + external reload trigger
5. Ensure large doc performance is fine (no full rerenders)

**Acceptance**
- Typing is smooth; content persists across relaunch.

---

## Milestone 3 — Full Markdown + GFM parsing in TS (editor-side)
**Deliverables**
- Markdown + GFM syntax tree available per document
- Basic syntax highlighting

**Steps**
1. Enable `@codemirror/lang-markdown` with GFM options
2. Add syntax highlighting theme tokens
3. Confirm syntax tree inspection works (Lezer tree)
4. Add minimal code block styling + inline code

**Acceptance**
- Editor correctly parses and highlights full Markdown constructs.

---

## Milestone 4 — Live Preview styling (without leaving the editor)
**Deliverables**
- Rich “live preview” feel using decorations:
  - headings rendered with typography
  - emphasis/strong styling
  - inline code styling
  - blockquote styling
  - code fences styled (still editable)
  - tables styled (readable)

**Steps**
1. Build a `LivePreviewExtension`:
   - walk syntax tree for visible viewport ranges
   - emit decorations (text classes/styles)
2. Apply CSS tokens for a Craft/Bear-like look
3. Ensure decorations update incrementally (viewport + changes)
4. Cover edge cases (lists, nested emphasis, tables)

**Acceptance**
- Markdown *looks* formatted while remaining fully editable.

---

## Milestone 5 — Hide Markdown markers (selection-aware)
**Deliverables**
- Toggle: Hide/Show Markdown markers
- Markers hidden/dimmed unless caret/selection is inside the construct

**Rules**
- Markers always visible when:
  - caret is inside the formatted span
  - selection intersects marker tokens
  - user hovers/clicks near them (optional)
- Never fully hide when selection touches marker

**Steps**
1. Identify marker token ranges via syntax tree nodes:
   - `**`, `_`, backticks, heading `#`, list markers, link `[]()`, table pipes
2. Create `MarkerVisibilityExtension`:
   - listens to selection changes
   - updates marker decorations in the viewport
3. Add setting toggle (show/hide markers)
4. Use “near-transparent” approach (don’t remove from layout)

**Acceptance**
- Feels Bear-like: clean text, markers appear when editing.

---

## Milestone 6 — Daily note template + minimal chrome
**Deliverables**
- Default daily template insertion
- Header date display
- Minimal keyboard hints (optional)

**Steps**
1. Template applied on create (Rust side)
2. Add header date display in daily window
3. Add `Cmd+J` jump-to-date UI
4. Add `Cmd+K` skeleton for command palette

**Acceptance**
- Opening Logbook always drops you into a useful daily structure.

---

## Milestone 7 — Tasks in Markdown (NotePlan-ish) + checkbox widgets
**Deliverables**
- Task lines parsed from markdown:
  - `- [ ]` and `- [x]`
- Clickable checkbox widget in editor
- Task IDs added automatically (recommended)

**Steps**
1. Detect tasks via syntax tree nodes (task list items)
2. Add checkbox widgets that toggle `[ ]` ↔ `[x]`
3. On new task creation, append `^t:UUID` (hidden marker)
4. Parse existing task IDs and avoid duplicates
5. Keep task edits stable as user types (no cursor jumps)

**Acceptance**
- Tasks feel native inside the daily note.

---

## Milestone 8 — Task model + Execute panels (Today / This Week)
**Deliverables**
- Task entity index stored in SQLite (Rust)
- Today + This Week slide-in panels
- Manual ordering for Today
- Quick actions: move to week/later, assign project

**Steps**
1. Rust indexer extracts tasks from markdown daily notes:
   - store: id, text, completed, source_note_path, line location (optional), tags, schedule token
2. Add task DB schema + migrations
3. Implement `get_tasks(today/week)` commands
4. Build panels in frontend with reorder + actions
5. Persist ordering in DB (not in markdown text order)

**Acceptance**
- You can manage and execute tasks without leaving daily mode.

---

## Milestone 9 — Indexing + Search (Obsidian-like)
**Deliverables**
- SQLite + FTS5 index for notes
- Instant search UI in command palette/drawer
- File watcher: updates index on external edits

**Steps**
1. Rust: build index DB in `.logbook/`
2. Index note metadata + content + headings
3. Add filesystem watcher (notify) -> reindex changed files
4. Add index migrations + background rebuild
5. Frontend: search results grouped by type (notes/tasks/projects)

**Acceptance**
- Search is instant and reliable; external edits are recognized.

---

## Milestone 10 — Library window (Craft-like browsing, secondary)
**Deliverables**
- Separate Library window:
  - collections (folders/saved views)
  - note list with previews
  - opens notes into daily window or a new editor tab/window

**Steps**
1. Build collections grid home
2. Build folder tree + note list view
3. Add “open note” behavior (same window or new)
4. Persist last-opened collection

**Acceptance**
- Organization exists, but daily-first UX remains untouched.

---

## Milestone 11 — Projects (optional V1.1+)
**Deliverables**
- Projects list/board
- Project notes folder or project notebooks
- Link tasks to projects via `p:Project` token or metadata

**Steps**
1. Project entity in SQLite
2. Minimal project view (list first, board later)
3. Link tasks and notes to projects
4. Optional: next action per project

**Acceptance**
- Adds structure without making the app feel heavy.

---

## Milestone 12 — Themes (Bear-like presets)
**Deliverables**
- Theme token system (CSS variables)
- Theme gallery + apply
- Small overrides (accent, editor font)

**Steps**
1. Define design tokens as CSS variables
2. Ship 6–8 curated themes
3. Persist theme selection in settings

**Acceptance**
- App feels personal and premium.

---

## Milestone 13 — iOS/mobile (later)
**Deliverables**
- (If you still want mobile) Decide:
  - Tauri mobile maturity + constraints
  - or separate native companion
- Vault sync strategy (iCloud Drive folder, etc.)

**Acceptance**
- Mobile doesn’t compromise the desktop experience.

---

# Definition of Done (V1)
- Daily-first window opens to today’s note (vault-based markdown file)
- CM6 editor with full Markdown + GFM live preview
- Hide markdown markers that reveal on caret/selection
- Tasks in markdown with clickable checkboxes + stable IDs
- Today/This Week panels + manual ordering
- Rust index + instant search + file watching
- Optional: Library window for browsing notes

---

# Build order (explicit)
1. Repo scaffolding + settings store
2. Vault + daily open/create + template
3. CM6 editor V1 (instant typing + save)
4. Full Markdown + GFM parsing
5. Live preview styling
6. Hide markers
7. Task widgets + task IDs
8. Rust indexing + search + watcher
9. Today/Week panels + task querying
10. Library window
11. Themes
12. Projects (later)
