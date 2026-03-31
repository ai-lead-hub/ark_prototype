# Ark — Sprint 2: Collaborative + Kitsu Integration (Production Spec)

**Prerequisite:** Sprint 1 complete — single-user project creation, scene/shot management, generation with full cinematographer/model settings, file storage on S3, elements system, chat assistant, and Django REST API all working.

**Goal:** Make Ark collaborative. Multiple artists work simultaneously. A director reviews all outputs on a global board and a canvas storyboard. Kitsu syncs project structure and publishes final previews. Real-time WebSocket updates replace polling. Audio generation ships. Comments on candidates.

---

## What Changes from Sprint 1

| Sprint 1 (local sandbox) | Sprint 2 (collaborative) |
|---|---|
| One user per project | Multiple users, simultaneous |
| No shared output view | Global board shows all artists' outputs |
| No canvas/storyboard | Zoomable canvas with shot cards |
| Polling every 2s | WebSocket real-time pushes (polling as fallback) |
| No Kitsu | Kitsu imports structure + publishes finals |
| Audio tab placeholder | Audio generation fully functional |
| No comments | Threaded comments on output tiles |
| Published = local star | Published = starred on board + pushed to Kitsu |
| No user presence | See who's working on which shot |

---

## Architecture (Updated)

```
┌─────────────┐  REST + WS  ┌──────────────┐         ┌─────────┐
│  Next.js    │◄───────────►│  Django API  │◄───────►│   S3    │
│  Frontend   │             │  + Channels  │  boto3  │  Bucket │
│  (Vercel)   │             └──────┬───────┘         └─────────┘
└─────────────┘                    │
                                   │ REST
                                   ▼
                            ┌─────────────┐
                            │  Kitsu API  │
                            │  (metadata  │
                            │  + previews)│
                            └─────────────┘
```

New:
- **Django Channels** — WebSocket layer for real-time updates
- **Kitsu API client** — pulls project structure, pushes published previews
- **Redis** — already used for Celery, now also backs Channels pub/sub

---

## Feature-by-Feature Implementation

---

### Feature 1: Global Board (Director View)

**What it does:** Full-project overview showing all shots and their output candidates from all artists. The director reviews progress, compares outputs, and publishes finals.

**Route:** `/project/{id}/board`

```
┌──────────────────────────────────────────────────────────────┐
│  Scarecrow — Global Board          [SC01] [SC02] [SC03 ▼]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  SH01 [gen] [gen] [gen] [gen] [gen]             [★ publish]  │
│  SH02 [gen] [gen]                                            │
│  SH03 [gen] [gen] [gen] [gen] [gen] [gen] [gen]  [★ pub]    │
│  SH04 (empty — no generations yet)                           │
│  SH05 [gen] [gen] [gen]                                      │
│  ...                                                         │
│                                                              │
│  ← chronological (oldest left)     published pinned right →  │
└──────────────────────────────────────────────────────────────┘
```

#### Layout
- Each row = one shot. Shot name on the left (fixed 80px column).
- Each tile = one output candidate, horizontally scrollable.
- Sorted chronologically (oldest left, newest right).
- **Published output pinned rightmost** — sorted separately from chronological order.

#### What is shown
- Only `outputs/` files from ALL artists.
- Never `refs/` — the global board ignores the refs folder entirely.

#### Tile hover information
- Artist name (who generated it)
- Model used
- Timestamp
- Prompt (first 100 chars)

#### Interactions

| Action | Trigger | Result |
|--------|---------|--------|
| **Fullscreen view** | Click tile | Opens same ImageEditor/VideoPlayer from Sprint 1 via `createPortal` |
| **Publish** | Star button on tile OR ⋮ menu → "Publish" | Sets as published, unpublishes previous, pushes to Kitsu if linked |
| **Scene filter** | Click scene tab at top | Filters board to that scene's shots only |
| **Sort** | (future) Dropdown | Sort by creation date, artist, model |

#### Backend endpoint
```
GET /api/projects/{id}/board/                    # All shots with outputs
GET /api/projects/{id}/board/?scene={scene_id}   # Filter by scene
```

**Response:**
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
          "published_file_id": "file_abc123",
          "outputs": [
            {
              "id": "file_def456",
              "s3_url": "https://...",
              "thumbnail_url": "https://...",
              "user": "sarah",
              "model": "flux",
              "prompt": "A weathered scarecrow...",
              "is_video": false,
              "published": false,
              "created_at": "2026-03-30T10:00:00Z"
            }
          ]
        }
      ]
    }
  ]
}
```

**Frontend rendering:**
```typescript
{shot.outputs
  .sort((a, b) => {
    // Published goes last (rightmost)
    if (a.published !== b.published) return a.published ? 1 : -1;
    // Otherwise chronological
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  })
  .map(output => <BoardTile key={output.id} file={output} />)}
```

---

### Feature 2: Canvas / Whiteboard Storyboard View

**What it does:** A visual storyboard where shots are laid out as cards on a zoomable/pannable canvas. The director sees the sequence at a glance, drags to reorder, and double-clicks to fullscreen.

**Route:** `/project/{id}/canvas`

```
┌──────────────────────────────────────────────────────────────┐
│  Scarecrow — Storyboard Canvas              [zoom] [fit all] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐           │
│   │ SH01   │  │ SH02   │  │ SH03   │  │ SH04   │           │
│   │ [img]  │→ │ [vid]  │→ │ [img]  │→ │ empty  │           │
│   │ wide   │  │ close  │  │ medium │  │        │           │
│   └────────┘  └────────┘  └────────┘  └────────┘           │
│                                                              │
│   ┌────────┐  ┌────────┐  ┌────────┐                       │
│   │ SH05   │  │ SH06   │  │ SH07   │                       │
│   │ [img]  │→ │ [vid]  │→ │ [img]  │                       │
│   │ bedroom│  │ hallway│  │ ending │                       │
│   └────────┘  └────────┘  └────────┘                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### Each card shows:
- Shot name (SH01)
- Thumbnail: published output, or latest output, or empty placeholder
- Direction note below
- Arrow connectors between sequential shots

#### Interactions

| Action | Trigger | Result |
|--------|---------|--------|
| **Zoom** | Scroll wheel | Zoom canvas in/out |
| **Pan** | Click + drag on background | Move viewport |
| **Fit all** | Fit button | Auto-zoom to show all cards |
| **Fullscreen** | Double-click card | Opens ImageEditor/VideoPlayer via `createPortal` |
| **Reorder** | Drag card | Moves shot to new position. Updates `order` field. Syncs to Kitsu. |
| **Open shot** | Single click | Navigates to that shot in the workspace grid |

**Canvas shows only outputs** — same rule as global board, never refs.

**Implementation:** Use a canvas library (React Flow, or custom CSS transforms with `transform: scale()` and `translate()`). Cards are absolutely positioned based on `order`.

---

### Feature 3: Real-Time Updates (WebSockets)

**What it does:** When any artist generates an output, uploads a file, publishes, or comments — all connected clients see it immediately.

#### Architecture
```
Artist A generates → Django creates ShotFile → Channels broadcasts to project room
                                                        ↓
                                              Artist B receives WS message
                                              → Shot grid updates
                                              → Board updates
                                              → New tile appears instantly
```

#### WebSocket Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `file_created` | `{ shot_id, file: ShotFileData }` | New output or ref uploaded |
| `file_published` | `{ shot_id, file_id }` | Output published/starred |
| `file_deleted` | `{ shot_id, file_id }` | File removed |
| `generation_progress` | `{ job_id, status, progress }` | Job status update |
| `generation_completed` | `{ job_id, shot_id, file: ShotFileData }` | Job finished |
| `comment_created` | `{ file_id, comment: CommentData }` | New comment on file |
| `user_presence` | `{ user, shot_id, action }` | User focused/unfocused a shot |

#### Django Channels Consumer
```python
class ProjectConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.project_id = self.scope['url_route']['kwargs']['project_id']
        self.room_group = f"project_{self.project_id}"
        await self.channel_layer.group_add(self.room_group, self.channel_name)
        await self.accept()

    async def file_created(self, event):
        await self.send_json({
            "type": "file_created",
            "shot_id": event["shot_id"],
            "file": event["file_data"],
        })

    async def generation_progress(self, event):
        await self.send_json({
            "type": "generation_progress",
            "job_id": event["job_id"],
            "status": event["status"],
            "progress": event["progress"],
        })

    async def receive_json(self, content):
        if content["type"] == "focus_shot":
            await self.channel_layer.group_send(self.room_group, {
                "type": "user.presence",
                "user": self.scope["user"].username,
                "shot_id": content["shot_id"],
                "action": "focused",
            })
```

#### Frontend WebSocket Manager
```typescript
// state/websocket.tsx
const ws = new WebSocket(`ws://api.ark.com/ws/project/${projectId}/`);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case "file_created":
      addFileToShot(data.shot_id, data.file);
      break;
    case "file_published":
      markPublished(data.shot_id, data.file_id);
      break;
    case "generation_progress":
      updateJobProgress(data.job_id, data.status, data.progress);
      break;
    case "comment_created":
      addComment(data.file_id, data.comment);
      break;
    case "user_presence":
      updatePresence(data.user, data.shot_id, data.action);
      break;
  }
};
```

**Fallback:** Keep Sprint 1 polling as backup. If WS connection drops, fall back to polling until reconnected.

---

### Feature 4: Kitsu Integration — Import Project Structure

**What it does:** Import scenes and shots from an existing Kitsu project instead of manually defining them.

#### Flow
```
1. User clicks "Import from Kitsu" in CreateProjectModal
2. Frontend: GET /api/kitsu/projects/ → lists Kitsu projects
3. User selects a Kitsu project
4. Frontend: POST /api/kitsu/import/
5. Backend:
   a. GET /api/data/projects/{id}/sequences → scenes
   b. For each sequence: GET /api/data/sequences/{id}/shots
   c. Creates Project, Scene, Shot records with kitsu_id fields
   d. Creates S3 folder structure
   e. Returns created project
6. Frontend navigates to workspace
```

#### Updated Django models
```python
class Project(models.Model):
    # ... existing Sprint 1 fields ...
    kitsu_id = models.CharField(max_length=100, blank=True, null=True, unique=True)

class Scene(models.Model):
    # ... existing ...
    kitsu_id = models.CharField(max_length=100, blank=True, null=True)

class Shot(models.Model):
    # ... existing ...
    kitsu_id = models.CharField(max_length=100, blank=True, null=True)
    kitsu_task_id = models.CharField(max_length=100, blank=True, null=True)
```

#### Backend endpoints
```
GET    /api/kitsu/projects/              # List Kitsu projects
POST   /api/kitsu/import/               # Import project structure
POST   /api/kitsu/sync/{project_id}/    # Re-sync (add new shots, etc.)
```

#### Kitsu API Client
```python
class KitsuClient:
    def __init__(self, base_url, email, password):
        self.base_url = base_url
        self.token = self._login(email, password)

    def get_projects(self):
        return self._get("/data/projects")

    def get_sequences(self, project_id):
        return self._get(f"/data/projects/{project_id}/sequences")

    def get_shots(self, sequence_id):
        return self._get(f"/data/sequences/{sequence_id}/shots")

    def upload_preview(self, task_id, file_path, comment=""):
        comment_data = self._post(f"/actions/tasks/{task_id}/comment", json={
            "task_status_id": self._get_wip_status_id(),
            "comment": comment,
        })
        with open(file_path, "rb") as f:
            self._post(
                f"/actions/tasks/{task_id}/comments/{comment_data['id']}/add-preview",
                files={"file": f},
            )
```

---

### Feature 5: Kitsu Integration — Publish Previews

**What it does:** When an output is published (starred) in Ark, the preview gets pushed to Kitsu so the broader production team can see it.

#### Flow
```
1. Artist publishes an output (same UI as Sprint 1)
2. Backend sets published=true
3. Backend checks: does this shot have a kitsu_id?
4. If yes:
   a. Dispatches Celery task: push_preview_to_kitsu
   b. Worker downloads file from S3
   c. Finds the Kitsu task for the shot
   d. Uploads preview to Kitsu via API
   e. Stores kitsu_preview_id on the ShotFile
5. Preview now visible in Kitsu's review interface
```

#### Updated publish endpoint
```python
class PublishView(APIView):
    def post(self, request, shot_id):
        shot = get_object_or_404(Shot, id=shot_id)
        file = get_object_or_404(File, id=request.data["file_id"])

        # Update the shot's published file pointer
        shot.published_file = file
        shot.save()

        # Push to Kitsu if linked
        if shot.kitsu_id:
            push_preview_to_kitsu.delay(file.id)

        # Broadcast via WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"project_{shot.scene.project.id}",
            {"type": "file.published", "shot_id": str(shot.id), "file_id": str(file.id)}
        )

        return Response(ShotFileSerializer(file).data)
```

**Note:** Kitsu only supports image and video previews. Audio files are not pushed to Kitsu — they remain S3-only.

---

### Feature 6: Multi-User Support

**What it does:** Multiple artists work on the same project simultaneously. Each sees the others' outputs in real-time.

#### What changes from Sprint 1
- All File records already have a `created_by` FK — no model changes needed.
- FileAssignment already supports any user tagging any file to any shot.
- WebSocket broadcasts ensure all clients see new files and assignments.
- Board queries `FileAssignment(role="output")` across all users for the project.
- Artist grid shows all assignments for the active shot regardless of who created them.
- Hover on any tile shows who generated it (from `file.created_by`).

#### User Presence

Show who's active on which shot with small avatar bubbles in the shot header:

```
┌──────────────────────────────────────────────────────────────┐
│ ▲  [SH05 ▼] — Bedroom confrontation    [AJ] [SK]  12 cand. │
│ ▼                          ↑ active user avatars             │
```

- 20x20px circles with initials, colored by user.
- Updated via `user_presence` WebSocket events.
- When a user activates a shot, frontend sends `{ type: "focus_shot", shot_id }` over WS.
- When a user leaves or switches, the previous shot's presence is cleared.

---

### Feature 7: Comments on Candidates

**What it does:** Artists and directors leave comments on individual output tiles. Comments appear in the fullscreen viewer and as a count badge on the tile.

#### Tile badge
- Small amber circle with number (e.g. "3") in bottom-right corner of tile.
- Only shown when comment count > 0.
- Updates in real-time via WebSocket.

#### Fullscreen viewer — Comment thread

```
┌──────────────────────────────────────────────────────────────┐
│                                                        [X]   │
│                                                              │
│                    ┌──────────────────┐                      │
│                    │                  │                      │
│                    │   image/video    │                      │
│                    │                  │                      │
│                    └──────────────────┘                      │
│                                                              │
│  ┌─ Comments ──────────────────────────────────────────────┐ │
│  │  [AJ] The lighting here is perfect, but can we          │ │
│  │       try a warmer color grade?            2h ago        │ │
│  │                                                          │ │
│  │  [SK] Updated version uploaded — warmer tones.           │ │
│  │       See SH05 output #4                  30m ago        │ │
│  │                                                          │ │
│  │  [Type a comment...                           ] [Send]   │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

#### Backend
```python
class FileComment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    file = models.ForeignKey(File, related_name="comments", on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
```

```
GET    /api/files/{file_id}/comments/         # List comments
POST   /api/files/{file_id}/comments/         # Add comment (broadcasts via WS)
DELETE /api/files/{file_id}/comments/{id}/     # Delete own comment
```

---

### Feature 8: Audio Generation

**What it does:** The Audio tab becomes fully functional. Artists generate sound effects, music, and dialogue for shots.

#### Audio Controls Pane

```
┌──┬──────────────────────────────────┐
│  │  Model: [ElevenLabs SFX ▼]      │
│  │                                  │
│🎵│  Type: [Sound Effect ▼]         │
│  │                                  │
│  │  Prompt:                         │
│  │  ┌──────────────────────────┐   │
│  │  │ Wind howling through     │   │
│  │  │ empty cornfield, distant │   │
│  │  │ crows cawing...          │   │
│  │  └──────────────────────────┘   │
│  │                                  │
│  │  Duration: [10s ▼]              │
│  │                                  │
│  │  Voice (TTS only):              │
│  │  [Sarah - Warm, narrative ▼]    │
│  │                                  │
│  │  [████████ Generate ████████]    │
└──┴──────────────────────────────────┘
```

#### Audio types
| Type | Models | Notes |
|------|--------|-------|
| Sound effects (SFX) | ElevenLabs SFX | Text prompt → audio clip |
| Background music | Suno, Udio | Text prompt → music track |
| Dialogue (TTS) | ElevenLabs, OpenAI TTS | Text + voice selection → speech |

#### Storage
- Audio files go into `{project_id}/generations/{filename}.mp3` (same flat folder as all outputs)
- File record: `is_audio=true`, `is_video=false`, `extension="mp3"` or `"wav"`
- FileAssignment tags the audio as `role="output"` for the target shot
- Tile in the grid: shows audio waveform icon instead of image/video
- Click: opens a fullscreen audio player with waveform visualizer
- Hover: plays a 5-second preview

**Kitsu limitation:** Kitsu does not support audio previews natively. Audio files are S3-only and visible only within Ark.

#### Audio Player (Fullscreen)
```
┌──────────────────────────────────────────────────────────────┐
│                                                        [X]   │
│                                                              │
│           ┌──────────────────────────────────┐               │
│           │  ▁▃▅▇▆▄▂▁▃▅▇▆▅▃▁▃▅▇▆▄▂▁▃▅▇▆▅  │               │
│           │          waveform                │               │
│           └──────────────────────────────────┘               │
│                                                              │
│  ──●────────────────────────────── 00:04 / 00:10            │
│  [▶]  [1x ▼]                                    [⬇ Download]│
│                                                              │
│  Prompt: "Wind howling through empty cornfield..."           │
│  Model: ElevenLabs SFX · Duration: 10s                      │
└──────────────────────────────────────────────────────────────┘
```

---

### Feature 9: Shot Reordering → Kitsu Sync

**What it does:** When a director reorders shots on the canvas or board, the new order syncs back to Kitsu.

#### Flow
1. Director drags SH05 before SH03 on the canvas
2. Frontend sends: `PUT /api/shots/{shot_id}/` with new `order` for each affected shot
3. Backend updates order in database
4. If shot has `kitsu_id`, backend calls Kitsu API: `PUT /data/entities/{kitsu_id}` with `{"data": {"order": new_order}}`
5. WebSocket broadcasts `shot_reordered` event to all clients
6. Canvas and board re-render with new order

---

## S3 Structure (Unchanged from Sprint 1)

The tag-based model scales naturally to multi-user. No structural changes needed:

```
{project_id}/
    ├── assets/
    ├── elements/{element_id}/
    ├── generations/          # ALL generated files from all artists (flat)
    └── manifest.json
```

Files from multiple artists all land in `generations/`. The `created_by` field on each File identifies the author. The `FileAssignment` table determines which shots see which files and in what role.

---

## View Matrix

| View | Shows | Query | Notes |
|------|-------|-------|-------|
| **Global board** | Outputs from all artists | `FileAssignment WHERE role="output" AND file.deleted_at IS NULL` | Published pinned rightmost |
| **Canvas storyboard** | Published or latest output per shot | `shot.published_file OR latest output assignment` | One card per shot |
| **Artist grid (active)** | Outputs + inputs + pinned | All assignments for the shot WHERE `file.deleted_at IS NULL` | Full brightness |
| **Artist grid (inactive)** | Outputs + inputs (dimmed) | Same query, different shot | 50% opacity |
| **Trash view** | Soft-deleted files | `File WHERE project=X AND deleted_at IS NOT NULL` | Restore button on each |

---

## Updated Django Project Structure

```
ark_backend/
├── ... (Sprint 1 apps unchanged)
├── kitsu/                          # NEW
│   ├── client.py                   # Kitsu API client
│   ├── sync.py                     # Import structure, push previews
│   ├── views.py                    # Import, sync endpoints
│   └── urls.py
├── comments/                       # NEW
│   ├── models.py                   # FileComment
│   ├── serializers.py
│   ├── views.py
│   └── urls.py
├── realtime/                       # NEW
│   ├── routing.py                  # WebSocket URL patterns
│   ├── consumers.py                # ProjectConsumer
│   └── middleware.py               # JWT auth for WebSocket
└── audio/                          # NEW (or extend generation/)
    ├── models.py                   # Audio-specific params
    └── tasks.py                    # Celery tasks for audio providers
```

**New dependencies:**
```
channels
channels-redis
daphne          # ASGI server
```

---

## Updated Next.js Project Structure

```
src/
├── components/
│   ├── ... (Sprint 1 unchanged)
│   ├── GlobalBoard.tsx             # NEW — director's output board
│   ├── CanvasStoryboard.tsx        # NEW — zoomable shot canvas
│   ├── CommentThread.tsx           # NEW — comments on files
│   ├── UserPresence.tsx            # NEW — active user avatars
│   ├── KitsuImportModal.tsx        # NEW — import from Kitsu
│   ├── AudioControls.tsx           # NEW — audio generation tab
│   └── AudioPlayer.tsx             # NEW — fullscreen audio player
├── state/
│   ├── ... (Sprint 1 unchanged)
│   └── websocket.tsx               # NEW — WS connection + handlers
├── lib/
│   ├── ... (Sprint 1 unchanged)
│   ├── kitsu.ts                    # NEW — Kitsu import API calls
│   ├── comments.ts                 # NEW — Comment API calls
│   └── ws.ts                       # NEW — WebSocket connection manager
└── ...
```

---

## Migration Checklist (Sprint 1 → Sprint 2)

### Backend

1. **Add Django Channels:**
   - `pip install channels channels-redis daphne`
   - Switch `wsgi.py` to `asgi.py` in deployment
   - Add WebSocket routing, consumer, JWT auth middleware
   - Add broadcast calls in file upload, publish, and generation completion views

2. **Add Kitsu integration:**
   - Create `kitsu/` app
   - Run migration: add `kitsu_id` fields to Project, Scene, Shot
   - Build import and sync endpoints
   - Add Celery task for pushing previews on publish

3. **Add comments:**
   - Create `comments/` app with FileComment model
   - Add list/create/delete endpoints
   - Broadcast new comments via WebSocket

4. **Add audio generation:**
   - Extend generation tasks with audio model providers (ElevenLabs, Suno)
   - Add audio-specific params (type, voice, etc.)
   - Audio files stored in same `outputs/` folder

5. **Update existing endpoints:**
   - Board endpoint: aggregate across all users
   - Publish endpoint: add Kitsu push + WS broadcast
   - File upload: add WS broadcast
   - Generation completion: add WS broadcast

### Frontend

1. **Add WebSocket connection:**
   - Create `websocket.tsx` context provider
   - Connect on project load, disconnect on leave
   - Handle: file_created, file_published, generation_progress, comment_created, user_presence
   - Fallback to polling if WS drops

2. **Build Global Board:**
   - New route `/project/{id}/board`
   - Fetch from board endpoint
   - Scene filter tabs, tile click → fullscreen, publish button
   - Real-time updates via WS

3. **Build Canvas Storyboard:**
   - New route `/project/{id}/canvas`
   - Zoomable/pannable canvas with shot cards
   - Drag to reorder, double-click → fullscreen
   - Real-time card updates via WS

4. **Wire Audio tab:**
   - Replace placeholder with AudioControls component
   - Model selector, type selector, prompt, duration, voice
   - Same generation/polling flow as image/video

5. **Add Comments:**
   - Comment thread in fullscreen viewer
   - Badge count on tiles
   - Real-time via WS

6. **Build Kitsu Import:**
   - Enable the grayed-out "Import from Kitsu" button in CreateProjectModal
   - KitsuImportModal: project selector → import flow

7. **Add User Presence:**
   - UserPresence component in shot headers
   - Send focus_shot WS events on shot activation
   - Show/hide user avatars based on presence events

---

## Environment Variables (New)

### Backend (additional)
```
KITSU_URL=https://kitsu.your-studio.com/api
KITSU_EMAIL=ark-service@studio.com
KITSU_PASSWORD=...
REDIS_URL=redis://localhost:6379/0    # Also used for Channels
```

### Frontend
No new env vars — WebSocket URL derived from `NEXT_PUBLIC_API_URL` (replace `http` with `ws`).
