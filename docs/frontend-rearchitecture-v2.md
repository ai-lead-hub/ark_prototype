# Frontend UI Re-Architecture: Grid-First Design

This plan outlines the structural UI/UX changes to transition the application from a split-pane layout into a dense, grid-first design where the `PreviewPane` is entirely removed and actions are contextualized to grid tiles.

## Proposed Changes

### 1. File Pane Expansion & Layout
- **Component**: `src/app/page.tsx`
- **Change**: Remove `<PreviewPane />` and `<ElementsManager />` side-pane logic. The layout will permanently consist of just two components: `<ControlsPane />` on the left (~420px width) and `<FileBrowser />` taking up the entire remaining width of the screen.

### 2. Upper Toolbar Refactoring
- **Component**: `src/components/FileBrowser.tsx`
- **Change**: 
  - Remove the standalone "Multi-Select" button.
  - Remove standalone "Images", "Videos", and "Sort" filter toggles.
  - Introduce a single "Filter" dropdown icon button next to the search bar. This dropdown will contain the category toggles (Image, Video) and sort options cleanly hidden behind it.
  - Introduce an "Elements Store" button to the top-right of the interface.

### 3. Grid Layout Updates
- **Component**: `src/components/FileBrowser.tsx`
- **Change**: 
  - Change the CSS grid layout from responsive `aspect-square` tiles to a strict **3-column layout** (`grid-cols-3`).
  - Update tile container classes to enforce a **16:9 aspect ratio** using `aspect-video`.

### 4. Queue Processing Placeholder Tiles
- **Component**: `src/components/FileBrowser.tsx` & `src/state/queue.tsx`
- **Change**: 
  - Integrate pending/processing jobs from `useQueue()` directly into the main grid layout.
  - While a job creates an asset, a "Skeleton" grid tile will render at the **top** of the grid (ignoring sort options) displaying the queue loading bar and current status logs. 
  - If a job fails, the error state will appear on the tile, with a retry button.

### 5. On-Hover Grid Tile Controls
- **Component**: `src/components/FileBrowser.tsx` (or a newly extracted `GridTile.tsx`)
- **Change**: Redesign the hover state overlay of each grid tile (with a top/bottom darkening vignette for contrast) to map the old preview-pane actions directly to the tile:
  - **Top Left**: A "hole punch" checkbox button to enable and toggle multi-select mode.
  - **Top Right**: The "Pin" button, adjacent to a "Kebab (3-dots) Menu" button. This dropdown menu will house:
    - **Crop**: Hovering exposes a submenu of quick aspect ratios.
    - **Upscale**: Hovering exposes a submenu for quick model selection.
    - **Publish**: Moved here for clean access.
  - **Bottom Left**: Action icon buttons for **Retry** (Recreate from output), **Copy Prompt**, and **Use as Ref** (which triggers a tiny visual success tick/toast).
  - **Bottom Right**: **Download** button.
  - **Drag and Drop Engine**: Any grid tile can be physically dragged out of the grid and dropped into the left Controls Pane directly.

### 6. Single Click "Image Lab" Full Screen Mode
- **Component**: `src/components/ImageLab.tsx`
- **Change**: 
  - Remove the manual "Full Screen" toggle button entirely.
  - Single click on a grid tile opens it in a full screen mode across the application viewport. 
  - This interface serves as the **Image Lab** environment, handling zoom, panning, and video playback on a black canvas base. 
  - **Frame Extraction**: The lab maintains the prior PreviewPane feature allowing users to scrub a video and capture/save the current frame as an image.
  - It features explicit Left/Right arrow key navigation and Chevron UI arrows to cycle seamlessly through the gallery directly within the lab.

### 7. Elements Store & Per-Project Pinning
- **Component**: `src/components/ElementsManager.tsx` -> `src/components/ElementsModal.tsx`
- **Change**: 
  - The Elements Manager operates as a centered overlay **Elements Modal** invoked by a top-right button in the main layout.
  - Users can explicitly **Pin Elements** on a per-workspace (project) basis. Pinned elements stay readily accessible across that project.

### 8. Prompt Integration, Multimodal Badging & Reference Flow
- **Component**: `src/components/ControlsPane.tsx`
- **Change**: 
  - **Prompt "@" Autocomplete**: Typing `@` in the prompt input triggers a popup menu displaying (in order):
    1. Active image/keyframe reference images.
    2. Pinned elements (scrollable).
    3. A fixed bottom action item: *"Pick from Element Store"* (which opens the Elements Modal).
  - **Compact Multimodal Badging**: Throughout the UI, any loaded reference file inside the Controls Pane will feature a compact visual overlay (e.g., a tiny corner circle). This dictates the modality type passed to the model: 
    - Standard Raw Media triggers proxy badges: `@img` or `@vid` (which are translated under-the-hood to match the exact JSON key the selected model's API expects).
    - True Element objects are decorated specifically with their `@elementname`.
  - **Video Models Controls UI**: For video models that support elements natively, a dedicated **"Elements" horizontal list** appears below the video references/keyframes list. Clicking the `+` button opens a picker where pinned elements sit at the very top. 
    - *Fallback Handling*: If a video model doesn't explicitly support elements natively, selecting one falls back to injecting the element's character sheet as a proxy reference image (`@img`) while keeping the exact same UX.
  - **Image Models Controls UI**: No separate elements bar. Elements can be added via the standard `+` references bar. If an image model doesn't explicitly support elements natively, the element's character sheet is automatically attached as a proxy image reference (`@img`).

### 9. Bottom Floating Toolbar for Multi-Select
- **Component**: `src/components/FileBrowser.tsx`
- **Change**: 
  - When multi-select mode is activated (via a tile's top-left hole-punch), a sticky, floating toolbar will slide up from the bottom of the screen.
  - This toolbar will contain bulk-action functions: 
    - **Compare**: Moves to this bottom bar and activates only when exactly two files are selected.
    - **Delete**: Moved explicitly to this toolbar layer.
    - **Combine into Collage**: Interface reserved, but implementation is deferred for a later phase.
    - **Clear Selection**.

---

### [Component Changes Overview]

#### [MODIFY] src/app/page.tsx
- Remove `PreviewPane` import and states.
- Modify the CSS grid to use permanently just two columns (Controls | FileBrowser).
- FileBrowser column dynamically flexes to scale fully across the removed space.
- Wire new global "Elements Store" button.

#### [MODIFY] src/components/FileBrowser.tsx
- Integrate `useQueue()` logic for placeholder rendering (sort forced top).
- Overhaul upper search bar and filter controls into a unified dropdown.
- Implement the 3-column grid layout with 16:9 ratios.
- Update tile `onMouseEnter` / `onMouseLeave` rendering code for hover actions, menus, and Drag-and-Drop parameters.
- Add trigger for full-screen `ImageLab` single-click behavior.
- Render the new floating bottom multi-select toolbar.

#### [MODIFY] src/components/ControlsPane.tsx
- Implement `@` autocomplete menu parsing in the prompt box.
- Create specific UI differences between Image Models (unified reference bar) and Video Models (dedicated references vs dedicated elements bars).
- Overlay compact circular badges indicating `@img`, `@vid`, or `@elementname` onto existing input references.
- Implement logical fallbacks (extract character sheet proxy) for unsupported element models.

#### [NEW] src/components/CompareModal.tsx
- Extracted ImageComparer, moved to an overlay modal when clicking "Compare" from the multi-select bottom bar.

#### [NEW] src/components/ImageLab.tsx
- A new full-screen viewport replacing the old Preview Pane component, invoked by a single click. Allows inspect/zoom/playing for media, Left/Right scrubbing, and Video Frame Extraction.

#### [MODIFY] src/components/ElementsManager.tsx -> ElementsModal.tsx
- Convert logic into an absolute-positioned center Modal. Add concept of pinning elements per project.

#### [DELETE] src/components/PreviewPane.tsx
- Entire component is removed. Subcomponents like comparative tools are moved sequentially.

---

## Verification Plan
### Automated Tests
- Run `npm run lint` and `npx tsc --noEmit` to ensure type checks pass across all files affected by removing `PreviewPane`.

### Manual Verification
- Execute `npm run dev:all`. 
- Type `@` in the ControlsPane prompt and verify the unified autocomplete menu appears logically.
- Test Elements Modal pinning features.
- Validate that compact corner badges (`@img`, `@vid`, `@element`) are successfully overlaying on generated reference thumbnails in the ControlsPane depending on what they are. 
- Verify queue processing bars appear natively in the Grid flow correctly sorted purely at the top.
- Confirm multi-select toolbar appears on hole-punch click.
