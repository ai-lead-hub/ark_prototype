/* eslint-disable react-refresh/only-export-components */
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import type { QueueJob } from "./queueTypes";
import { authHeaders } from "../lib/api/files";

type QueueContextType = {
    jobs: QueueJob[];
    addJob: (
        type: QueueJob["type"],
        name: string,
        payload: unknown,
        processor: (payload: unknown, log: (msg: string) => void) => Promise<unknown>
    ) => void;
    retryJob: (id: string) => void;
    clearCompleted: () => void;
    removeJob: (id: string) => void;
    toggleLog: () => void;
    isLogOpen: boolean;
};

const QueueContext = createContext<QueueContextType | null>(null);

const CONCURRENCY_LIMIT = 5;

export function QueueProvider({ children }: { children: ReactNode }) {
    const [jobs, setJobs] = useState<QueueJob[]>([]);
    const [processors, setProcessors] = useState<
        Record<string, (payload: unknown, log: (msg: string) => void) => Promise<unknown>>
    >({});
    const [isLogOpen, setIsLogOpen] = useState(false);

    const addJob = useCallback(
        (
            type: QueueJob["type"],
            name: string,
            payload: unknown,
            processor: (payload: unknown, log: (msg: string) => void) => Promise<unknown>
        ) => {
            const id = crypto.randomUUID();
            setProcessors((prev) => ({ ...prev, [id]: processor }));
            setJobs((prev) => [
                {
                    id,
                    status: "pending" as const,
                    type,
                    name,
                    payload,
                    timestamp: Date.now(),
                    logs: ["Job queued."],
                },
                ...prev,
            ].slice(0, 50));
        },
        []
    );

    const retryJob = useCallback((id: string) => {
        setJobs((prev) =>
            prev.map((job) =>
                job.id === id
                    ? {
                        ...job,
                        status: "pending",
                        error: undefined,
                        logs: [...job.logs, "Retrying job..."],
                    }
                    : job
            )
        );
    }, []);

    const removeJob = useCallback((id: string) => {
        setJobs((prev) => prev.filter((job) => job.id !== id));
        setProcessors((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    }, []);

    const clearCompleted = useCallback(() => {
        setJobs((prev) =>
            prev.filter((job) => job.status !== "completed" && job.status !== "failed")
        );
    }, []);

    const toggleLog = useCallback(() => setIsLogOpen((v) => !v), []);

    // Track pending job count to avoid wasteful effect runs
    const pendingJobCount = useMemo(
        () => jobs.filter((j) => j.status === "pending").length,
        [jobs]
    );
    const processingCount = useMemo(
        () => jobs.filter((j) => j.status === "processing").length,
        [jobs]
    );

    // Use a ref to track currently active jobs for accurate concurrency control
    // This avoids stale closure issues with processingCount
    const activeJobsRef = useRef<Set<string>>(new Set());

    // Queue Processor - processes multiple jobs up to CONCURRENCY_LIMIT
    useEffect(() => {
        const processQueue = () => {
            // Use the ref for accurate count of active jobs
            const activeCount = activeJobsRef.current.size;
            const slotsAvailable = CONCURRENCY_LIMIT - activeCount;

            console.log(`[Queue] Slots: ${slotsAvailable} (limit: ${CONCURRENCY_LIMIT}, active: ${activeCount}, pending: ${pendingJobCount})`);

            if (slotsAvailable <= 0) return;
            if (pendingJobCount === 0) return;

            // Find pending jobs that aren't already being started
            const pendingJobs = jobs
                .filter((j) => j.status === "pending" && !activeJobsRef.current.has(j.id))
                .slice(0, slotsAvailable);

            if (pendingJobs.length === 0) return;

            // Start each pending job
            for (const nextJob of pendingJobs) {
                const processor = processors[nextJob.id];
                if (!processor) {
                    setJobs((prev) =>
                        prev.map((j) =>
                            j.id === nextJob.id
                                ? { ...j, status: "failed", error: "Processor not found" }
                                : j
                        )
                    );
                    continue;
                }

                // Mark as active to prevent double-start
                activeJobsRef.current.add(nextJob.id);

                // Mark as processing immediately
                setJobs((prev) =>
                    prev.map((j) =>
                        j.id === nextJob.id ? { ...j, status: "processing" } : j
                    )
                );

                // Execute asynchronously
                (async () => {
                    const localLogs: string[] = [...nextJob.logs];
                    const log = (msg: string) => {
                        console.log(`[Queue] ${msg}`);
                        localLogs.push(msg);
                        setJobs((prev) =>
                            prev.map((j) =>
                                j.id === nextJob.id ? { ...j, logs: [...j.logs, msg] } : j
                            )
                        );
                    };

                    try {
                        log("Starting processing...");
                        const result = await processor(nextJob.payload, log);
                        setJobs((prev) =>
                            prev.map((j) =>
                                j.id === nextJob.id
                                    ? {
                                        ...j,
                                        status: "completed",
                                        result,
                                        logs: [...j.logs, "Completed successfully."],
                                    }
                                    : j
                            )
                        );
                        // Auto-fade after 10 seconds
                        setTimeout(() => {
                            setJobs((prev) => prev.filter((j) => j.id !== nextJob.id));
                            setProcessors((prev) => {
                                const next = { ...prev };
                                delete next[nextJob.id];
                                return next;
                            });
                        }, 10000);
                    } catch (error) {
                        const msg = error instanceof Error ? error.message : "Unknown error";
                        localLogs.push(`Failed: ${msg}`);

                        setJobs((prev) =>
                            prev.map((j) =>
                                j.id === nextJob.id
                                    ? {
                                        ...j,
                                        status: "failed",
                                        error: msg,
                                        logs: [...j.logs, `Failed: ${msg}`],
                                    }
                                    : j
                            )
                        );

                        // Log to server
                        try {
                            const payload = nextJob.payload as { connection?: { apiBase?: string; token?: string } };
                            const apiBase = payload?.connection?.apiBase || "http://localhost:8787";
                            const token = payload?.connection?.token;
                            await fetch(new URL("/log", apiBase).toString(), {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    ...authHeaders(token),
                                },
                                body: JSON.stringify({
                                    level: "error",
                                    message: `Job ${nextJob.id} failed`,
                                    data: {
                                        jobId: nextJob.id,
                                        type: nextJob.type,
                                        error: msg,
                                        logs: localLogs
                                    }
                                })
                            });
                        } catch (e) {
                            console.error("Failed to log error to server", e);
                        }
                    } finally {
                        // Remove from active set when done
                        activeJobsRef.current.delete(nextJob.id);
                    }
                })();
            }
        };

        processQueue();
    }, [pendingJobCount, processingCount, jobs, processors]);

    const value = useMemo(
        () => ({
            jobs,
            addJob,
            retryJob,
            clearCompleted,
            removeJob,
            toggleLog,
            isLogOpen,
        }),
        [jobs, addJob, retryJob, clearCompleted, removeJob, toggleLog, isLogOpen]
    );

    return (
        <QueueContext.Provider value={value}>{children}</QueueContext.Provider>
    );
}

export function useQueue() {
    const context = useContext(QueueContext);
    if (!context) {
        throw new Error("useQueue must be used within a QueueProvider");
    }
    return context;
}
