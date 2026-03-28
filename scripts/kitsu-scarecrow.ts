/**
 * Dump Scarecrow project details
 * Usage: npx tsx scripts/kitsu-scarecrow.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const BASE = process.env.KITSU_BASE_URL?.replace(/\/+$/, "")!;
const EMAIL = process.env.KITSU_EMAIL!;
const PASSWORD = process.env.KITSU_PASSWORD!;

async function main() {
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

  // Find Scarecrow project
  const projects = await get("/data/projects");
  const scarecrow = projects.find((p: any) => p.name === "Scarecrow");
  if (!scarecrow) {
    console.error("Scarecrow project not found");
    return;
  }
  console.log(`=== Project: ${scarecrow.name} (${scarecrow.id}) ===`);
  console.log(`  Type: ${scarecrow.production_type} | Style: ${scarecrow.production_style}`);
  console.log(`  Resolution: ${scarecrow.resolution} | FPS: ${scarecrow.fps} | Ratio: ${scarecrow.ratio}`);
  console.log(`  Dates: ${scarecrow.start_date} → ${scarecrow.end_date}`);

  // Sequences
  const allSequences = await get("/data/sequences");
  const sequences = allSequences.filter((s: any) => s.project_id === scarecrow.id);
  console.log(`\n=== Sequences (${sequences.length}) ===`);
  for (const seq of sequences) {
    console.log(`  ${seq.name} — ${seq.description || "(no description)"} (${seq.id})`);
  }

  // Shots
  const shots = await get(`/data/shots/all?project_id=${scarecrow.id}`);
  console.log(`\n=== Shots (${shots.length}) ===`);
  // Group by parent (sequence)
  const bySeq: Record<string, any[]> = {};
  for (const shot of shots) {
    const key = shot.parent_id || "no-sequence";
    if (!bySeq[key]) bySeq[key] = [];
    bySeq[key].push(shot);
  }
  for (const [seqId, seqShots] of Object.entries(bySeq)) {
    const seqName = sequences.find((s: any) => s.id === seqId)?.name ?? seqId.slice(0, 8);
    console.log(`\n  [${seqName}] (${seqShots.length} shots)`);
    for (const shot of seqShots) {
      const note = shot.data?.direction_note || shot.description || "";
      const frames = shot.nb_frames ? `${shot.nb_frames}f` : "";
      console.log(`    ${shot.name} ${frames} ${note ? `— ${note}` : ""}`);
    }
  }

  // Assets
  const assets = await get(`/data/assets?project_id=${scarecrow.id}`);
  console.log(`\n=== Assets (${assets.length}) ===`);

  // Try to get asset types for grouping
  const assetTypes = await get("/data/asset-types");
  const typeMap: Record<string, string> = {};
  for (const at of (Array.isArray(assetTypes) ? assetTypes : [])) {
    typeMap[at.id] = at.name;
  }

  for (const asset of assets) {
    const typeName = typeMap[asset.entity_type_id] || "Unknown";
    const desc = asset.description || "";
    console.log(`  [${typeName}] ${asset.name} ${desc ? `— ${desc}` : ""} (${asset.id})`);
  }

  // Tasks for first few shots
  console.log(`\n=== Tasks (first 3 shots) ===`);
  for (const shot of shots.slice(0, 3)) {
    const tasks = await get(`/data/shots/${shot.id}/tasks`);
    console.log(`\n  ${shot.name}:`);
    if (Array.isArray(tasks)) {
      for (const t of tasks) {
        console.log(`    [${t.task_type_name}] ${t.task_status_name} (retakes: ${t.retake_count})`);
      }
    }
    if (!Array.isArray(tasks) || tasks.length === 0) {
      console.log("    (no tasks)");
    }
  }
}

main().catch(console.error);
