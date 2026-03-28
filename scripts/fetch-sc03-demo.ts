/**
 * Fetch Scarecrow SC03 data from Kitsu and save as static demo data.
 * Downloads preview thumbnails to public/kitsu-previews/.
 * Usage: npx tsx scripts/fetch-sc03-demo.ts
 */

import { config } from "dotenv";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
config({ path: ".env.local" });

const BASE = process.env.KITSU_BASE_URL?.replace(/\/+$/, "")!;
const EMAIL = process.env.KITSU_EMAIL!;
const PASSWORD = process.env.KITSU_PASSWORD!;
const ROOT = join(import.meta.dirname, "..");
const PREVIEW_DIR = join(ROOT, "public", "kitsu-previews");
const DATA_FILE = join(ROOT, "src", "data", "sc03-demo.json");

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
    if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
    return res.json();
  };

  mkdirSync(PREVIEW_DIR, { recursive: true });
  mkdirSync(join(ROOT, "src", "data"), { recursive: true });

  // Get project + sequence
  const projects = await get("/data/projects");
  const scarecrow = projects.find((p: any) => p.name === "Scarecrow");
  if (!scarecrow) throw new Error("Scarecrow not found");

  const sequences = await get("/data/sequences");
  const sc03 = sequences.find(
    (s: any) => s.project_id === scarecrow.id && s.name === "SC03"
  );
  if (!sc03) throw new Error("SC03 not found");

  // Get SC03 shots
  const allShots = await get(`/data/shots/all?project_id=${scarecrow.id}`);
  const sc03Shots = allShots
    .filter((s: any) => s.parent_id === sc03.id)
    .sort((a: any, b: any) => {
      const numA = parseFloat(a.name.replace(/^SH/, ""));
      const numB = parseFloat(b.name.replace(/^SH/, ""));
      return numA - numB;
    });

  console.log(`SC03: ${sc03Shots.length} shots`);

  // Get assets for casting info
  const assets = await get(`/data/assets?project_id=${scarecrow.id}`);
  const assetTypes = await get("/data/asset-types");
  const typeMap: Record<string, string> = {};
  for (const at of assetTypes) typeMap[at.id] = at.name;

  const assetList = assets.map((a: any) => ({
    id: a.id,
    name: a.name,
    type: typeMap[a.entity_type_id] || "Unknown",
    description: a.description || "",
    previewFileId: a.preview_file_id || null,
  }));

  // Fetch previews for each shot (parallel, limited concurrency)
  const shotData: any[] = [];
  const downloadQueue: { url: string; path: string }[] = [];

  const BATCH = 8;
  for (let i = 0; i < sc03Shots.length; i += BATCH) {
    const batch = sc03Shots.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (shot: any) => {
        const previews = await get(`/data/shots/${shot.id}/preview-files`);
        const candidates: any[] = [];

        for (const [taskTypeId, pList] of Object.entries(previews)) {
          for (const p of pList as any[]) {
            const previewId = p.id;
            const ext = p.extension || "png";
            const isVideo = ext === "mp4" || ext === "mov" || ext === "webm";
            const thumbFilename = `${previewId}.png`;
            const origFilename = `${previewId}_orig.${ext}`;

            // Queue thumbnail download
            const thumbUrl = isVideo
              ? `${BASE}/movies/tiles/preview-files/${previewId}.png`
              : `${BASE}/pictures/thumbnails/preview-files/${previewId}.png`;

            downloadQueue.push({
              url: thumbUrl,
              path: join(PREVIEW_DIR, thumbFilename),
            });

            // Queue preview download (mid-size for images, low for videos)
            const previewUrl = isVideo
              ? `${BASE}/movies/low/preview-files/${previewId}.mp4`
              : `${BASE}/pictures/previews/preview-files/${previewId}.${ext}`;

            downloadQueue.push({
              url: previewUrl,
              path: join(PREVIEW_DIR, isVideo ? `${previewId}_preview.mp4` : `${previewId}_preview.${ext}`),
            });

            candidates.push({
              id: previewId,
              extension: ext,
              isVideo,
              revision: p.revision,
              width: p.width,
              height: p.height,
              duration: p.duration || 0,
              originalName: p.original_name || "",
              createdAt: p.created_at,
              taskTypeId,
              thumbnailPath: `/kitsu-previews/${thumbFilename}`,
              previewPath: `/kitsu-previews/${isVideo ? `${previewId}_preview.mp4` : `${previewId}_preview.${ext}`}`,
            });
          }
        }

        // Sort candidates: highest revision first
        candidates.sort((a: any, b: any) => b.revision - a.revision);

        return {
          id: shot.id,
          name: shot.name,
          description: shot.description || "",
          directionNote: shot.data?.direction_note || "",
          nbFrames: shot.nb_frames || 0,
          previewFileId: shot.preview_file_id || null,
          candidates,
        };
      })
    );
    shotData.push(...results);
    console.log(`  Fetched ${Math.min(i + BATCH, sc03Shots.length)}/${sc03Shots.length} shots`);
  }

  // Download all thumbnails and previews
  console.log(`\nDownloading ${downloadQueue.length} files...`);
  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < downloadQueue.length; i += BATCH) {
    const batch = downloadQueue.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async ({ url, path }) => {
        try {
          const res = await fetch(url, { headers });
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            writeFileSync(path, buf);
            downloaded++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      })
    );
    if ((i + BATCH) % 32 === 0 || i + BATCH >= downloadQueue.length) {
      console.log(`  ${downloaded} downloaded, ${failed} failed, ${downloadQueue.length - downloaded - failed} remaining`);
    }
  }

  // Also download asset thumbnails
  console.log("\nDownloading asset thumbnails...");
  for (const asset of assetList) {
    if (!asset.previewFileId) continue;
    const url = `${BASE}/pictures/thumbnails/preview-files/${asset.previewFileId}.png`;
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        writeFileSync(join(PREVIEW_DIR, `asset_${asset.id}.png`), buf);
        asset.thumbnailPath = `/kitsu-previews/asset_${asset.id}.png`;
      }
    } catch {}
  }

  // Write JSON data
  const demoData = {
    project: { id: scarecrow.id, name: scarecrow.name },
    scene: { id: sc03.id, name: sc03.name },
    shots: shotData,
    assets: assetList,
    fetchedAt: new Date().toISOString(),
  };

  writeFileSync(DATA_FILE, JSON.stringify(demoData, null, 2));
  console.log(`\nWrote ${DATA_FILE}`);
  console.log(`Shots: ${shotData.length}`);
  console.log(`Total candidates: ${shotData.reduce((s: number, sh: any) => s + sh.candidates.length, 0)}`);
  console.log(`Downloaded: ${downloaded}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error("FATAL:", err.message ?? err);
  process.exit(1);
});
