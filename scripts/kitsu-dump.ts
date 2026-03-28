/**
 * Dump full response shapes from Kitsu for one project
 * Usage: npx tsx scripts/kitsu-dump.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const BASE = process.env.KITSU_BASE_URL?.replace(/\/+$/, "")!;
const EMAIL = process.env.KITSU_EMAIL!;
const PASSWORD = process.env.KITSU_PASSWORD!;

async function main() {
  // Login
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const { access_token: token } = await loginRes.json();

  const get = async (path: string) => {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  };

  // Get first project
  const projects = await get("/data/projects");
  const project = projects[0];
  console.log("=== SAMPLE PROJECT ===");
  console.log(JSON.stringify(project, null, 2));

  // Get first shot
  const shots = await get(`/data/shots/all?project_id=${project.id}`);
  console.log("\n=== SAMPLE SHOT ===");
  console.log(JSON.stringify(shots[0], null, 2));

  // Get first asset
  const assets = await get(`/data/assets?project_id=${project.id}`);
  console.log("\n=== SAMPLE ASSET ===");
  console.log(JSON.stringify(assets[0], null, 2));

  // Get sequences
  const sequences = await get("/data/sequences");
  const projSeqs = sequences.filter((s: any) => s.project_id === project.id);
  console.log("\n=== SAMPLE SEQUENCE ===");
  if (projSeqs[0]) console.log(JSON.stringify(projSeqs[0], null, 2));

  // Check for task types and task statuses
  console.log("\n=== TASK TYPES ===");
  const taskTypes = await get("/data/task-types");
  for (const tt of (Array.isArray(taskTypes) ? taskTypes : []).slice(0, 10)) {
    console.log(`  ${tt.name} (${tt.id})`);
  }

  console.log("\n=== TASK STATUSES ===");
  const taskStatuses = await get("/data/task-status");
  for (const ts of (Array.isArray(taskStatuses) ? taskStatuses : []).slice(0, 10)) {
    console.log(`  ${ts.name} — short: ${ts.short_name} (${ts.id})`);
  }

  // Get tasks for first shot
  console.log("\n=== TASKS FOR FIRST SHOT ===");
  const tasks = await get(`/data/shots/${shots[0].id}/tasks`);
  console.log(JSON.stringify(Array.isArray(tasks) ? tasks.slice(0, 3) : tasks, null, 2));
}

main().catch(console.error);
