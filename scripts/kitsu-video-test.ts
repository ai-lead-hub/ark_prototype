/**
 * Test how Kitsu handles video previews — check original vs low quality, file sizes, etc.
 * Usage: npx tsx scripts/kitsu-video-test.ts
 */

import { config } from "dotenv";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
config({ path: ".env.local" });

const BASE = process.env.KITSU_BASE_URL?.replace(/\/+$/, "")!;
const EMAIL = process.env.KITSU_EMAIL!;
const PASSWORD = process.env.KITSU_PASSWORD!;
const OUT_DIR = join(import.meta.dirname, "kitsu-downloads");

async function main() {
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const { access_token: token } = await loginRes.json();
  const headers = { Authorization: `Bearer ${token}` };

  const get = async (path: string) => {
    const res = await fetch(`${BASE}${path}`, { headers });
    if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`);
    return res.json();
  };

  mkdirSync(OUT_DIR, { recursive: true });

  // Find Scarecrow project
  const projects = await get("/data/projects");
  const scarecrow = projects.find((p: any) => p.name === "Scarecrow");
  if (!scarecrow) throw new Error("Scarecrow not found");

  // Get all shots, find ones with previews
  const shots = await get(`/data/shots/all?project_id=${scarecrow.id}`);

  // Look through shots for video previews
  console.log("=== Scanning shots for video previews ===\n");

  let videoPreviewsFound = 0;

  for (const shot of shots.slice(0, 30)) {
    const shotPreviews = await get(`/data/shots/${shot.id}/preview-files`);

    for (const [taskTypeId, previews] of Object.entries(shotPreviews)) {
      for (const p of previews as any[]) {
        if (p.extension === "mp4" || p.extension === "mov" || p.extension === "webm" || p.is_movie) {
          videoPreviewsFound++;
          console.log(`── ${shot.name} (${shot.sequence_name || "?"}) ──`);
          console.log(`  Preview ID: ${p.id}`);
          console.log(`  Extension: ${p.extension}`);
          console.log(`  Is Movie: ${p.is_movie}`);
          console.log(`  Status: ${p.status}`);
          console.log(`  Width: ${p.width} Height: ${p.height}`);
          console.log(`  Duration: ${p.duration}`);
          console.log(`  File Size: ${p.file_size} bytes (${(p.file_size / 1024 / 1024).toFixed(2)} MB)`);
          console.log(`  Original Name: ${p.original_name}`);
          console.log(`  Source: ${p.source}`);
          console.log(`  URL: ${p.url}`);
          console.log(`  Uploaded Movie URL: ${p.uploaded_movie_url}`);
          console.log(`  Uploaded Movie Name: ${p.uploaded_movie_name}`);

          // Try to get the full preview file record for more details
          try {
            const fullRecord = await get(`/data/preview-files/${p.id}`);
            console.log(`\n  Full record keys: ${Object.keys(fullRecord).join(", ")}`);
            // Print any fields not in the list response
            for (const [k, v] of Object.entries(fullRecord)) {
              if (v !== null && v !== undefined && v !== "" && v !== 0 && v !== false) {
                if (!["id", "name", "extension", "status", "width", "height", "duration", "file_size", "original_name", "source", "created_at", "updated_at", "type", "is_movie", "revision", "position", "validation_status", "task_id", "person_id"].includes(k)) {
                  console.log(`  ${k}: ${JSON.stringify(v)}`);
                }
              }
            }
          } catch (e) {
            console.log(`  (Could not fetch full record)`);
          }

          // Check HEAD for original movie
          const origUrl = `${BASE}/movies/originals/preview-files/${p.id}.mp4`;
          console.log(`\n  Checking original: ${origUrl}`);
          const origHead = await fetch(origUrl, { method: "HEAD", headers });
          if (origHead.ok) {
            console.log(`    Status: ${origHead.status}`);
            console.log(`    Content-Type: ${origHead.headers.get("content-type")}`);
            console.log(`    Content-Length: ${origHead.headers.get("content-length")} bytes (${(Number(origHead.headers.get("content-length") || 0) / 1024 / 1024).toFixed(2)} MB)`);
          } else {
            console.log(`    Failed: ${origHead.status}`);
          }

          // Check HEAD for low quality movie
          const lowUrl = `${BASE}/movies/low/preview-files/${p.id}.mp4`;
          console.log(`\n  Checking low quality: ${lowUrl}`);
          const lowHead = await fetch(lowUrl, { method: "HEAD", headers });
          if (lowHead.ok) {
            console.log(`    Status: ${lowHead.status}`);
            console.log(`    Content-Type: ${lowHead.headers.get("content-type")}`);
            console.log(`    Content-Length: ${lowHead.headers.get("content-length")} bytes (${(Number(lowHead.headers.get("content-length") || 0) / 1024 / 1024).toFixed(2)} MB)`);
          } else {
            console.log(`    Failed: ${lowHead.status}`);
          }

          // Check for tile/sprite sheet
          const tileUrl = `${BASE}/movies/tiles/preview-files/${p.id}.png`;
          const tileHead = await fetch(tileUrl, { method: "HEAD", headers });
          console.log(`\n  Tile sprite: ${tileHead.ok ? `${tileHead.headers.get("content-length")} bytes` : `Failed ${tileHead.status}`}`);

          // Check original with actual extension
          if (p.extension && p.extension !== "mp4") {
            const extUrl = `${BASE}/movies/originals/preview-files/${p.id}.${p.extension}`;
            console.log(`\n  Checking original with .${p.extension}: ${extUrl}`);
            const extHead = await fetch(extUrl, { method: "HEAD", headers });
            console.log(`    ${extHead.ok ? `${extHead.headers.get("content-length")} bytes` : `Failed ${extHead.status}`}`);
          }

          // Download a small sample to check actual quality
          if (videoPreviewsFound <= 2) {
            console.log(`\n  Downloading original for inspection...`);
            const origRes = await fetch(origUrl, { headers });
            if (origRes.ok) {
              const buf = Buffer.from(await origRes.arrayBuffer());
              const outPath = join(OUT_DIR, `${shot.name}_video_orig_${p.id.slice(0, 8)}.mp4`);
              writeFileSync(outPath, buf);
              console.log(`    Saved: ${outPath} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
            }

            console.log(`  Downloading low quality for comparison...`);
            const lowRes = await fetch(lowUrl, { headers });
            if (lowRes.ok) {
              const buf = Buffer.from(await lowRes.arrayBuffer());
              const outPath = join(OUT_DIR, `${shot.name}_video_low_${p.id.slice(0, 8)}.mp4`);
              writeFileSync(outPath, buf);
              console.log(`    Saved: ${outPath} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
            }
          }

          console.log("");

          if (videoPreviewsFound >= 5) break;
        }
      }
      if (videoPreviewsFound >= 5) break;
    }
    if (videoPreviewsFound >= 5) break;
  }

  if (videoPreviewsFound === 0) {
    console.log("No video previews found in first 30 shots.");
    console.log("\nChecking Indira IVF project instead...");

    const ivf = projects.find((p: any) => p.name === "Indira IVF");
    if (ivf) {
      const ivfShots = await get(`/data/shots/all?project_id=${ivf.id}`);
      for (const shot of ivfShots.slice(0, 20)) {
        const previews = await get(`/data/shots/${shot.id}/preview-files`);
        for (const [_, pList] of Object.entries(previews)) {
          for (const p of pList as any[]) {
            console.log(`  ${shot.name}: ext=${p.extension} is_movie=${p.is_movie} size=${p.file_size} w=${p.width} h=${p.height} dur=${p.duration}`);
          }
        }
      }
    }
  }

  // Also check: what happens when we upload a video?
  // Let's check if any preview has uploaded_movie_url set
  console.log("\n=== Checking for uploaded_movie_url across all preview types ===");
  const allPreviews = await get(`/data/preview-files?project_id=${scarecrow.id}&page=1&limit=20`);
  const previewList = Array.isArray(allPreviews) ? allPreviews : allPreviews.data || [];
  for (const p of previewList.slice(0, 20)) {
    if (p.is_movie || p.extension === "mp4" || p.uploaded_movie_url) {
      console.log(`  ${p.id}: ext=${p.extension} is_movie=${p.is_movie} url=${p.url} uploaded_movie_url=${p.uploaded_movie_url} size=${p.file_size}`);
    }
  }

  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error("\nFATAL:", err.message ?? err);
  process.exit(1);
});
