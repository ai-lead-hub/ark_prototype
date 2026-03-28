/**
 * Focused investigation: does Kitsu transcode videos? Compare original vs low quality.
 * Usage: npx tsx scripts/kitsu-video-quality.ts
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

  // Get all projects
  const projects = await get("/data/projects");
  console.log("Projects:", projects.map((p: any) => p.name).join(", "));

  // Collect video previews from ALL projects
  const videoPreviewIds: { id: string; ext: string; shotName: string; project: string; width: number; height: number; duration: number }[] = [];

  for (const project of projects) {
    const shots = await get(`/data/shots/all?project_id=${project.id}`);
    console.log(`\n${project.name}: ${shots.length} shots`);

    for (const shot of shots.slice(0, 50)) {
      const shotPreviews = await get(`/data/shots/${shot.id}/preview-files`);
      for (const [_, previews] of Object.entries(shotPreviews)) {
        for (const p of previews as any[]) {
          // Check extension — don't rely on is_movie (undefined in list responses)
          if (p.extension === "mp4" || p.extension === "mov" || p.extension === "webm") {
            videoPreviewIds.push({
              id: p.id,
              ext: p.extension,
              shotName: shot.name,
              project: project.name,
              width: p.width,
              height: p.height,
              duration: p.duration,
            });
          }
        }
      }
      if (videoPreviewIds.length >= 6) break;
    }
    if (videoPreviewIds.length >= 6) break;
  }

  console.log(`\n=== Found ${videoPreviewIds.length} video previews ===\n`);

  // For each video preview, compare original vs low quality via HEAD
  for (const vp of videoPreviewIds) {
    console.log(`── ${vp.project} / ${vp.shotName} (${vp.id.slice(0, 8)}) ──`);
    console.log(`  Metadata: ${vp.width}x${vp.height}, ${vp.duration}s, .${vp.ext}`);

    // Fetch full record for more details
    try {
      const full = await get(`/data/preview-files/${vp.id}`);
      console.log(`  file_size: ${full.file_size} bytes (${((full.file_size || 0) / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`  is_movie: ${full.is_movie}`);
      console.log(`  original_name: ${full.original_name}`);
      console.log(`  source: ${full.source}`);
      console.log(`  uploaded_movie_url: ${full.uploaded_movie_url || "(empty)"}`);
      console.log(`  uploaded_movie_name: ${full.uploaded_movie_name || "(empty)"}`);
      if (full.source_file) console.log(`  source_file: ${JSON.stringify(full.source_file)}`);
    } catch (e) {
      console.log(`  (could not fetch full record)`);
    }

    // HEAD: /movies/originals/preview-files/{id}.mp4
    const origUrl = `${BASE}/movies/originals/preview-files/${vp.id}.mp4`;
    const origHead = await fetch(origUrl, { method: "HEAD", headers });
    const origSize = Number(origHead.headers.get("content-length") || 0);
    console.log(`  /movies/originals/: ${origHead.ok ? `${origSize} bytes (${(origSize / 1024 / 1024).toFixed(2)} MB) — ${origHead.headers.get("content-type")}` : `FAILED ${origHead.status}`}`);

    // HEAD: /movies/low/preview-files/{id}.mp4
    const lowUrl = `${BASE}/movies/low/preview-files/${vp.id}.mp4`;
    const lowHead = await fetch(lowUrl, { method: "HEAD", headers });
    const lowSize = Number(lowHead.headers.get("content-length") || 0);
    console.log(`  /movies/low/:       ${lowHead.ok ? `${lowSize} bytes (${(lowSize / 1024 / 1024).toFixed(2)} MB) — ${lowHead.headers.get("content-type")}` : `FAILED ${lowHead.status}`}`);

    if (origHead.ok && lowHead.ok) {
      const ratio = (origSize / lowSize).toFixed(2);
      console.log(`  Size ratio (orig/low): ${ratio}x`);
    }

    // HEAD: /movies/tiles/preview-files/{id}.png (sprite sheet for scrubbing)
    const tileUrl = `${BASE}/movies/tiles/preview-files/${vp.id}.png`;
    const tileHead = await fetch(tileUrl, { method: "HEAD", headers });
    console.log(`  /movies/tiles/:     ${tileHead.ok ? `${Number(tileHead.headers.get("content-length") || 0)} bytes` : `FAILED ${tileHead.status}`}`);

    // Also check if the original with native extension differs
    if (vp.ext !== "mp4") {
      const extUrl = `${BASE}/movies/originals/preview-files/${vp.id}.${vp.ext}`;
      const extHead = await fetch(extUrl, { method: "HEAD", headers });
      console.log(`  /movies/originals/*.${vp.ext}: ${extHead.ok ? `${Number(extHead.headers.get("content-length") || 0)} bytes` : `FAILED ${extHead.status}`}`);
    }

    // Compare with image endpoint (should fail for videos, but let's check)
    const picUrl = `${BASE}/pictures/originals/preview-files/${vp.id}.png`;
    const picHead = await fetch(picUrl, { method: "HEAD", headers });
    console.log(`  /pictures/originals/: ${picHead.ok ? `${Number(picHead.headers.get("content-length") || 0)} bytes (thumbnail generated?)` : `FAILED ${picHead.status}`}`);

    console.log("");
  }

  // Now compare with IMAGE previews to see if images are stored at full quality
  console.log("\n=== IMAGE PREVIEW COMPARISON ===\n");

  const imagePreviews: { id: string; ext: string; shotName: string; project: string; width: number; height: number }[] = [];

  for (const project of projects) {
    const shots = await get(`/data/shots/all?project_id=${project.id}`);
    for (const shot of shots.slice(0, 30)) {
      const shotPreviews = await get(`/data/shots/${shot.id}/preview-files`);
      for (const [_, previews] of Object.entries(shotPreviews)) {
        for (const p of previews as any[]) {
          if (p.extension === "png" || p.extension === "jpg" || p.extension === "jpeg") {
            imagePreviews.push({
              id: p.id,
              ext: p.extension,
              shotName: shot.name,
              project: project.name,
              width: p.width,
              height: p.height,
            });
          }
        }
      }
      if (imagePreviews.length >= 4) break;
    }
    if (imagePreviews.length >= 4) break;
  }

  for (const ip of imagePreviews.slice(0, 4)) {
    console.log(`── ${ip.project} / ${ip.shotName} (${ip.id.slice(0, 8)}) ──`);
    console.log(`  Metadata: ${ip.width}x${ip.height}, .${ip.ext}`);

    // Full record
    try {
      const full = await get(`/data/preview-files/${ip.id}`);
      console.log(`  file_size (metadata): ${full.file_size} bytes (${((full.file_size || 0) / 1024 / 1024).toFixed(2)} MB)`);
    } catch {}

    // HEAD: /pictures/originals/
    const origUrl = `${BASE}/pictures/originals/preview-files/${ip.id}.${ip.ext}`;
    const origHead = await fetch(origUrl, { method: "HEAD", headers });
    const origSize = Number(origHead.headers.get("content-length") || 0);
    console.log(`  /pictures/originals/: ${origHead.ok ? `${origSize} bytes (${(origSize / 1024 / 1024).toFixed(2)} MB)` : `FAILED ${origHead.status}`}`);

    // HEAD: /pictures/thumbnails/
    const thumbUrl = `${BASE}/pictures/thumbnails/preview-files/${ip.id}.png`;
    const thumbHead = await fetch(thumbUrl, { method: "HEAD", headers });
    const thumbSize = Number(thumbHead.headers.get("content-length") || 0);
    console.log(`  /pictures/thumbnails/: ${thumbHead.ok ? `${thumbSize} bytes (${(thumbSize / 1024 / 1024).toFixed(2)} MB)` : `FAILED ${thumbHead.status}`}`);

    if (origHead.ok && thumbHead.ok) {
      console.log(`  Size ratio (orig/thumb): ${(origSize / thumbSize).toFixed(2)}x`);
    }

    // HEAD: /pictures/previews/ (mid-size)
    const prevUrl = `${BASE}/pictures/previews/preview-files/${ip.id}.${ip.ext}`;
    const prevHead = await fetch(prevUrl, { method: "HEAD", headers });
    const prevSize = Number(prevHead.headers.get("content-length") || 0);
    console.log(`  /pictures/previews/: ${prevHead.ok ? `${prevSize} bytes (${(prevSize / 1024 / 1024).toFixed(2)} MB)` : `FAILED ${prevHead.status}`}`);

    console.log("");
  }

  // Download one video original + low for manual comparison
  if (videoPreviewIds.length > 0) {
    const vp = videoPreviewIds[0];
    console.log(`\n=== DOWNLOADING SAMPLE: ${vp.shotName} ===\n`);

    const origUrl = `${BASE}/movies/originals/preview-files/${vp.id}.mp4`;
    const origRes = await fetch(origUrl, { headers });
    if (origRes.ok) {
      const buf = Buffer.from(await origRes.arrayBuffer());
      const path = join(OUT_DIR, `${vp.shotName}_orig_${vp.id.slice(0, 8)}.mp4`);
      writeFileSync(path, buf);
      console.log(`  Original: ${path} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
    }

    const lowUrl = `${BASE}/movies/low/preview-files/${vp.id}.mp4`;
    const lowRes = await fetch(lowUrl, { headers });
    if (lowRes.ok) {
      const buf = Buffer.from(await lowRes.arrayBuffer());
      const path = join(OUT_DIR, `${vp.shotName}_low_${vp.id.slice(0, 8)}.mp4`);
      writeFileSync(path, buf);
      console.log(`  Low:      ${path} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
    }
  }

  console.log("\n=== DONE ===");
}

main().catch((err) => {
  console.error("\nFATAL:", err.message ?? err);
  process.exit(1);
});
