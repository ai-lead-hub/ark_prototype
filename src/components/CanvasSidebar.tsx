import { useState, useMemo } from "react";
import { useCatalog } from "../state/useCatalog";
import { getFileUrl, type FileEntry } from "../lib/api/files";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "gif"];
const VIDEO_EXTS = ["mp4", "webm", "mov", "mkv"];

type FilterMode = "all" | "images" | "videos";

export default function CanvasSidebar() {
    const {
        state: { entries, connection },
        actions: { refreshTree },
    } = useCatalog();
    const [filter, setFilter] = useState<FilterMode>("all");
    const [searchQuery, setSearchQuery] = useState("");

    const filteredEntries = useMemo(() => {
        let filtered = entries.filter((e) => e.kind === "file");

        // Filter by type
        if (filter === "images") {
            filtered = filtered.filter((e) => IMAGE_EXTS.includes(e.ext.toLowerCase()));
        } else if (filter === "videos") {
            filtered = filtered.filter((e) => VIDEO_EXTS.includes(e.ext.toLowerCase()));
        } else {
            // "all" still only shows images and videos
            filtered = filtered.filter((e) =>
                [...IMAGE_EXTS, ...VIDEO_EXTS].includes(e.ext.toLowerCase())
            );
        }

        // Filter by search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter((e) => e.name.toLowerCase().includes(query));
        }

        // Sort by most recent
        return filtered.sort((a, b) => b.mtime - a.mtime);
    }, [entries, filter, searchQuery]);

    const handleDragStart = (e: React.DragEvent, entry: FileEntry) => {
        if (!connection) return;

        const url = getFileUrl(connection, entry.relPath, { includeToken: true });
        const isImage = IMAGE_EXTS.includes(entry.ext.toLowerCase());

        const data = {
            url,
            name: entry.name,
            type: isImage ? "image" : "video",
            width: entry.width,
            height: entry.height,
        };

        console.log('Dragging asset:', data);
        e.dataTransfer.setData("application/json", JSON.stringify(data));
        e.dataTransfer.effectAllowed = "copy";
    };

    return (
        <aside className="w-64 flex-shrink-0 border-r border-white/10 bg-slate-950/80 flex flex-col">
            {/* Header */}
            <div className="p-3 border-b border-white/10">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-semibold text-slate-200">Assets</h2>
                    <button
                        onClick={() => refreshTree()}
                        className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                        title="Refresh"
                    >
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                    </button>
                </div>

                {/* Search */}
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search assets..."
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                />

                {/* Filter pills */}
                <div className="flex gap-1 mt-2">
                    {(["all", "images", "videos"] as const).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setFilter(mode)}
                            className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${filter === mode
                                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                                : "bg-white/5 text-slate-400 border border-transparent hover:bg-white/10"
                                }`}
                        >
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Asset grid */}
            <div className="flex-1 overflow-y-auto p-2">
                {!connection ? (
                    <div className="flex items-center justify-center h-32 text-slate-500 text-xs">
                        Connect to a workspace
                    </div>
                ) : filteredEntries.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-slate-500 text-xs">
                        No assets found
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        {filteredEntries.map((entry) => (
                            <AssetThumbnail
                                key={entry.id}
                                entry={entry}
                                connection={connection}
                                onDragStart={handleDragStart}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="p-2 border-t border-white/10 text-xs text-slate-500 text-center">
                {filteredEntries.length} asset{filteredEntries.length !== 1 ? "s" : ""}
            </div>
        </aside>
    );
}

function AssetThumbnail({
    entry,
    connection,
    onDragStart,
}: {
    entry: FileEntry;
    connection: { apiBase: string; workspaceId: string; token?: string };
    onDragStart: (e: React.DragEvent, entry: FileEntry) => void;
}) {
    const url = getFileUrl(connection, entry.relPath, { includeToken: true });
    const isVideo = VIDEO_EXTS.includes(entry.ext.toLowerCase());
    const [isHovering, setIsHovering] = useState(false);

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, entry)}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            className="relative aspect-square rounded-lg overflow-hidden bg-black/40 border border-white/10 cursor-grab hover:border-sky-400/50 transition-colors group"
            title={entry.name}
        >
            {isVideo ? (
                <video
                    src={url}
                    className="w-full h-full object-cover pointer-events-none"
                    muted
                    loop
                    playsInline
                    autoPlay={isHovering}
                    draggable={false}
                />
            ) : (
                <img
                    src={url}
                    alt={entry.name}
                    className="w-full h-full object-cover pointer-events-none"
                    draggable={false}
                />
            )}

            {/* Video indicator */}
            {isVideo && (
                <div className="absolute top-1 right-1 bg-black/60 rounded px-1 py-0.5 text-[10px] text-white">
                    ▶
                </div>
            )}

            {/* Name overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[10px] text-white truncate">{entry.name}</p>
            </div>
        </div>
    );
}
