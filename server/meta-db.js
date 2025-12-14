import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export async function createMetaDb(dbPath) {
  const resolved = path.resolve(dbPath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });

  const db = new DatabaseSync(resolved);

  // Pragmas (best-effort)
  try {
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA synchronous = NORMAL;");
    db.exec("PRAGMA busy_timeout = 5000;");
    db.exec("PRAGMA foreign_keys = ON;");
  } catch {
    // Ignore pragma failures
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      workspace_id TEXT NOT NULL,
      output_rel_path TEXT NOT NULL,
      output_mime TEXT,
      output_size INTEGER,
      category TEXT,
      model_id TEXT,
      provider TEXT,
      endpoint TEXT,
      prompt TEXT,
      seed TEXT,
      payload_json TEXT
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_generations_workspace_created_at
    ON generations (workspace_id, created_at DESC);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_generations_created_at
    ON generations (created_at DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      workspace_id TEXT NOT NULL,
      rel_path TEXT NOT NULL,
      name TEXT NOT NULL,
      ext TEXT,
      size INTEGER,
      mtime INTEGER,
      mime TEXT,
      width INTEGER,
      height INTEGER,
      duration REAL,
      PRIMARY KEY (workspace_id, rel_path)
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_files_workspace_mtime
    ON files (workspace_id, mtime DESC);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_files_workspace_ext
    ON files (workspace_id, ext);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at INTEGER NOT NULL,
      workspace_id TEXT,
      tab TEXT,
      model_id TEXT,
      prompt TEXT NOT NULL
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_prompt_history_workspace_created_at
    ON prompt_history (workspace_id, created_at DESC);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_prompt_history_created_at
    ON prompt_history (created_at DESC);
  `);

  const insertGenerationStmt = db.prepare(`
    INSERT OR REPLACE INTO generations (
      id,
      created_at,
      workspace_id,
      output_rel_path,
      output_mime,
      output_size,
      category,
      model_id,
      provider,
      endpoint,
      prompt,
      seed,
      payload_json
    ) VALUES (
      $id,
      $created_at,
      $workspace_id,
      $output_rel_path,
      $output_mime,
      $output_size,
      $category,
      $model_id,
      $provider,
      $endpoint,
      $prompt,
      $seed,
      $payload_json
    );
  `);

  const upsertFileStmt = db.prepare(`
    INSERT INTO files (
      workspace_id,
      rel_path,
      name,
      ext,
      size,
      mtime,
      mime,
      width,
      height,
      duration
    ) VALUES (
      $workspace_id,
      $rel_path,
      $name,
      $ext,
      $size,
      $mtime,
      $mime,
      $width,
      $height,
      $duration
    )
    ON CONFLICT (workspace_id, rel_path) DO UPDATE SET
      name = excluded.name,
      ext = excluded.ext,
      size = excluded.size,
      mtime = excluded.mtime,
      mime = excluded.mime,
      width = COALESCE(excluded.width, files.width),
      height = COALESCE(excluded.height, files.height),
      duration = COALESCE(excluded.duration, files.duration);
  `);

  const updateFileDimsStmt = db.prepare(`
    UPDATE files
    SET
      width = COALESCE($width, width),
      height = COALESCE($height, height),
      duration = COALESCE($duration, duration)
    WHERE workspace_id = $workspace_id AND rel_path = $rel_path;
  `);

  const deleteFilePrefixStmt = db.prepare(`
    DELETE FROM files
    WHERE workspace_id = $workspace_id
      AND (rel_path = $rel_path OR rel_path LIKE $prefix ESCAPE '\\');
  `);

  const deleteGenerationsPrefixStmt = db.prepare(`
    DELETE FROM generations
    WHERE workspace_id = $workspace_id
      AND (output_rel_path = $rel_path OR output_rel_path LIKE $prefix ESCAPE '\\');
  `);

  const listFilesStmt = db.prepare(`
    SELECT
      rel_path,
      name,
      ext,
      size,
      mtime,
      mime,
      width,
      height,
      duration
    FROM files
    WHERE workspace_id = $workspace_id
    ORDER BY mtime DESC
    LIMIT $limit
    OFFSET $offset;
  `);

  const insertPromptStmt = db.prepare(`
    INSERT INTO prompt_history (
      created_at,
      workspace_id,
      tab,
      model_id,
      prompt
    ) VALUES (
      $created_at,
      $workspace_id,
      $tab,
      $model_id,
      $prompt
    );
  `);

  const listGenerationsStmt = db.prepare(`
    SELECT
      id,
      created_at,
      workspace_id,
      output_rel_path,
      output_mime,
      output_size,
      category,
      model_id,
      provider,
      endpoint,
      prompt,
      seed
    FROM generations
    WHERE workspace_id = $workspace_id
    ORDER BY created_at DESC
    LIMIT $limit;
  `);

  const getGenerationByOutputStmt = db.prepare(`
    SELECT
      id,
      created_at,
      workspace_id,
      output_rel_path,
      output_mime,
      output_size,
      category,
      model_id,
      provider,
      endpoint,
      prompt,
      seed,
      payload_json
    FROM generations
    WHERE workspace_id = $workspace_id
      AND output_rel_path = $output_rel_path
    ORDER BY created_at DESC
    LIMIT 1;
  `);

  const listPromptsStmt = db.prepare(`
    SELECT
      id,
      created_at,
      workspace_id,
      tab,
      model_id,
      prompt
    FROM prompt_history
    WHERE ($workspace_id IS NULL OR workspace_id = $workspace_id)
    ORDER BY created_at DESC
    LIMIT $limit;
  `);

  return {
    dbPath: resolved,
    insertGeneration(input) {
      const id = input.id ?? crypto.randomUUID();
      const createdAt = input.createdAt ?? Date.now();
      insertGenerationStmt.run({
        id,
        created_at: createdAt,
        workspace_id: input.workspaceId,
        output_rel_path: input.outputRelPath,
        output_mime: input.outputMime ?? null,
        output_size: Number.isFinite(input.outputSize) ? input.outputSize : null,
        category: input.category ?? null,
        model_id: input.modelId ?? null,
        provider: input.provider ?? null,
        endpoint: input.endpoint ?? null,
        prompt: input.prompt ?? null,
        seed: input.seed ?? null,
      payload_json: input.payloadJson ?? null,
      });
      return { id, createdAt };
    },
    listGenerations({ workspaceId, limit = 50 }) {
      const safeLimit =
        typeof limit === "number" && Number.isFinite(limit)
          ? Math.max(1, Math.min(limit, 200))
          : 50;
      return listGenerationsStmt.all({
        workspace_id: workspaceId,
        limit: safeLimit,
      });
    },
    getGenerationByOutput({ workspaceId, outputRelPath }) {
      return (
        getGenerationByOutputStmt.get({
          workspace_id: workspaceId,
          output_rel_path: outputRelPath,
        }) ?? null
      );
    },
    upsertFile(input) {
      upsertFileStmt.run({
        workspace_id: input.workspaceId,
        rel_path: input.relPath,
        name: input.name,
        ext: input.ext ?? null,
        size: Number.isFinite(input.size) ? input.size : null,
        mtime: Number.isFinite(input.mtime) ? input.mtime : null,
        mime: input.mime ?? null,
        width: Number.isFinite(input.width) ? input.width : null,
        height: Number.isFinite(input.height) ? input.height : null,
        duration: Number.isFinite(input.duration) ? input.duration : null,
      });
    },
    updateFileDims(input) {
      updateFileDimsStmt.run({
        workspace_id: input.workspaceId,
        rel_path: input.relPath,
        width: Number.isFinite(input.width) ? input.width : null,
        height: Number.isFinite(input.height) ? input.height : null,
        duration: Number.isFinite(input.duration) ? input.duration : null,
      });
    },
    deletePathPrefix({ workspaceId, relPath }) {
      const escaped = relPath
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_");
      const prefix = `${escaped}/%`;
      deleteFilePrefixStmt.run({
        workspace_id: workspaceId,
        rel_path: relPath,
        prefix,
      });
      deleteGenerationsPrefixStmt.run({
        workspace_id: workspaceId,
        rel_path: relPath,
        prefix,
      });
    },
    listFiles({ workspaceId, limit = 50000, offset = 0 }) {
      const safeLimit =
        typeof limit === "number" && Number.isFinite(limit)
          ? Math.max(1, Math.min(limit, 50000))
          : 50000;
      const safeOffset =
        typeof offset === "number" && Number.isFinite(offset)
          ? Math.max(0, Math.min(offset, 50000))
          : 0;
      return listFilesStmt.all({
        workspace_id: workspaceId,
        limit: safeLimit,
        offset: safeOffset,
      });
    },
    insertPrompt(input) {
      const createdAt = input.createdAt ?? Date.now();
      insertPromptStmt.run({
        created_at: createdAt,
        workspace_id: input.workspaceId ?? null,
        tab: input.tab ?? null,
        model_id: input.modelId ?? null,
        prompt: input.prompt,
      });
      return { createdAt };
    },
    listPrompts({ workspaceId = null, limit = 50 }) {
      const safeLimit =
        typeof limit === "number" && Number.isFinite(limit)
          ? Math.max(1, Math.min(limit, 200))
          : 50;
      return listPromptsStmt.all({
        workspace_id: workspaceId,
        limit: safeLimit,
      });
    },
    transaction(fn) {
      db.exec("BEGIN");
      try {
        const result = fn();
        db.exec("COMMIT");
        return result;
      } catch (error) {
        try {
          db.exec("ROLLBACK");
        } catch {
          // ignore
        }
        throw error;
      }
    },
    close() {
      db.close();
    },
    _db: db,
  };
}
