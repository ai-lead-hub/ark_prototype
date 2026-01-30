# Wishlist (Future UI + Workflow Features)

## 1) Big Screen Mode (Gallery-first)
- Fullscreen grid view for quick browsing on large displays.
- Minimal bottom control bar (Artlist/Higgsfield style):
  - Filters, sort, project/shot selector, quick search.
  - Playback controls for videos, hover-preview toggle.
  - Quick publish/approve/flag actions for supervisors.
- Smart layout: masonry for mixed media; adaptive row height; keyboard shortcuts.
- “Presentation mode” toggle to hide all chrome for review sessions.

## 2) Canvas Mode (Infinite Board)
- Infinite canvas where users drag/drop assets from the library.
- Pan/zoom, snapping, grouping, alignment guides, rulers.
- Notes, arrows, and markup for feedback.
- Export canvas as image/PDF; save canvas state per project.
- Useful for moodboards, storyboard iteration, and shot planning.
- Location: stored in the **shared publish area** so everyone on the project can view the same board.

## 3) ComfyUI Backend Mode (Custom Workflows)
- Add a dedicated ComfyUI-compatible backend service.
- Support node-graph workflows saved per project and per user.
- Execute workflows as queued jobs; store workflow JSON with outputs.
- Allow swapping inputs (seed/prompt/reference) without rebuilding graphs.

## 4) Preset Workflows (SwarmUI-inspired)
- Curated presets for high-use tasks:
  - “Storyboard frame polish”
  - “Clip upscale + frame interpolation”
  - “Character consistency kit”
  - “Product hero render”
- Preset templates map to model choices, default params, and post steps.
- One-click apply + adjustable parameters panel.

## 5) Optional Enhancements
- Version timeline scrubber for shots with preview thumbnails.
- Auto-tagging by model/type/date for fast filtering.
- Kitsu retake sync: ingest review/playlist retake comments and surface as “To Fix” items in personal workspace.
- Quick “re-run” buttons on retake notes to regenerate with last-used settings.
- Batch publish with shot auto-detect from filenames.
- Auto-generate delivery packs (per shot/project) with previews + metadata.
- One-click “deliver to client” exports (watermarked or review-only).
- Kitsu style/camera preset sync: pull per-project or per-shot look-dev presets from Kitsu and expose them as selectable prompt presets.
- Prompt injection helpers: system-level style blocks (e.g., “cinematic lens package”) that can be toggled/stacked safely.

## 6) Acceleration Features (Productivity Boosters)
- “Prompt templates” per project with variables (shot code, character name, style).
- Reusable “reference kits” (preset image stacks for characters/props).
- Smart duplicates: clone a draft with settings + refs + seed in one click.
- Auto-versioning rules per project (e.g., daily vs per publish).
- Bulk relabel/rename tools with regex or templates.
- Usage analytics by project/user/model to control spend.
- Auto-archive inactive projects (cheap storage tier).
- Semantic search across assets (image/video): index clip content with embeddings, search by natural language (e.g., “blue neon street with car”).

## Implementation Notes (Lightweight)
- Feature flags per account or project.
- Save per-user layout preferences.
- Keep render-heavy modes optional to avoid performance impact.
