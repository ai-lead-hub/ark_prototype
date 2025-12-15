import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "fileBrowser_hoverPlay_v1";

/**
 * Shared hook for the video hover play setting.
 * Persists to localStorage and syncs across components.
 */
export function useHoverPlayVideos() {
    const [hoverPlayVideos, setHoverPlayVideosState] = useState<boolean>(() => {
        if (typeof localStorage === "undefined") return true;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw === null) return true;
            return raw === "true";
        } catch {
            return true;
        }
    });

    useEffect(() => {
        if (typeof localStorage === "undefined") return;
        try {
            localStorage.setItem(STORAGE_KEY, String(hoverPlayVideos));
        } catch {
            // Ignore storage errors.
        }
    }, [hoverPlayVideos]);

    // Listen for storage changes from other tabs/components
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY && e.newValue !== null) {
                setHoverPlayVideosState(e.newValue === "true");
            }
        };
        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);

    const setHoverPlayVideos = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
        setHoverPlayVideosState((prev) => {
            const next = typeof value === "function" ? value(prev) : value;
            // Dispatch event for same-window sync
            window.dispatchEvent(new CustomEvent("hoverPlayChange", { detail: next }));
            return next;
        });
    }, []);

    // Listen for same-window changes
    useEffect(() => {
        const handleChange = (e: Event) => {
            const customEvent = e as CustomEvent<boolean>;
            setHoverPlayVideosState(customEvent.detail);
        };
        window.addEventListener("hoverPlayChange", handleChange);
        return () => window.removeEventListener("hoverPlayChange", handleChange);
    }, []);

    return [hoverPlayVideos, setHoverPlayVideos] as const;
}
