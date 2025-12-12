import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useCatalog } from "../state/useCatalog";
import { useQueue } from "../state/queue";
import { type FileEntry, getFileUrl, publishFile, uploadFile } from "../lib/api/files";
import { FILE_ENTRY_MIME } from "../lib/drag-constants";
import { Spinner } from "./ui/Spinner";
import { PublishModal } from "./PublishModal";
import {
  listGenerations,
  listPrompts,
  recordFileMetadata,
  type GenerationListEntry,
  type PromptHistoryEntry,
} from "../lib/api/meta";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp"];
const VIDEO_EXTS = ["mp4", "webm", "mov", "mkv"];

export default function FileBrowser() {
  const {
    state: { entries, q, filterExt, selected, loading, connection },
    actions: { setQuery, setFilters, select, refreshTree, rename, remove },
  } = useCatalog();

  const { jobs } = useQueue();
  const activeJobs = useMemo(() =>
    jobs.filter(j => j.status === "pending" || j.status === "processing"),
    [jobs]);

  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [showRecent, setShowRecent] = useState(false);
  const [recentTab, setRecentTab] = useState<"generations" | "prompts">("generations");
  const [recentGenerations, setRecentGenerations] = useState<GenerationListEntry[]>([]);
  const [recentBusy, setRecentBusy] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [recentPrompts, setRecentPrompts] = useState<PromptHistoryEntry[]>([]);
  const [promptBusy, setPromptBusy] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [publishingEntry, setPublishingEntry] = useState<FileEntry | null>(null);
  const [editName, setEditName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [fileDims, setFileDims] = useState<Record<string, { w: number; h: number }>>({});
  const [operationLoading, setOperationLoading] = useState<string | null>(null);
  const playingVideoRef = useRef<HTMLVideoElement | null>(null);
  const sentFileMetaRef = useRef<Set<string>>(new Set());

  const getFileStyles = (entry: FileEntry) => {
    if (entry.mime.startsWith("image/")) {
      return {
        grid: "border-red-500/50 bg-red-500/5",
        list: "border-l-red-500/50",
      };
    }
    if (entry.mime.startsWith("video/")) {
      const dims = fileDims[entry.id];
      if (!dims)
        return {
          grid: "border-white/10 bg-black/40",
          list: "border-l-transparent",
        }; // Default until loaded
      if (dims.h >= 1080) {
        return {
          grid: "border-green-500/50 bg-green-500/5",
          list: "border-l-green-500/50",
        };
      }
      return {
        grid: "border-blue-500/50 bg-blue-500/5",
        list: "border-l-blue-500/50",
      };
    }
    return {
      grid: "border-white/10 bg-black/40",
      list: "border-l-transparent",
    };
  };

  const handleRename = async (entry: FileEntry) => {
    if (!editName.trim() || editName === entry.name) {
      setEditingId(null);
      return;
    }
    setOperationLoading(entry.id);
    try {
      await rename(entry, editName.trim());
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to rename "${entry.name}": ${msg}`);
    } finally {
      setEditingId(null);
      setOperationLoading(null);
    }
  };

  const handleDelete = async (entry: FileEntry, e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${entry.name}"?`)) return;
    setOperationLoading(entry.id);
    try {
      await remove(entry);
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to delete "${entry.name}": ${msg}`);
    } finally {
      setOperationLoading(null);
    }
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent, entry: FileEntry) => {
    if (editingId) return; // Don't handle shortcuts while editing

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      handleDelete(entry, e);
    } else if (e.key === 'F2') {
      e.preventDefault();
      setEditingId(entry.id);
      setEditName(entry.name);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!connection) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!connection) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    setUploadStatus(`Uploading ${files.length} file(s)...`);

    try {
      let successCount = 0;
      let failCount = 0;
      let renamedCount = 0;

      // Get existing file names for collision detection
      const existingNames = new Set(entries.map((entry) => entry.name.toLowerCase()));

      for (const file of files) {
        try {
          let targetName = file.name;

          // Check for collision and auto-rename if needed
          if (existingNames.has(targetName.toLowerCase())) {
            const ext = targetName.includes('.') ? '.' + targetName.split('.').pop() : '';
            const baseName = ext ? targetName.slice(0, -ext.length) : targetName;
            const timestamp = Date.now();
            targetName = `${baseName}_${timestamp}${ext}`;
            renamedCount++;
          }

          // Add to existing names to prevent intra-batch collisions
          existingNames.add(targetName.toLowerCase());

          await uploadFile(connection, targetName, file);
          successCount++;
        } catch (err) {
          console.error(`Failed to upload ${file.name}:`, err);
          failCount++;
        }
      }

      await refreshTree();

      if (failCount > 0) {
        setUploadStatus(`Uploaded ${successCount} files. ${failCount} failed.`);
      } else if (renamedCount > 0) {
        setUploadStatus(`Uploaded ${successCount} files. ${renamedCount} renamed to avoid conflicts.`);
      } else {
        setUploadStatus(`Uploaded ${successCount} files successfully.`);
      }

      setTimeout(() => setUploadStatus(null), 3000);
    } catch (error) {
      console.error("Upload process failed:", error);
      setUploadStatus("Upload process failed");
      setTimeout(() => setUploadStatus(null), 3000);
    }
  };

  const handlePublish = async (metadata: {
    project: string;
    sequence: string;
    shot: string;
    version: string;
  }) => {
    if (!connection || !publishingEntry) return;

    try {
      await publishFile(connection, publishingEntry.relPath, metadata);
      setPublishingEntry(null);
      alert("File published successfully!");
    } catch (error) {
      console.error("Publish failed:", error);
      throw error; // Re-throw for modal to handle
    }
  };

  const [visibleCount, setVisibleCount] = useState(30);

  const formatAgo = (timestamp: number) => {
    const deltaMs = Date.now() - timestamp;
    const s = Math.floor(deltaMs / 1000);
    if (!Number.isFinite(s) || s < 0) return "";
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
  };

  const refreshRecent = useCallback(async () => {
    if (!connection) return;
    setRecentBusy(true);
    setRecentError(null);
    try {
      const entries = await listGenerations(connection, { limit: 30 });
      setRecentGenerations(entries);
    } catch (error) {
      setRecentError(error instanceof Error ? error.message : "Failed to load recent generations");
    } finally {
      setRecentBusy(false);
    }
  }, [connection]);

  const refreshPrompts = useCallback(async () => {
    if (!connection) return;
    setPromptBusy(true);
    setPromptError(null);
    try {
      const entries = await listPrompts(connection, { limit: 30 });
      setRecentPrompts(entries);
    } catch (error) {
      setPromptError(error instanceof Error ? error.message : "Failed to load prompt history");
    } finally {
      setPromptBusy(false);
    }
  }, [connection]);

  useEffect(() => {
    if (!showRecent) return;
    if (recentTab === "prompts") {
      void refreshPrompts();
    } else {
      void refreshRecent();
    }
  }, [showRecent, recentTab, refreshRecent, refreshPrompts, connection?.workspaceId]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(30);
  }, [q, filterExt, connection?.workspaceId]);

  const filteredEntries = useMemo(() => {
    const query = q.trim().toLowerCase();
    return entries.filter((entry) => {
      if (!connection) return false;

      // 1. Basic Exclusion: No directories, no dotfiles
      if (entry.kind === "dir") return false;
      if (entry.name.startsWith(".")) return false;

      // 2. Mime Type Check: Only images and videos
      const isMedia = entry.mime.startsWith("image/") || entry.mime.startsWith("video/");
      if (!isMedia) return false;

      // 3. Search Query
      const matchesQuery = query
        ? entry.name.toLowerCase().includes(query) ||
        entry.relPath.toLowerCase().includes(query)
        : true;

      // 4. Extension Filter (if active)
      const matchesExt =
        filterExt.length === 0 ||
        filterExt.includes(entry.ext);

      return matchesQuery && matchesExt;
    });
  }, [entries, q, filterExt, connection]);

  const visibleEntries = useMemo(() => {
    return filteredEntries.slice(0, visibleCount);
  }, [filteredEntries, visibleCount]);

  // Cleanup fileDims for removed files
  useEffect(() => {
    setFileDims((prev) => {
      const next = { ...prev };
      let changed = false;
      const currentIds = new Set(entries.map((e) => e.id));
      for (const id in next) {
        if (!currentIds.has(id)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [entries]);

  // Seed fileDims from server-provided metadata when available
  useEffect(() => {
    setFileDims((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const entry of entries) {
        if (
          typeof entry.width === "number" &&
          typeof entry.height === "number" &&
          entry.width > 0 &&
          entry.height > 0
        ) {
          const existing = next[entry.id];
          if (!existing || existing.w !== entry.width || existing.h !== entry.height) {
            next[entry.id] = { w: entry.width, h: entry.height };
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [entries]);

  const toggleGroup = (group: "images" | "videos") => {
    const groupExts = group === "images" ? IMAGE_EXTS : VIDEO_EXTS;
    const allSelected = groupExts.every((ext) => filterExt.includes(ext));

    if (allSelected) {
      // Remove all extensions from this group
      setFilters(filterExt.filter((ext) => !groupExts.includes(ext)));
    } else {
      // Add all extensions from this group (avoiding duplicates)
      const newFilters = new Set([...filterExt, ...groupExts]);
      setFilters(Array.from(newFilters));
    }
  };

  const isImagesActive = IMAGE_EXTS.every((ext) => filterExt.includes(ext));
  const isVideosActive = VIDEO_EXTS.every((ext) => filterExt.includes(ext));

  if (!connection) {
    return (
      <div className="rounded-lg border border-dashed border-white/20 bg-gradient-to-br from-sky-500/5 to-indigo-500/5 p-6 text-sm">
        <div className="mb-2 text-base font-semibold text-sky-200">
          📂 No Workspace Connected
        </div>
        <div className="text-slate-300">
          Click <strong>"Connect"</strong> at the top to link your workspace API and start browsing files.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search files"
          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
        />
        <div className="flex items-center rounded-lg border border-white/10 bg-black/40 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`rounded px-2 py-1.5 text-xs font-medium transition-colors ${viewMode === "list"
              ? "bg-white/10 text-white"
              : "text-slate-400 hover:text-white"
              }`}
            title="List View"
          >
            ☰
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`rounded px-2 py-1.5 text-xs font-medium transition-colors ${viewMode === "grid"
              ? "bg-white/10 text-white"
              : "text-slate-400 hover:text-white"
              }`}
            title="Grid View"
          >
            ⊞
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowRecent((v) => !v)}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${showRecent
            ? "border-sky-400 text-sky-200"
            : "border-white/10 text-slate-200 hover:border-sky-400 hover:text-sky-200"
            }`}
        >
          Recent
        </button>
        <button
          type="button"
          onClick={() => {
            refreshTree();
            setVisibleCount(30);
          }}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-sky-400 hover:text-sky-200"
        >
          Refresh
        </button>
      </div>

      {showRecent ? (
        <div className="rounded-lg border border-white/10 bg-black/20">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Recent
              </div>
              <div className="flex items-center rounded-md border border-white/10 bg-black/30 p-0.5">
                <button
                  type="button"
                  onClick={() => setRecentTab("generations")}
                  className={`rounded px-2 py-1 text-[11px] font-semibold transition ${recentTab === "generations"
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  Generations
                </button>
                <button
                  type="button"
                  onClick={() => setRecentTab("prompts")}
                  className={`rounded px-2 py-1 text-[11px] font-semibold transition ${recentTab === "prompts"
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  Prompts
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void (recentTab === "prompts" ? refreshPrompts() : refreshRecent())}
              disabled={recentTab === "prompts" ? promptBusy : recentBusy}
              className="rounded-md border border-white/10 px-2 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-sky-400 hover:text-sky-200 disabled:opacity-60"
            >
              {recentTab === "prompts"
                ? promptBusy
                  ? "..."
                  : "Refresh"
                : recentBusy
                  ? "..."
                  : "Refresh"}
            </button>
          </div>

          {recentTab === "generations" ? (
            recentError ? (
              <div className="px-3 py-2 text-xs text-rose-300">
                {recentError}
              </div>
            ) : recentGenerations.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-400">
                No generation history yet for this workspace.
              </div>
            ) : (
              <div className="max-h-[220px] overflow-auto">
                {recentGenerations.map((gen) => {
                  const fileName =
                    gen.output_rel_path.split("/").filter(Boolean).pop() ?? gen.output_rel_path;
                  const subtitle =
                    gen.model_id || gen.category || "generation";
                  const title = gen.prompt?.trim()
                    ? gen.prompt.trim()
                    : fileName;

                  return (
                    <button
                      key={gen.id}
                      type="button"
                      onClick={() => {
                        const match = entries.find((e) => e.relPath === gen.output_rel_path);
                        if (match) {
                          select(match);
                        } else {
                          void refreshTree(gen.output_rel_path);
                        }
                      }}
                      className="flex w-full items-center gap-3 border-b border-white/5 px-3 py-2 text-left text-xs transition hover:bg-white/5"
                    >
                      <div className="w-10 shrink-0 text-[10px] font-semibold text-slate-400">
                        {formatAgo(gen.created_at)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-slate-100">
                          {title}
                        </div>
                        <div className="truncate text-[10px] text-slate-400">
                          {subtitle} · {gen.output_rel_path}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : promptError ? (
            <div className="px-3 py-2 text-xs text-rose-300">
              {promptError}
            </div>
          ) : recentPrompts.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-400">
              No prompt history yet for this workspace.
            </div>
          ) : (
            <div className="max-h-[220px] overflow-auto">
              {recentPrompts.map((p) => (
                <button
                  key={String(p.id)}
                  type="button"
                  onClick={() => setQuery(p.prompt)}
                  className="flex w-full items-center gap-3 border-b border-white/5 px-3 py-2 text-left text-xs transition hover:bg-white/5"
                  title="Click to set search"
                >
                  <div className="w-10 shrink-0 text-[10px] font-semibold text-slate-400">
                    {formatAgo(p.created_at)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-slate-100">
                      {p.prompt}
                    </div>
                    <div className="truncate text-[10px] text-slate-400">
                      {p.model_id || "prompt"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1 text-xs">
        <button
          type="button"
          onClick={() => toggleGroup("images")}
          className={`rounded-full px-3 py-1 font-semibold transition-colors ${isImagesActive
            ? "bg-sky-500/30 text-white"
            : "bg-white/10 text-slate-300 hover:text-white"
            }`}
        >
          Images
        </button>
        <button
          type="button"
          onClick={() => toggleGroup("videos")}
          className={`rounded-full px-3 py-1 font-semibold transition-colors ${isVideosActive
            ? "bg-sky-500/30 text-white"
            : "bg-white/10 text-slate-300 hover:text-white"
            }`}
        >
          Videos
        </button>
        {filterExt.length ? (
          <button
            type="button"
            onClick={() => setFilters([])}
            className="rounded-full px-3 py-1 font-semibold text-slate-300 hover:text-white"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div
        className={`relative flex-1 overflow-auto rounded-lg border transition-colors ${isDragging
          ? "border-sky-400 bg-sky-500/10"
          : "border-white/10 bg-black/20"
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="rounded-xl border border-sky-500/30 bg-black/80 p-6 text-center shadow-2xl">
              <div className="mb-2 text-4xl">📥</div>
              <div className="text-lg font-semibold text-sky-200">Drop files to upload</div>
            </div>
          </div>
        )}
        {uploadStatus && (
          <div className="absolute top-2 right-2 z-20 rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white shadow-lg">
            {uploadStatus}
          </div>
        )}
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : filteredEntries.length === 0 && entries.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="max-w-sm text-center">
              <div className="mb-3 text-4xl">🎨</div>
              <div className="mb-2 text-base font-semibold text-white">
                No Files Yet
              </div>
              <div className="text-sm text-slate-300">
                Generate your first image or video using the controls on the left. Your files will appear here automatically!
              </div>
            </div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-300">
            <div className="mb-1">🔍 No files match your search</div>
            <div className="text-xs text-slate-400">Try a different search term or clear your filters</div>
          </div>
        ) : (
          <div className="flex flex-col min-h-full">
            {viewMode === "grid" ? (
              <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3">
                {activeJobs.map((job) => (
                  <div
                    key={job.id}
                    className="relative flex aspect-square flex-col overflow-hidden rounded-lg border border-white/10 bg-black/40 animate-pulse"
                  >
                    <div className="flex h-full items-center justify-center">
                      <Spinner size="lg" />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 backdrop-blur-sm">
                      <div className="truncate text-xs text-slate-300 italic">
                        {job.status === "processing" ? "Generating..." : "Queued..."}
                      </div>
                    </div>
                  </div>
                ))}
                {visibleEntries.map((entry) => {
                  const url = getFileUrl(connection, entry.relPath, { includeToken: true });
                  const styles = getFileStyles(entry);

	                  return (
	                    <button
	                      key={entry.id}
	                      type="button"
	                      draggable={entry.kind === "file"}
	                      onDragStart={(event) => {
	                        if (entry.kind === "file") {
	                          event.dataTransfer.setData(
                            FILE_ENTRY_MIME,
                            JSON.stringify({
                              workspaceId: connection.workspaceId,
                              path: entry.relPath,
                              name: entry.name,
                              mime: entry.mime,
                            })
                          );
                          event.dataTransfer.effectAllowed = "copy";
                          event.dataTransfer.setData("DownloadURL", `${entry.mime}:${entry.name}:${url}`);
                        }
                      }}
                      onClick={() => select(entry)}
                      onKeyDown={(e) => handleKeyDown(e, entry)}
                      className={`group relative flex aspect-square flex-col overflow-hidden rounded-lg border transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${selected?.id === entry.id ? "ring-2 ring-yellow-500" : ""
                        } ${styles.grid}`}
	                    >
	                      <div className="flex-1 w-full overflow-hidden bg-white/5">
	                        {entry.kind === "dir" ? (
	                          <div className="flex h-full items-center justify-center text-4xl">
	                            📁
	                          </div>
	                        ) : entry.mime.startsWith("video") ? (
	                          <video
	                            src={url}
	                            className="h-full w-full object-cover"
	                            preload="metadata"
	                            muted
	                            loop
	                            playsInline
	                            onMouseEnter={(e) => {
	                              const target = e.currentTarget;
	                              if (playingVideoRef.current && playingVideoRef.current !== target) {
	                                playingVideoRef.current.pause();
	                                playingVideoRef.current.currentTime = 0;
	                              }
	                              playingVideoRef.current = target;
	                              void target.play();
	                            }}
	                            onMouseLeave={(e) => {
	                              const target = e.currentTarget;
	                              target.pause();
	                              target.currentTime = 0;
	                              if (playingVideoRef.current === target) {
	                                playingVideoRef.current = null;
	                              }
	                            }}
	                            onLoadedMetadata={(e) => {
	                              const target = e.target as HTMLVideoElement;
	                              const dims = { w: target.videoWidth, h: target.videoHeight };
	                              setFileDims((prev) => ({
	                                ...prev,
	                                [entry.id]: dims,
	                              }));
	                              if (
	                                typeof entry.width === "number" &&
	                                typeof entry.height === "number" &&
	                                entry.width === dims.w &&
	                                entry.height === dims.h &&
	                                (Number.isFinite(target.duration) && target.duration > 0
	                                  ? typeof entry.duration === "number" &&
	                                  Number.isFinite(entry.duration) &&
	                                  Math.abs(entry.duration - target.duration) < 0.25
	                                  : true)
	                              ) {
	                                return;
	                              }
	                              const key = entry.id;
	                              if (!sentFileMetaRef.current.has(key)) {
	                                sentFileMetaRef.current.add(key);
	                                void recordFileMetadata(connection, {
	                                  workspaceId: connection.workspaceId,
	                                  relPath: entry.relPath,
	                                  width: dims.w,
	                                  height: dims.h,
	                                  duration:
	                                    Number.isFinite(target.duration) && target.duration > 0
	                                      ? target.duration
	                                      : undefined,
	                                }).catch(() => {
	                                  sentFileMetaRef.current.delete(key);
	                                });
	                              }
	                            }}
	                          />
	                        ) : (
	                          <img
	                            src={url}
	                            alt={entry.name}
	                            className="h-full w-full object-cover"
	                            loading="lazy"
	                            onLoad={(e) => {
	                              const target = e.target as HTMLImageElement;
	                              const dims = { w: target.naturalWidth, h: target.naturalHeight };
	                              setFileDims((prev) => ({
	                                ...prev,
	                                [entry.id]: dims,
	                              }));
	                              if (
	                                typeof entry.width === "number" &&
	                                typeof entry.height === "number" &&
	                                entry.width === dims.w &&
	                                entry.height === dims.h
	                              ) {
	                                return;
	                              }
	                              const key = entry.id;
	                              if (!sentFileMetaRef.current.has(key)) {
	                                sentFileMetaRef.current.add(key);
	                                void recordFileMetadata(connection, {
	                                  workspaceId: connection.workspaceId,
	                                  relPath: entry.relPath,
	                                  width: dims.w,
	                                  height: dims.h,
	                                }).catch(() => {
	                                  sentFileMetaRef.current.delete(key);
	                                });
	                              }
	                            }}
	                          />
	                        )}
	                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 backdrop-blur-sm">
                        {editingId === entry.id ? (
                          <input
                            autoFocus
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={() => handleRename(entry)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRename(entry);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full rounded border border-sky-500/50 bg-black/50 px-1 py-0.5 text-xs text-white outline-none"
                          />
                        ) : (
                          <div
                            className="truncate text-xs text-white cursor-text"
                            title={entry.name}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingId(entry.id);
                              setEditName(entry.name);
                            }}
                          >
                            {entry.name}
                          </div>
                        )}
                      </div>
                      {operationLoading === entry.id && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                          <Spinner size="md" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPublishingEntry(entry);
                        }}
                        className="absolute top-1 right-8 rounded bg-black/60 p-1 text-xs opacity-0 transition-opacity hover:bg-sky-500 hover:text-white group-hover:opacity-100"
                        title="Publish"
                      >
                        🚀
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(entry, e)}
                        className="absolute top-1 right-1 rounded bg-black/60 p-1 text-xs opacity-0 transition-opacity hover:bg-red-500 hover:text-white group-hover:opacity-100"
                        title="Delete (Del)"
                      >
                        🗑️
                      </button>
                    </button>
                  );
                })}
              </div>
            ) : (
              <ul>
                {activeJobs.map((job) => (
                  <li key={job.id} className="flex w-full items-center gap-3 border-l-4 border-l-transparent px-3 py-2 text-left text-sm opacity-70">
                    <div className="flex h-5 w-5 items-center justify-center">
                      <Spinner size="sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-400 truncate italic">
                        {job.status === "processing" ? "Generating..." : "Queued..."}
                      </div>
                    </div>
                  </li>
                ))}
                {visibleEntries.map((entry) => {
                  const url = getFileUrl(connection, entry.relPath, { includeToken: true });
                  const styles = getFileStyles(entry);
                  const dims = fileDims[entry.id];

                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        draggable={entry.kind === "file"}
                        onDragStart={(event) => {
                          if (entry.kind === "file") {
                            event.dataTransfer.setData(
                              FILE_ENTRY_MIME,
                              JSON.stringify({
                                workspaceId: connection.workspaceId,
                                path: entry.relPath,
                                name: entry.name,
                                mime: entry.mime,
                              })
                            );
                            event.dataTransfer.effectAllowed = "copy";
                            event.dataTransfer.setData("DownloadURL", `${entry.mime}:${entry.name}:${url}`);
                          }
                        }}
                        onClick={() => select(entry)}
                        className={`group flex w-full items-center justify-between gap-3 border-l-4 px-3 py-2 text-left text-sm transition ${selected?.id === entry.id ? "bg-yellow-500/20" : ""
                          } ${styles.list}`}
                      >
                        {/* Hidden media for metadata capture - REMOVED for memory optimization */}

                        <div className="flex-1 min-w-0">
                          {editingId === entry.id ? (
                            <input
                              autoFocus
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onBlur={() => handleRename(entry)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRename(entry);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full rounded border border-sky-500/50 bg-black/50 px-1 py-0.5 text-white outline-none"
                            />
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <div
                                className="font-semibold text-white truncate"
                                title={entry.name}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setEditingId(entry.id);
                                  setEditName(entry.name);
                                }}
                              >
                                {entry.name}
                                {entry.kind === "dir" ? "/" : ""}
                              </div>
                              {dims && (
                                <span className="flex-shrink-0 text-[10px] text-slate-500 font-mono">
                                  {dims.w}x{dims.h} ({(() => {
                                    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
                                    const div = gcd(dims.w, dims.h);
                                    return `${dims.w / div}:${dims.h / div}`;
                                  })()})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-right text-xs text-slate-400">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPublishingEntry(entry);
                            }}
                            className="opacity-0 transition-opacity group-hover:opacity-100 p-1 hover:text-sky-400"
                            title="Publish"
                          >
                            🚀
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(entry, e)}
                            className="opacity-0 transition-opacity group-hover:opacity-100 p-1 hover:text-red-400"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {visibleCount < filteredEntries.length && (
              <div className="p-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 30)}
                  className="rounded-full bg-white/10 px-6 py-2 text-sm font-semibold text-white transition hover:bg-white/20 hover:scale-105 active:scale-95"
                >
                  Load More ({filteredEntries.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {publishingEntry && (
        <PublishModal
          fileName={publishingEntry.name}
          defaultProject={connection.workspaceId !== "default" ? connection.workspaceId : ""}
          onConfirm={handlePublish}
          onCancel={() => setPublishingEntry(null)}
        />
      )}
    </div>
  );
}
