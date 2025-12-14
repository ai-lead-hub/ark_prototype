const RECENT_REFS_STORAGE_PREFIX = "recent_refs_v1:";
const MAX_RECENT_REFS = 30;
const RECENT_REFS_EVENT = "recent-references-changed";

function dispatchChange(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(RECENT_REFS_EVENT));
  } catch {
    // Ignore dispatch errors.
  }
}

function storageKey(workspaceKey: string): string {
  return `${RECENT_REFS_STORAGE_PREFIX}${encodeURIComponent(workspaceKey)}`;
}

function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors.
  }
}

function safeRemoveItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage errors.
  }
}

export type ReferenceUse = "startFrame" | "endFrame" | "reference";

export type RecentReference = {
  relPath: string;
  name: string;
  mime: string;
  lastUsedAt: number;
  lastUse: ReferenceUse;
};

function normalize(entries: RecentReference[]): RecentReference[] {
  const filtered = entries
    .filter(
      (entry) =>
        entry &&
        typeof entry.relPath === "string" &&
        entry.relPath &&
        typeof entry.name === "string" &&
        entry.name &&
        typeof entry.mime === "string" &&
        typeof entry.lastUsedAt === "number" &&
        Number.isFinite(entry.lastUsedAt) &&
        entry.lastUsedAt > 0 &&
        (entry.lastUse === "startFrame" ||
          entry.lastUse === "endFrame" ||
          entry.lastUse === "reference")
    )
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt);

  // Dedupe by relPath, keep most recent
  const seen = new Set<string>();
  const deduped: RecentReference[] = [];
  for (const entry of filtered) {
    if (seen.has(entry.relPath)) continue;
    seen.add(entry.relPath);
    deduped.push(entry);
    if (deduped.length >= MAX_RECENT_REFS) break;
  }
  return deduped;
}

export function loadRecentReferences(workspaceKey: string): RecentReference[] {
  const raw = safeGetItem(storageKey(workspaceKey));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return normalize(parsed as RecentReference[]);
  } catch {
    return [];
  }
}

export function saveRecentReferences(workspaceKey: string, refs: RecentReference[]): void {
  if (!refs || refs.length === 0) {
    safeRemoveItem(storageKey(workspaceKey));
    dispatchChange();
    return;
  }
  safeSetItem(storageKey(workspaceKey), JSON.stringify(normalize(refs)));
  dispatchChange();
}

export function recordRecentReference(
  workspaceKey: string,
  input: Pick<RecentReference, "relPath" | "name" | "mime">,
  use: ReferenceUse
): RecentReference[] {
  const existing = loadRecentReferences(workspaceKey);
  const nextEntry: RecentReference = {
    relPath: input.relPath,
    name: input.name,
    mime: input.mime,
    lastUsedAt: Date.now(),
    lastUse: use,
  };
  const merged = [nextEntry, ...existing.filter((e) => e.relPath !== input.relPath)];
  const normalized = normalize(merged);
  saveRecentReferences(workspaceKey, normalized);
  return normalized;
}

export function removeRecentReference(workspaceKey: string, relPath: string): RecentReference[] {
  const existing = loadRecentReferences(workspaceKey);
  const next = existing.filter((e) => e.relPath !== relPath);
  saveRecentReferences(workspaceKey, next);
  return next;
}

export function renameRecentReference(
  workspaceKey: string,
  oldRelPath: string,
  next: Pick<RecentReference, "relPath" | "name" | "mime">
): RecentReference[] {
  const existing = loadRecentReferences(workspaceKey);
  const updated = existing.map((entry) =>
    entry.relPath === oldRelPath
      ? {
        ...entry,
        relPath: next.relPath,
        name: next.name,
        mime: next.mime,
      }
      : entry
  );
  saveRecentReferences(workspaceKey, updated);
  return loadRecentReferences(workspaceKey);
}

export function onRecentReferencesChange(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(RECENT_REFS_EVENT, handler);
  return () => window.removeEventListener(RECENT_REFS_EVENT, handler);
}
