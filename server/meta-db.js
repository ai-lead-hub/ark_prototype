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
    INSERT INTO generations (
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
  };
}

