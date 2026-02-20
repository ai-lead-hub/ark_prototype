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
const IS_DEV = import.meta.env.DEV;

export function QueueProvider({ children }: { children: ReactNode }) {
    const [jobs, setJobs] = useState<QueueJob[]>([]);
    const [processors, setProcessors] = useState<
        Record<string, (payload: unknown, log: (msg: string) => void) => Promise<unknown>>
    >({});
    const [isLogOpen, setIsLogOpen] = useState(false);
    const [schedulerTick, setSchedulerTick] = useState(0);
    const activeJobsRef = useRef<Set<string>>(new Set());

    const deleteProcessors = useCallback((ids: string[]) => {
        if (ids.length === 0) return;
        setProcessors((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const id of ids) {
                if (id in next) {
                    delete next[id];
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, []);

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
            ]);
        },
        []
    );

    const retryJob = useCallback((id: string) => {
        activeJobsRef.current.delete(id);
        setSchedulerTick((prev) => prev + 1);
        setJobs((prev) =>
            prev.map((job) =>
                job.id === id
                    ? {
                        ...job,
                        status: "pending",
                        result: undefined,
                        error: undefined,
                        logs: [...job.logs, "Retrying job..."],
                    }
                    : job
            )
        );
    }, []);

    const removeJob = useCallback((id: string) => {
        activeJobsRef.current.delete(id);
        setSchedulerTick((prev) => prev + 1);
        setJobs((prev) => prev.filter((job) => job.id !== id));
        deleteProcessors([id]);
    }, [deleteProcessors]);

    const clearCompleted = useCallback(() => {
        setJobs((prev) => {
            const removedIds = prev
                .filter((job) => job.status === "completed" || job.status === "failed")
                .map((job) => job.id);
            if (removedIds.length > 0) {
                queueMicrotask(() => {
                    deleteProcessors(removedIds);
                });
            }
            return prev.filter(
                (job) => job.status !== "completed" && job.status !== "failed"
            );
        });
    }, [deleteProcessors]);

    const toggleLog = useCallback(() => setIsLogOpen((v) => !v), []);

    // Track pending job count to avoid wasteful effect runs
    const pendingJobCount = useMemo(
        () => jobs.filter((j) => j.status === "pending").length,
        [jobs]
    );

    // Queue Processor - processes multiple jobs up to CONCURRENCY_LIMIT
    useEffect(() => {
        const processQueue = () => {
            // Use the ref for accurate count of active jobs
            const activeCount = activeJobsRef.current.size;
            const slotsAvailable = CONCURRENCY_LIMIT - activeCount;

            if (IS_DEV) {
                console.log(`[Queue] Slots: ${slotsAvailable} (limit: ${CONCURRENCY_LIMIT}, active: ${activeCount}, pending: ${pendingJobCount})`);
            }

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
                    let slotReleased = false;
                    const releaseSlot = () => {
                        if (slotReleased) return;
                        slotReleased = true;
                        activeJobsRef.current.delete(nextJob.id);
                        // Trigger immediate queue refill when a job leaves an active slot.
                        setSchedulerTick((prev) => prev + 1);
                    };
                    const log = (msg: string) => {
                        if (IS_DEV) {
                            console.log(`[Queue] ${msg}`);
                        }
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
                        releaseSlot();
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
                            deleteProcessors([nextJob.id]);
                        }, 10000);
                    } catch (error) {
                        releaseSlot();
                        const rawMsg = error instanceof Error ? error.message : String(error ?? "");
                        const msg = rawMsg.trim() || "Unknown error";
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
                        releaseSlot();
                    }
                })();
            }
        };

        processQueue();
    }, [pendingJobCount, jobs, processors, schedulerTick, deleteProcessors]);

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
