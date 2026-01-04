# Agent Guide

This guide is for AI agents and developers working with the AI Asset Studio codebase.

## 🏗️ Architecture

**Two-part system:**
1. **Frontend**: React 19 + TypeScript + Vite + TailwindCSS
2. **Backend**: Fastify file API server for storage/streaming

### Directory Structure

```
server/                    # Fastify backend
├── index.js               # Main server entry
└── meta-db.js             # SQLite metadata store

src/
├── app/page.tsx           # Main layout
├── components/
│   ├── ControlsPane.tsx   # Model/prompt controls, generation
│   ├── FileBrowser.tsx    # File tree display
│   ├── PreviewPane.tsx    # Media preview, upscale, compare
│   ├── ProjectBar.tsx     # Header with settings dropdown
│   ├── PromptStudio/      # Photography prompt builder modal
│   └── studio/            # Live preview components
├── lib/
│   ├── api/files.ts       # File API client
│   ├── models.json        # Video model definitions
│   ├── models.ts          # Model adapters & type system
│   ├── image-models.ts    # Image model definitions
│   ├── prompts.ts         # System prompts for LLM expansion
│   ├── photography-presets.ts # Camera/lens/style presets
│   ├── providers/         # KIE, FAL API clients
│   └── useHoverPlayVideos.ts # Shared preferences hook
└── state/
    ├── catalog.tsx        # Workspace connection, file tree
    └── queue.tsx          # Job queue management
```


## 🧩 Key Concepts

### Model Definitions

**Video models** (`models.json`):
- JSON schema defines parameters
- UI auto-renders controls from schema
- Pricing embedded in definition

**Image models** (`image-models.ts`):
- TypeScript objects with `mapInput` functions
- Transform UI state → API payloads

### Provider Integration

**KIE.ai** (`lib/kie.ts`):
- Primary provider for generation
- Jobs API (async polling) and Direct API (sync)
- Task polling with status updates

**FAL.ai** (`lib/fal.ts`):
- Temporary file storage (`uploadToFal`)
- VLM for prompt expansion

### File Storage

- Server stores files in `FILE_STORAGE_ROOT` (default: `./data`)
- Organized by date: `images/YYYY-MM-DD/`, `videos/YYYY-MM-DD/`
- Supports HTTP Range requests for video streaming

### Settings System

The `ProjectBar.tsx` contains a settings dropdown with:
- Workspace connection inputs (API URL, Workspace ID, Token)
- Preferences section with shared hooks (e.g., `useHoverPlayVideos`)

## 🛠️ Common Tasks

### Adding a New Video Model

1. Edit `src/lib/models.json`
2. Add entry with `id`, `label`, `endpoint`, `pricing`, `params`
3. No code changes needed - UI auto-renders from schema

### Adding a New Image Model

1. Edit `src/lib/image-models.ts`
2. Add `ImageModelSpec` with `mapInput` function
3. Update pricing if needed

### Adding a Setting/Preference

1. Create a hook in `src/lib/` (see `useHoverPlayVideos.ts`)
2. Use localStorage for persistence
3. Add toggle in `ProjectBar.tsx` settings dropdown

### Modifying the UI

- **ControlsPane.tsx**: Generation controls (prompt, refs, params)
- **ProjectBar.tsx**: Header, settings, connection
- **FileBrowser.tsx**: File list, search, filters
- **PreviewPane.tsx**: Preview, upscale, frame extraction

## 🔄 Primary Flow

```
User configures → ControlsPane
         ↓
callModelEndpoint(provider, endpoint, payload)
         ↓
Returns blob → uploadFile(connection, path, file)
         ↓
refreshTree(relPath) → selects new file
         ↓
PreviewPane streams via getFileUrl
```

## ⚠️ Critical Constraints

1. **Secrets**: API keys in `.env.local` - never commit
2. **Server required**: File API must run for any persistence
3. **CORS**: Server must allow frontend origin
4. **Token alignment**: `VITE_FILE_API_TOKEN` must match `FILE_API_TOKEN`

## 🚀 Quick Reference

### Start Development
```bash
npm run dev:all
```

### Key Files to Read
1. `src/lib/models.json` - Model capabilities
2. `src/components/ControlsPane.tsx` - Generation logic
3. `src/lib/providers/index.ts` - API routing

### Environment Variables

**Frontend (`.env.local`):**
```
VITE_FAL_KEY, VITE_KIE_KEY, VITE_FILE_API_BASE, VITE_FILE_API_TOKEN
```

**Backend (`.env.server`):**
```
FILE_API_PORT, FILE_STORAGE_ROOT, FILE_API_TOKEN, FILE_API_CORS_ORIGIN
```

---

**Mental model**: React UI → `callModelEndpoint` → `uploadFile` → `refreshTree` → preview via `getFileUrl`
