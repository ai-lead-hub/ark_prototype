import { useCallback, useEffect, useState } from "react";
import { getKieCredits, getKieKey } from "../lib/kie";

export default function CreditTracker() {
    const [credits, setCredits] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [hasKey, setHasKey] = useState(() => Boolean(getKieKey()));

    const fetchCredits = useCallback(async () => {
        if (!getKieKey()) return;
        setLoading(true);
        try {
            const amount = await getKieCredits();
            setCredits(amount);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const present = Boolean(getKieKey());
        setHasKey(present);
        if (present) {
            void fetchCredits();
        } else {
            setCredits(null);
            setLoading(false);
        }
    }, [fetchCredits]);

    if (!hasKey) return null;

    return (
        <div className="kv-glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
            <span className="kv-mono uppercase tracking-[0.18em] text-slate-500">Credits</span>
            <span className={`kv-mono font-semibold ${credits !== null && credits < 10 ? "text-red-400" : "text-amber-200"}`}>
                {loading && credits === null ? "..." : credits ?? 0}
            </span>
            <button
                type="button"
                onClick={fetchCredits}
                disabled={loading}
                className="kv-icon-button ml-1 flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-50"
                aria-label="Refresh credits"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2v6h-6" />
                    <path d="M3 12a9 9 0 0 1 15.55-6.36L21 8" />
                    <path d="M3 22v-6h6" />
                    <path d="M21 12a9 9 0 0 1-15.55 6.36L3 16" />
                </svg>
            </button>
        </div>
    );
}
