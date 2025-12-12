import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import mime from "mime-types";
import dotenv from "dotenv";
import { createMetaDb } from "./meta-db.js";

// Load env files: .env.server overrides .env if both exist.
dotenv.config({
  path: path.resolve(process.cwd(), ".env.server"),
  override: true,
});
dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
  override: false,
});

const STORAGE_ROOT = path.resolve(
  process.env.FILE_STORAGE_ROOT ?? path.join(process.cwd(), "data")
);
const META_DB_PATH = path.resolve(
  process.env.FILE_META_DB_PATH ?? path.join(STORAGE_ROOT, "metadata.sqlite")
);

function isWorkspaceDirName(name) {
  return name && name !== "publish";
}

async function* walkFiles(rootDir, baseRel = "") {
  const dirents = await fs.readdir(rootDir, { withFileTypes: true });
  for (const dirent of dirents) {
    const relPath = baseRel ? `${baseRel}/${dirent.name}` : dirent.name;
    const fullPath = path.join(rootDir, dirent.name);
    if (dirent.isDirectory()) {
      yield* walkFiles(fullPath, relPath);
    } else if (dirent.isFile()) {
      yield { relPath, fullPath, name: dirent.name };
    }
  }
}

function categoryFromMime(mimeType) {
  if (typeof mimeType !== "string") return null;
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return null;
}

function backfillIdFor(workspaceId, relPath) {
  const hash = crypto
    .createHash("sha256")
    .update(`${workspaceId}:${relPath}`)
    .digest("hex")
    .slice(0, 20);
  return `backfill_${hash}`;
}

async function main() {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
  const metaDb = await createMetaDb(META_DB_PATH);

  const dirents = await fs.readdir(STORAGE_ROOT, { withFileTypes: true });
  const workspaces = dirents
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter(isWorkspaceDirName);
  if (!workspaces.includes("default")) {
    workspaces.unshift("default");
  }

  console.log(`Storage root: ${STORAGE_ROOT}`);
  console.log(`Metadata DB:  ${metaDb.dbPath}`);
  console.log(`Workspaces:   ${workspaces.join(", ") || "(none)"}`);

  let totalFiles = 0;
  let totalGenerations = 0;

  for (const workspaceId of workspaces) {
    const workspaceDir = path.join(STORAGE_ROOT, workspaceId);
    try {
      await fs.access(workspaceDir);
    } catch {
      continue;
    }

    let workspaceFiles = 0;
    let workspaceGenerations = 0;

    // Iterate outside transaction; we still batch commits per workspace via manual BEGIN/COMMIT.
    metaDb._db.exec("BEGIN");
    try {
      for await (const file of walkFiles(workspaceDir)) {
        const ext = (path.extname(file.relPath).replace(".", "") || "").toLowerCase();
        const mimeType = mime.lookup(ext) || "application/octet-stream";
        let stats;
        try {
          stats = await fs.stat(file.fullPath);
        } catch {
          continue;
        }
        metaDb.upsertFile({
          workspaceId,
          relPath: file.relPath,
          name: file.name,
          ext,
          size: stats.size,
          mtime: stats.mtimeMs,
          mime: mimeType,
        });
        workspaceFiles += 1;
        totalFiles += 1;

        const category = categoryFromMime(mimeType);
        if (category) {
          metaDb.insertGeneration({
            id: backfillIdFor(workspaceId, file.relPath),
            createdAt: stats.mtimeMs,
            workspaceId,
            outputRelPath: file.relPath,
            outputMime: mimeType,
            outputSize: stats.size,
            category,
            modelId: null,
            provider: null,
            endpoint: null,
            prompt: null,
            seed: null,
            payloadJson: null,
          });
          workspaceGenerations += 1;
          totalGenerations += 1;
        }
      }
      metaDb._db.exec("COMMIT");
    } catch (error) {
      metaDb._db.exec("ROLLBACK");
      throw error;
    }

    console.log(
      `✓ ${workspaceId}: indexed ${workspaceFiles} files, backfilled ${workspaceGenerations} generations`
    );
  }

  console.log(
    `Done. Indexed ${totalFiles} files; backfilled ${totalGenerations} generations.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
