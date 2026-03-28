/**
 * Test grabbing preview images from shots and uploading a preview to an empty shot
 * Usage: npx tsx scripts/kitsu-preview-test.ts
 */

import { config } from "dotenv";
import { writeFileSync, readFileSync } from "fs";
import { join } from "path";
config({ path: ".env.local" });

const BASE = process.env.KITSU_BASE_URL?.replace(/\/+$/, "")!;
const EMAIL = process.env.KITSU_EMAIL!;
const PASSWORD = process.env.KITSU_PASSWORD!;

const OUT_DIR = join(import.meta.dirname, "kitsu-downloads");

async function main() {
  // Login
  console.log("=== Logging in ===");
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const { access_token: token } = await loginRes.json();
  console.log(`  OK — token: ${token.slice(0, 20)}...`);

  const headers = { Authorization: `Bearer ${token}` };

  const get = async (path: string) => {
    const res = await fetch(`${BASE}${path}`, { headers });
    if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`);
    return res.json();
  };

  // Find Scarecrow project
  const projects = await get("/data/projects");
  const scarecrow = projects.find((p: any) => p.name === "Scarecrow");
  if (!scarecrow) throw new Error("Scarecrow not found");
  console.log(`\nProject: ${scarecrow.name} (${scarecrow.id})`);

  // Get all shots
  const shots = await get(`/data/shots/all?project_id=${scarecrow.id}`);
  console.log(`Total shots: ${shots.length}`);

  // ─── PART 1: GRAB PREVIEW IMAGES ──────────────────────────────────

  console.log("\n=== PART 1: Grabbing preview images from shots ===");

  // Get preview files grouped by task type for first few shots that have previews
  const shotsWithPreviews = shots.filter((s: any) => s.preview_file_id);
  console.log(`Shots with preview_file_id set: ${shotsWithPreviews.length}`);

  // Also check via the preview-files endpoint for a shot
  const testShot = shots[0];
  console.log(`\nChecking previews for ${testShot.name} (${testShot.id}):`);
  const shotPreviews = await get(`/data/shots/${testShot.id}/preview-files`);
  console.log(`  Preview files response (keys = task_type_ids):`);
  for (const [taskTypeId, previews] of Object.entries(shotPreviews)) {
    const previewList = previews as any[];
    console.log(`  Task type ${taskTypeId}: ${previewList.length} preview(s)`);
    for (const p of previewList.slice(0, 3)) {
      console.log(`    - id=${p.id} rev=${p.revision} ext=${p.extension} status=${p.status}`);
    }
  }

  // Try downloading actual preview images
  const { mkdirSync } = await import("fs");
  mkdirSync(OUT_DIR, { recursive: true });

  // Find a preview file ID to download
  let downloadedCount = 0;
  for (const [_, previews] of Object.entries(shotPreviews)) {
    for (const p of (previews as any[]).slice(0, 2)) {
      const previewId = p.id;
      const ext = p.extension || "png";

      // Try thumbnail
      const thumbUrl = `${BASE}/pictures/thumbnails/preview-files/${previewId}.png`;
      console.log(`\n  Downloading thumbnail: ${thumbUrl}`);
      const thumbRes = await fetch(thumbUrl, { headers });
      if (thumbRes.ok) {
        const buf = Buffer.from(await thumbRes.arrayBuffer());
        const outPath = join(OUT_DIR, `${testShot.name}_thumb_${previewId.slice(0, 8)}.png`);
        writeFileSync(outPath, buf);
        console.log(`    Saved: ${outPath} (${buf.length} bytes)`);
        downloadedCount++;
      } else {
        console.log(`    Failed: ${thumbRes.status}`);
      }

      // Try original
      const origUrl = `${BASE}/pictures/originals/preview-files/${previewId}.${ext}`;
      console.log(`  Downloading original: ${origUrl}`);
      const origRes = await fetch(origUrl, { headers });
      if (origRes.ok) {
        const buf = Buffer.from(await origRes.arrayBuffer());
        const outPath = join(OUT_DIR, `${testShot.name}_orig_${previewId.slice(0, 8)}.${ext}`);
        writeFileSync(outPath, buf);
        console.log(`    Saved: ${outPath} (${buf.length} bytes)`);
        downloadedCount++;
      } else {
        console.log(`    Failed: ${origRes.status}`);
        // Try as movie
        if (ext === "mp4" || ext === "mov") {
          const movUrl = `${BASE}/movies/originals/preview-files/${previewId}.mp4`;
          console.log(`  Trying movie: ${movUrl}`);
          const movRes = await fetch(movUrl, { headers });
          if (movRes.ok) {
            const buf = Buffer.from(await movRes.arrayBuffer());
            const outPath = join(OUT_DIR, `${testShot.name}_movie_${previewId.slice(0, 8)}.mp4`);
            writeFileSync(outPath, buf);
            console.log(`    Saved: ${outPath} (${buf.length} bytes)`);
            downloadedCount++;
          } else {
            console.log(`    Movie also failed: ${movRes.status}`);
          }
        }
      }

      if (downloadedCount >= 4) break;
    }
    if (downloadedCount >= 4) break;
  }

  console.log(`\nDownloaded ${downloadedCount} files to ${OUT_DIR}`);

  // ─── PART 2: UPLOAD PREVIEW TO AN EMPTY SHOT ─────────────────────

  console.log("\n=== PART 2: Upload preview to an empty shot ===");

  // Find a shot with no preview
  const emptyShot = shots.find((s: any) => !s.preview_file_id);
  if (!emptyShot) {
    console.log("  No empty shots found — all have previews. Skipping upload test.");
    return;
  }
  console.log(`\nTarget shot: ${emptyShot.name} (${emptyShot.id}) — no preview_file_id`);

  // Get tasks for this shot to find one we can attach a preview to
  const tasks = await get(`/data/shots/${emptyShot.id}/tasks`);
  console.log(`  Tasks on this shot: ${(tasks as any[]).length}`);
  for (const t of tasks as any[]) {
    console.log(`    [${t.task_type_name}] ${t.task_status_name} (${t.id})`);
  }

  // Pick the first task (or generation task if exists)
  const task = (tasks as any[]).find((t: any) => t.task_type_name === "Generation")
    || (tasks as any[]).find((t: any) => t.task_type_name === "Animation")
    || (tasks as any[])[0];

  if (!task) {
    console.log("  No tasks on this shot. Cannot upload preview without a task.");
    return;
  }
  console.log(`\n  Using task: [${task.task_type_name}] ${task.id}`);

  // Get task statuses to find "WIP" status id
  const taskStatuses = await get("/data/task-status");
  const wipStatus = (taskStatuses as any[]).find((s: any) => s.short_name === "wip");
  if (!wipStatus) {
    console.log("  Could not find WIP task status.");
    return;
  }

  // Step 1: Create a comment on the task
  console.log("\n  Step 1: Creating comment on task...");
  const commentRes = await fetch(`${BASE}/actions/tasks/${task.id}/comment`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      task_status_id: wipStatus.id,
      comment: "Test upload from Ark prototype",
    }),
  });
  if (!commentRes.ok) {
    const text = await commentRes.text();
    console.log(`  Failed to create comment: ${commentRes.status} ${text}`);
    return;
  }
  const comment = await commentRes.json();
  console.log(`  Comment created: ${comment.id}`);

  // Step 2: Add preview metadata to the comment
  console.log("  Step 2: Adding preview metadata...");
  const addPreviewRes = await fetch(
    `${BASE}/actions/tasks/${task.id}/comments/${comment.id}/add-preview`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  );
  if (!addPreviewRes.ok) {
    const text = await addPreviewRes.text();
    console.log(`  Failed to add preview: ${addPreviewRes.status} ${text}`);
    return;
  }
  const previewMeta = await addPreviewRes.json();
  console.log(`  Preview record created: ${previewMeta.id}`);

  // Step 3: Upload an actual file
  // Create a simple test image (1x1 red pixel PNG) or use a downloaded file
  let fileBuffer: Buffer;
  let fileName: string;

  // Check if we downloaded anything earlier
  const { readdirSync } = await import("fs");
  const downloaded = readdirSync(OUT_DIR).filter((f) => f.endsWith(".png") || f.endsWith(".jpg"));
  if (downloaded.length > 0) {
    const filePath = join(OUT_DIR, downloaded[0]);
    fileBuffer = readFileSync(filePath);
    fileName = downloaded[0];
    console.log(`  Using downloaded file: ${fileName} (${fileBuffer.length} bytes)`);
  } else {
    // Create a minimal PNG (1x1 red pixel)
    // PNG header + IHDR + IDAT + IEND for a 1x1 red pixel
    fileBuffer = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108020000009001" +
      "2e00000000c49444154789c626060f80f0000010100005018d84d00000000" +
      "49454e44ae426082",
      "hex"
    );
    fileName = "test-upload.png";
    console.log(`  Using generated test PNG (${fileBuffer.length} bytes)`);
  }

  console.log("  Step 3: Uploading file...");
  const formData = new FormData();
  formData.append("file", new Blob([fileBuffer]), fileName);

  const uploadRes = await fetch(
    `${BASE}/pictures/preview-files/${previewMeta.id}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }
  );
  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    console.log(`  Upload failed: ${uploadRes.status} ${text}`);
    return;
  }
  const uploadResult = await uploadRes.json();
  console.log(`  Upload successful!`);
  console.log(`  Result:`, JSON.stringify(uploadResult, null, 2));

  // Step 4: Set as main preview for the shot
  console.log("\n  Step 4: Setting as main preview...");
  const setMainRes = await fetch(
    `${BASE}/actions/preview-files/${previewMeta.id}/set-main-preview`,
    {
      method: "PUT",
      headers,
    }
  );
  if (setMainRes.ok) {
    const result = await setMainRes.json();
    console.log(`  Set as main preview for: ${result.name} (preview_file_id: ${result.preview_file_id})`);
  } else {
    console.log(`  Set main preview failed: ${setMainRes.status} ${await setMainRes.text()}`);
  }

  // Verify
  console.log("\n  Verifying...");
  const updatedShot = await get(`/data/shots/${emptyShot.id}`);
  console.log(`  Shot ${updatedShot.name} preview_file_id: ${updatedShot.preview_file_id}`);
  console.log(`  Thumbnail URL: ${BASE}/pictures/thumbnails/preview-files/${previewMeta.id}.png`);

  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error("\nFATAL:", err.message ?? err);
  process.exit(1);
});
