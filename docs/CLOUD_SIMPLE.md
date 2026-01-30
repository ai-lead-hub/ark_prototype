# Cloud Plan — Phase 1 (Manual, No Kitsu)

Audience: incoming web developer. Scope: keep current app usable in the cloud with manual project selection, personal-per-project drafts, and publish to shared project folders. No Kitsu integration yet.

## Objectives
- Personal workspaces only; each user works in their own project-scoped area.
- Users must pick a project after login; drafts they create are visible only to them within that project.
- Publishing moves a user’s files into the project’s shared publish area; everyone can view, only supervisors/owners can edit/replace/delete.
- Shots are managed in-app by supervisors/owners.
- Secrets stay server-side; storage/metadata live on AWS services.

## Target AWS Architecture (minimal viable)
- Compute: ECS Fargate (API + static UI) behind ALB + TLS (ACM).
- DB: RDS Postgres (replaces SQLite).
- Cache/Queue: ElastiCache Redis for job queue + rate limiting.
- Storage: S3 bucket; optional CloudFront for media.
- Secrets: AWS Secrets Manager (provider keys, DB URL, JWT signing keys).
- Monitoring: CloudWatch logs/metrics/alarms; health `/health`, ready `/ready`.

## Data Model (Postgres)
- `users`
- `projects (slug unique)`
- `project_members (project_id, user_id, role: owner|supervisor|editor|viewer)`
- `shots (project_id, code unique per project)`
- `draft_assets (project_id, user_id, type, rel_path, storage_path, mtime, width, height, duration, model_id, provider, prompt, timestamps)` — private.
- `assets (project_id, shot_id, type, status: published|replaced|deleted, latest_version, published_by, approved_by, timestamps, is_deleted)`
- `asset_versions (asset_id, version, storage_path, width, height, duration, checksum, model_id, provider, prompt, created_at)`
- `pins/prompts/generations` with `user_id` + `project_id`.

## Roles & Permissions (per project)
- Owner: manage members/shots; publish; full edit rights in publish area.
- Supervisor: full read/write/delete in publish area; approve/replace/rename; can edit shot list.
- Editor: draft in personal area; publish (append-only) into publish area; no edit/delete of published items or shots.
- Viewer: read-only; can view publish area and shots.
- Enforce via middleware on every route; no query-token bypass.

## Storage Layout (S3 keys)
- Personal drafts: `personal/{projectSlug}/{userId}/...`
- Publish area: `publish/{projectSlug}/{shotCode}/{projectSlug}_{shotCode}_vYYYYMMDD-HHMMSS[-NN].ext`
- Temp uploads: `temp/{uuid}/{filename}`
- Bucket private; access via signed URLs or server proxy honoring roles.

## Publish Flow
1) User selects project; drafts live in `personal/{projectSlug}/{userId}/...`.
2) `POST /publish` (role ≥ editor):
   - Inputs: `projectId`, `shotId`, `type`, `sourceRelPath`.
   - Server copies to `publish/{projectSlug}/{shotCode}/...`, versions `vYYYYMMDD-HHMMSS` (+ `-NN` on collision), writes `assets` + `asset_versions`.
3) Supervisors: `PATCH /publish/:id` (rename/reassign/replace), `DELETE /publish/:id` (soft).
4) View: `GET /publish` (filters) and `GET /publish/:id/download` (signed URL).

## API Changes (Fastify)
- Add JWT/OIDC middleware (Cognito recommended). All routes require auth; use `project_members` for role checks.
- Swap local FS for S3 adapter (signed PUT/GET); keep path sanitizers.
- Rate limit per user/project via Redis.
- Audit log for publish/rename/delete.

## Frontend Changes
- Remove `VITE_FAL_KEY/VITE_KIE_KEY` from client; proxy provider calls through server.
- Project selector at login; browser shows only current project’s personal drafts.
- Shot selector in Publish modal; final filename preview; shot editing gated to supervisor+.
- Supervisor “Publish board” with edit/replace/delete; status badges.
- Shared queue state from server (not per tab).
- Reference uploads: use S3/CloudFront signed URLs, not FAL storage from browser.

## File Server (Admin)
- `/admin/fs` (or separate service) with RBAC:
  - Publish prefix: list/download for any project member; write/rename/delete for supervisors/owners.
  - Personal prefix: list/download for owner user; supervisors/owners optional read-only.
- Endpoints: list, download (signed URL), upload/replace (supervisor), rename, delete (soft).
- Audit every admin action; deny keys outside allowed prefixes.

## Deployment Steps (AWS)
1) Provision RDS, Redis, S3, Secrets Manager, ACM, ALB.
2) Run migrations (tables above).
3) Build image (`npm ci --omit=dev`, non-root) and push to ECR.
4) ECS Fargate service behind ALB; env from Secrets/SSM:
   - `DATABASE_URL`, `REDIS_URL`, `S3_BUCKET`, `S3_REGION`, `CLOUDFRONT_URL`, `JWT_ISSUER`, `JWT_AUDIENCE`, `FAL_API_KEY`, `KIE_API_KEY`, `MAX_UPLOAD_MB`, `CORS_ORIGIN`.
5) S3 bucket policy for task role; optional STS role for admin file access; enable versioning + lifecycle.
6) (Optional) CloudFront for media (signed URLs/cookies).
7) Alarms: ALB 5xx, task CPU/Mem, RDS/Redis health, queue depth.
8) Load test publish + browse; verify role matrix.

## Validation Checklist
- Auth enforced on all API routes; no query-token bypass.
- Publishing writes to `publish/...`; supervisors can edit; editors cannot delete.
- Deterministic versioning with collision suffix.
- S3 keys and DB rows stay in sync; soft-deletes intact.
- Admin file server restricted; actions audited.
- Secrets not shipped to client; provider calls proxied.
- Structured logs with requestId; health/ready probes pass; metrics emitted.
