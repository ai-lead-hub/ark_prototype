# Known Issues (UI/UX and Backend)

## Backend / Security
- Auth off by default; predictable `devtoken` and `*` CORS in compose (server/index.js:23-117, docker-compose.yml:13-15).
- Query-string token bypass (server/index.js:105-116) defeats header auth; no user identity or roles anywhere.
- Secrets shipped to client: FAL/KIE keys in bundle (`src/lib/fal.ts`, `src/lib/kie.ts`).
- No multi-tenant enforcement: any bearer token can list/create/delete any workspace/files (server/index.js:191-474).
- Local FS + SQLite (DatabaseSync) block horizontal scaling; no backups or migrations; `node:sqlite` dependency not declared in package.json (meta-db.js), may fail at runtime.
- Trash wiped on startup (server/index.js:42-49) → silent data loss.
- No rate limiting; 1GB body limit invites DoS and cost blowout.
- No CSRF protection on mutating routes; CORS permissive.
- Upload validation thin: spaces/dots allowed, no MIME allowlist, no AV/scan, no per-user quotas.
- `/log` endpoint appends to `debug.log` without rotation/size cap (server/index.js:538-565).
- Publish lacks per-user/project authorization; regex-only validation (server/index.js:476-524).
- Metadata DB synchronous access (DatabaseSync) on request path can block event loop on large queries; falls back silently to FS when unavailable → inconsistent results.
- Range/streaming endpoints lack cache/ETag controls and leak path timing; video served `no-store` but others `private` without checksum.
- No request IDs; logger enabled may leak sensitive headers; no structured logging fields.

## Data / Performance
- GET /files does full recursive walk; no pagination; can blow memory on large trees.
- FS and DB states can diverge; delete/rename failures in metaDb only warn and continue.
- Background delete (`/files/trash`) moves files without transactional consistency with DB.
- Queue is client-only; no server-side dedupe, quota, or persistence; failures vanish after tab close.
- Large `debug.log` unbounded growth; disk pressure risk.

## UI/UX
- Tokens/API base stored indefinitely in `localStorage`; no session expiry or revocation (`ProjectBar.tsx`).
- Connection failure silently empties workspace list; no inline error (ProjectBar.tsx ~78-95).
- No loading/error states in FileBrowser/Controls for failed fetches; console-only errors.
- Publish UI has no role awareness; any user can attempt destructive actions (server also unenforced).
- Queue clears jobs after 10s; loses history and errors (`queue.tsx`).
- No auth state indicator beyond icon; no token expiry warnings.
- Settings dropdown lacks keyboard A11y and focus trap (ProjectBar.tsx).
- No confirmation dialogs on delete/trash/rename; easy misclick data loss.
- Reference uploads rely on localStorage state; not scoped per project; risk of wrong-target upload.

## Build / Deploy
- No automated tests; lint not enforced in CI.
- Docker image runs as root; no user drop; no healthcheck script in image (only compose wget).
- Missing CSP/security headers; no HSTS guidance.

## Stability / Gaps
- `/health` ignores DB/Redis/S3; no readiness probe.
- `_trash` deletion on boot undocumented; surprises operators.
- CORS defaults unsafe; FILE_API_TOKEN optional leads to open API.
- Provider timeouts: 10m hardcoded; no circuit breaker; retries lack jitter.

## Possible Improvements (priority-ordered)
1) Add real auth: JWT/OIDC, per-user roles, remove query-token bypass; enforce on every route.
2) Move storage to S3; add signed URL flow; stop serving from local FS; migrate metadata to Postgres with migrations.
3) Add rate limiting + quotas (user/project/file size/count); MIME allowlist; optional AV scan.
4) Remove secrets from client; proxy provider calls server-side; store keys in secrets manager.
5) Implement role-aware publish/delete/edit; soft delete with restore; stop trash auto-wipe.
6) Add paginated listing and background indexing; async worker for thumbnails/metadata.
7) Add structured logging with requestId; log rotation; metrics; health/ready probes that check DB/S3/Redis.
8) Improve UX: error/loading states, confirmation dialogs, keyboard A11y, session expiration, role badges.
9) Persist queue server-side with shared state; expose job statuses to all users in a project.
10) Container hardening: non-root user, minimal runtime deps, healthcheck endpoint, CSP/HSTS at proxy.
