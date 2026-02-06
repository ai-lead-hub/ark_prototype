import { nanoid } from "nanoid";

// Max total filename length (excluding extension) to avoid filesystem issues
const MAX_FILENAME_LENGTH = 80;
// Allocate space for model ID (keeping it short)
const MAX_MODEL_ID_LENGTH = 20;
// Max slug length (prompt portion)
const MAX_SLUG_LENGTH = 40;

function sanitizeSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function promptToSlug(prompt: string, seed?: string | number) {
  const base = sanitizeSegment(prompt);
  const seedPart =
    seed === undefined || seed === null || seed === ""
      ? ""
      : `_seed${sanitizeSegment(String(seed))}`;
  // Truncate base to leave room for seed part (max 15 chars for seed)
  const maxBase = Math.max(MAX_SLUG_LENGTH - seedPart.length, 10);
  return (base.slice(0, maxBase) || "render") + seedPart;
}

export function buildFilename(
  modelId: string,
  prompt: string,
  extension: string,
  seed?: string | number
) {
  const sanitizedModel = sanitizeSegment(modelId).slice(0, MAX_MODEL_ID_LENGTH);
  const slug = promptToSlug(prompt, seed);
  const trimmedExt = extension.replace(/^\.+/, "").toLowerCase();
  const unique = nanoid(6);
  
  // Build filename and ensure it doesn't exceed max length
  let filename = `${sanitizedModel}_${slug}_${unique}`;
  if (filename.length > MAX_FILENAME_LENGTH) {
    // Truncate the slug portion to fit
    const overhead = sanitizedModel.length + 1 + 1 + unique.length; // model_..._unique
    const availableForSlug = MAX_FILENAME_LENGTH - overhead;
    const truncatedSlug = slug.slice(0, Math.max(availableForSlug, 10));
    filename = `${sanitizedModel}_${truncatedSlug}_${unique}`;
  }
  
  return `${filename}.${trimmedExt || "bin"}`;
}
