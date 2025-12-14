const PINS_STORAGE_PREFIX = "pins_v1:";

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

function storageKey(workspaceKey: string): string {
  return `${PINS_STORAGE_PREFIX}${encodeURIComponent(workspaceKey)}`;
}

export type PinsMap = Record<string, number>;

export function loadPins(workspaceKey: string): PinsMap {
  const raw = safeGetItem(storageKey(workspaceKey));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const pins: PinsMap = {};
    for (const [relPath, pinnedAt] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof relPath !== "string" || !relPath) continue;
      if (typeof pinnedAt !== "number" || !Number.isFinite(pinnedAt) || pinnedAt <= 0) continue;
      pins[relPath] = pinnedAt;
    }
    return pins;
  } catch {
    return {};
  }
}

export function savePins(workspaceKey: string, pins: PinsMap): void {
  if (!pins || Object.keys(pins).length === 0) {
    safeRemoveItem(storageKey(workspaceKey));
    return;
  }
  safeSetItem(storageKey(workspaceKey), JSON.stringify(pins));
}

export function togglePin(workspaceKey: string, relPath: string): PinsMap {
  const pins = loadPins(workspaceKey);
  if (pins[relPath]) {
    delete pins[relPath];
  } else {
    pins[relPath] = Date.now();
  }
  savePins(workspaceKey, pins);
  return pins;
}

export function removePin(workspaceKey: string, relPath: string): PinsMap {
  const pins = loadPins(workspaceKey);
  if (!pins[relPath]) return pins;
  delete pins[relPath];
  savePins(workspaceKey, pins);
  return pins;
}

export function renamePin(
  workspaceKey: string,
  oldRelPath: string,
  newRelPath: string
): PinsMap {
  const pins = loadPins(workspaceKey);
  if (!pins[oldRelPath]) return pins;
  const pinnedAt = pins[oldRelPath];
  delete pins[oldRelPath];
  pins[newRelPath] = pinnedAt;
  savePins(workspaceKey, pins);
  return pins;
}

