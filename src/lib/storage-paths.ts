export type MediaFolder = "images" | "videos";

export function formatDateFolder(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function buildDatedMediaPath(
  folder: MediaFolder,
  filename: string,
  date = new Date()
) {
  return `${folder}/${formatDateFolder(date)}/${filename}`;
}

export function mediaFolderFromMime(mime: string): MediaFolder | null {
  const normalized = (mime || "").toLowerCase();
  if (normalized.startsWith("image/")) return "images";
  if (normalized.startsWith("video/")) return "videos";
  return null;
}

