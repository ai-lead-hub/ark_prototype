# Ark — Sprint Implementation Guide

**Audience:** Frontend dev (Next.js/React) and backend dev (Django/Python) who build websites, not film tools.
**Goal:** A production tool where artists generate AI images/videos for shots in a film, organized by scenes and shots, with a shared output board.

---

## What This App Does (Plain English)

Think of it like Figma meets a video production pipeline:

1. A **project** is a film/show (e.g. "Scarecrow")
2. A project has **scenes** (SC01, SC02...) — like chapters
3. Each scene has **shots** (SH01, SH02...) — individual camera angles / moments
4. An artist opens a shot, writes a text prompt, picks an AI model, and generates images or videos
5. All generated outputs for a shot are visible to the whole team immediately
6. A director reviews outputs and "publishes" (stars) the best one as the final pick
7. Artists can use outputs from other shots as input references for new generations

The app has two main views:
- **Grid view** — the artist's workspace. Shows one shot at a time with all its candidates
- **Global board** — the director's overview. Shows all shots and their outputs across the project

---

## Architecture Overview

```
┌─────────────┐         ┌──────────────┐         ┌─────────┐
│  Next.js    │  REST   │  Django API  │         │   S3    │
│  Frontend   │◄───────►│  Backend     │◄───────►│  Bucket │
│  (Vercel)   │  JSON   │  (Railway)   │  boto3  │  (AWS)  │
└─────────────┘         └──────┬───────┘         └─────────┘
                               │
                               │ (Sprint 2 only)
                               ▼
                        ┌─────────────┐
                        │  Kitsu API  │
                        │  (metadata) │
                        └─────────────┘
```

- **Next.js frontend** — all UI, no server-side logic. Calls the Django API for everything.
- **Django backend** — REST API. Handles auth, project CRUD, file management, generation job dispatch, S3 operations.
- **S3** — stores all files. Images, videos, audio, project manifests.
- **Kitsu** (Sprint 2) — external production tracker. Only for publishing finals and syncing project structure. Not required for Sprint 1.

---

## S3 Folder Structure

This is the single most important thing to understand. Every file in the system lives here.

```
{project_id}/
    ├── assets/                              # Shared project resources
    │     ├── characters/                    # Character sheets, turnarounds
    │     │     └── scarecrow_main.png
    │     ├── locations/                     # Environment references
    │     │     └── cornfield_dawn.jpg
    │     └── props/                         # Prop references
    │           └── lantern_rusty.png
    │
    ├── scenes/
    │     └── {scene_id}/
    │           └── {shot_id}/
    │                 ├── outputs/           # ALL generated candidates (PUBLIC)
    │                 │     ├── 1711892400_ayush_kling_a3f2.mp4
    │                 │     ├── 1711892500_sarah_flux_b7c1.png
    │                 │     └── ...
    │                 └── refs/              # Input references (PRIVATE to grid)
    │                       ├── 1711891200_ayush_ref_c8d2.png
    │                       └── ...
    │
    └── manifest.json                        # Project state, metadata, publish flags
```

### Key rules:
- `outputs/` — **public.** Every generation from every artist goes here. The global board reads only from this folder. Nothing is hidden.
- `refs/` — **private to the artist grid.** When an artist drags a frame from another shot to use as a reference, it gets **copied** here. The global board never shows refs. The artist's grid shows them with a green border.
- `assets/` — **shared.** Project-level resources everyone uses. When dragged into a shot as a reference, the file is copied into that shot's `refs/` folder.

### Why copy instead of link?
Each shot folder is self-contained. If the original in SH02 gets deleted, SH05's copy still exists. You can zip a shot folder and hand it to someone — it has everything. The `source` field in the manifest tracks where it came from.

---

## Data Model

### manifest.json

The manifest is the brain of the project. It lives on S3 and the Django backend reads/writes it.

```json
{
  "id": "proj_abc123",
  "name": "Scarecrow",
  "created_by": "ayush",
  "created_at": "2026-03-01T00:00:00Z",

  "scenes": [
    {
      "id": "sc01",
      "name": "SC01",
      "order": 0,
      "shots": [
        {
          "id": "sh01",
          "name": "SH01",
          "order": 0,
          "direction_note": "Wide establishing shot, cornfield at dawn",
          "published_output": "scenes/sc01/sh01/outputs/1711892400_ayush_kling_a3f2.mp4"
        },
        {
          "id": "sh02",
          "name": "SH02",
          "order": 1,
          "direction_note": "Close-up scarecrow face, eyes glow",
          "published_output": null
        }
      ]
    }
  ],

  "files": {
    "scenes/sc01/sh01/outputs/1711892400_ayush_kling_a3f2.mp4": {
      "role": "output",
      "user": "ayush",
      "model": "kling-1.6",
      "prompt": "A weathered scarecrow walks through golden corn...",
      "created_at": "2026-03-31T14:00:00Z",
      "published": true,
      "refs_used": [
        "scenes/sc01/sh01/refs/1711891200_ayush_ref_b7c1.png"
      ],
      "width": 1920,
      "height": 1080,
      "duration": 5.0,
      "extension": "mp4",
      "is_video": true
    },
    "scenes/sc01/sh01/refs/1711891200_ayush_ref_b7c1.png": {
      "role": "ref",
      "user": "ayush",
      "created_at": "2026-03-31T13:40:00Z",
      "source": "scenes/sc01/sh02/outputs/1711880000_sarah_flux_d4e5.png",
      "width": 1920,
      "height": 1080,
      "extension": "png",
      "is_video": false
    }
  }
}
```

### Django models (simplified)

```python
class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    name = models.CharField(max_length=255)
    s3_prefix = models.CharField(max_length=255)  # "{project_id}/"
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

class Scene(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    project = models.ForeignKey(Project, related_name="scenes", on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    order = models.IntegerField(default=0)

class Shot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    scene = models.ForeignKey(Scene, related_name="shots", on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    order = models.IntegerField(default=0)
    direction_note = models.TextField(blank=True, default="")
    published_output = models.CharField(max_length=500, blank=True, null=True)

class ShotFile(models.Model):
    """Metadata for every file in a shot folder (output or ref)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    shot = models.ForeignKey(Shot, related_name="files", on_delete=models.CASCADE)
    s3_key = models.CharField(max_length=500)       # Full S3 path
    role = models.CharField(max_length=10)            # "output" | "ref"
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    model_id = models.CharField(max_length=100, blank=True, default="")
    prompt = models.TextField(blank=True, default="")
    source = models.CharField(max_length=500, blank=True, default="")  # Where a ref was copied from
    published = models.BooleanField(default=False)
    width = models.IntegerField(default=0)
    height = models.IntegerField(default=0)
    duration = models.FloatField(default=0)
    extension = models.CharField(max_length=10)
    is_video = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

class ProjectAsset(models.Model):
    """Project-level shared assets (characters, locations, props)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    project = models.ForeignKey(Project, related_name="assets", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=50)  # "characters" | "locations" | "props"
    s3_key = models.CharField(max_length=500)
    thumbnail_s3_key = models.CharField(max_length=500, blank=True, default="")
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
```

---

## Backend API (Django REST Framework)

The backend is a standard REST API. No websockets in Sprint 1 — the frontend polls for updates.

### Auth
```
POST   /api/auth/login/          # Email + password → JWT token
POST   /api/auth/register/
POST   /api/auth/refresh/
```

### Projects
```
GET    /api/projects/                      # List user's projects
POST   /api/projects/                      # Create project
GET    /api/projects/{id}/                 # Get project with scenes + shots
PUT    /api/projects/{id}/                 # Update project name
DELETE /api/projects/{id}/                 # Archive project
```

**Create project request:**
```json
{
  "name": "Scarecrow",
  "scenes": [
    { "name": "SC01", "shot_count": 8 },
    { "name": "SC02", "shot_count": 12 },
    { "name": "SC03", "shot_count": 6 }
  ]
}
```

The backend creates the project, scenes, and shots in the database, creates the S3 folder structure, and writes the initial `manifest.json`.

**Get project response:**
```json
{
  "id": "proj_abc123",
  "name": "Scarecrow",
  "created_by": "ayush",
  "scenes": [
    {
      "id": "sc01",
      "name": "SC01",
      "order": 0,
      "shot_count": 8
    }
  ],
  "asset_count": 5,
  "updated_at": "2026-03-31T14:00:00Z"
}
```

### Scenes
```
GET    /api/projects/{id}/scenes/                  # List scenes
POST   /api/projects/{id}/scenes/                  # Add scene
PUT    /api/projects/{id}/scenes/{scene_id}/       # Rename, reorder
DELETE /api/projects/{id}/scenes/{scene_id}/
```

### Shots
```
GET    /api/scenes/{scene_id}/shots/               # List shots with file counts
POST   /api/scenes/{scene_id}/shots/               # Add shot
PUT    /api/shots/{shot_id}/                        # Update name, direction note, order
DELETE /api/shots/{shot_id}/
POST   /api/shots/{shot_id}/publish/               # Publish a candidate
```

**List shots response:**
```json
[
  {
    "id": "sh01",
    "name": "SH01",
    "order": 0,
    "direction_note": "Wide establishing shot",
    "published_output": null,
    "output_count": 12,
    "ref_count": 3
  }
]
```

### Shot Files (the core content API)
```
GET    /api/shots/{shot_id}/files/                 # List all files (outputs + refs)
GET    /api/shots/{shot_id}/files/?role=output      # Only outputs (for global board)
POST   /api/shots/{shot_id}/files/upload/           # Upload generated output or ref
POST   /api/shots/{shot_id}/files/copy-ref/         # Copy a file from another shot as ref
DELETE /api/shots/{shot_id}/files/{file_id}/         # Soft delete
```

**Upload flow (after generation completes):**
```
1. Frontend generates image/video via AI model API
2. Frontend calls POST /api/shots/{shot_id}/files/upload/
   - multipart form: file blob + metadata JSON
3. Backend:
   a. Generates filename: {timestamp}_{user}_{model}_{hash}.{ext}
   b. Uploads to S3: {project_id}/scenes/{scene_id}/{shot_id}/outputs/{filename}
   c. Creates ShotFile record in database
   d. Returns file metadata + S3 presigned URL for display
```

**Copy ref flow (drag output from SH02 into SH05):**
```
POST /api/shots/{sh05_id}/files/copy-ref/
{
  "source_file_id": "file_xyz789"   // The ShotFile ID from SH02
}

Backend:
  1. Reads the source file's S3 key
  2. Copies to: {project_id}/scenes/{scene_id}/{sh05_id}/refs/{timestamp}_{user}_ref_{hash}.{ext}
  3. Creates new ShotFile record with role="ref" and source=original S3 key
  4. Returns new file metadata
```

**Publish flow:**
```
POST /api/shots/{shot_id}/publish/
{
  "file_id": "file_abc123"
}

Backend:
  1. Sets published=true on the ShotFile
  2. Sets published=false on any previously published file for this shot
  3. Updates shot.published_output to this file's S3 key
  4. Returns updated shot
```

### Project Assets
```
GET    /api/projects/{id}/assets/                   # List all project assets
GET    /api/projects/{id}/assets/?category=characters
POST   /api/projects/{id}/assets/upload/            # Upload asset
DELETE /api/projects/{id}/assets/{asset_id}/
```

### Global Board (Director View)
```
GET    /api/projects/{id}/board/                    # All shots with their outputs
GET    /api/projects/{id}/board/?scene={scene_id}   # Filter by scene
```

**Board response:**
```json
{
  "scenes": [
    {
      "id": "sc01",
      "name": "SC01",
      "shots": [
        {
          "id": "sh01",
          "name": "SH01",
          "direction_note": "Wide establishing shot",
          "published_output_id": "file_abc123",
          "outputs": [
            {
              "id": "file_def456",
              "s3_url": "https://...",
              "thumbnail_url": "https://...",
              "user": "sarah",
              "model": "flux",
              "is_video": false,
              "published": false,
              "created_at": "2026-03-30T10:00:00Z"
            },
            {
              "id": "file_abc123",
              "s3_url": "https://...",
              "thumbnail_url": "https://...",
              "user": "ayush",
              "model": "kling-1.6",
              "is_video": true,
              "published": true,
              "created_at": "2026-03-31T14:00:00Z"
            }
          ]
        }
      ]
    }
  ]
}
```

Outputs are sorted chronologically within each shot. Published output is always last (pinned rightmost). The frontend reads this and renders the board.

### Generation (Job Dispatch)
```
POST   /api/generate/                   # Submit generation job
GET    /api/generate/{job_id}/          # Poll job status
GET    /api/generate/?shot={shot_id}    # List jobs for a shot
```

**Generate request:**
```json
{
  "shot_id": "sh05",
  "model": "kling-1.6",
  "prompt": "A weathered scarecrow walks through golden corn...",
  "params": {
    "aspect_ratio": "16:9",
    "duration": 5,
    "resolution": "1080p"
  },
  "ref_file_ids": ["file_ref_001", "file_ref_002"]
}
```

**Generate flow:**
```
1. Frontend POSTs to /api/generate/
2. Backend validates, creates job record (status: "pending")
3. Backend dispatches to Celery task queue
4. Celery worker:
   a. Downloads ref files from S3 (if any)
   b. Calls AI model API (Kling, Flux, etc.)
   c. When complete, uploads result to S3:
      {project_id}/scenes/{scene_id}/{shot_id}/outputs/{timestamp}_{user}_{model}_{hash}.{ext}
   d. Creates ShotFile record
   e. Updates job status to "completed"
5. Frontend polls GET /api/generate/{job_id}/ until status is "completed"
6. Frontend fetches updated file list for the shot
```

### S3 Presigned URLs
```
GET    /api/files/{file_id}/url/        # Get presigned download URL (expires 1hr)
POST   /api/files/upload-url/           # Get presigned upload URL for direct-to-S3 upload
```

For large files, the frontend uploads directly to S3 using a presigned URL, then notifies the backend. This avoids routing file bytes through Django.

---

## Frontend Implementation

### Tech Stack
- **Next.js 14+** (App Router, but used as a pure SPA — no server components needed)
- **React 18+** with hooks and context
- **Tailwind CSS** for styling
- **TypeScript** throughout

### Pages and Routes

```
/                       → HomeScreen (project list)
/project/{id}           → Main workspace (grid + controls)
/project/{id}/board     → Global board (director view)
```

In Sprint 1, these can all be client-side routes (no SSR needed). The page.tsx at the root handles routing via state, exactly like the current prototype.

---

## Feature-by-Feature Implementation

### Feature 1: Home Screen (Project Selector)

**What it does:** Shows all projects as cards. Click one to enter the workspace. Has a "New Project" button.

**Reference:** `src/components/HomeScreen.tsx` in the prototype.

**Visual description:**
```
┌──────────────────────────────────────────────────────────────┐
│  [A] Ark                                    [Search] [Avatar]│
├──────────────────────────────────────────────────────────────┤
│  Projects                                                    │
│  Select a project to open the workspace                      │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ ▶ video  │  │          │  │          │  │   + New  │    │
│  │ thumbnail│  │  letter  │  │  letter  │  │  Project │    │
│  │          │  │          │  │          │  │          │    │
│  ├──────────┤  ├──────────┤  ├──────────┤  │  (dashed │    │
│  │Scarecrow │  │Moonrise  │  │Deep Cur..│  │  border) │    │
│  │5 scenes  │  │3 scenes  │  │8 scenes  │  │          │    │
│  │47 shots  │  │28 shots  │  │112 shots │  │          │    │
│  │In Prod.  │  │Pre-Prod. │  │In Prod.  │  │          │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└──────────────────────────────────────────────────────────────┘
```

Each project card shows:
- A thumbnail (the published output from the most recent shot, or a placeholder letter)
- Project name
- Scene count / shot count
- Status badge (In Production, Pre-Production, Review)
- "Updated X ago" timestamp

On hover, the thumbnail darkens and shows an arrow icon. Video thumbnails auto-play on hover.

**Frontend implementation:**
```typescript
// Types
type Project = {
  id: string;
  name: string;
  thumbnail_url: string | null;
  scene_count: number;
  shot_count: number;
  status: string;
  updated_at: string;
};

// API call
const projects = await fetch("/api/projects/", { headers: authHeaders }).then(r => r.json());

// Route on click
<ProjectCard onClick={() => router.push(`/project/${project.id}`)} />
```

**Backend implementation:**
```python
class ProjectListView(generics.ListCreateAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Project.objects.filter(
            created_by=self.request.user
        ).order_by("-updated_at")

    def perform_create(self, serializer):
        project = serializer.save(created_by=self.request.user)
        # Create S3 folder structure
        create_project_folders(project)
        # Create scenes and shots from request data
        for scene_data in self.request.data.get("scenes", []):
            scene = Scene.objects.create(
                project=project,
                name=scene_data["name"],
                order=scene_data.get("order", 0),
            )
            for i in range(scene_data.get("shot_count", 0)):
                Shot.objects.create(
                    scene=scene,
                    name=f"SH{str(i+1).zfill(2)}",
                    order=i,
                )
```

---

### Feature 2: Create Project Flow

**What it does:** Modal or page where you name a project, define scenes and how many shots each scene has.

**Visual description:**
```
┌─────────────────────────────────────────────┐
│  Create New Project                         │
│                                             │
│  Project Name                               │
│  ┌─────────────────────────────────────┐    │
│  │ Scarecrow                           │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Scenes                                     │
│  ┌─────────────────────────────────────┐    │
│  │ SC01  Opening         8 shots  [x]  │    │
│  │ SC02  Chase           12 shots [x]  │    │
│  │ SC03  Confrontation   6 shots  [x]  │    │
│  │                                     │    │
│  │ [+ Add Scene]                       │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ── or ──                                   │
│  [Import from Kitsu]  (Sprint 2)            │
│                                             │
│              [Cancel]  [Create Project]      │
└─────────────────────────────────────────────┘
```

Each scene row has:
- Scene name (editable text input, defaults to SC01, SC02...)
- Optional description
- Shot count (number input, default 8)
- Delete button (x)

The "Add Scene" button appends a new row. "Create Project" calls the backend, which creates the full S3 structure and database records.

---

### Feature 3: Main Workspace Layout

**What it does:** The primary working screen. Two-panel layout: generation controls on the left, shot grid on the right.

**Reference:** `src/app/page.tsx`, `src/components/ControlsPane.tsx`, `src/components/FileBrowser.tsx` in the prototype.

**Visual description:**
```
┌─────────────────┬──────────────────────────────────────────┐
│                 │  [<] Scarecrow / [SC03 ▼]   47 shots     │
│  [img]          │                                          │
│  [vid]          │  ┌─ SH05 — Bedroom confrontation ──────┐│
│  [tools]        │  │                                      ││
│  [audio]        │  │ [ref] [ref] [gen] [gen] [gen] [gen]  ││
│  [chat]         │  │ [gen] [gen] [gen] [🔄 generating...] ││
│                 │  │                                      ││
│  ┌───────────┐  │  └──────────────────────────────────────┘│
│  │Model:     │  │                                          │
│  │[Kling 1.6]│  │  ┌─ SH06 (dimmed) ─────────────────────┐│
│  │           │  │  │ [ref] [gen] [gen] [gen]              ││
│  │Prompt:    │  │  └──────────────────────────────────────┘│
│  │[textarea] │  │                                          │
│  │           │  │  ┌─ SH07 (dimmed) ─────────────────────┐│
│  │Params:    │  │  │ [gen] [gen]                          ││
│  │...        │  │  └──────────────────────────────────────┘│
│  │           │  │                                          │
│  │[Generate] │  │                                          │
│  └───────────┘  │                                          │
└─────────────────┴──────────────────────────────────────────┘
```

**Left panel — Controls Pane** (`~398px` fixed width):
- Vertical icon tabs on the far left: Image, Video, Tools, Audio, Chat
- The active tab's controls fill the rest of the panel
- Image/Video/Tools tabs show: model selector dropdown, prompt textarea, parameter controls (aspect ratio, resolution, duration, etc.), reference image upload zones, and a Generate button
- Audio tab: placeholder (Sprint 2)
- Chat tab: AI assistant for prompt writing (see Feature 10)

**Right panel — Shot Grid:**
- Top bar: back button (←), project name, scene selector dropdown, shot count
- Below: shot containers stacked vertically, active shot at top in full color, inactive shots below dimmed

**Reference files:**
- Controls pane: `src/components/ControlsPane.tsx` — the vertical icon tabs are at lines 2813-2830
- Shot grid: `src/components/FileBrowser.tsx` — shot rendering starts at line 1038
- Shot container: `src/components/ShotContainer.tsx`

---

### Feature 4: Shot Container

**What it does:** A visual container for one shot. Shows the shot's outputs and input refs in a flat grid. Has a header with navigation, shot name dropdown, and candidate count.

**Reference:** `src/components/ShotContainer.tsx` in the prototype.

**Visual description (active shot):**
```
┌─────────────────────────────────────────────────────────────┐
│ ▲  [SH05 ▼] — Bedroom confrontation          12 candidates │
│ ▼                                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                     │
│  │ emerald │  │ emerald │  │         │   ← refs have       │
│  │ border  │  │ border  │  │  gen 1  │     green border     │
│  │  (ref)  │  │  (ref)  │  │         │                     │
│  └─────────┘  └─────────┘  └─────────┘                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                     │
│  │         │  │  ▶ play │  │ ★ pub'd │   ← published has   │
│  │  gen 2  │  │ (video) │  │  (star) │     star indicator   │
│  │         │  │         │  │         │                     │
│  └─────────┘  └─────────┘  └─────────┘                     │
│  ┌─────────┐                                                │
│  │ 🔄 gen  │   ← in-progress generation                    │
│  │ 45%...  │     shows progress bar                        │
│  └─────────┘                                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Shot header:**
- Up/down arrows: navigate to previous/next shot
- Shot name: clickable, opens dropdown to jump to any shot in the scene
- Direction note: short text after the shot name
- Candidate count: "12 candidates"

**Candidate tiles** (3-column grid, 16:9 aspect ratio each):
- **Refs** (role=ref): emerald green border, shown first in grid
- **Outputs** (role=output): no border by default, amber border on hover
- **Published output**: star indicator, shown but not specially positioned in grid view (positioned rightmost only on the global board)
- **Video tiles**: show a centered play button icon. On hover, video auto-plays. On click, opens fullscreen player.
- **Image tiles**: on click, opens fullscreen image editor.
- **In-progress generation**: shows a processing tile with progress bar and status text

**Hover controls on each tile:**
```
┌─────────────────────────────┐
│ [✓]              [📌] [⋮]  │  ← top: select, pin, menu
│                             │
│        (image/video)        │
│                             │
│ [↻] [📋] [📎]      [⬇]   │  ← bottom: retry, copy prompt,
└─────────────────────────────┘    use as ref, download
```

All hover buttons use `stopPropagation` so clicking them doesn't trigger the fullscreen view. Only clicking the tile itself (not a button) opens fullscreen.

**Inactive shot (dimmed):**
- Same structure but at 50% opacity, `hover:opacity-70`
- Shows both refs and outputs (dimmed)
- Clicking the header or any area activates the shot

**Frontend implementation:**
```typescript
// Fetch shot files
const files = await fetch(`/api/shots/${shotId}/files/`, { headers: authHeaders }).then(r => r.json());

// Separate by role
const refs = files.filter(f => f.role === "ref");
const outputs = files.filter(f => f.role === "output");

// Render in flat grid: refs first, then outputs
<div className="grid grid-cols-3 gap-2">
  {refs.map(f => <CandidateTile key={f.id} file={f} />)}
  {outputs.map(f => <CandidateTile key={f.id} file={f} />)}
</div>
```

---

### Feature 5: Scene Selector

**What it does:** A dropdown in the shot grid header that lets you switch between scenes in the project.

**Reference:** The `<select>` element in `src/components/FileBrowser.tsx` at the scene header area.

**Visual description:**
```
[<] Scarecrow / [SC03 ▼]  47 shots
                  │
                  ▼
              ┌────────┐
              │ SC01   │
              │ SC02   │
              │ SC03 ✓ │
              │ SC04   │
              │ SC05   │
              └────────┘
```

When you select a different scene, the grid reloads with that scene's shots. The first shot auto-activates.

**Frontend:** A `<select>` element bound to `activeSceneId` state. On change, fetches the new scene's shots from the API.

**Backend:** `GET /api/scenes/{scene_id}/shots/` returns the shots for the selected scene.

---

### Feature 6: Fullscreen Viewer (Image Editor / Video Player)

**What it does:** Clicking any candidate tile opens a fullscreen overlay with the image editor or video player. Supports zoom, pan, annotations (images), playback controls (videos), and prev/next navigation through candidates.

**Reference:** `src/components/ImageEditor.tsx` and `src/components/VideoPlayer.tsx` in the prototype.

**Visual description (video player):**
```
┌──────────────────────────────────────────────────────────────┐
│                                                        [X]   │
│                                                              │
│                                                              │
│                    ┌──────────────────┐                      │
│                    │                  │                      │
│                    │   video frame    │    ← zoomable,       │
│                    │   (pannable)     │      pannable        │
│                    │                  │                      │
│                    └──────────────────┘                      │
│                                                              │
│  [◀ prev]                                        [next ▶]   │
│                                                              │
│  ──●────────────────────────────── 00:02 / 00:05            │
│  [⏮] [▶] [⏭]  [1x ▼]  [📷 Extract Frame]  [⬇ Download]   │
└──────────────────────────────────────────────────────────────┘
```

**Key controls:**
- Close (X button or Escape key)
- Previous/Next arrows: cycle through candidates in the shot
- Video: play/pause (spacebar), frame stepping (arrow keys), speed control, timeline scrubbing
- Image: zoom (scroll wheel), pan (drag), annotation tools (rect, circle, arrow, text, brush)
- Extract Frame: captures current video frame as PNG
- Download: downloads the file

**Critical implementation detail:** The fullscreen viewer is rendered via `createPortal(component, document.body)` to escape any parent overflow or z-index stacking contexts. Without the portal, the viewer gets clipped by the grid's scroll container.

```typescript
{fullscreenCandidate && createPortal(
  fullscreenCandidate.is_video ? (
    <VideoPlayer
      videoUrl={fullscreenCandidate.s3_url}
      videoName={fullscreenCandidate.original_name}
      onClose={() => setFullscreenCandidate(null)}
      onPrevious={hasPrev ? () => navigateCandidate("prev") : undefined}
      onNext={hasNext ? () => navigateCandidate("next") : undefined}
    />
  ) : (
    <ImageEditor
      imageUrl={fullscreenCandidate.s3_url}
      imageName={fullscreenCandidate.original_name}
      onClose={() => setFullscreenCandidate(null)}
      onPrevious={hasPrev ? () => navigateCandidate("prev") : undefined}
      onNext={hasNext ? () => navigateCandidate("next") : undefined}
    />
  ),
  document.body,
)}
```

---

### Feature 7: Generation Controls (Left Panel)

**What it does:** The left panel where artists configure and trigger AI generation. Has five tabs accessed via vertical icon buttons.

**Reference:** `src/components/ControlsPane.tsx` in the prototype.

**Tab layout:**
```
┌──┬──────────────────────────────────┐
│🖼│  Model: [Kling 1.6 ▼]           │
│  │                                  │
│🎬│  Reference Images:               │
│  │  ┌──────┐ ┌──────┐ [+ Add]     │
│🔧│  │ ref1 │ │ ref2 │             │
│  │  └──────┘ └──────┘             │
│🎵│                                  │
│  │  Prompt:                         │
│💬│  ┌──────────────────────────┐   │
│  │  │ A scarecrow walks throu… │   │
│  │  └──────────────────────────┘   │
│  │                                  │
│  │  Aspect Ratio: [16:9 ▼]         │
│  │  Duration: [5s ▼]               │
│  │  Resolution: [1080p ▼]          │
│  │                                  │
│  │  [████████ Generate ████████]    │
│  │                                  │
│  │  T2V mode                        │
└──┴──────────────────────────────────┘
```

**Vertical icon tabs (left edge):**
| Icon | Tab | Description |
|------|-----|-------------|
| 🖼 (image icon) | Image | Image generation models (Flux, SDXL, etc.) |
| 🎬 (camera icon) | Video | Video generation models (Kling, Wan, etc.) |
| 🔧 (wrench icon) | Tools | Special models (video-to-video, upscale, etc.) |
| 🎵 (music note) | Audio | Audio generation (Sprint 2 placeholder) |
| 💬 (chat bubble) | Chat | AI prompt assistant |

Active tab gets an orange gradient background. Inactive tabs are gray icons.

**Image tab controls:**
- Model selector dropdown
- Reference image upload zone (drag & drop or click to browse)
- Prompt textarea
- Aspect ratio selector
- Resolution selector
- Seed input (optional)
- Generate button

**Video tab controls:**
- Model selector dropdown
- Start frame upload (optional — determines T2V vs I2V mode)
- End frame upload (optional)
- Reference images
- Prompt textarea
- Duration selector
- Aspect ratio selector
- Camera movement selector
- Generate button
- Mode indicator: "T2V" (text-to-video) or "I2V" (image-to-video) based on whether a start frame is provided

**Tools tab controls:**
- Model selector (video-to-video, upscale models)
- Video/image input upload
- Prompt textarea
- Model-specific parameters
- Generate button

**Audio tab (Sprint 2):**
- Placeholder UI with "coming soon" message and skeleton wireframes

**Chat tab:**
- System prompt selector dropdown (General Assistant, Creative Director, Prompt Engineer, etc.)
- Chat message history
- AI can generate prompts in code blocks with a "Copy" button
- Text input at bottom with send button

---

### Feature 8: Generation Flow (End to End)

**What happens when the artist clicks "Generate":**

```
1. FRONTEND: Validates inputs (prompt not empty, model selected)
2. FRONTEND: Collects all parameters into a request:
   {
     shot_id, model, prompt, params,
     ref_file_ids: [ids of files in the shot's refs/ folder]
   }
3. FRONTEND: POST /api/generate/
4. BACKEND: Creates GenerationJob record (status: "pending")
5. BACKEND: Dispatches to Celery task queue
6. BACKEND: Returns job_id immediately
7. FRONTEND: Shows "processing" tile in the shot grid with progress bar
8. FRONTEND: Polls GET /api/generate/{job_id}/ every 2 seconds

   --- Meanwhile, in the Celery worker ---
   a. Downloads ref files from S3 if needed
   b. Builds API request for the AI model
   c. Calls the AI model API (Kling, Flux, etc.)
   d. Waits for completion (some models are async themselves)
   e. Downloads the result
   f. Uploads to S3: scenes/{scene_id}/{shot_id}/outputs/{filename}
   g. Creates ShotFile record (role="output")
   h. Updates job status to "completed" with the file_id

9. FRONTEND: Poll returns status "completed" with file metadata
10. FRONTEND: Replaces processing tile with the actual output tile
11. FRONTEND: Output is now visible on the global board too
```

**Important: Shot-scoped generation.** The `shot_id` is captured at job creation time. If the artist switches to a different shot while generation is running, the output still lands in the original shot. This enables parallel work across shots.

---

### Feature 9: Global Board (Director View)

**What it does:** A full-project overview showing all shots and their outputs. The director uses this to review progress, compare candidates, and publish finals.

**Visual description:**
```
┌──────────────────────────────────────────────────────────────┐
│  Scarecrow — Global Board          [SC01] [SC02] [SC03 ▼]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  SH01  [gen] [gen] [gen] [gen] [gen]            [★ publish] │
│  SH02  [gen] [gen]                                          │
│  SH03  [gen] [gen] [gen] [gen] [gen] [gen] [gen] [★ pub]   │
│  SH04  (empty — no generations yet)                          │
│  SH05  [gen] [gen] [gen]                                    │
│  ...                                                         │
│                                                              │
│  ← chronological (oldest left)    published pinned right →  │
└──────────────────────────────────────────────────────────────┘
```

Each row is a shot. Each tile in the row is an output candidate, sorted chronologically (oldest left, newest right). The published/starred candidate is pinned to the rightmost position.

**Key interactions:**
- Click a tile → fullscreen viewer (same ImageEditor/VideoPlayer)
- Double-click (or dedicated button) → publish as the selected final
- Hover shows artist name, model used, timestamp
- Scene filter tabs at the top

**What is NOT shown on the board:**
- Input refs (the `refs/` folder is ignored)
- Generation parameters (available on hover/click, not inline)

**Frontend implementation:**
```typescript
// Fetch board data
const board = await fetch(`/api/projects/${projectId}/board/?scene=${sceneId}`, {
  headers: authHeaders,
}).then(r => r.json());

// Render
{board.scenes.map(scene => (
  scene.shots.map(shot => (
    <div key={shot.id} className="flex items-center gap-2">
      <div className="w-20 text-sm font-mono">{shot.name}</div>
      <div className="flex gap-2 overflow-x-auto">
        {shot.outputs
          .sort((a, b) => {
            // Published goes last (rightmost)
            if (a.published !== b.published) return a.published ? 1 : -1;
            // Otherwise chronological
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          })
          .map(output => (
            <BoardTile key={output.id} file={output} />
          ))}
      </div>
    </div>
  ))
))}
```

---

### Feature 10: Chat Tab (AI Prompt Assistant)

**What it does:** A mini chat interface inside the controls panel where the artist can ask an AI to help write generation prompts. The AI's output includes copyable prompt blocks.

**Reference:** The chat tab in `src/components/ControlsPane.tsx` (around line 2889).

**Visual description:**
```
┌──────────────────────────────────┐
│ [✦ Prompt Engineer ▼]           │  ← system prompt selector
├──────────────────────────────────┤
│                                  │
│        Write me a cinematic   [U]│  ← user message (right-aligned)
│        prompt for a scarecrow    │
│        walking through mist...   │
│                                  │
│  [AI] Here's a cinematic prompt: │  ← AI response
│                                  │
│  ┌─ Generated Prompt ──── [Copy]┐│  ← code block with copy button
│  │ A weathered scarecrow with   ││
│  │ tattered burlap clothing     ││
│  │ slowly walks through endless ││
│  │ rows of golden corn...       ││
│  └──────────────────────────────┘│
│                                  │
│  [AI] I focused on volumetric   │
│  lighting and film texture...    │
│                                  │
├──────────────────────────────────┤
│ [Ask anything...         ] [▶]  │  ← input + send
└──────────────────────────────────┘
```

**System prompt presets:**
- General Assistant — default, broad help
- Creative Director — focuses on composition, storytelling, mood
- Shot Breakdown — helps decompose scenes into shots
- Prompt Engineer — optimizes prompts for specific models
- Storyboard Advisor — suggests shot sequences and transitions

**Backend:** A simple endpoint that proxies to an LLM API (Claude, GPT, etc.) with the selected system prompt prepended.

```
POST /api/chat/
{
  "system_prompt": "prompt_engineer",
  "messages": [
    { "role": "user", "content": "Write me a cinematic prompt for..." }
  ]
}
```

---

### Feature 11: Project Assets (Characters, Locations, Props)

**What it does:** Shared project-level resources that any artist can use as references. Uploaded once, available everywhere.

**Visual description (accessed via Elements/Asset Store button):**
```
┌──────────────────────────────────────────────┐
│  Asset Store                           [X]   │
│                                              │
│  [Characters] [Locations] [Props]            │
│                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │scarecrow│  │ farmer  │  │  crow   │     │
│  │  main   │  │  wife   │  │         │     │
│  └─────────┘  └─────────┘  └─────────┘     │
│  ┌─────────┐                                 │
│  │  + Add  │                                 │
│  │  Asset  │                                 │
│  └─────────┘                                 │
│                                              │
│  Drag an asset into a shot to use as ref     │
└──────────────────────────────────────────────┘
```

When you drag an asset into a shot (or click "Use as Reference"), the backend copies the file from `assets/` into the shot's `refs/` folder.

---

### Feature 12: Copy Ref from Another Shot

**What it does:** Artist is working on SH05 and wants to use an output from SH02 as a reference. They drag it (or use a UI action) and it gets copied into SH05's refs folder.

**Flow:**
1. Artist browses to SH02 (scrolls down to the inactive shot, or uses the Asset Store's Shots tab)
2. Hovers on the desired output, clicks "Use as Ref" button
3. Frontend calls `POST /api/shots/{sh05_id}/files/copy-ref/` with the source file ID
4. Backend copies the file on S3 from `scenes/sc01/sh02/outputs/...` to `scenes/sc01/sh05/refs/...`
5. Creates a new ShotFile record with `role="ref"` and `source=` pointing to the original
6. Frontend refreshes SH05's file list — the copied ref appears with an emerald border

**The ref is a copy, not a link.** If the original in SH02 is deleted, SH05's copy survives.

---

## Sprint 1 vs Sprint 2 Scope

### Sprint 1 — Local Sandbox (What to Build Now)

| Feature | Status |
|---------|--------|
| Home screen with project list | Build |
| Create project (define scenes/shots) | Build |
| Scene selector in workspace | Build |
| Shot containers with grid view | Build (prototype exists) |
| Generation controls (image/video/tools tabs) | Build (prototype exists) |
| Generation flow (dispatch → poll → display) | Build |
| Shot file management (upload, list, delete) | Build |
| Fullscreen viewer (image editor + video player) | Build (prototype exists) |
| Copy ref from another shot | Build |
| Project assets (upload, browse, use as ref) | Build |
| Publish/star a candidate | Build |
| Chat tab (AI prompt assistant) | Build (prototype exists) |
| Audio tab | Placeholder only |
| S3 storage backend | Build |
| Django REST API | Build |
| Auth (JWT) | Build |

### Sprint 2 — Collaborative + Kitsu Integration

| Feature | Status |
|---------|--------|
| Global board (director view) | Build |
| Canvas/whiteboard storyboard view | Build |
| Kitsu sync (pull project structure) | Build |
| Kitsu publish (push previews) | Build |
| Import project from Kitsu | Build |
| Multi-user (see other artists' outputs) | Build |
| Comments on candidates | Build |
| Audio generation | Build |
| Real-time updates (WebSockets) | Build |
| Shot reordering on canvas → Kitsu | Build |

---

## Django Project Structure

```
ark_backend/
├── manage.py
├── requirements.txt
├── ark/
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── projects/
│   ├── models.py          # Project, Scene, Shot, ShotFile, ProjectAsset
│   ├── serializers.py
│   ├── views.py           # REST views for all CRUD
│   ├── urls.py
│   └── services/
│         ├── s3.py         # S3 upload, download, copy, presigned URLs
│         └── manifest.py   # Read/write manifest.json
├── generation/
│   ├── models.py          # GenerationJob
│   ├── serializers.py
│   ├── views.py           # Generate endpoint, poll status
│   ├── urls.py
│   └── tasks.py           # Celery tasks for async generation
├── chat/
│   ├── views.py           # LLM proxy endpoint
│   └── prompts.py         # System prompt presets
├── auth/
│   ├── models.py          # User
│   ├── views.py           # Login, register, refresh
│   └── urls.py
└── kitsu/                  # Sprint 2
    ├── client.py           # Kitsu API client
    ├── sync.py             # Pull structure, push previews
    └── views.py
```

---

## Next.js Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Router: home vs workspace
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── HomeScreen.tsx              # Project list + create
│   ├── CreateProjectModal.tsx      # New project form
│   ├── FileBrowser.tsx             # Shot grid + toolbar
│   ├── ShotContainer.tsx           # Single shot with candidates
│   ├── CandidateTile.tsx           # Individual file tile with hover controls
│   ├── ControlsPane.tsx            # Generation controls with vertical tabs
│   ├── ImageEditor.tsx             # Fullscreen image viewer/annotator
│   ├── VideoPlayer.tsx             # Fullscreen video player
│   ├── GlobalBoard.tsx             # Director's output board
│   ├── AssetStore.tsx              # Project assets modal
│   └── ui/
│         ├── Spinner.tsx
│         └── CameraMovementSelector.tsx
├── state/
│   ├── auth.tsx                    # Auth context + JWT management
│   ├── project.tsx                 # Active project context
│   ├── shots.tsx                   # Shots for active scene
│   └── queue.tsx                   # Generation job queue
├── lib/
│   ├── api.ts                      # Base fetch wrapper with auth headers
│   ├── projects.ts                 # Project API calls
│   ├── shots.ts                    # Shot + file API calls
│   ├── generation.ts               # Generation API calls
│   └── chat.ts                     # Chat API calls
└── types/
    └── index.ts                    # Shared TypeScript types
```

---

## Getting Started (For Developers)

### Backend Dev

1. Create Django project with DRF:
   ```bash
   django-admin startproject ark_backend
   pip install djangorestframework djangorestframework-simplejwt boto3 celery redis django-cors-headers
   ```

2. Set up S3:
   - Create an S3 bucket (e.g. `ark-production`)
   - Create IAM user with S3 read/write permissions
   - Set env vars: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_S3_REGION`

3. Set up Celery + Redis for async generation jobs:
   ```python
   # settings.py
   CELERY_BROKER_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
   ```

4. Build in this order:
   - Auth (login/register/JWT) — day 1
   - Project CRUD + S3 folder creation — day 2
   - Scene/Shot CRUD — day 2
   - ShotFile upload/list/delete + S3 operations — day 3-4
   - Copy ref endpoint — day 4
   - Generation job dispatch + Celery task — day 5-7
   - Project assets — day 7
   - Chat proxy — day 8
   - Board endpoint — day 8

### Frontend Dev

1. The prototype (`/Users/ayushjalan/Documents/ark_prototype`) is the reference implementation. Most components exist already — they just need to be wired to the real API instead of static demo data.

2. Build in this order:
   - Replace static demo data in `shots.tsx` with API calls — day 1-2
   - Wire HomeScreen to real project list API — day 2
   - Build CreateProjectModal — day 3
   - Wire ControlsPane generate button to real API + polling — day 4-5
   - Wire ShotContainer to real file API (upload, list, copy-ref) — day 5-6
   - Wire fullscreen viewer to real S3 URLs — day 6
   - Wire scene selector to real scene API — day 7
   - Wire project assets modal — day 7
   - Wire chat tab to LLM proxy API — day 8

3. Key patterns to follow from the prototype:
   - Use `createPortal(component, document.body)` for all fullscreen overlays
   - Use React context providers for shared state (project, shots, queue)
   - All S3 file URLs come from the backend as presigned URLs — never construct S3 URLs on the frontend
   - Generation polling: `setInterval` every 2 seconds until job completes, then clear interval

---

## Environment Variables

### Backend
```
SECRET_KEY=django-secret-key
DATABASE_URL=postgres://...
REDIS_URL=redis://localhost:6379/0
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=ark-production
AWS_S3_REGION=us-east-1
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

### Frontend
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

That's it. The frontend has one env var — the API URL. Everything else is handled by the backend.
