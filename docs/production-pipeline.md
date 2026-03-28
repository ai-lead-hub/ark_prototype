# Production Pipeline: Kitsu-Driven Shot Workflow

**Status:** Design spec — not yet implemented
**Scope:** New canvas view, Kitsu integration, shot-scoped generation workflow
**Goal:** A production pipeline where Kitsu owns the project/scene/shot hierarchy, the grid is the artist's generation workspace scoped to the active shot, and the canvas is a zoomable storyboard review surface for directors

---

## 1. Problem

The current UI is a flat file grid with no concept of shots, scenes, or production structure. Artists generate dozens of outputs across multiple shots and they interleave in a single timeline-sorted list. There is no way to:

- Scope the working context to a specific shot
- See the state of an entire production at a glance
- Review and compare candidates per shot
- Collaborate between artists and directors on shot selection

The team is used to grid-based iteration (Freepik/Higgsfield style) which is fast for generation. The director wants a storyboard overview (Luma Agents/Frameo style) which is good for review. These are different workflows that need different views of the same data.

---

## 2. Architecture

### Data Hierarchy (owned by Kitsu)

```
Project
  └── Sequence (Kitsu entity — displayed as "Scene" in UI, e.g. SC01-SC12)
        └── Shot (a single camera setup / action beat, e.g. SH01-SH44)
              └── Generated Assets (outputs from the tool)
```

- **Kitsu is the single source of truth** for project/scene/shot structure
- The tool syncs this hierarchy and uses it for organization
- Two-way sync: the canvas can create/remove/reorder shots and push changes back to Kitsu
- Conflict resolution: last-write-wins with manual refresh (productions typically have one person managing the shot list)

### Data Flow

```
Kitsu API  ──sync──>  Local Shot Store  ──drives──>  Shot Containers (grid)
                                                      Shot Rows (canvas)

Artist generates ──>  Output tagged with activeShot ──>  Appears in shot container (grid)
                                                          Appears in shot row (canvas)

Artist publishes ──>  Asset marked published ──>  Starred on canvas
                                                   Approved version for director
```

### Key Principle

**Grid and canvas are views of the same data, not separate systems.** Both read from the same reactive shot store and asset store. Generate in the grid, it appears on the canvas. Delete from the grid, it disappears from the canvas. No sync layer, no publish-to-canvas step.

**Shot mutations propagate everywhere.** The shot store is the single source of truth for shot list, order, and names. When a shot is added, removed, renamed, or reordered — whether from the canvas, from Kitsu directly, or from any other client — the change flows through the shot store and both views update:

```
Canvas reorders SH03 ──> Kitsu API PUT ──> Shot Store updates ──> Grid re-renders shot containers in new order
Kitsu user renames SH05 ──> Periodic sync detects change ──> Shot Store updates ──> Grid + Canvas both show new name
Canvas adds new shot ──> Kitsu API POST ──> Shot Store inserts ──> Grid shows new empty shot container
```

The shot store polls Kitsu on an interval (or listens via webhook if available) to catch external mutations. Canvas and grid mutations go through the store, which pushes to Kitsu and updates both views synchronously.

---

## 3. Views

### Grid View (Artist Workspace)

The file browser grid, scoped to the active shot. The grid is the artist's primary generation and iteration surface.

#### Shot Container

The shot selector is NOT in the top toolbar. Instead, each shot is a **visual container inside the grid** — a subtle rounded rectangle with a border. The container has a header strip:

```
┌─────────────────────────────────────────────────────────┐
│ ▲ ▼  SH05 — Bedroom confrontation   (●)(●)(●)          │
│  nav   shot name/note                tagged elements    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [pin]  [pin]  [input]  [input]  [output]  [output]     │
│  [output]  [output]  [output]  [🔄gen...]               │
│          (flat grid, color-differentiated)               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- **Up/down arrows** on the left of the header — **navigate to next/previous shot** (switches active shot, scrolls to it). NOT for reordering — shot order comes from Kitsu and reordering is a production planning action done on the canvas
- **Shot number + direction note** — e.g. "SH05 — Bedroom confrontation" pulled from Kitsu `data.direction_note`
- **Tagged element circles** on the right of the header — small circular avatars of elements tagged to this shot in Kitsu (characters, props relevant to the shot). These are the same elements that get priority in the prompt `@` autocomplete

#### Active Shot Content (Full Color)

All assets inside the shot container live in a single flat grid. They are differentiated by **color**, not by spatial tiers or size differences:

**Pinned assets** — distinct color border + small pin icon overlay. These are assets the artist explicitly pinned to this shot. Could be reference images, approved frames from other shots, mood boards, etc. Draggable into ControlsPane as references. To pin globally (across shots), the artist pins it from the global project level.

**Input references** — distinct color border (different from pinned). Auto-populated from generation lineage — when you generate, the inputs (start frames, end frames, reference images) are captured and displayed here. These are NOT necessarily from the asset store — they can be arbitrary images the artist dragged in. No per-role color coding (start frame vs end frame vs reference) — just one uniform "input" color. Inputs are not individually color-coded because the distinction doesn't matter at a glance; the artist already knows what they used.

**Outputs** — default color / no special border. Generated candidates for this shot. Standard hover controls (pin, publish, delete, retry, kebab menu). Published/approved outputs get a highlight. Currently generating outputs show a skeleton/pulse animation. These are what flow to the canvas view.

**Drag-in behavior**: Dragging any asset into a shot container treats it as a **shot input reference** by default. This is the common case — you're pulling in material to use for generation. If the artist wants the asset available globally across shots, they explicitly pin it.

All three types are the same tile size in the grid. The color coding is enough to scan what's what without needing layout hierarchy.

#### Inactive Shots (Grayed Out)

When working on SH05, other shots (SH04, SH06, etc.) are still visible below in the scroll but **grayed out / visually muted**. For each inactive shot:

- The shot container header is still visible (shot number, tagged elements)
- **Distinct input references** for that shot are shown (so you can see what was used)
- **Output shots** are shown as muted thumbnails
- Clicking an inactive shot switches it to active (full color, pulled to top)
- The previously active shot grays out in place

This gives the artist peripheral awareness of adjacent shots without cluttering the active workspace.

#### Shot-Scoped Generation

**Generating assets inside a shot stays inside that shot, even if you switch shots mid-generation.** This enables parallelized work:

1. Artist is on SH05, kicks off 3 generations
2. While those are processing, switches to SH06 and starts working there
3. SH05's generations complete — they land in SH05's container (visible grayed out below)
4. Artist switches back to SH05 later and sees the completed outputs

The queue job carries the `shotId` it was created with. The output is always tagged to that shot regardless of which shot is active when the job completes.

#### Tagged Elements in Prompt

Elements tagged to the active shot in Kitsu get priority treatment in the prompt input:

- **`@` autocomplete** — when the artist types `@` in the prompt, tagged elements for the current shot appear at the top of the suggestion list, above pinned elements and other assets
- **Quick-add from header** — the circular element avatars in the shot header are clickable to insert that element reference directly

This means switching to a new shot automatically re-prioritizes the relevant characters/props in the prompt workflow without manual element management.

#### Generation Flow

1. Artist scrolls to or clicks a shot — it becomes active (full color, pulled to top)
2. Tagged elements auto-surface in prompt `@` autocomplete
3. Artist configures prompt, drags references from pinned assets or other shots
4. Generates — output tagged with `activeShot`, appears in shot container
5. Input references auto-populate in the grid from generation lineage
6. Artist iterates, can switch to another shot mid-generation
7. Artist publishes the best candidate — highlighted in grid, starred on canvas

#### Cross-Shot and Cross-Scene References

An artist working on SH05 may need an output from SH02, or a reference from a completely different scene. Three paths, each for different levels of intent:

**Path 1 — Asset Store "Shots" tab**: The asset store (renamed from "elements store") has two tabs:
- **Assets tab**: Kitsu assets — actors, environments, props, references (existing functionality)
- **Shots tab**: Published/approved outputs from ALL shots across ALL scenes in the project. Browse or search, drag into ControlsPane as input reference. This is the primary path for cross-scene references — the artist finds the approved output from SC02-SH05 and drags it in. Only published candidates appear here, so it's curated, not a dump of every generation.

**Path 2 — Navigate to the scene manually**: Switch to the other scene in the grid, find the shot, drag the asset you need. More effort but gives full browsing context when you don't know exactly what you're looking for.

**Path 3 — Canvas "use as input" button**: On the global canvas (all scenes visible), right-click or hover a candidate and hit "Use as input ref." This copies it into the active shot's input references in the grid. Good for the director workflow — they're reviewing the canvas, spot something that would work as a reference for another shot, one action sends it to the artist's workspace.

**Asset store rename**: "Elements store" → "Asset store." It now holds Kitsu assets (actors, environments, props) plus published shot outputs. "Elements" implied only character-type entities which was misleading.

**From global pinned assets**: Assets pinned at the project level (not shot level) appear in every shot container. This is for persistent reference material across the entire production — style guides, color palettes, character turnaround sheets.

### Canvas View (Storyboard / Director Review)

A zoomable, pannable surface showing the entire production.

**Layout:**
- **Vertical axis**: Shots, ordered by Kitsu shot number (deterministic, auto-laid-out)
- **Horizontal axis**: Generated candidates per shot, ordered by timestamp (newest appended right)
- **All shots for the scene are pre-populated** as empty rows based on Kitsu data — the structure exists before any generation happens

**Zoom levels:**
- **Zoomed out**: See all 40+ shots at once. Each shot is a thin row with tiny thumbnails. Director gets a bird's-eye view of production progress (which shots have candidates, which are empty, which have approved versions)
- **Zoomed in**: Punch into a single shot's row. See full-size candidates side by side for comparison. Leave comments on specific candidates

**Shot management on canvas:**
- **Add shot**: Insert between existing rows. Creates in Kitsu, empty row appears
- **Remove shot**: Archives in Kitsu (no hard delete — assets may exist). Row disappears
- **Reorder shots**: Drag row up/down. Updates sort order in Kitsu

**Visual states:**
- Default: All candidates shown as thumbnails in their shot row
- Published/approved: Starred or highlighted — the director's selected version
- Active shot (if artist has grid open): Full color
- Inactive shots: Slightly dimmed but visible for context

**What is NOT on the canvas:**
- Input references (start frames, end frames, reference images) — these are per-generation creative context, not review material. They live in the grid/controls pane only
- Generation parameters — available on hover/click for a specific candidate, not displayed on the node

**Canvas as generation surface**: The canvas is NOT read-only. When an artist generates in the grid, the output auto-snaps to the corresponding shot row on the canvas. The canvas is a live view of generation activity — candidates appear in real time. However, the generation controls themselves (prompt, model selection, params) live in the ControlsPane alongside the grid, not on the canvas.

### Commenting (Canvas)

- Per-candidate comments anchored to specific thumbnails
- Director can comment on any candidate: "Use this but with darker lighting", "Too fast, reduce motion"
- Comments visible on hover or in a side panel when a candidate is selected
- Comment threads, not single annotations — enables back-and-forth between artist and director

---

## 4. Data Model

### Shot (synced from Kitsu)

```typescript
type Shot = {
  id: string;              // Kitsu shot ID
  name: string;            // e.g. "SH01", "SH02"
  directionNote?: string;  // from Kitsu data.direction_note
  description?: string;    // Kitsu shot description
  sceneId: string;         // Parent scene
  sortOrder: number;       // Position in sequence
  status?: string;         // Kitsu task status (e.g. "wip", "review", "approved")
  taggedElementIds: string[]; // Kitsu casting — elements assigned to this shot
  previewFileId?: string;  // Kitsu preview_file_id (main thumbnail)
};
```

### Sequence / Scene (synced from Kitsu)

Kitsu calls these "Sequences" — our UI labels them "Scenes" (e.g. SC01, SC02 in Scarecrow).

```typescript
type Sequence = {
  id: string;
  name: string;            // e.g. "SC03", "SQ01"
  projectId: string;
  parentId?: string;       // episode ID if TV show
  shots: Shot[];
};
```

### Kitsu Asset (synced from Kitsu)

```typescript
type KitsuAsset = {
  id: string;
  name: string;            // e.g. "Scarecrow", "Bedroom"
  description?: string;    // e.g. "Antagonist", "Sasu maa"
  typeName: string;        // from asset_type: "Actor", "Environment", "Prop", "Reference"
  projectId: string;
};
```

Asset types map directly to asset store categories:
- **Actor** → Character elements (Scarecrow, Milli, Arrav, Farmer, etc.)
- **Environment** → Set/location references (Bedroom, House, Beach, Hay Stack)
- **Prop** → Prop elements (Cap, Milli Cycle)
- **Reference** → Reference imagery (Living Room New, Bedroom Shots, House Exterior Night)

### Asset Metadata Extension

Extend the existing file metadata with shot context:

```typescript
// Added to existing file/asset metadata
type ShotAssetMeta = {
  shotId: string;          // Which shot this belongs to
  role: "pinned" | "input" | "output"; // Color coding in the grid
  published: boolean;      // Whether this is the approved version
  generationId?: string;   // Link to generation job for lineage
};
```

- **role=pinned**: Manually pinned by artist. Shown with pin icon + distinct border color. Persistent reference material.
- **role=input**: Auto-populated from generation lineage or dragged in. Distinct border color. Start frames, end frames, reference images used as generation inputs.
- **role=output**: Generated candidates. Default styling. Published outputs get a highlight. These flow to the canvas.

### Generation Lineage (automatic, no user effort)

Captured automatically at generation time from the job payload:

```typescript
type GenerationRecord = {
  id: string;
  shotId: string;
  modelId: string;
  prompt: string;
  params: Record<string, unknown>;
  inputAssets: {
    role: "start_frame" | "end_frame" | "reference";
    assetPath: string;
  }[];
  outputAssetPath: string;
  timestamp: number;
};
```

This enables:
- **"How did I make this?"** — click any output, see exact inputs and params
- **"Redo with tweaks"** — populate controls from a previous generation record, change one thing, regenerate
- **Derivation chains** — base prompt -> v1 -> used as start_frame -> v2 -> upscaled -> v3

---

## 5. Kitsu Integration

### Required API Operations

**Note:** Kitsu calls scenes "Sequences" in its data model. Our UI uses "Scene" for the user-facing concept but the API entity is `Sequence`.

| Operation | Kitsu Endpoint | Direction | Verified |
|---|---|---|---|
| Login | `POST /auth/login` | Write | Yes |
| Check auth | `GET /auth/authenticated` | Read | Yes |
| List projects | `GET /data/projects` | Read | Yes |
| List sequences (scenes) | `GET /data/sequences` (filter by project_id client-side) | Read | Yes |
| List shots | `GET /data/shots/all?project_id=X` | Read | Yes |
| Get shot tasks | `GET /data/shots/{shot_id}/tasks` | Read | Yes |
| Get shot previews | `GET /data/shots/{shot_id}/preview-files` | Read | Yes |
| Get task statuses | `GET /data/task-status` | Read | Yes |
| Get task types | `GET /data/task-types` | Read | Yes |
| Get asset types | `GET /data/asset-types` | Read | Yes |
| List assets | `GET /data/assets?project_id=X` | Read | Yes |
| Create shot | `POST /data/shots` | Write | Not yet |
| Update shot | `PUT /data/shots/{id}` | Write | Not yet |
| Delete shot | `DELETE /data/shots/{id}` | Write | Not yet |
| Create comment | `POST /actions/tasks/{task_id}/comment` | Write | Yes |
| Add preview to comment | `POST /actions/tasks/{task_id}/comments/{comment_id}/add-preview` | Write | Yes |
| Upload preview file | `POST /pictures/preview-files/{preview_id}` | Write | Yes |
| Set main preview | `PUT /actions/preview-files/{preview_id}/set-main-preview` | Write | Yes |
| Download original | `GET /pictures/originals/preview-files/{id}.{ext}` | Read | Yes |
| Download thumbnail | `GET /pictures/thumbnails/preview-files/{id}.png` | Read | Yes |
| Download movie (original) | `GET /movies/originals/preview-files/{id}.mp4` | Read | Yes |
| Download movie (low quality) | `GET /movies/low/preview-files/{id}.mp4` | Read | Yes |
| Download movie tile sprite | `GET /movies/tiles/preview-files/{id}.png` | Read | Yes |
| Download image preview (mid) | `GET /pictures/previews/preview-files/{id}.{ext}` | Read | Yes |

### Kitsu Media Processing (Validated)

Kitsu preserves original uploads and generates lower-quality derivatives for browsing:

**Videos:**
| Endpoint | Quality | Typical Size |
|---|---|---|
| `/movies/originals/` | Full quality (original upload) | 20-40 MB |
| `/movies/low/` | Transcoded low-bitrate (~4.5x smaller) | 4-9 MB |
| `/movies/tiles/` | Sprite sheet for timeline scrubbing | 3-11 MB |
| `/pictures/originals/` | Auto-extracted thumbnail frame | 1-2 MB |

**Images:**
| Endpoint | Quality | Typical Size |
|---|---|---|
| `/pictures/originals/` | Full quality (original upload) | 6-7 MB (2752x1536) |
| `/pictures/previews/` | Mid-size preview (~4-5x smaller) | 1.3-1.6 MB |
| `/pictures/thumbnails/` | Small thumbnail (~220x smaller) | 28-31 KB |

**Key findings:**
- `file_size` in preview metadata matches `/movies/originals/` (or `/pictures/originals/`) exactly — originals are never modified
- For videos, `/movies/low/` is roughly 4.5-5x smaller (bitrate reduction, same resolution)
- For images, `/pictures/previews/` is ~4-5x smaller, `/pictures/thumbnails/` is ~220x smaller
- Integration should fetch from `/originals/` for full quality, use lower tiers for grid thumbnails and canvas browse

### Preview Upload Workflow (Validated)

Uploading a generated output as a shot preview requires 4 API calls:

```
1. POST /actions/tasks/{task_id}/comment
   Body: { task_status_id, comment }
   → returns { id: comment_id }

2. POST /actions/tasks/{task_id}/comments/{comment_id}/add-preview
   Body: {} (revision auto-increments)
   → returns { id: preview_file_id }

3. POST /pictures/preview-files/{preview_file_id}
   Body: multipart form with file
   → returns { id, extension, file_size, width, height }

4. PUT /actions/preview-files/{preview_file_id}/set-main-preview
   → sets as the shot's thumbnail in Kitsu
```

This workflow is how generated outputs get published back to Kitsu. The comment serves as an audit trail — each upload has a comment ("Generated with Kling 2.5 Pro, prompt: ...") and a revision number.

### Sync Strategy

- **On app load**: Pull full project -> scene -> shot hierarchy
- **On scene switch**: Refresh shots for that scene
- **On canvas edit** (add/remove/reorder shot): Immediate push to Kitsu
- **Periodic refresh**: Poll for changes every 30s (or websocket if Kitsu supports it)
- **Conflict handling**: Last-write-wins. If a shot was deleted in Kitsu while the canvas had it open, remove it on next sync and notify the artist

### Kitsu Asset Tagging

Leverage Kitsu's existing metadata/tagging system to maximum effect:
- **Pin assets** to shots via Kitsu tags — pinned assets surface to the top in the grid and asset store when that shot is active
- **Asset store filtering** — elements tagged by shot/scene in Kitsu auto-surface when the artist switches to that shot (characters and props relevant to the shot appear first)
- **Shot status updates** — when an artist publishes a candidate, optionally update the Kitsu task status (e.g. "wip" -> "review")

---

## 6. Implementation Order

### Phase 1: Kitsu Sync + Shot Selector

**Goal**: Artist can work within shot context. No canvas yet.

1. **Kitsu API client** — login, pull project/sequence/shot hierarchy, cache locally
2. **Local shot store** — cache hierarchy, expose via React context
3. **Shot containers in grid** — render shots as visual containers with header (nav arrows, name, tagged elements). Active shot in full color, others grayed out
4. **Auto-tag on generate** — outputs get `shotId` from active shot, persist in asset metadata
5. **Grid scoping** — active shot's assets in full color, inactive shots visible but muted. Up/down arrows navigate between shots

This is the critical path. Everything else builds on having shots available.

### Phase 2: Generation Lineage

**Goal**: Automatic provenance tracking. No user effort.

1. **Capture generation record** at job creation — model, prompt, params, input asset paths
2. **Persist against output** — link generation record to output file metadata
3. **"Recreate" action** on grid tiles — populate controls from generation record
4. **"Info" panel** — click any output to see how it was made

### Phase 3: Canvas Storyboard View

**Goal**: Director review surface.

1. **Canvas renderer** — zoomable/pannable surface (consider react-flow, xyflow, or custom with CSS transforms)
2. **Auto-layout engine** — shots as rows, candidates as columns, deterministic positioning
3. **Shot CRUD on canvas** — add/remove/reorder shots, two-way sync to Kitsu
4. **Published/starred indicators** — approved candidates highlighted
5. **Zoom interaction** — smooth transition between production overview and shot detail

### Phase 4: Commenting

**Goal**: Director-artist collaboration.

1. **Comment data model** — per-candidate threads, stored in backend (or Kitsu if it supports annotations)
2. **Comment UI on canvas** — click candidate, open comment panel, threaded discussion
3. **Notifications** — artist sees when director comments on their shot

### Phase 5: Deep Kitsu Tag Integration

**Goal**: Kitsu tags drive the entire UI.

1. **Asset store scoping** — assets tagged for a shot auto-surface when that shot is active
2. **Asset store "Shots" tab** — published outputs from all shots/scenes, browsable and draggable as input refs
3. **Asset pinning via Kitsu** — pin assets to shots through Kitsu metadata
3. **Status sync** — publish updates Kitsu task status

---

## 7. Canvas Technical Notes

### Why Canvas, Not a Structured Layout

A grouped list with horizontal scroll can show shots and candidates, but cannot:
- Zoom to fit the entire production in one viewport
- Smoothly transition between overview and detail
- Give directors the spatial awareness of production progress at a glance

These interactions justify canvas complexity over a simpler DOM layout.

### Constraints

- **Auto-layout only** — users can zoom and pan but cannot rearrange individual nodes. Shot order comes from Kitsu (reorderable via row drag on canvas), candidate order comes from timestamp. No saving spatial positions per-node, no overlap handling
- **Outputs only** — no input references, no generation params on the surface. Clean review view
- **Live generation surface** — outputs auto-snap to their shot row as they're generated from the grid. The canvas is a live projection, not a static snapshot

### Tech Choices

| Option | Pros | Cons |
|---|---|---|
| **xyflow/react-flow** | Mature, handles zoom/pan/viewport, node rendering is React components | Designed for node graphs, may fight against strict row layout |
| **Custom CSS transforms** | Full control over layout, no library overhead | Must implement zoom/pan/minimap from scratch |
| **tldraw** | Full canvas toolkit, collaboration built in | Heavy dependency, opinionated about interaction model |

Recommendation: Start with **xyflow** for the zoom/pan/viewport management but use a custom layout algorithm that enforces the row/column structure. If xyflow fights the constrained layout too much, fall back to custom CSS transforms with a lightweight zoom/pan hook.

---

## 8. Open Questions

1. **Per-shot generation state**: When switching shots, should the controls pane restore the last prompt/params used for that shot? This makes context-switching seamless but adds state persistence complexity.

2. **Multiple artists per scene**: If two artists work on different shots in the same scene simultaneously, how does the canvas handle concurrent updates? Real-time sync (websocket) or manual refresh?

3. **Shot versioning vs. flat candidates**: Currently all candidates are equal in the shot row. Should there be an explicit "version" concept where the artist groups candidates into versions (v1 attempts, v2 attempts after director feedback)?

4. **Kitsu authentication**: How do users authenticate with Kitsu? Per-user tokens stored in workspace settings, or shared project token? Current test uses email/password login → JWT. Token refresh is available via `GET /auth/refresh-token` (tokens expire every 2 weeks).

5. **Cross-shot and cross-scene references**: How does an artist use an output from another shot or scene as an input reference? (See Section 3 — Grid View — Cross-Shot References)

---

## 9. UX Audit — Known Risks and Gaps

### Grid View

**Problem: Shot containers make the grid very tall.** With 47 shots in SC03 (Scarecrow), even collapsed/grayed out, that's a massive scroll area. If each inactive shot shows even 1 row of thumbnails + header, you're looking at 47 × ~120px = ~5600px of inactive content below the active shot. Artists will lose spatial awareness of where they are in the shot list.
- *Mitigation*: Inactive shots should be aggressively collapsed — header only, no asset thumbnails by default. Expand on click/hover. Or only show adjacent shots (N-1, N+1) and collapse the rest to just a thin header bar.

**Problem: No clear "where am I" indicator.** If the artist scrolls past the active shot header, they lose context of which shot they're working in. The shot name needs to be sticky/pinned to the top of the viewport while scrolling within that shot's assets.

**Problem: Drag-in-as-input ambiguity.** Dragging an asset into the grid area — does it go to the active shot only? What if you drag it onto a grayed-out shot's container? Does it become an input for that shot? This needs to be visually clear — maybe only the active shot accepts drops, and inactive shots require activation first.

**Problem: Three colors for three roles in a flat grid is subtle.** If the grid has 30 assets (5 pinned, 8 inputs, 17 outputs) all at the same size with only border color differences, an artist scanning quickly may not parse the structure. The colors need to be sufficiently distinct and the grouping within the flat grid should cluster by role (pinned first, then inputs, then outputs) even if they're the same size.

**Problem: Input references accumulate.** Every generation captures its inputs. After 20 generations, the shot has 20+ input references (many duplicates — the same start frame used repeatedly). Need deduplication or a way to collapse/hide inputs that are identical across generations.

### Canvas View

**Problem: 197 shots × N candidates = enormous canvas.** Scarecrow has 197 shots. At even 5 candidates per shot, that's ~1000 nodes. Performance and navigation become real issues. Virtualization is essential — only render nodes in the viewport.

**Problem: No generation controls on canvas.** The director sees the storyboard but if they want to trigger a re-generation of a shot, they have to switch to the grid view, find the shot, and work from there. A "regenerate" action on canvas nodes (which opens the grid focused on that shot) would bridge this gap.

### Cross-View Coherence

**Problem: Which view is primary?** If an artist is in grid view working on SH05 and the director is on canvas commenting on SH05, are their states linked? Does clicking SH05 on canvas switch the grid to SH05? Or are they independent? This matters for single-screen vs multi-screen workflows.

**Problem: Publish action has no undo.** Once published, the candidate is starred on canvas and potentially pushes a Kitsu task status update. If the artist publishes the wrong one, there's no obvious way to un-publish. Need an explicit un-publish or "replace published" action.

### Kitsu Integration

**Problem: Sequences endpoint doesn't filter by project.** From our test, `GET /data/sequences` returns all sequences across all projects. We filter client-side by `project_id`. With many projects this could return a lot of data. May need to cache aggressively.

**Problem: Shot ordering is not explicit in Kitsu.** Shots don't have a `sort_order` field — they're identified by name (SH01, SH02, SH0.5, SH25.5). Ordering must be derived by parsing the shot name numerically. Decimal shots (SH0.5, SH2.5, SH25.5) are inserted shots that need to sort correctly between their integer neighbors.

**Problem: No "Generation" task on all shots.** In Scarecrow, shots have Animation, Compositing, Frames, Storyboard tasks — but no Generation task type by default. We either need to create Generation tasks on each shot before uploading previews, or piggyback on an existing task type. Creating tasks programmatically via Kitsu API needs to be validated.
