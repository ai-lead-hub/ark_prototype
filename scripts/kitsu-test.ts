/**
 * Kitsu API integration test script
 *
 * Usage:
 *   npx tsx scripts/kitsu-test.ts
 *
 * Env vars (set in .env.local or export before running):
 *   KITSU_BASE_URL  - e.g. https://your-instance.kitsu.cloud/api
 *   KITSU_EMAIL     - login email
 *   KITSU_PASSWORD  - login password
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const BASE = process.env.KITSU_BASE_URL?.replace(/\/+$/, "");
const EMAIL = process.env.KITSU_EMAIL;
const PASSWORD = process.env.KITSU_PASSWORD;

if (!BASE || !EMAIL || !PASSWORD) {
  console.error(
    "Missing env vars. Set KITSU_BASE_URL, KITSU_EMAIL, KITSU_PASSWORD in .env.local"
  );
  process.exit(1);
}

// ── helpers ──────────────────────────────────────────────────────────

async function kitsuFetch(path: string, token: string, params?: Record<string, string>) {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

function printTable(label: string, items: Record<string, unknown>[], cols: string[]) {
  console.log(`\n── ${label} (${items.length}) ──`);
  if (items.length === 0) {
    console.log("  (none)");
    return;
  }
  for (const item of items.slice(0, 20)) {
    const row = cols.map((c) => `${c}=${item[c] ?? "-"}`).join("  ");
    console.log(`  ${row}`);
  }
  if (items.length > 20) console.log(`  ... and ${items.length - 20} more`);
}

// ── tests ────────────────────────────────────────────────────────────

async function login(): Promise<string> {
  console.log(`\n[1] POST /auth/login (${EMAIL} @ ${BASE})`);
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  const token = data.access_token ?? data.login?.access_token;
  if (!token) {
    console.log("  Full response:", JSON.stringify(data, null, 2));
    throw new Error("No access_token in login response");
  }
  console.log(`  OK — token: ${token.slice(0, 20)}...`);
  return token;
}

async function checkAuth(token: string) {
  console.log("\n[2] GET /auth/authenticated");
  const data = await kitsuFetch("/auth/authenticated", token);
  console.log(`  Authenticated as: ${data.full_name ?? data.email ?? JSON.stringify(data)}`);
  return data;
}

async function getProjects(token: string) {
  console.log("\n[3] GET /data/projects");
  const data = await kitsuFetch("/data/projects", token);
  const projects = Array.isArray(data) ? data : data.data ?? [];
  printTable("Projects", projects, ["id", "name", "project_status_name"]);
  return projects;
}

async function getSequences(token: string, projectId?: string) {
  console.log("\n[4] GET /data/sequences");
  const data = await kitsuFetch("/data/sequences", token);
  let sequences = Array.isArray(data) ? data : data.data ?? [];
  if (projectId) {
    sequences = sequences.filter((s: Record<string, unknown>) => s.project_id === projectId);
  }
  printTable("Sequences" + (projectId ? ` (project ${projectId.slice(0, 8)})` : ""), sequences, [
    "id",
    "name",
    "project_id",
  ]);
  return sequences;
}

async function getShots(token: string, projectId?: string) {
  console.log("\n[5] GET /data/shots/all");
  const params: Record<string, string> = {};
  if (projectId) params.project_id = projectId;
  const data = await kitsuFetch("/data/shots/all", token, params);
  const shots = Array.isArray(data) ? data : data.data ?? [];
  printTable("Shots" + (projectId ? ` (project ${projectId.slice(0, 8)})` : ""), shots, [
    "id",
    "name",
    "parent_id",
    "nb_frames",
  ]);
  return shots;
}

async function getAssets(token: string, projectId?: string) {
  console.log("\n[6] GET /data/assets");
  const params: Record<string, string> = {};
  if (projectId) params.project_id = projectId;
  const data = await kitsuFetch("/data/assets", token, params);
  const assets = Array.isArray(data) ? data : data.data ?? [];
  printTable("Assets" + (projectId ? ` (project ${projectId.slice(0, 8)})` : ""), assets, [
    "id",
    "name",
    "asset_type_name",
    "project_name",
  ]);
  return assets;
}

// ── main ─────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Kitsu API Integration Test ===");

  const token = await login();
  await checkAuth(token);

  const projects = await getProjects(token);

  // If projects exist, drill into the first one
  const project = projects[0];
  if (project) {
    const pid = project.id as string;
    console.log(`\n── Drilling into project: "${project.name}" (${pid}) ──`);
    await getSequences(token, pid);
    await getShots(token, pid);
    await getAssets(token, pid);
  } else {
    console.log("\nNo projects found — skipping detail queries.");
    // Still try global queries
    await getSequences(token);
    await getShots(token);
    await getAssets(token);
  }

  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error("\nFATAL:", err.message ?? err);
  process.exit(1);
});
