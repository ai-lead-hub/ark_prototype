# Agent Guide

This guide is designed for AI agents and developers to quickly understand the codebase, architecture, and development workflows of AI Asset Studio.

## 🏗️ Architecture Overview

The application consists of two main parts:
1.  **Frontend**: A React application (Vite + TypeScript) that handles the UI, model configuration, and API calls to AI providers (KIE, FAL).
2.  **File API Server**: A lightweight Fastify server that handles local file storage, streaming, and workspace management.

### Key Directories

-   **`server/`**: The Fastify backend.
    -   `index.js`: Main server entry point.
    -   `routes/`: API routes for file operations.
-   **`src/app`**: Main application shell and layout.
-   **`src/components`**: UI components.
    -   `ControlsPane.tsx`: The core logic for model selection, parameter inputs, and generation triggers.
    -   `FileBrowser.tsx`: Displays the file tree of the connected workspace.
    -   `PreviewPane.tsx`: Handles file previews (images/videos).
    -   `ProjectBar.tsx`: Manages workspace connection and credit tracking.
-   **`src/lib`**: Core business logic.
    -   `api/files.ts`: Client-side API for interacting with the file server.
    -   `models.json`: **Single source of truth** for Video models (params, endpoints, pricing). See also `video models kie docs.md` for full API reference.
    -   `image-models.ts`: Definitions for Image models.
    -   `providers/`: API client implementations for KIE and FAL.
-   **`src/state`**: Global state management via React Context (`useCatalog`).

## 🧩 Key Concepts

### 1. Model Definitions
Models are defined in `src/lib/models.json` (Video) and `src/lib/image-models.ts` (Image).
-   **Video Models:** Use a JSON schema to define parameters (`params`). The UI dynamically renders controls based on this schema.
-   **Image Models:** Defined as TypeScript objects with `mapInput` functions to transform UI state into API payloads.
-   **Pricing:** Pricing strings are embedded directly in the model definitions (`pricing` field).

### 2. API Integration (`src/lib/providers`)
-   **KIE.ai:** The primary provider for video and image generation.
    -   `src/lib/kie.ts`: Handles authentication, request signing, and polling for "Jobs API" models.
    -   Supports both **Jobs API** (async polling) and **Direct API** (sync response, e.g., VEO/Flux).
-   **FAL.ai:** Used primarily for **temporary file storage** (`uploadToFal`) because KIE does not currently provide a general-purpose storage API.
    -   `src/lib/fal.ts`: Handles uploads to `https://fal.run/storage/upload`.

### 3. File Server Integration
-   **Workspace Model:** Files are stored on the server's disk (default `./data`), organized by date (`images/YYYY-MM-DD`).
-   **API Client:** `src/lib/api/files.ts` provides methods to list files, upload assets, and manage workspaces.
-   **Streaming:** The server supports HTTP Range requests for efficient video playback.

## ✨ Recommended Models

### For Images:
-   **flux-2-pro** - Professional quality, detailed
-   **nano-banana-edit** - Creative and artistic
-   **kling-o1** - High-quality image generation

## 🛠️ Development Workflows

### Upscaling Images

Make your images higher quality:

1.  **Select the upscale model** ("seedvr-image-upscale")
2.  **Upload your image** - Drag and drop the file you want to enhance
3.  **Choose settings:**
    -   Upscale factor (2x, 4x)
4.  **Click Generate** ⬆️

### Upscaling Videos
1.  **Select a video** in the file browser
2.  **Click Upscale** in the preview pane controls
3.  The video will be upscaled (2x default) and saved to the same folder

### Adding a New Video Model
1.  Open `src/lib/models.json`.
2.  Add a new entry to the `models` array.
3.  Define `id`, `label`, `endpoint`, `pricing`, and `params`.
4.  **Note:** If the model uses the standard KIE Jobs API, no code changes are needed—the UI will automatically render the new model.

### Adding a New Image Model
1.  Open `src/lib/image-models.ts`.
2.  Add a new `ImageModelSpec` to the `IMAGE_MODELS` array.
3.  Implement `mapInput` to transform the standard `ImageJob` into the provider's specific payload format.

### Modifying the UI
-   **`ControlsPane.tsx`** is the main control center. It is divided into three explicit sections:
    -   `modelKind === "image"`
    -   `modelKind === "video"`
    -   `modelKind === "upscale"`
-   Each section handles its own specific inputs (Reference Uploads, Prompts, Seeds, etc.).

## ⚠️ Critical Constraints

1.  **Secrets:** API keys (`VITE_FAL_KEY`, `VITE_KIE_KEY`) must be set in `.env.local`. **NEVER commit these keys.**
2.  **Server Dependency:** The frontend requires the file server to be running (`npm run dev:all`).
3.  **CORS:** The file server must allow the frontend origin (configured via `FILE_API_CORS_ORIGIN`).

## 🔍 Troubleshooting

-   **"Missing API Key":** Check `.env.local` and restart the dev server.
-   **"Connection Failed":** Ensure the file server is running and the URL/token in the UI match `.env.server`.
-   **"Upload Failed":** Check `uploadToFal` in `ControlsPane.tsx`. Large files (>50MB) might fail depending on FAL's limits.

## 🚀 Quick Restart for Agents

1.  **Read `src/lib/models.json`** to understand the current video model capabilities.
2.  **Read `src/components/ControlsPane.tsx`** to see how inputs are mapped to API calls.
3.  **Check `src/lib/providers/index.ts`** to see available API clients.

