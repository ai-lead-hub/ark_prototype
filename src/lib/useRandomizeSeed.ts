import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "global_randomizeSeed_v1";

/**
 * Shared hook for the randomize seed setting.
 * Persists to localStorage and syncs across components.
 * Default: false (disabled)
 */
export function useRandomizeSeed() {
    const [randomizeSeed, setRandomizeSeedState] = useState<boolean>(() => {
        if (typeof localStorage === "undefined") return false;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw === null) return false; // Default: disabled
            return raw === "true";
        } catch {
            return false;
        }
    });

    useEffect(() => {
        if (typeof localStorage === "undefined") return;
        try {
            localStorage.setItem(STORAGE_KEY, String(randomizeSeed));
        } catch {
            // Ignore storage errors.
        }
    }, [randomizeSeed]);

    // Listen for storage changes from other tabs/components
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY && e.newValue !== null) {
                setRandomizeSeedState(e.newValue === "true");
            }
        };
        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);

    const setRandomizeSeed = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
        setRandomizeSeedState((prev) => {
            const next = typeof value === "function" ? value(prev) : value;
            // Dispatch event for same-window sync
            window.dispatchEvent(new CustomEvent("randomizeSeedChange", { detail: next }));
            return next;
        });
    }, []);

    // Listen for same-window changes
    useEffect(() => {
        const handleChange = (e: Event) => {
            const customEvent = e as CustomEvent<boolean>;
            setRandomizeSeedState(customEvent.detail);
        };
        window.addEventListener("randomizeSeedChange", handleChange);
        return () => window.removeEventListener("randomizeSeedChange", handleChange);
    }, []);

    return [randomizeSeed, setRandomizeSeed] as const;
}
