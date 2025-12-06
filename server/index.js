import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import crypto from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import mime from "mime-types";
import dotenv from "dotenv";

// Load env files: .env.server overrides .env if both exist.
dotenv.config({
  path: path.resolve(process.cwd(), ".env.server"),
  override: true,
});
dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
  override: false,
});

const PORT = Number(process.env.FILE_API_PORT ?? 8787);
const STORAGE_ROOT = path.resolve(
  process.env.FILE_STORAGE_ROOT ?? path.join(process.cwd(), "data")
);
const API_TOKEN = process.env.FILE_API_TOKEN;
const CORS_ORIGIN = process.env.FILE_API_CORS_ORIGIN ?? "http://localhost:5173";
const MAX_SIZE_MB = Number(process.env.FILE_MAX_SIZE_MB ?? 1024);
const MAX_SIZE_BYTES = Math.max(1, MAX_SIZE_MB) * 1024 * 1024;

const server = Fastify({
  logger: true,
  bodyLimit: MAX_SIZE_BYTES,
});

await fs.mkdir(STORAGE_ROOT, { recursive: true });

await server.register(cors, {
  origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN,
});

await server.register(multipart, {
  limits: { fileSize: MAX_SIZE_BYTES },
});

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
    if (request.url.startsWith("/files") || request.url.startsWith("/health") ||
      request.url.startsWith("/workspaces") || request.url.startsWith("/publish") ||
      request.url.startsWith("/log")) {
      return reply.code(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html");
  });
  console.log("✓ Serving frontend from dist/");
} catch {
  console.log("ℹ No dist/ folder found, API-only mode");
}

// API routes that require auth
const API_ROUTES = ["/files", "/workspaces", "/publish", "/log"];

server.addHook("onRequest", async (request, reply) => {
  // Get just the pathname (without query string)
  const pathname = request.url.split("?")[0];

  // Health endpoint is public
  if (pathname === "/health") return;

  // Skip auth for static files (non-API routes)  
  const isApiRoute = API_ROUTES.some(route => pathname.startsWith(route));
  if (!isApiRoute) return;

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
  if (auth === expected || queryToken === API_TOKEN) return;
  return reply.code(401).send({ error: "Unauthorized" });
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
  const resolved = path.resolve(workspaceDir, relPath);
  if (!resolved.startsWith(workspaceDir)) {
    throw new Error("Path escapes workspace");
  }
  return resolved;
}

async function readTree(baseDir, baseRel = "") {
  const entries = [];
  const dirents = await fs.readdir(baseDir, { withFileTypes: true });
  for (const dirent of dirents) {
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

server.get("/health", async () => ({ ok: true }));

server.get("/workspaces", async () => {
  const dirents = await fs.readdir(STORAGE_ROOT, { withFileTypes: true });
  const workspaces = dirents
    .filter((dirent) => dirent.isDirectory())
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
  const range = request.headers.range;

  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (!match) {
      reply.code(416).send({ error: "Invalid range" });
      return;
    }
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : stats.size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
      reply.code(416).send({ error: "Invalid range" });
      return;
    }
    const chunkSize = end - start + 1;
    reply.code(206);
    reply.header("Content-Range", `bytes ${start}-${end}/${stats.size}`);
    reply.header("Accept-Ranges", "bytes");
    reply.header("Content-Length", chunkSize);
    reply.header("Content-Type", mimeType);
    return reply.send(createReadStream(absPath, { start, end }));
  }

  reply.header("Accept-Ranges", "bytes");
  reply.header("Content-Length", stats.size);
  reply.header("Content-Type", mimeType);
  return reply.send(createReadStream(absPath));
});

server.post("/files", async (request, reply) => {
  const parts = request.parts();
  let workspaceId = request.query.workspace || "default";
  let relPath = request.query.path;
  let fileProcessed = false;
  let savedStats = null;
  let savedMime = null;

  try {
    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "file") {
        if (!relPath) {
          // If path wasn't in query, we can't save yet.
          // But we must consume the stream to avoid hanging.
          await part.toBuffer();
          continue;
        }

        try {
          workspaceId = sanitizeWorkspaceId(workspaceId);
          relPath = sanitizeRelPath(relPath);
        } catch (error) {
          throw new Error(error.message ?? "Invalid input");
        }

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
      } else {
        // Handle fields if needed, but we prefer query params now
        if (part.type === "field") {
          if (part.fieldname === "workspace") workspaceId = part.value;
          if (part.fieldname === "path") relPath = part.value;
        }
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
    reply.send({ ok: true });
  } catch {
    reply.code(404).send({ error: "Not found" });
  }
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
  const { message, level = "info", data } = request.body ?? {};
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message} ${data ? JSON.stringify(data) : ""}\n`;

  try {
    await fs.appendFile(path.join(process.cwd(), "debug.log"), logEntry);
    return { ok: true };
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: "Failed to write log" });
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
    console.log(`  ✓ Auth:          ${API_TOKEN ? "enabled" : "disabled (no token set)"}`);
    console.log(`  ✓ CORS:          ${CORS_ORIGIN}`);
    console.log(`  ✓ Max file size: ${MAX_SIZE_MB}MB`);
    console.log(`${"=".repeat(50)}\n`);
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  try {
    await server.close();
    console.log("Server closed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startServer();
