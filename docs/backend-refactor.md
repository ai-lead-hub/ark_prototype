# Backend Refactor: Universal Generate Pipeline

**Status:** Design spec — not yet implemented
**Scope:** `src/lib/` and `src/state/`
**Goal:** One universal `generate()` function that works for any model on any provider, driven by config files — not per-model code

---

## 1. Current State

### What exists and works

| File | What it does |
|---|---|
| `src/lib/models.json` | Per-model config: endpoint, params, taskConfig, provider |
| `src/lib/models.ts` | Loads JSON, adds per-model `adapter.mapInput()` functions |
| `src/lib/kie.ts` | KIE provider bridge: submit, poll, download, upload |
| `src/lib/wavespeed.ts` | WaveSpeed provider bridge |
| `src/lib/providers/index.ts` | `callModelEndpoint()` dispatches to correct bridge by provider |
| `src/lib/providers/types.ts` | `TaskPollingConfig`, `ProviderCallOptions` types |
| `src/state/queueTypes.ts` | `QueueJob` — in-memory queue entry with status + logs |

### What is wrong with the current approach

**Problem 1: `UnifiedPayload` grows forever.**
`src/lib/models.ts` defines a flat `UnifiedPayload` type containing every parameter from every model (`start_frame_url`, `end_frame_url`, `aspect_ratio`, `reference_image_urls`, `character_id_list`, etc.). Adding a new model with a new parameter means modifying this shared type. It becomes a grab-bag that is impossible to validate against any specific model.

**Problem 2: Per-model code in `models.ts`.**
`models.ts` contains a `kieModelMap` hardcoded object that maps app model IDs to internal KIE model strings (e.g. `"sora-2"` → `"sora-2-image-to-video"` or `"sora-2-text-to-video"` depending on input). It also contains explicit `if (model.id.startsWith("veo-3.1"))` and `if (model.id === "ltx-2.3")` branches with custom `mapInput()` functions. Every new model with unusual input shape requires adding code here.

**Problem 3: `QueueJob.payload` is `unknown`.**
The queue records what job is running but loses all type information. There is no immutable snapshot of what the user submitted, so redo, variations, and history are not possible without re-reading the UI state.

**Problem 4: No asset lineage.**
Generated files are saved to disk with no record of what job produced them, what inputs were used, or what file was used as a reference. There is no way to answer "what generated this?" or "generate a variation of this."

---

## 2. Target Architecture

Three primitives. Everything else is derived from them.

```
ModelDefinition   →  Declares inputs, outputs, field mappings (config, not code)
Job               →  Immutable execution record (inputs frozen at creation)
Asset             →  Generated file with provenance link to its Job
```

### The universal generate function signature

```typescript
async function generate(
  model: ModelDefinition,   // what the model can accept (from config)
  input: InputSnapshot,     // what the user actually set (frozen at call time)
  bridge: Provider          // how to talk to this provider's API
): Promise<Job>
```

This function is written once. Adding a new model = adding a JSON config file. No new TypeScript.

### Internal steps (same for every model)

```
1. validate(model, input)          — check input against model's port rules
2. createJob(model.id, input)      — write to DB, freeze input snapshot
3. buildPayload(model.ports, input) — map our field names → API field names
4. resolveAssets(payload, bridge)  — upload local files, resolve asset refs to URLs
5. bridge.submit(endpoint, payload) — POST to provider, get task ID back
6. bridge.poll(taskId, taskConfig) — loop until success/fail (or skip if sync)
7. saveAsset(resultUrl, job.id)    — download file, write Asset record
8. updateJob(job.id, "completed")  — stamp job done, attach asset IDs
```

---

## 3. What to Keep Unchanged

Do not rewrite these. Extend only.

- **`src/lib/kie.ts`** — The KIE bridge already handles auth, upload, polling, download-url resolution, transient failure retries. Keep it. It becomes the implementation behind the `Provider` interface.
- **`src/lib/wavespeed.ts`** — Same. Keep.
- **`src/lib/providers/types.ts`** — `TaskPollingConfig` is already declarative and correct. Keep.
- **`src/lib/models.json`** — Extend the schema, don't replace. Existing model entries stay valid.
- **`src/state/queueTypes.ts`** — Keep `QueueJob` for UI queue display. The new `Job` record is the persistent backend record; `QueueJob` is the live UI state that tracks it.

---

## 4. New Types to Add

### 4.1 Port system — replaces `UnifiedPayload`

Create `src/lib/ports.ts`:

```typescript
// The kinds of values a model port can hold
export type PortType =
  | "text"        // prompt, negative prompt
  | "number"      // steps, cfg_scale, seed, duration
  | "boolean"     // enable_audio, remove_watermark
  | "enum"        // aspect_ratio, resolution, mode
  | "image"       // single image (upload or asset reference)
  | "video"       // single video
  | "audio"       // single audio file
  | "image[]"     // array of images (reference images, elements)
  | "video[]"     // array of videos
  | "asset-slots" // N mixed-type assets with @tag labels (Seedance 2 pattern)

// A Condition evaluates against current port values
// Used for showWhen / disableWhen rules in the model config
export type Condition =
  | { port: string; eq: unknown }
  | { port: string; neq: unknown }
  | { port: string; exists: boolean }
  | { port: string; in: unknown[] }
  | { and: Condition[] }
  | { or: Condition[] }
  | { not: Condition }

export type Port = {
  key: string            // internal name used in the app
  type: PortType
  label?: string         // display name shown in UI
  required?: boolean | Condition
  default?: unknown

  // Constraints (type-specific)
  constraints?: {
    min?: number; max?: number; step?: number  // for number
    options?: { value: unknown; label: string }[] // for enum
    maxCount?: number                           // for array types
    accept?: string[]                          // MIME filter e.g. ["image/jpeg"]
  }

  // UI behaviour — used by the form renderer
  tier?: "primary" | "standard" | "advanced" | "hidden"
  group?: string
  showWhen?: Condition   // hide the field when condition is false
  disableWhen?: Condition
  disableReason?: string // tooltip text when field is grayed out
  clearWhen?: Condition  // auto-clear value when condition becomes true

  // Provider mapping — how to translate this port to the API payload
  mapTo?: string         // provider's field name (if different from key)
  transform?:            // value transformation applied before sending
    | "wrap-array"       // "value" → ["value"]
    | "join-comma"       // ["a","b"] → "a,b"
    | "to-string"        // 10 → "10"
    | "to-number"        // "10" → 10
    | "stringify"        // object → JSON string
}

export function evalCondition(
  cond: Condition,
  values: Record<string, unknown>
): boolean {
  if ("port" in cond) {
    const val = values[cond.port]
    if ("eq" in cond)     return val === cond.eq
    if ("neq" in cond)    return val !== cond.neq
    if ("exists" in cond) return cond.exists ? val != null : val == null
    if ("in" in cond)     return (cond.in as unknown[]).includes(val)
  }
  if ("and" in cond) return cond.and.every(c => evalCondition(c, values))
  if ("or" in cond)  return cond.or.some(c => evalCondition(c, values))
  if ("not" in cond) return !evalCondition(cond.not, values)
  return true
}
```

### 4.2 ModelDefinition — extends current ModelSpec

Add to `src/lib/models.ts` (or a new `src/lib/model-definition.ts`):

```typescript
export type EndpointRule = {
  when?: Condition   // if omitted, this is the default
  use: string        // the endpoint path to use
}

export type ModelDefinition = {
  id: string
  label: string
  provider: ModelProvider
  capabilities: string[]   // "text-to-video" | "image-to-video" | "text-to-image" etc.

  // Either a static string or conditional rules (replaces kieModelMap in models.ts)
  endpoint: string | EndpointRule[]

  // The universal port list (replaces UnifiedPayload + params)
  ports: Port[]

  // How to find the result URL in the raw API response
  outputMapping: {
    resultPath: string  // dot-notation path e.g. "data.resultJson.resultUrls[0]"
    type: "url" | "base64"
  }

  // Polling config — already exists in TaskPollingConfig, keep as-is
  taskConfig?: TaskPollingConfig

  // Output type for asset record creation
  outputType: "image" | "video" | "audio"
}
```

### 4.3 InputSnapshot — replaces `unknown` payload

```typescript
// src/lib/job-types.ts

export type AssetRef = {
  portKey: string   // which port this asset was used in
  assetId: string   // pointer to the Asset record
  resolvedUrl?: string // URL at time of submission (filled during resolve step)
}

export type InputSnapshot = {
  params: Record<string, unknown>  // scalar values (strings, numbers, booleans)
  assetRefs: AssetRef[]            // file/asset inputs tracked by reference
}
```

### 4.4 Job — persistent execution record

```typescript
// src/lib/job-types.ts (continued)

export type JobStatus = "pending" | "running" | "completed" | "failed"

export type Job = {
  id: string
  modelId: string
  createdAt: string        // ISO timestamp
  status: JobStatus

  // Frozen at creation — never mutated
  inputSnapshot: InputSnapshot

  // Set after completion
  outputAssetIds?: string[]
  providerJobId?: string   // task ID returned by the API
  error?: string
  startedAt?: string
  completedAt?: string
  durationMs?: number

  // Lineage — set if this job was created from another job (redo / variation)
  parentJobId?: string
}
```

### 4.5 Asset — generated file with lineage

```typescript
// src/lib/job-types.ts (continued)

export type Asset = {
  id: string
  type: "image" | "video" | "audio"
  url: string             // stored path or CDN URL
  thumbnailUrl?: string
  mimeType: string
  sizeBytes: number
  source: "generated" | "uploaded" | "imported"

  // Lineage
  createdByJobId?: string  // null if user-uploaded
  createdAt: string

  // Denormalised metadata for search
  metadata?: {
    width?: number
    height?: number
    duration?: number
    prompt?: string
  }

  deletedAt?: string       // soft delete
}
```

---

## 5. New Functions to Add

### 5.1 `buildPayload()` — universal field mapper

Create `src/lib/generate/build-payload.ts`:

```typescript
import type { Port, InputSnapshot } from "../ports"

// Applies transform rules declared in the port config
function applyTransform(value: unknown, transform?: Port["transform"]): unknown {
  if (!transform) return value
  switch (transform) {
    case "wrap-array":  return [value]
    case "join-comma":  return (value as string[]).join(",")
    case "to-string":   return String(value)
    case "to-number":   return Number(value)
    case "stringify":   return JSON.stringify(value)
    default:            return value
  }
}

// Replaces all per-model mapInput() adapter functions
export function buildPayload(
  ports: Port[],
  snapshot: InputSnapshot
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  for (const port of ports) {
    // Scalar params first
    const scalarValue = snapshot.params[port.key]

    // Then check asset refs
    const assetRef = snapshot.assetRefs.find(r => r.portKey === port.key)
    const value = scalarValue ?? assetRef?.resolvedUrl

    if (value === undefined) {
      if (port.default !== undefined) {
        payload[port.mapTo ?? port.key] = applyTransform(port.default, port.transform)
      }
      continue
    }

    payload[port.mapTo ?? port.key] = applyTransform(value, port.transform)
  }

  return payload
}
```

### 5.2 `resolveEndpoint()` — replaces `kieModelMap` in models.ts

Create `src/lib/generate/resolve-endpoint.ts`:

```typescript
import type { ModelDefinition } from "../models"
import type { InputSnapshot } from "../ports"
import { evalCondition } from "../ports"

export function resolveEndpoint(
  model: ModelDefinition,
  snapshot: InputSnapshot
): string {
  if (typeof model.endpoint === "string") return model.endpoint

  const values = {
    ...snapshot.params,
    ...Object.fromEntries(snapshot.assetRefs.map(r => [r.portKey, r.resolvedUrl ?? true]))
  }

  for (const rule of model.endpoint) {
    if (!rule.when) return rule.use          // default rule
    if (evalCondition(rule.when, values)) return rule.use
  }

  throw new Error(`No endpoint rule matched for model ${model.id}`)
}
```

### 5.3 `generate()` — the universal function

Create `src/lib/generate/index.ts`:

```typescript
import type { ModelDefinition } from "../models"
import type { InputSnapshot } from "../ports"
import type { Job, Asset } from "../job-types"
import { buildPayload } from "./build-payload"
import { resolveEndpoint } from "./resolve-endpoint"
import { callModelEndpoint } from "../providers"
import { jobStore, assetStore } from "../stores"  // see section 6

export async function generate(
  model: ModelDefinition,
  input: InputSnapshot,
  options?: { log?: (msg: string) => void }
): Promise<Job> {
  const log = options?.log ?? (() => {})
  const jobId = crypto.randomUUID()

  // Step 2: Create job record (input frozen here)
  const job = await jobStore.create({
    id: jobId,
    modelId: model.id,
    status: "pending",
    inputSnapshot: input,
    createdAt: new Date().toISOString(),
  })

  try {
    await jobStore.update(jobId, { status: "running", startedAt: new Date().toISOString() })

    // Step 3: Build payload
    const payload = buildPayload(model.ports, input)

    // Step 4: Resolve endpoint
    const endpoint = resolveEndpoint(model, input)

    log("Submitting task...")

    // Step 5: Submit to API
    const result = await callModelEndpoint(model.provider, endpoint, payload, {
      taskConfig: model.taskConfig,
      log,
      preferUrlResult: true,
    })

    const resultUrl = result.url
    if (!resultUrl) throw new Error("Provider returned no result URL.")

    log("Saving asset...")

    // Step 7: Save asset
    const asset = await assetStore.createFromUrl(resultUrl, {
      type: model.outputType,
      createdByJobId: jobId,
      prompt: typeof input.params.prompt === "string" ? input.params.prompt : undefined,
    })

    // Step 8: Update job complete
    const completedAt = new Date().toISOString()
    await jobStore.update(jobId, {
      status: "completed",
      outputAssetIds: [asset.id],
      completedAt,
      durationMs: Date.now() - new Date(job.createdAt).getTime(),
    })

    return jobStore.get(jobId)
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    await jobStore.update(jobId, { status: "failed", error })
    throw err
  }
}
```

### 5.4 `deriveJob()` — redo / variations

Add to `src/lib/generate/index.ts`:

```typescript
// Redo exact:                   deriveJob(jobId)
// Variation (new seed):         deriveJob(jobId, { seed: Math.random() * 2147483647 | 0 })
// Tweak a parameter:            deriveJob(jobId, { cfg_scale: 0.8 })
export async function deriveJob(
  sourceJobId: string,
  overrides: Record<string, unknown> = {}
): Promise<Job> {
  const source = await jobStore.get(sourceJobId)
  const model = modelRegistry.get(source.modelId)

  const newInput: InputSnapshot = {
    params: { ...source.inputSnapshot.params, ...overrides },
    assetRefs: source.inputSnapshot.assetRefs,
  }

  return generate(model, { ...newInput, parentJobId: sourceJobId } as any)
}
```

---

## 6. Architecture Constraint: Backend Execution and Database Storage

**This is non-negotiable for the production system.**

### All model processing must happen on the backend server

Currently the app calls provider APIs (KIE, WaveSpeed) directly from the browser. This must move to the backend (`server/`) for several reasons:

- **API keys must not be exposed to the browser.** `VITE_KIE_KEY` is currently readable by anyone who opens DevTools. Backend execution means keys live only in server environment variables.
- **Polling must survive browser tab closure.** If the user closes the tab mid-generation, the poll loop dies and the result is lost. A backend poller completes the job regardless of what the frontend is doing.
- **Job and asset records must be written to the database from the server**, not from the browser. Browser storage (`localStorage`, `IndexedDB`) is local to one device and one user session, cannot be queried across users or projects, and is cleared by the browser.

### What moves to the backend

The `generate()` function and everything it calls — `buildPayload()`, `resolveEndpoint()`, `bridge.submit()`, `bridge.poll()`, `assetStore.createFromUrl()`, `jobStore.create/update()` — must run on `server/index.js` (or a new backend module).

The frontend sends a `POST /api/generate` request with `{ modelId, inputSnapshot }` and receives back `{ jobId }`. It then polls `GET /api/jobs/:jobId` to track status and retrieve the result when done.

```
Browser                          Backend (server/)
  │                                    │
  │  POST /api/generate                │
  │  { modelId, inputSnapshot }   ───► │  validate()
  │                                    │  createJob() → DB
  │  ◄── { jobId }                     │  buildPayload()
  │                                    │  resolveEndpoint()
  │  GET /api/jobs/:jobId  ──────────► │  bridge.submit() → provider API
  │  ◄── { status: "running" }         │  bridge.poll() (server-side loop)
  │                                    │  saveAsset() → DB
  │  GET /api/jobs/:jobId  ──────────► │  updateJob(completed) → DB
  │  ◄── { status: "completed",        │
  │        assetIds: [...] }           │
```

### Database

Use **SQLite** (via `better-sqlite3`) for the prototype. It is a single file, requires no external service, and is trivially replaceable with Postgres later. The server already uses `server/meta-db.js` — add the job and asset tables there.

**Minimum schema:**

```sql
CREATE TABLE jobs (
  id           TEXT PRIMARY KEY,
  model_id     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  input_snapshot TEXT NOT NULL,  -- JSON blob
  output_asset_ids TEXT,          -- JSON array
  provider_job_id TEXT,
  parent_job_id TEXT,
  error        TEXT,
  created_at   TEXT NOT NULL,
  started_at   TEXT,
  completed_at TEXT,
  duration_ms  INTEGER
);

CREATE TABLE assets (
  id             TEXT PRIMARY KEY,
  type           TEXT NOT NULL,
  url            TEXT NOT NULL,
  thumbnail_url  TEXT,
  mime_type      TEXT,
  size_bytes     INTEGER,
  source         TEXT NOT NULL DEFAULT 'generated',
  created_by_job_id TEXT,
  created_at     TEXT NOT NULL,
  metadata       TEXT,           -- JSON blob: { prompt, width, height, duration }
  deleted_at     TEXT
);
```

### Storage Layer Interface

Define the interface in `src/lib/stores.ts` as a client that calls the backend API, not a local store:

```typescript
// src/lib/stores.ts — browser side, talks to backend

export const jobStore = {
  create: (data) => fetch("/api/jobs", { method: "POST", body: JSON.stringify(data) }).then(r => r.json()),
  get:    (id)   => fetch(`/api/jobs/${id}`).then(r => r.json()),
  update: (id, patch) => fetch(`/api/jobs/${id}`, { method: "PATCH", body: JSON.stringify(patch) }).then(r => r.json()),
  list:   ()     => fetch("/api/jobs").then(r => r.json()),
}

export const assetStore = {
  get:        (id)    => fetch(`/api/assets/${id}`).then(r => r.json()),
  listByJob:  (jobId) => fetch(`/api/assets?jobId=${jobId}`).then(r => r.json()),
}
```

The actual database writes happen in the server route handlers — not in these client functions.

---

## 7. Migrating Existing Models to the Port System

### Priority order

1. **New models** — write port-based JSON config from the start. No adapter needed.
2. **Kling family** (kling-2.5-pro, kling-3.0, kling-v2-6-pro) — straightforward field mapping, use `mapTo` and `transform`. Remove from `kieModelMap`.
3. **Sora 2 / Sora 2 Pro** — conditional endpoint based on whether `start_frame` port has a value. Use `EndpointRule[]`.
4. **Veo 3.1** — more complex (T2V / I2V / REFERENCE mode). May need a small bridge extension in `kie.ts` rather than pure config.
5. **LTX-2.3 (WaveSpeed)** — already isolated in its adapter. Migrate to port config + WaveSpeed bridge extension.

### Example: migrating Kling 2.5 Pro

**Before** (current `models.json` + code in `mapInput`):
```json
{
  "id": "kling-2.5-pro",
  "params": {
    "image_url": { "type": "string", "uiKey": "start_frame_url" },
    "tail_image_url": { "type": "string", "uiKey": "end_frame_url" },
    "duration": { "type": "enum", "values": ["5", "10"] }
  }
}
```
Plus code in `kieModelMap`: `"kling-2.5-pro": { i2v: "kling/v2-5-turbo-image-to-video-pro" }`

**After** (port config only, no code):
```json
{
  "id": "kling-2.5-pro",
  "label": "Kling 2.5 Turbo Pro",
  "provider": "kie",
  "outputType": "video",
  "endpoint": "/api/v1/jobs/createTask",
  "ports": [
    { "key": "prompt",     "type": "text",  "required": true, "tier": "primary",
      "mapTo": "prompt" },
    { "key": "model",      "type": "text",  "tier": "hidden",
      "default": "kling/v2-5-turbo-image-to-video-pro" },
    { "key": "start_frame","type": "image", "tier": "primary",
      "mapTo": "image_url" },
    { "key": "end_frame",  "type": "image", "tier": "standard",
      "mapTo": "tail_image_url",
      "showWhen": { "port": "start_frame", "exists": true } },
    { "key": "duration",   "type": "enum",  "required": true, "tier": "primary",
      "default": "5",
      "constraints": { "options": [
        { "value": "5",  "label": "5s" },
        { "value": "10", "label": "10s" }
      ]}},
    { "key": "cfg_scale",  "type": "number","tier": "advanced",
      "default": 0.5, "constraints": { "min": 0, "max": 1, "step": 0.05 }},
    { "key": "negative_prompt", "type": "text", "tier": "advanced" }
  ]
}
```

---

## 8. File Map After Refactor

```
src/lib/
  ports.ts                    NEW — Port types, Condition type, evalCondition()
  job-types.ts                NEW — Job, Asset, InputSnapshot, AssetRef types
  stores.ts                   NEW — jobStore, assetStore interfaces + localStorage impl
  generate/
    index.ts                  NEW — generate(), deriveJob()
    build-payload.ts          NEW — buildPayload(), applyTransform()
    resolve-endpoint.ts       NEW — resolveEndpoint()
  models.json                 MODIFIED — add "ports" array to each model entry
  models.ts                   MODIFIED — remove kieModelMap, remove adapter.mapInput()
                                         for models migrated to port config
  kie.ts                      UNCHANGED (mostly) — keep as Provider implementation
  wavespeed.ts                UNCHANGED — keep as Provider implementation
  providers/
    index.ts                  UNCHANGED
    types.ts                  UNCHANGED
```

---

## 9. Instructions for Implementation

These steps are ordered. Complete each before starting the next. Each step is independently testable.

---

### Step 1 — Create `src/lib/ports.ts`

Write the `PortType`, `Condition`, `Port` types and `evalCondition()` function exactly as defined in section 4.1. No logic beyond what is written there. Export all types.

**Test:** Write a unit test that evaluates a condition `{ port: "start_frame", exists: true }` against `{ start_frame: "url" }` → `true`, and against `{}` → `false`.

---

### Step 2 — Create `src/lib/job-types.ts`

Write `AssetRef`, `InputSnapshot`, `JobStatus`, `Job`, `Asset` types exactly as defined in sections 4.3, 4.4, 4.5. Export all.

**Test:** Verify TypeScript compiles with no errors.

---

### Step 3 — Add job and asset tables to the database

In `server/meta-db.js`, add the two `CREATE TABLE IF NOT EXISTS` statements from section 6. Run the server and verify both tables are created in the SQLite file.

Then add four REST routes to `server/index.js`:
- `POST /api/jobs` — insert a new job row, return the job
- `GET /api/jobs/:id` — return a job by ID
- `PATCH /api/jobs/:id` — update a job row (status, completedAt, outputAssetIds, error)
- `GET /api/assets?jobId=` — return assets where `created_by_job_id` matches

In `src/lib/stores.ts`, implement the client-side `jobStore` and `assetStore` as HTTP calls to these routes, as shown in section 6. No localStorage.

**Test:** POST a job via curl or Postman, PATCH its status to "completed", GET it and verify the status changed. Verify the record persists after restarting the server.

---

### Step 4 — Create `src/lib/generate/build-payload.ts`

Implement `applyTransform()` and `buildPayload()` exactly as defined in section 5.1.

**Test:** Given a port with `key: "duration"`, `mapTo: "n_frames"`, `transform: "to-string"`, and `snapshot.params = { duration: 10 }`, verify the output is `{ n_frames: "10" }`. Given a port with `key: "start_frame"`, `transform: "wrap-array"`, and `snapshot.assetRefs = [{ portKey: "start_frame", resolvedUrl: "https://..." }]`, verify output is `{ start_frame: ["https://..."] }`.

---

### Step 5 — Create `src/lib/generate/resolve-endpoint.ts`

Implement `resolveEndpoint()` exactly as defined in section 5.2. Import `evalCondition` from `ports.ts`.

**Test:** Given a model with `endpoint: [{ when: { port: "start_frame", exists: true }, use: "/i2v" }, { use: "/t2v" }]`, verify it returns `/i2v` when `assetRefs` contains a `start_frame` entry, and `/t2v` when it does not.

---

### Step 6 — Create the generate route on the backend

Create `server/generate.js` (imported by `server/index.js`). Implement `generate()` as defined in section 5.3. This file runs on the server — it imports `callModelEndpoint`, the DB job/asset functions, `buildPayload`, and `resolveEndpoint`.

Add a route to `server/index.js`:
- `POST /api/generate` — accepts `{ modelId, inputSnapshot }`, calls `generate()`, returns `{ jobId }`

The browser never calls provider APIs directly. All provider calls happen inside this route handler.

Do not yet implement `deriveJob()`. Leave a `// TODO: deriveJob` comment.

**Test:** Send `POST /api/generate` via Postman with a real Kling model ID and a prompt. Verify a job row appears in the SQLite DB with status `"completed"` and an asset row with the output URL.

---

### Step 7 — Add port config to `models.json` for Kling 2.5 Pro

Using the example in section 7, add a `"ports"` array to the `"kling-2.5-pro"` entry in `models.json`. Keep the existing `"params"` field for now (backward compat). Do not delete anything yet.

---

### Step 8 — Remove `kling-2.5-pro` from `kieModelMap` in `models.ts`

After step 7, the model's endpoint is declared in config. Remove its entry from `kieModelMap` and from the `adapter.mapInput()` function. Verify generation still works.

---

### Step 9 — Repeat steps 7–8 for remaining KIE models

In order: Kling 3.0, Kling V2.6 Pro, Sora 2, Sora 2 Pro, Wan 2.6, Seedance 1.5, Hailuo models, Grok Imagine. For each: add ports to JSON, verify it works, then remove from code adapters.

---

### Step 10 — Implement `deriveJob()`

Add `deriveJob()` to `src/lib/generate/index.ts` as defined in section 5.4. Wire it to the UI's "Redo" action.

---

### Step 11 — Remove `UnifiedPayload` from `models.ts`

Once all models have been migrated to the port system, `UnifiedPayload` can be deleted. Any component still reading `UnifiedPayload` should be updated to read from the model's `ports` array instead.

---

## 10. Postman Usage

Before implementing any new model, test its API manually in Postman first.

**Setup:**
1. Create a collection named `Ark API — Providers`
2. Create an environment with variables: `KIE_KEY`, `WAVESPEED_KEY`
3. Set auth on the KIE collection folder: Bearer Token → `{{KIE_KEY}}`

**For each new model, create a Postman request that:**
- Uses the real endpoint from the provider docs
- Sends a minimal valid payload (prompt + one image if I2V)
- Verifies the response structure (where is `taskId`? What is the `statePath`?)
- Sends a status poll request and verifies the success state string and result URL path

**This tells you exactly what to put in the model's JSON config** (`taskConfig.statePath`, `taskConfig.successStates`, `outputMapping.resultPath`) before writing any TypeScript.

**Postman is also useful for:**
- Confirming which fields are required vs optional (send without them and see what the API rejects)
- Discovering quirks (e.g. KIE's Veo endpoint uses numeric success states `1` vs string `"success"` on others)
- Sharing the collection with other devs so they can test any model's API in 30 seconds

---

## 11. What Not to Do

- Do not create a new `Provider` abstract class or inheritance hierarchy. The current `callModelEndpoint()` dispatch function is sufficient. Add new providers by adding a new branch to that function and a new `callXxx()` module.
- Do not delete `models.ts` or the existing `ModelSpec` type until all models are migrated to the port system. Migration is incremental.
- Do not move `kie.ts` logic into the JSON config. KIE-specific behaviour (transient failure retries, `resolveKieDownloadUrl`, `extractUrlFromResultJson`) is intentionally in code because it reflects API quirks — not model differences.
- Do not add per-model `if` statements to `generate()`. If a model requires special handling that cannot be expressed in the port config, the correct place is a bridge extension in `kie.ts` or `wavespeed.ts`.
