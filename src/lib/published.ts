/**
 * Track published files in localStorage.
 * Similar structure to pins.ts but for tracking which files have been published.
 */

const PUBLISHED_STORAGE_PREFIX = "published_v1:";

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

function storageKey(workspaceKey: string): string {
    return `${PUBLISHED_STORAGE_PREFIX}${encodeURIComponent(workspaceKey)}`;
}

export type PublishedMap = Record<string, number>;

export function loadPublished(workspaceKey: string): PublishedMap {
    const raw = safeGetItem(storageKey(workspaceKey));
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object") return {};
        const published: PublishedMap = {};
        for (const [relPath, publishedAt] of Object.entries(parsed as Record<string, unknown>)) {
            if (typeof relPath !== "string" || !relPath) continue;
            if (typeof publishedAt !== "number" || !Number.isFinite(publishedAt) || publishedAt <= 0) continue;
            published[relPath] = publishedAt;
        }
        return published;
    } catch {
        return {};
    }
}

export function savePublished(workspaceKey: string, published: PublishedMap): void {
    if (!published || Object.keys(published).length === 0) {
        // Don't remove - keep empty object for clarity
        safeSetItem(storageKey(workspaceKey), "{}");
        return;
    }
    safeSetItem(storageKey(workspaceKey), JSON.stringify(published));
}

export function addPublished(workspaceKey: string, relPath: string): PublishedMap {
    const published = loadPublished(workspaceKey);
    published[relPath] = Date.now();
    savePublished(workspaceKey, published);
    return published;
}

export function isPublished(published: PublishedMap, relPath: string): boolean {
    return Boolean(published[relPath]);
}

export function renamePublished(
    workspaceKey: string,
    oldRelPath: string,
    newRelPath: string
): PublishedMap {
    const published = loadPublished(workspaceKey);
    if (!published[oldRelPath]) return published;
    const publishedAt = published[oldRelPath];
    delete published[oldRelPath];
    published[newRelPath] = publishedAt;
    savePublished(workspaceKey, published);
    return published;
}

export function removePublished(workspaceKey: string, relPath: string): PublishedMap {
    const published = loadPublished(workspaceKey);
    if (!published[relPath]) return published;
    delete published[relPath];
    savePublished(workspaceKey, published);
    return published;
}
