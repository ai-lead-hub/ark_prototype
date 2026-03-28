import fs from "node:fs/promises";
import { constants as fsConstants, createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import crypto from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import mime from "mime-types";
import dotenv from "dotenv";
import { createMetaDb } from "./meta-db.js";

// Load env files with this priority:
// 1) Existing process environment (highest priority)
// 2) .env.server
// 3) .env
dotenv.config({
  path: path.resolve(process.cwd(), ".env.server"),
  override: false,
});
dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
  override: false,
});

const NODE_ENV = process.env.NODE_ENV ?? "development";

function parseBooleanEnv(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function parseIntegerEnv(value, fallback, { min, max } = {}) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (min !== undefined && parsed < min) return min;
  if (max !== undefined && parsed > max) return max;
  return parsed;
}

function buildCorsOriginResolver(raw) {
  const normalized = String(raw ?? "").trim();
  if (!normalized || normalized === "*") return true;
  const allowedOrigins = normalized
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (allowedOrigins.length <= 1) {
    return allowedOrigins[0] ?? false;
  }
  const allowed = new Set(allowedOrigins);
  return (origin, callback) => {
    if (!origin || allowed.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Not allowed by CORS"), false);
  };
}

const PORT = parseIntegerEnv(process.env.FILE_API_PORT, 8787, { min: 1, max: 65535 });
const STORAGE_ROOT = path.resolve(
  process.env.FILE_STORAGE_ROOT ?? path.join(process.cwd(), "data")
);
const META_DB_PATH = path.resolve(
  process.env.FILE_META_DB_PATH ?? path.join(STORAGE_ROOT, "metadata.sqlite")
);
const API_TOKEN = process.env.FILE_API_TOKEN;
const REQUIRE_TOKEN = parseBooleanEnv(
  process.env.FILE_API_REQUIRE_TOKEN,
  NODE_ENV === "production"
);
const CORS_ORIGIN_RAW = process.env.FILE_API_CORS_ORIGIN ?? "http://localhost:5173";
const CORS_ORIGIN = buildCorsOriginResolver(CORS_ORIGIN_RAW);
const MAX_SIZE_MB = parseIntegerEnv(process.env.FILE_MAX_SIZE_MB, 256, {
  min: 1,
  max: 4096,
});
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const CLEAR_TRASH_ON_START = parseBooleanEnv(
  process.env.FILE_TRASH_CLEAR_ON_START,
  false
);
const ENABLE_CLIENT_LOG_ENDPOINT = parseBooleanEnv(
  process.env.FILE_ENABLE_CLIENT_LOG_ENDPOINT,
  NODE_ENV !== "production"
);
const MAX_DEBUG_LOG_BYTES = parseIntegerEnv(
  process.env.FILE_MAX_DEBUG_LOG_BYTES,
  10 * 1024 * 1024,
  { min: 1024 * 1024, max: 200 * 1024 * 1024 }
);
const TRUST_PROXY = parseBooleanEnv(
  process.env.FILE_API_TRUST_PROXY,
  NODE_ENV === "production"
);
const REQUEST_TIMEOUT_MS = parseIntegerEnv(process.env.FILE_REQUEST_TIMEOUT_MS, 120000, {
  min: 10_000,
  max: 600_000,
});
const REQUIRE_META_DB = parseBooleanEnv(process.env.FILE_REQUIRE_META_DB, false);

if (REQUIRE_TOKEN && !API_TOKEN) {
  throw new Error(
    "FILE_API_TOKEN is required when FILE_API_REQUIRE_TOKEN is enabled."
  );
}

const server = Fastify({
  logger: true,
  bodyLimit: MAX_SIZE_BYTES,
  trustProxy: TRUST_PROXY,
  requestTimeout: REQUEST_TIMEOUT_MS,
});

await fs.mkdir(STORAGE_ROOT, { recursive: true });

// Empty trash on startup
const TRASH_DIR = path.join(STORAGE_ROOT, "_trash");
if (CLEAR_TRASH_ON_START) {
  try {
    await fs.rm(TRASH_DIR, { recursive: true, force: true });
    console.log("✓ Trash emptied");
  } catch {
    // Ignore if trash doesn't exist
  }
}

let metaDb = null;
try {
  metaDb = await createMetaDb(META_DB_PATH);
  console.log(`✓ Metadata DB: ${metaDb.dbPath}`);
} catch (error) {
  console.warn("⚠ Metadata DB disabled:", error?.message ?? error);
}

await server.register(cors, {
  origin: CORS_ORIGIN,
});

await server.register(multipart, {
  limits: { fileSize: MAX_SIZE_BYTES },
});

const API_ROUTES = [
  "/files",
  "/workspaces",
  "/publish",
  "/log",
  "/meta",
  "/elements",
  "/api/freepik",
];

function isApiPath(pathname) {
  return API_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isQueryTokenPathAllowed(pathname, method) {
  if (method !== "GET") return false;
  return pathname.startsWith("/files/") || pathname.startsWith("/elements/");
}

// Serve static frontend files in production
const distPath = path.resolve(process.cwd(), "dist");
try {
  await fs.access(distPath);
  const fastifyStatic = (await import("@fastify/static")).default;
  await server.register(fastifyStatic, {
    root: distPath,
    prefix: "/",
    decorateReply: false,
  });
  // SPA fallback - serve index.html for non-API routes
  server.setNotFoundHandler(async (request, reply) => {
    const pathname = request.url.split("?")[0];
    if (
      pathname === "/health" ||
      pathname === "/ready" ||
      isApiPath(pathname)
    ) {
      return reply.code(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html");
  });
  console.log("✓ Serving frontend from dist/");
} catch {
  console.log("ℹ No dist/ folder found, API-only mode");
}

server.addHook("onRequest", async (request, reply) => {
  // Get just the pathname (without query string)
  const pathname = request.url.split("?")[0];

  // Health endpoints are public
  if (pathname === "/health" || pathname === "/ready") return;

  // Skip auth for static files (non-API routes)  
  if (!isApiPath(pathname)) return;

  if (!API_TOKEN) return;
  const auth = request.headers.authorization;
  const expected = `Bearer ${API_TOKEN}`;
  const queryToken =
    request.query &&
      typeof request.query === "object" &&
      "token" in request.query &&
      typeof request.query.token === "string"
      ? request.query.token
      : undefined;
  if (auth === expected) return;
  if (queryToken === API_TOKEN && isQueryTokenPathAllowed(pathname, request.method)) {
    return;
  }
  return reply.code(401).send({ error: "Unauthorized" });
});

server.addHook("onSend", async (request, reply, payload) => {
  reply.header("X-Request-Id", request.id);
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
  return payload;
});

function sanitizeWorkspaceId(raw) {
  const value = (raw ?? "default").trim();
  if (!value) return "default";
  if (!/^[a-zA-Z0-9._\s-]+$/.test(value)) {
    throw new Error("Invalid workspace id");
  }
  return value;
}

function sanitizeRelPath(relPath) {
  const clean = path.normalize((relPath ?? "").trim()).replace(/^[/\\]+/, "");
  if (!clean || clean === "." || clean === ".." || clean.includes("..")) {
    throw new Error("Invalid path");
  }
  return clean;
}

async function ensureWorkspaceDir(workspaceId) {
  const dir = path.join(STORAGE_ROOT, workspaceId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function toSafePath(workspaceDir, relPath) {
  const baseDir = path.resolve(workspaceDir);
  const resolved = path.resolve(baseDir, relPath);
  if (resolved !== baseDir && !resolved.startsWith(`${baseDir}${path.sep}`)) {
    throw new Error("Path escapes workspace");
  }
  return resolved;
}

async function readTree(baseDir, baseRel = "") {
  const entries = [];
  const dirents = await fs.readdir(baseDir, { withFileTypes: true });
  for (const dirent of dirents) {
    // Skip hidden files and _trash folder
    if (dirent.name.startsWith(".") || dirent.name === "_trash") continue;
    const relPath = baseRel ? `${baseRel}/${dirent.name}` : dirent.name;
    const fullPath = path.join(baseDir, dirent.name);
    if (dirent.isDirectory()) {
      entries.push({
        id: relPath,
        name: dirent.name,
        relPath,
        kind: "dir",
        ext: "",
        size: 0,
        mtime: 0,
        mime: "",
      });
      const nested = await readTree(fullPath, relPath);
      entries.push(...nested);
    } else if (dirent.isFile()) {
      const stat = await fs.stat(fullPath);
      const ext = (dirent.name.split(".").pop() ?? "").toLowerCase();
      entries.push({
        id: relPath,
        name: dirent.name,
        relPath,
        kind: "file",
        ext,
        size: stat.size,
        mtime: stat.mtimeMs,
        mime: mime.lookup(ext) || "application/octet-stream",
      });
    }
  }
  return entries;
}

server.get("/health", async () => ({
  ok: true,
  uptimeSec: Math.floor(process.uptime()),
  timestamp: new Date().toISOString(),
}));

server.get("/ready", async (_request, reply) => {
  try {
    await fs.access(STORAGE_ROOT, fsConstants.W_OK);
  } catch {
    return reply.code(503).send({
      ok: false,
      reason: "Storage root is not writable.",
    });
  }

  if (REQUIRE_META_DB && !metaDb) {
    return reply.code(503).send({
      ok: false,
      reason: "Metadata DB unavailable (required).",
    });
  }

  return reply.send({ ok: true, metaDb: Boolean(metaDb) });
});

server.route({
  method: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  url: "/api/freepik/*",
  handler: async (request, reply) => {
    const wildcard = request.params["*"] ?? "";
    const search = request.url.includes("?")
      ? request.url.slice(request.url.indexOf("?"))
      : "";
    const target = new URL(`/${wildcard}${search}`, "https://api.freepik.com");

    const keyFromHeader = request.headers["x-freepik-api-key"];
    const resolvedKey =
      (typeof keyFromHeader === "string" && keyFromHeader.trim()) ||
      process.env.FREEPIK_API_KEY;
    if (!resolvedKey) {
      return reply.code(500).send({
        error: "Missing Freepik API key. Provide x-freepik-api-key or FREEPIK_API_KEY.",
      });
    }

    const contentTypeHeader = request.headers["content-type"];
    const contentType =
      typeof contentTypeHeader === "string"
        ? contentTypeHeader
        : Array.isArray(contentTypeHeader)
          ? contentTypeHeader[0]
          : undefined;

    const headers = {
      "x-freepik-api-key": resolvedKey,
      ...(contentType ? { "content-type": contentType } : {}),
    };

    const method = request.method.toUpperCase();
    const body =
      method === "GET" || method === "HEAD"
        ? undefined
        : request.body === undefined
          ? undefined
          : typeof request.body === "string"
            ? request.body
            : JSON.stringify(request.body);

    try {
      const upstreamResponse = await fetch(target.toString(), {
        method,
        headers,
        body,
      });

      const responseBuffer = Buffer.from(await upstreamResponse.arrayBuffer());
      const upstreamContentType = upstreamResponse.headers.get("content-type");
      if (upstreamContentType) {
        reply.header("Content-Type", upstreamContentType);
      }
      reply.code(upstreamResponse.status);
      return reply.send(responseBuffer);
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({ error: "Failed to reach Freepik upstream API." });
    }
  },
});

server.get("/workspaces", async () => {
  const internalDirs = new Set(["publish", "_trash", "_elements"]);
  const dirents = await fs.readdir(STORAGE_ROOT, { withFileTypes: true });
  const workspaces = dirents
    .filter((dirent) => dirent.isDirectory())
    .filter((dirent) => !dirent.name.startsWith("."))
    .filter((dirent) => !internalDirs.has(dirent.name))
    .map((dirent) => dirent.name);
  if (!workspaces.includes("default")) {
    workspaces.unshift("default");
  }
  return { workspaces };
});

server.post("/workspaces", async (request, reply) => {
  const { id } = (request.body ?? {});
  let workspaceId = id;
  if (!workspaceId) {
    workspaceId = crypto.randomUUID();
  }
  try {
    const safeId = sanitizeWorkspaceId(workspaceId);
    const dir = await ensureWorkspaceDir(safeId);
    return { workspaceId: safeId, basePath: dir };
  } catch (error) {
    reply.code(400).send({ error: error.message ?? "Invalid workspace id" });
  }
});

server.get("/files", async (request, reply) => {
  const workspaceId = (() => {
    try {
      return sanitizeWorkspaceId(request.query.workspace);
    } catch (error) {
      reply.code(400).send({ error: error.message ?? "Invalid workspace id" });
      return null;
    }
  })();
  if (!workspaceId) return;
  if (metaDb) {
    try {
      const limitRaw =
        request.query &&
          typeof request.query === "object" &&
          "limit" in request.query
          ? request.query.limit
          : undefined;
      const offsetRaw =
        request.query &&
          typeof request.query === "object" &&
          "offset" in request.query
          ? request.query.offset
          : undefined;
      const limitNum = Number(limitRaw);
      const offsetNum = Number(offsetRaw);
      const limit = Number.isFinite(limitNum) ? limitNum : 50000;
      const offset = Number.isFinite(offsetNum) ? offsetNum : 0;

      const rows = metaDb.listFiles({ workspaceId, limit, offset });
      if (rows.length) {
        const entries = rows.map((row) => ({
          id: row.rel_path,
          name: row.name,
          relPath: row.rel_path,
          kind: "file",
          ext: row.ext ?? "",
          size: row.size ?? 0,
          mtime: row.mtime ?? 0,
          mime: row.mime ?? "application/octet-stream",
          width: row.width ?? undefined,
          height: row.height ?? undefined,
          duration: row.duration ?? undefined,
        }));
        return { entries };
      }
    } catch (error) {
      request.log.error(error);
      // Fall through to filesystem listing
    }
  }

  const workspaceDir = await ensureWorkspaceDir(workspaceId);
  const entries = await readTree(workspaceDir);
  entries.sort((a, b) => b.mtime - a.mtime);
  return { entries };
});

server.get("/files/:workspace/*", async (request, reply) => {
  const { workspace, "*": wildcard } = request.params;
  let safeWorkspace = workspace;
  let relPath;
  try {
    safeWorkspace = sanitizeWorkspaceId(workspace);
    relPath = sanitizeRelPath(wildcard);
  } catch (error) {
    reply.code(400).send({ error: error.message ?? "Invalid path" });
    return;
  }
  const workspaceDir = await ensureWorkspaceDir(safeWorkspace);
  const absPath = toSafePath(workspaceDir, relPath);
  let stats;
  try {
    stats = await fs.stat(absPath);
    if (!stats.isFile()) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
  } catch {
    reply.code(404).send({ error: "Not found" });
    return;
  }

  const mimeType = mime.lookup(absPath) || "application/octet-stream";
  const isVideo = typeof mimeType === "string" && mimeType.startsWith("video/");
  const cacheControl = isVideo
    ? "no-store"
    : "private, max-age=0, must-revalidate";
  const range = request.headers.range;

  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (!match) {
      reply.code(416).send({ error: "Invalid range" });
      return;
    }
    const start = Number(match[1]);
    const endRaw = match[2] ? Number(match[2]) : stats.size - 1;
    const end = Math.min(endRaw, stats.size - 1);
    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start > end ||
      start < 0 ||
      start >= stats.size
    ) {
      reply.code(416).send({ error: "Invalid range" });
      return;
    }
    const chunkSize = end - start + 1;
    reply.code(206);
    reply.header("Content-Range", `bytes ${start}-${end}/${stats.size}`);
    reply.header("Accept-Ranges", "bytes");
    reply.header("Content-Length", chunkSize);
    reply.header("Content-Type", mimeType);
    reply.header("Cache-Control", cacheControl);
    return reply.send(createReadStream(absPath, { start, end }));
  }

  reply.header("Accept-Ranges", "bytes");
  reply.header("Content-Length", stats.size);
  reply.header("Content-Type", mimeType);
  reply.header("Cache-Control", cacheControl);
  return reply.send(createReadStream(absPath));
});

server.post("/files", async (request, reply) => {
  let workspaceId;
  let relPath;
  try {
    workspaceId = sanitizeWorkspaceId(request.query.workspace);
    relPath = sanitizeRelPath(request.query.path);
  } catch (error) {
    return reply.code(400).send({ error: error.message ?? "Invalid input" });
  }

  const parts = request.parts();
  let fileProcessed = false;
  let savedStats = null;
  let savedMime = null;

  try {
    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "file") {
        const workspaceDir = await ensureWorkspaceDir(workspaceId);
        const targetPath = toSafePath(workspaceDir, relPath);
        const targetDir = path.dirname(targetPath);
        await fs.mkdir(targetDir, { recursive: true });

        const writeStream = createWriteStream(targetPath);
        await pipeline(part.file, writeStream);

        const stats = await fs.stat(targetPath);
        const ext = (path.extname(relPath).replace(".", "") || "").toLowerCase();
        savedStats = stats;
        savedMime = mime.lookup(ext) || "application/octet-stream";
        fileProcessed = true;

        if (metaDb) {
          try {
            const name = path.basename(relPath);
            metaDb.upsertFile({
              workspaceId,
              relPath,
              name,
              ext,
              size: stats.size,
              mtime: stats.mtimeMs,
              mime: savedMime,
            });
          } catch (error) {
            request.log.warn(error, "Failed to update file index");
          }
        }
      } else if (part.type === "file") {
        // Drain unknown file fields to avoid hanging multipart processing.
        part.file.resume();
      }
    }
  } catch (error) {
    return reply.code(500).send({ error: error.message ?? "Failed to save file" });
  }

  if (!fileProcessed) {
    return reply.code(400).send({ error: "Missing file or path" });
  }

  return reply.send({
    workspaceId,
    relPath,
    size: savedStats.size,
    mime: savedMime,
  });
});

server.delete("/files", async (request, reply) => {
  let { workspace, path: relPath } = request.body ?? {};
  try {
    workspace = sanitizeWorkspaceId(workspace);
    relPath = sanitizeRelPath(relPath);
  } catch (error) {
    reply.code(400).send({ error: error.message ?? "Invalid input" });
    return;
  }
  const workspaceDir = await ensureWorkspaceDir(workspace);
  const targetPath = toSafePath(workspaceDir, relPath);
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
    if (metaDb) {
      try {
        metaDb.deletePathPrefix({ workspaceId: workspace, relPath });
      } catch (error) {
        request.log.warn(error, "Failed to update file index on delete");
      }
    }
    reply.send({ ok: true });
  } catch {
    reply.code(404).send({ error: "Not found" });
  }
});

// Move files to trash instead of permanent deletion
server.post("/files/trash", async (request, reply) => {
  const { workspace, paths } = request.body ?? {};

  if (!Array.isArray(paths) || paths.length === 0) {
    return reply.code(400).send({ error: "Missing or empty paths array" });
  }

  let safeWorkspace;
  try {
    safeWorkspace = sanitizeWorkspaceId(workspace);
  } catch (error) {
    return reply.code(400).send({ error: error.message ?? "Invalid workspace" });
  }

  const workspaceDir = await ensureWorkspaceDir(safeWorkspace);
  const trashWorkspaceDir = path.join(TRASH_DIR, safeWorkspace);
  await fs.mkdir(trashWorkspaceDir, { recursive: true });

  const results = { success: [], failed: [] };

  for (const relPath of paths) {
    try {
      const safePath = sanitizeRelPath(relPath);
      const sourcePath = toSafePath(workspaceDir, safePath);
      const trashPath = path.join(trashWorkspaceDir, safePath);
      const trashDir = path.dirname(trashPath);

      // Ensure trash subdirectory exists
      await fs.mkdir(trashDir, { recursive: true });

      // Move file to trash
      await fs.rename(sourcePath, trashPath);

      // Update metadata DB
      if (metaDb) {
        try {
          metaDb.deletePathPrefix({ workspaceId: safeWorkspace, relPath: safePath });
        } catch (error) {
          request.log.warn(error, "Failed to update file index on trash");
        }
      }

      results.success.push(relPath);
    } catch (error) {
      results.failed.push({ path: relPath, error: error.message ?? "Unknown error" });
    }
  }

  return reply.send(results);
});

server.patch("/files", async (request, reply) => {
  let { workspace, path: relPath, newPath } = request.body ?? {};
  try {
    workspace = sanitizeWorkspaceId(workspace);
    relPath = sanitizeRelPath(relPath);
    newPath = sanitizeRelPath(newPath);
  } catch (error) {
    reply.code(400).send({ error: error.message ?? "Invalid input" });
    return;
  }

  const workspaceDir = await ensureWorkspaceDir(workspace);
  const oldFullPath = toSafePath(workspaceDir, relPath);
  const newFullPath = toSafePath(workspaceDir, newPath);

  try {
    await fs.rename(oldFullPath, newFullPath);
    if (metaDb) {
      try {
        const stats = await fs.stat(newFullPath);
        const ext = (path.extname(newPath).replace(".", "") || "").toLowerCase();
        const mimeType = mime.lookup(ext) || "application/octet-stream";
        metaDb.deletePathPrefix({ workspaceId: workspace, relPath });
        metaDb.upsertFile({
          workspaceId: workspace,
          relPath: newPath,
          name: path.basename(newPath),
          ext,
          size: stats.size,
          mtime: stats.mtimeMs,
          mime: mimeType,
        });
      } catch (error) {
        request.log.warn(error, "Failed to update file index on rename");
      }
    }
    reply.send({ ok: true });
  } catch (error) {
    reply.code(500).send({ error: error.message ?? "Rename failed" });
  }
});

// Sanitize publish metadata fields to prevent path traversal
function sanitizeMetadataField(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing or invalid ${fieldName}`);
  }
  const clean = value.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(clean)) {
    throw new Error(`Invalid ${fieldName}: only alphanumeric, underscore, and hyphen allowed`);
  }
  if (clean.length > 50) {
    throw new Error(`${fieldName} too long (max 50 characters)`);
  }
  return clean;
}

const DEBUG_LOG_PATH = path.join(process.cwd(), "debug.log");

async function appendDebugLog(entry) {
  try {
    const stat = await fs.stat(DEBUG_LOG_PATH);
    if (stat.size >= MAX_DEBUG_LOG_BYTES) {
      const rotated = `${DEBUG_LOG_PATH}.1`;
      await fs.rm(rotated, { force: true }).catch(() => {});
      await fs.rename(DEBUG_LOG_PATH, rotated);
    }
  } catch {
    // File does not exist yet or cannot be stat'd; append will handle creation/failure.
  }
  await fs.appendFile(DEBUG_LOG_PATH, entry);
}

server.post("/publish", async (request, reply) => {
  let { workspace, path: relPath, project, sequence, shot, version } = request.body ?? {};

  try {
    workspace = sanitizeWorkspaceId(workspace);
    relPath = sanitizeRelPath(relPath);
    project = sanitizeMetadataField(project, "project");
    sequence = sanitizeMetadataField(sequence, "sequence");
    shot = sanitizeMetadataField(shot, "shot");
    version = sanitizeMetadataField(version, "version");
  } catch (error) {
    reply.code(400).send({ error: error.message ?? "Invalid input" });
    return;
  }

  const workspaceDir = await ensureWorkspaceDir(workspace);
  const sourcePath = toSafePath(workspaceDir, relPath);

  // Construct destination path: publish/{workspace}/{project}_{sequence}_{shot}_v{version}.{ext}
  const ext = path.extname(relPath);
  const fileName = `${project}_${sequence}_${shot}_v${version}${ext}`;
  const publishDir = path.join(STORAGE_ROOT, "publish", workspace);
  const destPath = path.join(publishDir, fileName);

  try {
    // Ensure source exists
    await fs.access(sourcePath);

    // Ensure publish dir exists
    await fs.mkdir(publishDir, { recursive: true });

    // Copy file
    await fs.copyFile(sourcePath, destPath);

    reply.send({ ok: true, publishedPath: `publish/${workspace}/${fileName}` });
  } catch (error) {
    reply.code(500).send({ error: error.message ?? "Publish failed" });
  }
});

server.post("/log", async (request, reply) => {
  if (!ENABLE_CLIENT_LOG_ENDPOINT) {
    return reply.code(404).send({ error: "Not found" });
  }

  const { message, level = "info", data } = request.body ?? {};
  const safeMessage =
    typeof message === "string" && message.trim()
      ? message.slice(0, 2000)
      : "No message";
  const safeLevel = typeof level === "string" ? level.slice(0, 24) : "info";
  const timestamp = new Date().toISOString();
  const serializedData = data ? JSON.stringify(data).slice(0, 20000) : "";
  const logEntry = `[${timestamp}] [${safeLevel.toUpperCase()}] ${safeMessage} ${serializedData}\n`;

  try {
    await appendDebugLog(logEntry);
    return { ok: true };
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: "Failed to write log" });
  }
});

server.get("/meta/health", async () => ({
  ok: Boolean(metaDb),
  dbPath: metaDb?.dbPath ?? null,
}));

server.post("/meta/files", async (request, reply) => {
  if (!metaDb) return reply.code(503).send({ error: "Metadata DB unavailable" });
  const body = request.body ?? {};

  let workspaceId;
  let relPath;
  try {
    workspaceId = sanitizeWorkspaceId(body.workspace ?? body.workspaceId);
    relPath = sanitizeRelPath(body.relPath ?? body.path);
  } catch (error) {
    return reply.code(400).send({ error: error.message ?? "Invalid input" });
  }

  const width = typeof body.width === "number" ? body.width : undefined;
  const height = typeof body.height === "number" ? body.height : undefined;
  const duration = typeof body.duration === "number" ? body.duration : undefined;

  const workspaceDir = await ensureWorkspaceDir(workspaceId);
  const absPath = toSafePath(workspaceDir, relPath);
  let stats;
  try {
    stats = await fs.stat(absPath);
    if (!stats.isFile()) {
      return reply.code(404).send({ error: "Not found" });
    }
  } catch {
    return reply.code(404).send({ error: "Not found" });
  }

  const ext = (path.extname(relPath).replace(".", "") || "").toLowerCase();
  const mimeType = mime.lookup(ext) || "application/octet-stream";

  try {
    metaDb.upsertFile({
      workspaceId,
      relPath,
      name: path.basename(relPath),
      ext,
      size: stats.size,
      mtime: stats.mtimeMs,
      mime: mimeType,
      width,
      height,
      duration,
    });
    return reply.send({ ok: true });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: "Failed to update file metadata" });
  }
});

server.post("/meta/generations", async (request, reply) => {
  if (!metaDb) return reply.code(503).send({ error: "Metadata DB unavailable" });
  const body = request.body ?? {};
  let workspaceId;
  let outputRelPath;
  try {
    workspaceId = sanitizeWorkspaceId(body.workspace ?? body.workspaceId);
    outputRelPath = sanitizeRelPath(body.outputRelPath ?? body.output?.relPath);
  } catch (error) {
    return reply.code(400).send({ error: error.message ?? "Invalid input" });
  }

  const category = body.category;
  const safeCategory =
    category === "image" || category === "video" || category === "upscale"
      ? category
      : null;

  const prompt =
    typeof body.prompt === "string" && body.prompt.trim()
      ? body.prompt.slice(0, 50_000)
      : null;

  const payloadJson =
    body.payload !== undefined ? JSON.stringify(body.payload).slice(0, 1_000_000) : null;

  try {
    const result = metaDb.insertGeneration({
      workspaceId,
      outputRelPath,
      outputMime:
        typeof body.outputMime === "string"
          ? body.outputMime
          : typeof body.output?.mime === "string"
            ? body.output.mime
            : null,
      outputSize:
        typeof body.outputSize === "number"
          ? body.outputSize
          : typeof body.output?.size === "number"
            ? body.output.size
            : null,
      category: safeCategory,
      modelId: typeof body.modelId === "string" ? body.modelId : null,
      provider: typeof body.provider === "string" ? body.provider : null,
      endpoint: typeof body.endpoint === "string" ? body.endpoint : null,
      prompt,
      seed: body.seed !== undefined ? String(body.seed) : null,
      payloadJson,
    });
    return reply.send({ ok: true, id: result.id, createdAt: result.createdAt });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: "Failed to write generation metadata" });
  }
});

server.get("/meta/generations", async (request, reply) => {
  if (!metaDb) return reply.code(503).send({ error: "Metadata DB unavailable" });
  const workspaceRaw =
    request.query &&
      typeof request.query === "object" &&
      "workspace" in request.query
      ? request.query.workspace
      : undefined;
  const limitRaw =
    request.query &&
      typeof request.query === "object" &&
      "limit" in request.query
      ? request.query.limit
      : undefined;

  let workspaceId;
  try {
    workspaceId = sanitizeWorkspaceId(workspaceRaw);
  } catch (error) {
    return reply.code(400).send({ error: error.message ?? "Invalid workspace" });
  }

  const limitNum = Number(limitRaw);
  const limit = Number.isFinite(limitNum) ? limitNum : 50;

  try {
    const rows = metaDb.listGenerations({ workspaceId, limit });
    return reply.send({ entries: rows });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: "Failed to list generation metadata" });
  }
});

server.get("/meta/generations/by-output", async (request, reply) => {
  if (!metaDb) return reply.code(503).send({ error: "Metadata DB unavailable" });
  const workspaceRaw =
    request.query &&
      typeof request.query === "object" &&
      "workspace" in request.query
      ? request.query.workspace
      : undefined;
  const pathRaw =
    request.query &&
      typeof request.query === "object" &&
      "path" in request.query
      ? request.query.path
      : undefined;

  let workspaceId;
  let outputRelPath;
  try {
    workspaceId = sanitizeWorkspaceId(workspaceRaw);
    outputRelPath = sanitizeRelPath(pathRaw);
  } catch (error) {
    return reply.code(400).send({ error: error.message ?? "Invalid input" });
  }

  try {
    const row = metaDb.getGenerationByOutput({ workspaceId, outputRelPath });
    if (!row) {
      return reply.send({ entry: null });
    }
    const { payload_json: payloadJsonRaw, ...rest } = row;
    let payload = null;
    if (typeof payloadJsonRaw === "string" && payloadJsonRaw.trim()) {
      try {
        payload = JSON.parse(payloadJsonRaw);
      } catch {
        payload = payloadJsonRaw;
      }
    }
    return reply.send({ entry: { ...rest, payload } });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: "Failed to fetch generation metadata" });
  }
});

server.post("/meta/prompts", async (request, reply) => {
  if (!metaDb) return reply.code(503).send({ error: "Metadata DB unavailable" });
  const body = request.body ?? {};

  const prompt =
    typeof body.prompt === "string" && body.prompt.trim()
      ? body.prompt.slice(0, 50_000)
      : null;
  if (!prompt) return reply.code(400).send({ error: "Missing prompt" });

  let workspaceId = null;
  try {
    if (body.workspace ?? body.workspaceId) {
      workspaceId = sanitizeWorkspaceId(body.workspace ?? body.workspaceId);
    }
  } catch (error) {
    return reply.code(400).send({ error: error.message ?? "Invalid workspace" });
  }

  const tab = body.tab === "image" || body.tab === "video" ? body.tab : null;

  try {
    const result = metaDb.insertPrompt({
      workspaceId,
      tab,
      modelId: typeof body.modelId === "string" ? body.modelId : null,
      prompt,
    });
    return reply.send({ ok: true, createdAt: result.createdAt });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: "Failed to write prompt history" });
  }
});

server.get("/meta/prompts", async (request, reply) => {
  if (!metaDb) return reply.code(503).send({ error: "Metadata DB unavailable" });
  const workspaceRaw =
    request.query &&
      typeof request.query === "object" &&
      "workspace" in request.query
      ? request.query.workspace
      : undefined;
  const limitRaw =
    request.query &&
      typeof request.query === "object" &&
      "limit" in request.query
      ? request.query.limit
      : undefined;

  let workspaceId = null;
  if (workspaceRaw !== undefined) {
    try {
      workspaceId = sanitizeWorkspaceId(workspaceRaw);
    } catch (error) {
      return reply.code(400).send({ error: error.message ?? "Invalid workspace" });
    }
  }

  const limitNum = Number(limitRaw);
  const limit = Number.isFinite(limitNum) ? limitNum : 50;

  try {
    const entries = metaDb.listPrompts({ workspaceId, limit });
    return reply.send({ entries });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: "Failed to list prompt history" });
  }
});

// Pins API endpoints
server.get("/meta/pins", async (request, reply) => {
  if (!metaDb) return reply.code(503).send({ error: "Metadata DB unavailable" });
  const workspaceRaw =
    request.query &&
      typeof request.query === "object" &&
      "workspace" in request.query
      ? request.query.workspace
      : undefined;

  let workspaceId;
  try {
    workspaceId = sanitizeWorkspaceId(workspaceRaw);
  } catch (error) {
    return reply.code(400).send({ error: error.message ?? "Invalid workspace" });
  }

  try {
    const pins = metaDb.listPins({ workspaceId });
    return reply.send({ pins });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: "Failed to list pins" });
  }
});

server.post("/meta/pins", async (request, reply) => {
  if (!metaDb) return reply.code(503).send({ error: "Metadata DB unavailable" });
  const body = request.body ?? {};

  let workspaceId;
  let relPath;
  try {
    workspaceId = sanitizeWorkspaceId(body.workspace ?? body.workspaceId);
    relPath = sanitizeRelPath(body.relPath ?? body.path);
  } catch (error) {
    return reply.code(400).send({ error: error.message ?? "Invalid input" });
  }

  const pinnedAt = typeof body.pinnedAt === "number" ? body.pinnedAt : Date.now();

  try {
    metaDb.setPin({ workspaceId, relPath, pinnedAt });
    return reply.send({ ok: true, pinnedAt });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: "Failed to set pin" });
  }
});

server.delete("/meta/pins", async (request, reply) => {
  if (!metaDb) return reply.code(503).send({ error: "Metadata DB unavailable" });
  const body = request.body ?? {};

  let workspaceId;
  let relPath;
  try {
    workspaceId = sanitizeWorkspaceId(body.workspace ?? body.workspaceId);
    relPath = sanitizeRelPath(body.relPath ?? body.path);
  } catch (error) {
    return reply.code(400).send({ error: error.message ?? "Invalid input" });
  }

  try {
    metaDb.removePin({ workspaceId, relPath });
    return reply.send({ ok: true });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: "Failed to remove pin" });
  }
});

server.patch("/meta/pins", async (request, reply) => {
  if (!metaDb) return reply.code(503).send({ error: "Metadata DB unavailable" });
  const body = request.body ?? {};

  let workspaceId;
  let oldRelPath;
  let newRelPath;
  try {
    workspaceId = sanitizeWorkspaceId(body.workspace ?? body.workspaceId);
    oldRelPath = sanitizeRelPath(body.oldPath ?? body.oldRelPath);
    newRelPath = sanitizeRelPath(body.newPath ?? body.newRelPath);
  } catch (error) {
    return reply.code(400).send({ error: error.message ?? "Invalid input" });
  }

  try {
    metaDb.renamePin({ workspaceId, oldRelPath, newRelPath });
    return reply.send({ ok: true });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: "Failed to rename pin" });
  }
});

// ============================================================
// ELEMENTS API - Global elements storage outside workspaces
// ============================================================

const ELEMENTS_DIR = path.join(STORAGE_ROOT, "_elements");
const ELEMENTS_JSON = path.join(ELEMENTS_DIR, "elements.json");

// Ensure elements directory exists
await fs.mkdir(ELEMENTS_DIR, { recursive: true });

// Load elements from JSON file
async function loadElements() {
  try {
    const data = await fs.readFile(ELEMENTS_JSON, "utf-8");
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((element) => {
      if (!element || typeof element !== "object") return element;
      const { videoReferenceUrl: _removedVideoReferenceUrl, ...rest } = element;
      return rest;
    });
  } catch {
    return [];
  }
}

// Save elements to JSON file
async function saveElements(elements) {
  await fs.writeFile(ELEMENTS_JSON, JSON.stringify(elements, null, 2));
}

// Get file extension from filename
function getExtension(filename) {
  return path.extname(filename).toLowerCase();
}

// List all elements
server.get("/elements", async () => {
  const elements = await loadElements();
  return { elements };
});

// Create new element
server.post("/elements", async (request, reply) => {
  const parts = request.parts();
  const elementId = crypto.randomUUID();
  const elementDir = path.join(ELEMENTS_DIR, elementId);
  await fs.mkdir(elementDir, { recursive: true });

  let name = "";
  let frontalImageUrl = "";
  const referenceImageUrls = [];
  let characterSheetUrl = "";

  try {
    for await (const part of parts) {
      if (part.type === "field" && part.fieldname === "name") {
        name = part.value.trim();
        continue;
      }

      if (part.type === "file") {
        const ext = getExtension(part.filename);
        let targetName = "";

        if (part.fieldname === "frontalImage") {
          targetName = `frontal${ext}`;
          frontalImageUrl = `/elements/${elementId}/files/${targetName}`;
        } else if (part.fieldname.startsWith("referenceImage_")) {
          const index = part.fieldname.split("_")[1];
          targetName = `ref_${index}${ext}`;
          referenceImageUrls.push(`/elements/${elementId}/files/${targetName}`);
        } else if (part.fieldname === "characterSheet") {
          targetName = `sheet${ext}`;
          characterSheetUrl = `/elements/${elementId}/files/${targetName}`;
        }

        if (targetName) {
          const targetPath = path.join(elementDir, targetName);
          const writeStream = createWriteStream(targetPath);
          await pipeline(part.file, writeStream);
        } else {
          // Drain unknown file fields so multipart processing can continue safely.
          part.file.resume();
        }
      }
    }

    if (!name) {
      await fs.rm(elementDir, { recursive: true, force: true });
      return reply.code(400).send({ error: "Name is required" });
    }

    if (!frontalImageUrl) {
      await fs.rm(elementDir, { recursive: true, force: true });
      return reply.code(400).send({ error: "Frontal image is required" });
    }

    const now = Date.now();
    const element = {
      id: elementId,
      name,
      frontalImageUrl,
      referenceImageUrls,
      characterSheetUrl: characterSheetUrl || undefined,
      createdAt: now,
      updatedAt: now,
    };

    const elements = await loadElements();
    elements.unshift(element);
    await saveElements(elements);

    return reply.send({ element });
  } catch (error) {
    await fs.rm(elementDir, { recursive: true, force: true }).catch(() => { });
    request.log.error(error);
    return reply.code(500).send({ error: error.message ?? "Failed to create element" });
  }
});

// Delete element
server.patch("/elements/:id", async (request, reply) => {
  const { id } = request.params;
  const { name } = request.body ?? {};

  if (!id || !/^[a-f0-9-]+$/i.test(id)) {
    return reply.code(400).send({ error: "Invalid element ID" });
  }

  if (typeof name !== "string" || !name.trim()) {
    return reply.code(400).send({ error: "Name is required" });
  }

  try {
    const elements = await loadElements();
    const index = elements.findIndex((el) => el.id === id);

    if (index === -1) {
      return reply.code(404).send({ error: "Element not found" });
    }

    const existing = elements[index];
    const updated = {
      ...existing,
      name: name.trim(),
      updatedAt: Date.now(),
    };

    elements[index] = updated;
    await saveElements(elements);

    return reply.send({ element: updated });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: error.message ?? "Failed to update element" });
  }
});

// Delete element
server.delete("/elements/:id", async (request, reply) => {
  const { id } = request.params;

  if (!id || !/^[a-f0-9-]+$/i.test(id)) {
    return reply.code(400).send({ error: "Invalid element ID" });
  }

  try {
    const elements = await loadElements();
    const index = elements.findIndex((el) => el.id === id);

    if (index === -1) {
      return reply.code(404).send({ error: "Element not found" });
    }

    // Remove from list
    elements.splice(index, 1);
    await saveElements(elements);

    // Delete files
    const elementDir = path.join(ELEMENTS_DIR, id);
    await fs.rm(elementDir, { recursive: true, force: true });

    return reply.send({ ok: true });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: error.message ?? "Failed to delete element" });
  }
});

// Serve element files
server.get("/elements/:id/files/*", async (request, reply) => {
  const { id, "*": filename } = request.params;

  if (!id || !/^[a-f0-9-]+$/i.test(id)) {
    return reply.code(400).send({ error: "Invalid element ID" });
  }

  if (!filename) {
    return reply.code(400).send({ error: "Invalid filename" });
  }

  let safeFilename;
  try {
    safeFilename = sanitizeRelPath(filename);
  } catch {
    return reply.code(400).send({ error: "Invalid filename" });
  }

  const elementDir = path.join(ELEMENTS_DIR, id);
  const filePath = toSafePath(elementDir, safeFilename);

  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return reply.code(404).send({ error: "Not found" });
    }

    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    reply.header("Content-Type", mimeType);
    reply.header("Content-Length", stats.size);
    reply.header("Cache-Control", "private, max-age=86400");
    return reply.send(createReadStream(filePath));
  } catch {
    return reply.code(404).send({ error: "Not found" });
  }
});

// Startup validation and logging
const startServer = async () => {
  try {
    await server.listen({ port: PORT, host: "0.0.0.0" });

    // Log startup info
    console.log(`\n${"=".repeat(50)}`);
    console.log("  AI Asset Studio - File API Server");
    console.log(`${"=".repeat(50)}`);
    console.log(`  ✓ Port:          ${PORT}`);
    console.log(`  ✓ Storage:       ${STORAGE_ROOT}`);
    console.log(`  ✓ Auth:          ${API_TOKEN ? "enabled" : "disabled"}`);
    console.log(`  ✓ Token required:${REQUIRE_TOKEN ? "yes" : "no"}`);
    console.log(`  ✓ CORS:          ${CORS_ORIGIN_RAW}`);
    console.log(`  ✓ Max file size: ${MAX_SIZE_MB}MB`);
    console.log(`  ✓ Request timeout: ${REQUEST_TIMEOUT_MS}ms`);
    console.log(`  ✓ Trust proxy:   ${TRUST_PROXY ? "enabled" : "disabled"}`);
    console.log(`  ✓ Client logs:   ${ENABLE_CLIENT_LOG_ENDPOINT ? "enabled" : "disabled"}`);
    console.log(`  ✓ Trash clear on start: ${CLEAR_TRASH_ON_START ? "enabled" : "disabled"}`);
    console.log(`  ✓ Require meta DB: ${REQUIRE_META_DB ? "yes" : "no"}`);
    console.log(`${"=".repeat(50)}\n`);
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

// Graceful shutdown
let isShuttingDown = false;
const shutdown = async (signal) => {
  if (isShuttingDown) {
    console.log("Force exiting...");
    process.exit(1);
  }
  isShuttingDown = true;
  console.log(`\n${signal} received, shutting down gracefully...`);

  // Force exit after 5 seconds if close hangs
  const forceExitTimeout = setTimeout(() => {
    console.log("Server close timed out, forcing exit...");
    process.exit(1);
  }, 5000);
  forceExitTimeout.unref();

  try {
    await server.close();
    if (metaDb) {
      try {
        metaDb.close();
      } catch (error) {
        console.warn("Failed to close metadata DB cleanly:", error);
      }
    }
    clearTimeout(forceExitTimeout);
    console.log("Server closed successfully.");
    process.exit(0);
  } catch (error) {
    clearTimeout(forceExitTimeout);
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startServer();
