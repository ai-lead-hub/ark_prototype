# Cloud Plan — Phase 2 (Kitsu-Driven Rebuild)

Audience: incoming web developer. Scope: Kitsu is the source of truth for projects/shots/tasks/roles; app mirrors Kitsu, stores media in S3/CloudFront, and syncs statuses and previews back to Kitsu.

## Objectives
- Derive projects, shots, tasks, members, and roles from Kitsu.
- Users only see tasks assigned to them; task brief/guidelines/attachments pulled from Kitsu.
- Drafts remain private per user per project/task; publish moves outputs to shared project folders.
- Previews (thumbs/posters/low-bitrate) auto-upload to Kitsu; statuses mirrored both ways.

## Data Model (Postgres)
- `users` (include `kitsu_user_id`)
- `projects (kitsu_project_id, slug unique)`
- `project_members (project_id, user_id, role)` derived from Kitsu; local overrides minimized.
- `shots (project_id, kitsu_shot_id, code unique per project)`
- `tasks (id, project_id, shot_id?, kitsu_task_id, type, status, assignees, due, brief, attachments_json, timestamps)`
- `draft_assets (project_id, user_id, task_id, type, rel_path, storage_path, meta...)`
- `assets / asset_versions` same as Phase 1, with Kitsu IDs on records; add `task_id` FK.
- `pins/prompts/generations` include `task_id` when applicable.

## Directory Layout (Kitsu-driven)
- Project slug = Kitsu project code/slug.
- Shot code = Kitsu shot/sequence code.
- Task types map to folders: `asset|concept|storyboard|frame|clip|post`.
- Drafts: `personal/{projectSlug}/{userId}/{taskType}/{taskId}/...`
- Publish: `publish/{projectSlug}/{shotCode}/{taskType}/{projectSlug}_{shotCode}_{taskType}_vYYYYMMDD-HHMMSS[-NN].ext`
- Previews stored alongside originals under `previews/{size}/...`.

## Sync Strategy
- Webhooks: `POST /integrations/kitsu/webhook` (verify signature) for project/shot/task create/update/status/assignment.
- Polling fallback: delta endpoints (`updated_since`) every 2–5 minutes with backoff.
- Cache Kitsu entities in Postgres; use Redis for hot caches.
- Idempotency: dedupe by Kitsu event id or (entity id, updated_at).

## Task-First UX
- Login → select project (from Kitsu membership).
- Task tray shows assigned tasks with brief, shot context, due, status, attachments (URLs).
- “Start work” → ensure personal task folder exists; track start time.
- Publish requires selecting shot (from Kitsu) and writes versioned file; marks task `ready_for_review` (or configurable) and posts a Kitsu comment with URLs.
- Supervisors see all publishes; can rename/replace/delete; can change task status to `approved/changes_requested` and sync to Kitsu.

## Retake Comment Sync (Kitsu → Personal Workspace)
- Use Kitsu review/playlist comments as the review system of record.
- When a supervisor marks “retake” or leaves review notes on a task/shot:
  - Webhook ingests the comment and attaches it to the user’s personal workspace for that task.
  - Store as a `retake_note` record linked to `task_id` + `user_id`, and surface it in the UI as a “To Fix” item.
  - Optionally auto-create a checklist or pin the related asset in the user’s personal file browser.
- This keeps Kitsu review history intact while making the feedback actionable inside the app.

## Publish & Previews
- Version rule: `vYYYYMMDD-HHMMSS` (+ `-NN` on collision).
- Derivatives on save/publish:
  - Images: 320px thumb, 1280px web; original untouched.
  - Video: poster frame; 720p low-bitrate mp4/webm; original untouched.
- Worker queue pushes previews to Kitsu as attachments/comments with signed URLs; retries and rate limits.

## API Surfaces
- `/kitsu/projects`, `/kitsu/tasks?assignee=me&project=...` (proxy/cache).
- `/integrations/kitsu/webhook` (idempotent).
- `/tasks/:id/start`, `/tasks/:id/status`, `/tasks/:id/comment` (mirror to Kitsu).
- `/publish` (writes S3, DB; posts comment/status to Kitsu).
- `/admin/fs` with same RBAC as Phase 1, keyed by project/task.

## Roles & Permissions (per project, from Kitsu)
- Map Kitsu roles to local roles: owner/supervisor/editor/viewer (configurable mapping).
- Only assignees + supervisors/owners can work on a task; viewers read-only.
- Publish area: everyone can view; supervisors/owners can edit/replace/delete; editors can append versions.

## Frontend Changes
- Task-centric home: task list, brief panel, attachments, shot context.
- Project + Task selector replaces generic workspace selector.
- Shot list read-only for editors/viewers; editable for supervisors/owners (and mirrored to Kitsu).
- Publish modal pre-populates from task (shot, type); shows final filename and version.
- Status controls for supervisors (`approve`, `request changes`) sync to Kitsu.

## Provider Calls
- Store refs in S3; pass signed URLs to models. No client-side provider keys or FAL uploads.

## Deployment/Ops (same as Phase 1)
- ECS/Fargate, RDS, Redis, S3, Secrets Manager, CloudFront optional.
- Add Kitsu API creds to Secrets Manager; set rate limits; add webhook signature secret.
- Add metrics/alerts for webhook failures, Kitsu API 4xx/5xx, sync lag, queue depth.

## Validation Checklist
- Kitsu project/shot/task lists match in-app; assignees see only their tasks.
- Publishing writes to Kitsu-linked paths and posts previews/links back to Kitsu.
- Status changes sync both ways; idempotent under retries.
- No provider keys in client; all S3 access signed; RBAC enforced.
- Logs/metrics for webhook and sync pipelines; alerts on failures/backlog.
