import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useCatalog } from "../state/useCatalog";
import { useQueue } from "../state/queue";
import { type FileEntry, getFileUrl, publishFile, uploadFile, trashFiles } from "../lib/api/files";
import { FILE_ENTRY_MIME } from "../lib/drag-constants";
import ProjectBar from "./ProjectBar";
import { Spinner } from "./ui/Spinner";
import { PublishModal } from "./PublishModal";
import { buildDatedMediaPath, mediaFolderFromMime } from "../lib/storage-paths";
import {
  loadPublished,
  addPublished,
  isPublished,
  type PublishedMap,
} from "../lib/published";
import {
  recordFileMetadata,
  setPin as apiSetPin,
  removePin as apiRemovePin,
  renamePin as apiRenamePin,
} from "../lib/api/meta";
import { useHoverPlayVideos } from "../lib/useHoverPlayVideos";
import CanvasBrowser, { type CanvasBrowserItem } from "./CanvasBrowser";
import ShotContainer from "./ShotContainer";
import { useShots } from "../state/shots";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp"];
const VIDEO_EXTS = ["mp4", "webm", "mov", "mkv"];
const SHOW_QUEUE_PREVIEW_TILE = true;

type QueueTileView = {
  id: string;
  status: "pending" | "processing" | "failed";
  type: "image" | "video" | "upscale";
  name: string;
  payload: unknown;
  timestamp: number;
  logs: string[];
  error?: string;
  demoProgress?: number;
};

type FileBrowserProps = {
  disableKeyboardNav?: boolean;
  onBack?: () => void;
};

function formatTileDuration(duration?: number): string | null {
  if (!Number.isFinite(duration) || !duration || duration <= 0) {
    return null;
  }

  const totalSeconds = Math.max(1, Math.round(duration));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function FileBrowser({ disableKeyboardNav, onBack }: FileBrowserProps) {
  const {
    state: { entries: catalogEntries, q, filterExt, sortByName, pins, selected, loading, connection },
    actions: { setQuery, setFilters, setSortByName, setPins, refreshPins, select, refreshTree, rename },
  } = useCatalog();

  // DUMMY DATA FOR TESTING LAYOUT
  const entries = useMemo<FileEntry[]>(() => {
    if (!catalogEntries) return [];
    const dummies: FileEntry[] = [
      { id: "dummy-img-1", name: "hero_shot.jpg", relPath: "dummy/hero_shot.jpg", kind: "file", size: 1024, mtime: Date.now(), mime: "image/jpeg", ext: "jpg" },
      { id: "dummy-vid-1", name: "cinematic_pan.mp4", relPath: "dummy/cinematic_pan.mp4", kind: "file", size: 4096, mtime: Date.now() - 1000, mime: "video/mp4", ext: "mp4" },
      { id: "dummy-img-2", name: "character_design.png", relPath: "dummy/character_design.png", kind: "file", size: 2048, mtime: Date.now() - 2000, mime: "image/png", ext: "png" },
      { id: "dummy-vid-2", name: "action_sequence.webm", relPath: "dummy/action_sequence.webm", kind: "file", size: 8192, mtime: Date.now() - 3000, mime: "video/webm", ext: "webm" },
      { id: "dummy-img-3", name: "environment_concept.jpeg", relPath: "dummy/environment_concept.jpeg", kind: "file", size: 5048, mtime: Date.now() - 4000, mime: "image/jpeg", ext: "jpeg" },
      { id: "dummy-img-4", name: "close_up_portrait.png", relPath: "dummy/close_up_portrait.png", kind: "file", size: 3048, mtime: Date.now() - 5000, mime: "image/png", ext: "png" },
    ];
    return [...dummies, ...catalogEntries];
  }, [catalogEntries]);

  const { jobs, retryJob } = useQueue();
  const { shots, activeShot, inactiveShots, setActiveShot, navigateShot, sceneName, projectName, allScenes, activeSceneId, setActiveScene } = useShots();
  const queueTiles = useMemo(
    () => {
      const rank: Record<"processing" | "pending" | "failed" | "completed", number> = {
        processing: 0,
        pending: 1,
        failed: 2,
        completed: 3,
      };

      return [...jobs]
        .filter((job) => job.status === "pending" || job.status === "processing" || job.status === "failed")
        .sort((a, b) => {
          const statusDiff = rank[a.status] - rank[b.status];
          if (statusDiff !== 0) return statusDiff;
          return b.timestamp - a.timestamp;
        });
    },
    [jobs]
  );
  const hasRealQueueTiles = queueTiles.length > 0;
  const [demoQueuePhase, setDemoQueuePhase] = useState<"processing" | "completed">("processing");
  const [demoQueueProgress, setDemoQueueProgress] = useState(0);
  const visibleQueueTiles = useMemo(() => {
    if (queueTiles.length > 0) return queueTiles as QueueTileView[];
    if (!SHOW_QUEUE_PREVIEW_TILE) return [];
    if (demoQueuePhase === "completed") return [];

    return [
      {
        id: "queue-preview-tile",
        status: "processing" as const,
        type: "image" as const,
        name: "Queue Preview Tile",
        payload: null,
        timestamp: Date.now(),
        logs: [
          "Queued and waiting for a worker slot.",
          "Prompt bundle uploaded.",
          "Rendering first frame.",
        ],
        demoProgress: demoQueueProgress,
      },
    ];
  }, [demoQueuePhase, demoQueueProgress, queueTiles]);
  const showDemoCompletedTile =
    SHOW_QUEUE_PREVIEW_TILE && !hasRealQueueTiles && demoQueuePhase === "completed";

  const [published, setPublished] = useState<PublishedMap>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [publishingEntry, setPublishingEntry] = useState<FileEntry | null>(null);
  const [editName, setEditName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const [operationLoading, setOperationLoading] = useState<string | null>(null);
  const playingVideoRef = useRef<HTMLVideoElement | null>(null);
  const sentFileMetaRef = useRef<Set<string>>(new Set());

  // Multi-select mode state
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const lastClickedIdRef = useRef<string | null>(null);

  const [filterOpen, setFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "canvas">("grid");
  const [hoverPlayVideos] = useHoverPlayVideos();

  const iconButtonBase =
    "kv-icon-button rounded-full p-1 text-xs transition-opacity";
  const iconButtonHidden = "opacity-0 group-hover:opacity-100";
  const iconButtonVisible = "opacity-100";
  const toolbarIconButtonBase =
    "kv-icon-button inline-flex h-9 w-9 items-center justify-center rounded-full";
  const tileMetaIconChip =
    "flex h-7 w-7 items-center justify-center rounded-full bg-[#b7ae9d]/42 text-white/92 shadow-[0_8px_18px_rgba(0,0,0,0.12)] backdrop-blur-[10px]";
  const tileMetaInfoChip =
    "flex items-center gap-1.5 rounded-full bg-[#b7ae9d]/42 px-2.5 py-1.5 text-[11px] font-medium text-white/92 shadow-[0_8px_18px_rgba(0,0,0,0.12)] backdrop-blur-[10px]";

  const workspaceKey = useMemo(() => {
    if (!connection) return "";
    return `${connection.apiBase}|${connection.workspaceId}`;
  }, [connection]);

  useEffect(() => {
    if (!SHOW_QUEUE_PREVIEW_TILE || hasRealQueueTiles) return;

    let progressTimer: number | undefined;
    let phaseTimer: number | undefined;

    if (demoQueuePhase === "processing") {
      setDemoQueueProgress(0);
      let progress = 0;
      progressTimer = window.setInterval(() => {
        progress = Math.min(progress + 10, 100);
        setDemoQueueProgress(progress);

        if (progress >= 100) {
          window.clearInterval(progressTimer);
          phaseTimer = window.setTimeout(() => {
            setDemoQueuePhase("completed");
          }, 350);
        }
      }, 280);
    } else {
      phaseTimer = window.setTimeout(() => {
        setDemoQueuePhase("processing");
      }, 1600);
    }

    return () => {
      if (progressTimer) {
        window.clearInterval(progressTimer);
      }
      if (phaseTimer) {
        window.clearTimeout(phaseTimer);
      }
    };
  }, [demoQueuePhase, hasRealQueueTiles]);

  useEffect(() => {
    if (!workspaceKey) {
      setPublished({});
      return;
    }
    sentFileMetaRef.current.clear();
    void refreshPins();
    setPublished(loadPublished(workspaceKey));
  }, [workspaceKey, refreshPins]);

  // Toggle pin with server sync
  const handleTogglePin = useCallback(async (relPath: string) => {
    if (!connection) return;
    const isPinned = Boolean(pins[relPath]);

    // Optimistic update
    setPins((prev) => {
      const next = { ...prev };
      if (isPinned) {
        delete next[relPath];
      } else {
        next[relPath] = Date.now();
      }
      return next;
    });

    try {
      if (isPinned) {
        await apiRemovePin(connection, relPath);
      } else {
        await apiSetPin(connection, relPath);
      }
    } catch (error) {
      console.error("Failed to toggle pin:", error);
      // Revert on failure
      void refreshPins();
    }
  }, [connection, pins, refreshPins, setPins]);

  const getFileStyles = useCallback((entry: FileEntry) => {
    if (entry.mime.startsWith("image/") || entry.mime.startsWith("video/")) {
      return "border-transparent bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(17,19,23,0.94))] hover:border-transparent";
    }
    return "border-transparent bg-slate-900/40 hover:bg-slate-800/60";
  }, []);

  const handleRename = async (entry: FileEntry) => {
    if (!editName.trim() || editName === entry.name) {
      setEditingId(null);
      return;
    }
    const nextName = editName.trim();
    // Properly construct new path by replacing only the filename at the end
    const lastSlashIndex = entry.relPath.lastIndexOf('/');
    const directory = lastSlashIndex >= 0 ? entry.relPath.substring(0, lastSlashIndex + 1) : '';
    const newPath = directory + nextName;
    setOperationLoading(entry.id);
    try {
      await rename(entry, nextName);
      if (connection && pins[entry.relPath]) {
        // Update pin path on server
        await apiRenamePin(connection, entry.relPath, newPath).catch(console.error);
        setPins((prev) => {
          const next = { ...prev };
          const pinnedAt = next[entry.relPath];
          delete next[entry.relPath];
          if (pinnedAt) next[newPath] = pinnedAt;
          return next;
        });
      }
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
    if (!connection) return;

    setOperationLoading(entry.id);
    try {
      // Use trash instead of permanent delete
      const result = await trashFiles(connection, [entry.relPath]);

      if (result.success.length > 0) {
        // Remove from pins if pinned
        if (pins[entry.relPath]) {
          await apiRemovePin(connection, entry.relPath).catch(console.error);
          setPins((prev) => {
            const next = { ...prev };
            delete next[entry.relPath];
            return next;
          });
        }
        // Refresh file list
        await refreshTree();
      } else if (result.failed.length > 0) {
        throw new Error(result.failed[0].error);
      }
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to delete "${entry.name}": ${msg}`);
    } finally {
      setOperationLoading(null);
    }
  };

  // Toggle selection for multi-select mode
  const toggleSelection = useCallback((entry: FileEntry) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entry.id)) {
        next.delete(entry.id);
      } else {
        next.add(entry.id);
      }
      return next;
    });
    lastClickedIdRef.current = entry.id;
  }, []);

  // Bulk delete selected files
  const handleBulkDelete = async () => {
    if (!connection || selectedIds.size === 0) return;

    // Confirm before deleting multiple files
    const confirmed = window.confirm(
      `Are you sure you want to trash ${selectedIds.size} file(s)? This action can be undone from the trash.`
    );
    if (!confirmed) return;

    setBulkDeleting(true);
    try {
      const paths = entries
        .filter((e) => selectedIds.has(e.id))
        .map((e) => e.relPath);

      const result = await trashFiles(connection, paths);

      // Remove pins for trashed files
      if (connection) {
        for (const relPath of result.success) {
          if (pins[relPath]) {
            await apiRemovePin(connection, relPath).catch(console.error);
          }
        }
        // Refresh pins from server
        void refreshPins();
      }

      // Clear selection and refresh
      setSelectedIds(new Set());
      setMultiSelectMode(false);
      await refreshTree();

      if (result.failed.length > 0) {
        alert(`Trashed ${result.success.length} files. ${result.failed.length} failed.`);
      }
    } catch (error) {
      console.error(error);
      alert(`Bulk delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setBulkDeleting(false);
    }
  };

  // Exit multi-select mode with Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && multiSelectMode) {
        setMultiSelectMode(false);
        setSelectedIds(new Set());
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [multiSelectMode]);

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

      // Get existing file paths for collision detection
      const existingPaths = new Set(entries.map((entry) => entry.relPath.toLowerCase()));

      for (const file of files) {
        try {
          const folderFromType = mediaFolderFromMime(file.type);
          const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
          const folder =
            folderFromType ??
            (IMAGE_EXTS.includes(ext)
              ? "images"
              : VIDEO_EXTS.includes(ext)
                ? "videos"
                : null);

          if (!folder) {
            failCount++;
            continue;
          }

          let targetName = file.name;
          let targetPath = buildDatedMediaPath(folder, targetName);

          // Check for collision and auto-rename if needed
          if (existingPaths.has(targetPath.toLowerCase())) {
            const ext = targetName.includes('.') ? '.' + targetName.split('.').pop() : '';
            const baseName = ext ? targetName.slice(0, -ext.length) : targetName;
            const timestamp = Date.now();
            targetName = `${baseName}_${timestamp}${ext}`;
            renamedCount++;
            targetPath = buildDatedMediaPath(folder, targetName);
          }

          // Add to existing paths to prevent intra-batch collisions
          existingPaths.add(targetPath.toLowerCase());

          await uploadFile(connection, targetPath, file);
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

  // Handle clipboard paste for images
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    if (!connection) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          // Generate a name for pasted images (they don't have names by default)
          const ext = file.type.split("/")[1] || "png";
          const timestamp = Date.now();
          const namedFile = new File([file], `pasted_image_${timestamp}.${ext}`, {
            type: file.type,
          });
          imageFiles.push(namedFile);
        }
      }
    }

    if (imageFiles.length === 0) return;

    e.preventDefault();
    setUploadStatus(`Pasting ${imageFiles.length} image(s)...`);

    try {
      const existingPaths = new Set(entries.map((entry) => entry.relPath.toLowerCase()));
      let successCount = 0;
      let failCount = 0;

      for (const file of imageFiles) {
        try {
          let targetName = file.name;
          let targetPath = buildDatedMediaPath("images", targetName);

          // Check for collision and auto-rename if needed
          if (existingPaths.has(targetPath.toLowerCase())) {
            const ext = targetName.includes('.') ? '.' + targetName.split('.').pop() : '';
            const baseName = ext ? targetName.slice(0, -ext.length) : targetName;
            const timestamp = Date.now() + Math.random();
            targetName = `${baseName}_${Math.floor(timestamp)}.${ext.replace('.', '')}`;
            targetPath = buildDatedMediaPath("images", targetName);
          }

          existingPaths.add(targetPath.toLowerCase());
          await uploadFile(connection, targetPath, file);
          successCount++;
        } catch (err) {
          console.error(`Failed to paste image:`, err);
          failCount++;
        }
      }

      await refreshTree();

      if (failCount > 0) {
        setUploadStatus(`Pasted ${successCount} images. ${failCount} failed.`);
      } else {
        setUploadStatus(`Pasted ${successCount} image(s) successfully.`);
      }
      setTimeout(() => setUploadStatus(null), 3000);
    } catch (error) {
      console.error("Paste failed:", error);
      setUploadStatus("Paste failed");
      setTimeout(() => setUploadStatus(null), 3000);
    }
  }, [connection, entries, refreshTree]);

  // Add global paste listener
  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [handlePaste]);

  const handlePublish = async (metadata: {
    project: string;
    sequence: string;
    shot: string;
    version: string;
  }) => {
    if (!connection || !publishingEntry || !workspaceKey) return;

    try {
      // Build new filename from metadata
      const ext = publishingEntry.name.split('.').pop() || '';
      const newName = `${metadata.project}_${metadata.sequence}_${metadata.shot}_v${metadata.version}.${ext}`;
      const folder = publishingEntry.relPath.substring(0, publishingEntry.relPath.lastIndexOf('/'));
      const newPath = folder ? `${folder}/${newName}` : newName;

      // Publish the file
      await publishFile(connection, publishingEntry.relPath, metadata);

      // Rename the file to the new naming convention
      await rename(publishingEntry, newName);

      // Track as published
      setPublished(addPublished(workspaceKey, newPath));

      // Auto-pin the published file
      if (connection) {
        await apiSetPin(connection, newPath).catch(console.error);
        setPins((prev) => ({ ...prev, [newPath]: Date.now() }));
      }

      setPublishingEntry(null);
    } catch (error) {
      console.error("Publish failed:", error);
      throw error; // Re-throw for modal to handle
    }
  };

  const [visibleCount, setVisibleCount] = useState(30);

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

  const orderedEntries = useMemo(() => {
    // Separate pinned and unpinned
    const pinnedEntries = filteredEntries
      .filter((entry) => Boolean(pins[entry.relPath]))
      .sort((a, b) => (pins[b.relPath] ?? 0) - (pins[a.relPath] ?? 0));

    let unpinnedEntries = filteredEntries.filter((entry) => !pins[entry.relPath]);

    // Apply sorting to unpinned entries
    if (sortByName) {
      unpinnedEntries = unpinnedEntries.sort((a, b) => a.name.localeCompare(b.name));
    }
    // Default: sorted by mtime (recency) - entries already come sorted from server

    return [...pinnedEntries, ...unpinnedEntries];
  }, [filteredEntries, pins, sortByName]);

  const visibleEntries = useMemo(() => {
    return orderedEntries.slice(0, visibleCount);
  }, [orderedEntries, visibleCount]);

  const canvasItems = useMemo<CanvasBrowserItem[]>(() => {
    if (!connection) return [];

    const queueItems: CanvasBrowserItem[] = visibleQueueTiles.map((job) => ({
      id: job.id,
      type: "queue",
      name: job.name,
      status: job.status,
      jobType: job.type,
      logs: job.logs,
      progress:
        job.status === "failed"
          ? 100
          : job.id === "queue-preview-tile"
            ? job.demoProgress ?? 0
            : 45,
      error: job.error,
      retryable: job.status === "failed" && job.id !== "queue-preview-tile",
    }));

    const resultItems: CanvasBrowserItem[] = showDemoCompletedTile
      ? [
          {
            id: "queue-preview-result",
            type: "result",
            name: "Demo generated result",
            url: "https://picsum.photos/seed/demo-queue-result/640/360",
          },
        ]
      : [];

    const fileItems: CanvasBrowserItem[] = visibleEntries.map((entry) => {
      const isVideo = entry.mime.startsWith("video/");
      const durationLabel = isVideo
        ? entry.id.startsWith("dummy-vid")
          ? "0:04"
          : formatTileDuration(entry.duration)
        : null;
      const url = entry.id.startsWith("dummy-img")
        ? `https://picsum.photos/seed/${entry.id}/400/225`
        : entry.id.startsWith("dummy-vid")
          ? "https://www.w3schools.com/html/mov_bbb.mp4"
          : getFileUrl(connection, entry.relPath, { includeToken: true });

      return {
        id: entry.id,
        type: "file",
        entry,
        url,
        isVideo,
        durationLabel,
        isPublished: isPublished(published, entry.relPath),
      };
    });

    return [...queueItems, ...resultItems, ...fileItems];
  }, [connection, published, showDemoCompletedTile, visibleEntries, visibleQueueTiles]);

  // Ref for grid container to calculate column count
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  // Arrow key navigation for file browser (full grid navigation with auto-scroll)
  useEffect(() => {
    if (disableKeyboardNav || viewMode === "canvas") return;
    const handleArrowNav = (e: KeyboardEvent) => {
      // Don't navigate if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      // Don't navigate while editing
      if (editingId) return;
      // Don't navigate if modifier keys are pressed (allow Ctrl/Cmd for other shortcuts)
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const isUp = e.key === 'ArrowUp';
      const isDown = e.key === 'ArrowDown';
      const isLeft = e.key === 'ArrowLeft';
      const isRight = e.key === 'ArrowRight';

      if (!isUp && !isDown && !isLeft && !isRight) return;

      e.preventDefault();

      // If nothing selected, select first entry
      if (!selected && visibleEntries.length > 0) {
        select(visibleEntries[0]);
        // Scroll first item into view
        setTimeout(() => {
          const el = document.querySelector(`[data-file-id="${visibleEntries[0].id}"]`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 0);
        return;
      }

      if (!selected) return;

      const currentIndex = visibleEntries.findIndex((entry) => entry.id === selected.id);
      if (currentIndex === -1) {
        // Selected file not in visible list, select first
        if (visibleEntries.length > 0) {
          select(visibleEntries[0]);
        }
        return;
      }

      // Calculate column count based on window width matching Tailwind breakpoints
      // grid-cols-2 by default, sm:grid-cols-3 at 640px+
      const columnCount = window.innerWidth >= 640 ? 3 : 2;

      let nextIndex = currentIndex;
      if (isLeft) {
        nextIndex = currentIndex - 1;
      } else if (isRight) {
        nextIndex = currentIndex + 1;
      } else if (isUp) {
        // Move up one row (subtract column count)
        nextIndex = currentIndex - columnCount;
      } else if (isDown) {
        // Move down one row (add column count)
        nextIndex = currentIndex + columnCount;
      }

      // Clamp to valid range
      if (nextIndex < 0) nextIndex = 0;
      if (nextIndex >= visibleEntries.length) nextIndex = visibleEntries.length - 1;

      if (nextIndex !== currentIndex) {
        const nextEntry = visibleEntries[nextIndex];
        select(nextEntry);
        // Scroll the newly selected item into view
        setTimeout(() => {
          const el = document.querySelector(`[data-file-id="${nextEntry.id}"]`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 0);
      }
    };

    document.addEventListener('keydown', handleArrowNav);
    return () => document.removeEventListener('keydown', handleArrowNav);
  }, [selected, visibleEntries, select, editingId, disableKeyboardNav, viewMode]);

  // Handle multi-select click with shift support for range selection
  const handleMultiSelectClick = useCallback((entry: FileEntry, event: React.MouseEvent) => {
    if (event.shiftKey && lastClickedIdRef.current && lastClickedIdRef.current !== entry.id) {
      // Shift-click: select range between last clicked and current
      const lastIdx = visibleEntries.findIndex((e) => e.id === lastClickedIdRef.current);
      const currentIdx = visibleEntries.findIndex((e) => e.id === entry.id);

      if (lastIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(lastIdx, currentIdx);
        const end = Math.max(lastIdx, currentIdx);
        const rangeIds = visibleEntries.slice(start, end + 1).map((e) => e.id);

        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const id of rangeIds) {
            next.add(id);
          }
          return next;
        });
        return;
      }
    }

    // Regular click: toggle single selection
    toggleSelection(entry);
  }, [visibleEntries, toggleSelection]);


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
      <div className="flex h-full flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 relative">
          <ProjectBar />
        </div>
        <div className="kv-panel-soft rounded-[24px] p-6 text-sm">
          <div className="kv-display mb-2 text-base font-semibold text-amber-200">
            No Workspace Connected
          </div>
          <div className="text-slate-300">
            Click <strong>"Connect"</strong> at the top to link your workspace API and start browsing files.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden overscroll-none">
      <div className="z-30 shrink-0 rounded-[22px] bg-[#111318]/94 pb-2 pt-1 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <ProjectBar mode="leading" />
          </div>

          <div className="flex items-center gap-2 pl-1">
            <input
              type="search"
              value={q}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search files"
              className="kv-input w-36 rounded-full px-3 py-2 text-xs xl:w-48"
            />

            <div className="relative">
              <button
                type="button"
                onClick={() => setFilterOpen(!filterOpen)}
                className={`${toolbarIconButtonBase} ${filterOpen ? "border-amber-400/50 bg-amber-500/10 text-amber-200" : ""}`}
                aria-label="Open filters and sort options"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M7 12h10" /><path d="M10 18h4" /></svg>
              </button>

              {filterOpen && (
                <div className="kv-panel absolute right-0 top-full z-50 mt-2 flex w-52 flex-col gap-1 rounded-[22px] p-2">
                  <button
                    type="button"
                    onClick={() => toggleGroup("images")}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${isImagesActive ? "bg-amber-500/12 text-amber-200" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
                  >
                    Images <span>{isImagesActive ? "✓" : ""}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleGroup("videos")}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${isVideosActive ? "bg-amber-500/12 text-amber-200" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
                  >
                    Videos <span>{isVideosActive ? "✓" : ""}</span>
                  </button>
                  <div className="my-1 h-px bg-white/6" />
                  <button
                    type="button"
                    onClick={() => setSortByName((v) => !v)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    Sort: {sortByName ? "A→Z" : "Newest"} <span>🔃</span>
                  </button>
                  {filterExt.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilters([])}
                      className="mt-1 w-full rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/20"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                refreshTree();
                setVisibleCount(30);
              }}
              className={toolbarIconButtonBase}
              aria-label="Refresh files"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15.55-6.36L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15.55 6.36L3 16" /></svg>
            </button>
          </div>

          <div className="ml-auto flex shrink-0 items-center justify-end gap-2 pl-2">
          <div className="kv-glass flex items-center gap-1 rounded-full p-1">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition ${
                viewMode === "grid"
                  ? "bg-amber-500 text-black shadow-[0_10px_24px_rgba(245,158,11,0.3)]"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("canvas")}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition ${
                viewMode === "canvas"
                  ? "bg-amber-500 text-black shadow-[0_10px_24px_rgba(245,158,11,0.3)]"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14" /><path d="M12 3h7a2 2 0 0 1 2 2v7" /><path d="M12 21h7a2 2 0 0 0 2-2v-7" /><path d="M3 12v7a2 2 0 0 0 2 2h7" /></svg>
            </button>
          </div>

          <ProjectBar mode="utilities" />
        </div>
        </div>
      </div>

      <div
        className={`kv-grid-surface relative min-h-0 flex-1 rounded-[24px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-colors ${
          viewMode === "canvas" ? "overflow-hidden overscroll-none" : "overflow-auto"
        } ${isDragging
          ? "border-amber-400/45 bg-amber-500/10"
          : "border-transparent"
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="kv-panel rounded-[24px] p-6 text-center">
              <div className="mb-2 text-4xl">📥</div>
              <div className="kv-display text-lg font-semibold text-amber-200">Drop files to upload</div>
            </div>
          </div>
        )}
        {uploadStatus && (
          <div className="kv-panel absolute right-2 top-2 z-20 rounded-full px-3 py-1 text-xs font-semibold text-amber-100">
            {uploadStatus}
          </div>
        )}
        {/* Show loading overlay during refresh, but only replace content if no entries exist yet */}
        {loading && entries.length > 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
            <Spinner />
          </div>
        )}
        {loading && entries.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : filteredEntries.length === 0 && entries.length === 0 && visibleQueueTiles.length === 0 && !showDemoCompletedTile ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="max-w-sm text-center">
              <div className="mb-3 text-4xl">🎨</div>
              <div className="kv-display mb-2 text-base font-semibold text-white">
                No Files Yet
              </div>
              <div className="text-sm text-slate-300">
                Generate your first image or video using the controls on the left. Your files will appear here automatically!
              </div>
            </div>
          </div>
        ) : filteredEntries.length === 0 && visibleQueueTiles.length === 0 && !showDemoCompletedTile ? (
          <div className="p-4 text-center text-sm text-slate-300">
            <div className="mb-1">🔍 No files match your search</div>
            <div className="text-xs text-slate-400">Try a different search term or clear your filters</div>
          </div>
        ) : viewMode === "canvas" ? (
          <CanvasBrowser
            items={canvasItems}
            selectedId={selected?.id}
            onSelectFile={select}
            onRetryQueueJob={retryJob}
            hoverPlayVideos={hoverPlayVideos}
            storageKey={workspaceKey ? `canvas-layout:${workspaceKey}` : undefined}
            shots={shots}
          />
        ) : shots.length > 0 ? (
          <div className="flex flex-col gap-3 p-3 min-h-full">
            {/* Project / Scene / Shot header */}
            <div className="flex items-center gap-2 px-1">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
                  aria-label="Back to projects"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
              )}
              <span className="kv-mono text-sm font-semibold text-slate-300">{projectName}</span>
              <span className="text-slate-600">/</span>
              <select
                value={activeSceneId}
                onChange={(e) => setActiveScene(e.target.value)}
                className="kv-mono rounded-lg bg-transparent px-1.5 py-0.5 text-sm font-semibold text-amber-200/80 transition hover:bg-white/5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-400/30"
              >
                {allScenes.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <span className="text-slate-600">/</span>
              <select
                value={activeShot?.id ?? ""}
                onChange={(e) => setActiveShot(e.target.value)}
                className="kv-mono rounded-lg bg-transparent px-1.5 py-0.5 text-sm font-semibold text-amber-200/80 transition hover:bg-white/5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-400/30"
              >
                {shots.map((shot) => (
                  <option key={shot.id} value={shot.id}>{shot.name}</option>
                ))}
              </select>
              <span className="kv-mono text-[10px] text-slate-600">{shots.length} shots</span>
            </div>

            {/* Active shot */}
            {activeShot && (
              <ShotContainer
                shot={activeShot}
                isActive={true}
                onActivate={() => {}}
                onNavigate={navigateShot}
                allShots={shots}
                onSelectShot={setActiveShot}
                demoQueuePhase={demoQueuePhase}
                demoQueueProgress={demoQueueProgress}
              />
            )}

            {/* Inactive shots */}
            {inactiveShots.map((shot) => (
              <ShotContainer
                key={shot.id}
                shot={shot}
                isActive={false}
                onActivate={() => setActiveShot(shot.id)}
                onNavigate={navigateShot}
                allShots={shots}
                onSelectShot={setActiveShot}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col min-h-full">
              <div ref={gridContainerRef} className="grid grid-cols-3 gap-2 p-2">
                {visibleQueueTiles.map((job) => (
                  <div
                    key={job.id}
                    className={`relative flex aspect-video flex-col overflow-hidden rounded-[16px] border ${
                      job.status === "failed"
                        ? "border-rose-500/40 bg-rose-950/12"
                        : "border-amber-400/10 bg-[#17191f]"
                    }`}
                  >
                    <div className="absolute inset-x-0 top-0 z-10 h-1 bg-white/5">
                      <div
                        className={`h-full rounded-full ${
                          job.status === "failed"
                            ? "bg-rose-500/80"
                            : "bg-gradient-to-r from-orange-500 to-amber-400"
                        }`}
                        style={{
                          width: `${job.status === "failed"
                            ? 100
                            : job.id === "queue-preview-tile"
                              ? job.demoProgress ?? 0
                              : 45}%`,
                        }}
                      />
                    </div>

                    <div className="flex h-full flex-col justify-between gap-3 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="kv-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">{`${job.type} job`}</div>
                          <div className="truncate text-sm font-semibold text-white">
                            {job.name}
                          </div>
                        </div>

                        <div
                          className={`kv-mono shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                            job.status === "failed"
                              ? "bg-rose-500/15 text-rose-200"
                              : "bg-amber-500/12 text-amber-200"
                          }`}
                        >
                          {job.status === "processing" ? "Generating" : job.status}
                        </div>
                      </div>

                      <div className="flex flex-1 items-center justify-center overflow-hidden rounded-[12px] border border-transparent bg-black/25">
                        {job.status === "failed" ? (
                          <div className="flex h-full w-full flex-col items-center justify-center bg-rose-500/10 px-4 text-center">
                            <div className="text-sm font-medium text-rose-200">Generation failed</div>
                            <div className="mt-1 text-xs text-rose-200/80">Error preview space</div>
                          </div>
                        ) : (
                          <div className="h-full w-full bg-[radial-gradient(circle_at_35%_18%,rgba(249,115,22,0.14),transparent_0_28%),linear-gradient(135deg,rgba(44,48,58,0.92),rgba(14,15,19,0.96))]" />
                        )}
                      </div>

                      <div className="space-y-2 rounded-[12px] bg-black/30 p-2.5">
                        <div className="kv-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                          {job.status === "failed" ? (job.error ?? "Job failed") : "Latest status"}
                        </div>
                        <div className="space-y-1">
                          {job.logs.slice(-3).map((log, index) => (
                            <div
                              key={`${job.id}-log-${index}`}
                              className="truncate text-[11px] text-slate-400"
                            >
                              {log}
                            </div>
                          ))}
                        </div>
                        {job.status === "failed" && (
                          <button
                            type="button"
                            onClick={() => retryJob(job.id)}
                            disabled={job.id === "queue-preview-tile"}
                            className="inline-flex rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {showDemoCompletedTile && (
                  <div className="relative flex aspect-video flex-col overflow-hidden rounded-[16px] border border-transparent bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(17,19,23,0.94))]">
                    <div className="flex-1 overflow-hidden">
                      <img
                        src="https://picsum.photos/seed/demo-queue-result/640/360"
                        alt="Demo generated result"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="absolute right-2 top-2 rounded-full bg-amber-500 px-2 py-1 text-[10px] font-semibold text-black">
                      New
                    </div>
                    <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5">
                      <div className={tileMetaIconChip}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3l1.9 4.4L18 9.3l-4.1 1.8L12 15.5l-1.9-4.4L6 9.3l4.1-1.9z" />
                        </svg>
                      </div>
                      <div className={tileMetaInfoChip}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                          <circle cx="12" cy="13" r="3" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
                {visibleEntries.map((entry) => {
                  const url = entry.id.startsWith("dummy-img")
                    ? `https://picsum.photos/seed/${entry.id}/400/225`
                    : entry.id.startsWith("dummy-vid")
                    ? "https://www.w3schools.com/html/mov_bbb.mp4"
                    : getFileUrl(connection, entry.relPath, { includeToken: true });
                  const styles = getFileStyles(entry);
                  const isVideoTile = entry.mime.startsWith("video/");
                  const isImageTile = entry.mime.startsWith("image/");
                  const tileDuration =
                    isVideoTile
                      ? entry.id.startsWith("dummy-vid")
                        ? "0:04"
                        : formatTileDuration(entry.duration)
                      : null;

                  return (
                    <button
                      key={entry.id}
                      data-file-id={entry.id}
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
                      onClick={(e) => multiSelectMode ? handleMultiSelectClick(entry, e) : select(entry)}
                      onKeyDown={(e) => handleKeyDown(e, entry)}
                      className={`group relative flex aspect-video flex-col overflow-hidden rounded-[16px] border transition focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${selected?.id === entry.id && !multiSelectMode ? "ring-2 ring-amber-400" : ""
                        } ${selectedIds.has(entry.id) ? "ring-2 ring-rose-400" : ""
                        } ${isPublished(published, entry.relPath) ? "ring-2 ring-violet-400/70 shadow-lg shadow-violet-500/40" : ""
                        } ${styles}`}
                    >
                      {/* Multi-select checkbox */}
                      {multiSelectMode && (
                        <div className={`absolute top-1 left-1 z-20 h-5 w-5 rounded border-2 flex items-center justify-center transition ${selectedIds.has(entry.id) ? "bg-rose-500 border-rose-500" : "bg-black/50 border-slate-500/50"}`}>
                          {selectedIds.has(entry.id) && <span className="text-white text-xs font-bold">✓</span>}
                        </div>
                      )}
                      {/* Published star indicator */}
                      {isPublished(published, entry.relPath) && (
                        <div className="absolute top-1 left-1 z-10 rounded-full bg-violet-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-lg shadow-violet-500/50">
                          ⭐
                        </div>
                      )}
                      {entry.kind === "file" && (isVideoTile || isImageTile) ? (
                        <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5">
                          <div className={tileMetaIconChip}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 3l1.9 4.4L18 9.3l-4.1 1.8L12 15.5l-1.9-4.4L6 9.3l4.1-1.9z" />
                            </svg>
                          </div>
                          <div className={tileMetaInfoChip}>
                            {isVideoTile ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m22 8-6 4 6 4V8Z" />
                                <rect x="2" y="6" width="14" height="12" rx="2" ry="2" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                                <circle cx="12" cy="13" r="3" />
                              </svg>
                            )}
                            {tileDuration ? (
                              <span className="kv-mono text-[10px] tracking-[0.08em] text-white/85">
                                {tileDuration}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      <div className="flex-1 w-full overflow-hidden rounded-t-[16px] bg-white/[0.03]">
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
                            onMouseEnter={
                              hoverPlayVideos
                                ? (e) => {
                                  const target = e.currentTarget;
                                  if (playingVideoRef.current && playingVideoRef.current !== target) {
                                    playingVideoRef.current.pause();
                                    playingVideoRef.current.currentTime = 0;
                                  }
                                  playingVideoRef.current = target;
                                  void target.play();
                                }
                                : undefined
                            }
                            onMouseLeave={
                              hoverPlayVideos
                                ? (e) => {
                                  const target = e.currentTarget;
                                  target.pause();
                                  target.currentTime = 0;
                                  if (playingVideoRef.current === target) {
                                    playingVideoRef.current = null;
                                  }
                                }
                                : undefined
                            }
                            onLoadedMetadata={(e) => {
                              const target = e.target as HTMLVideoElement;
                              const dims = { w: target.videoWidth, h: target.videoHeight };

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
                              const key = `${connection.workspaceId}:${entry.relPath}`;
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

                              if (
                                typeof entry.width === "number" &&
                                typeof entry.height === "number" &&
                                entry.width === dims.w &&
                                entry.height === dims.h
                              ) {
                                return;
                              }
                              const key = `${connection.workspaceId}:${entry.relPath}`;
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
                      {editingId === entry.id ? (
                        <div className="absolute inset-x-0 bottom-0 rounded-b-[16px] bg-black/60 p-2 backdrop-blur-sm">
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
                            className="kv-input w-full rounded-md px-2 py-1 text-xs"
                          />
                        </div>
                      ) : null}
                      {operationLoading === entry.id && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                          <Spinner size="md" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleTogglePin(entry.relPath);
                        }}
                        className={`absolute top-1 right-14 ${iconButtonBase} hover:bg-yellow-500 hover:text-black ${pins[entry.relPath] ? iconButtonVisible : iconButtonHidden
                          }`}
                        title={pins[entry.relPath] ? "Unpin" : "Pin"}
                      >
                        📌
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPublishingEntry(entry);
                        }}
                        className={`absolute top-1 right-8 ${iconButtonBase} ${iconButtonHidden} hover:bg-sky-500 hover:text-white`}
                        title="Publish"
                      >
                        🚀
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(entry, e)}
                        className={`absolute top-1 right-1 ${iconButtonBase} ${iconButtonHidden} hover:bg-red-500 hover:text-white`}
                        title="Delete (Del)"
                      >
                        🗑️
                      </button>
                    </button>
                  );
                })}
              </div>

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

        {/* Floating action bar for multi-select */}
        {multiSelectMode && selectedIds.size > 0 && (
          <div className="sticky bottom-4 mx-4 z-30 flex items-center justify-between rounded-xl border border-white/20 bg-black/90 px-4 py-3 shadow-2xl backdrop-blur-sm">
            <div className="text-sm font-semibold text-white">
              {selectedIds.size} file{selectedIds.size > 1 ? 's' : ''} selected
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedIds(new Set());
                  setMultiSelectMode(false);
                }}
                className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
              >
                {bulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size}`}
              </button>
            </div>
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
