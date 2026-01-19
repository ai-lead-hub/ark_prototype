import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useCatalog } from "../state/useCatalog";
import { useQueue } from "../state/queue";
import { type FileEntry, getFileUrl, publishFile, uploadFile, trashFiles } from "../lib/api/files";
import { FILE_ENTRY_MIME } from "../lib/drag-constants";
import { Spinner } from "./ui/Spinner";
import { PublishModal } from "./PublishModal";
import { buildDatedMediaPath, mediaFolderFromMime } from "../lib/storage-paths";
import { setControlsPrompt } from "../lib/controls-store";
import { type PinsMap } from "../lib/pins";
import {
  loadPublished,
  addPublished,
  isPublished,
  type PublishedMap,
} from "../lib/published";
import {
  loadRecentReferences,
  onRecentReferencesChange,
  removeRecentReference,
  renameRecentReference,
  type RecentReference,
} from "../lib/recent-references";
import {
  listPrompts,
  recordFileMetadata,
  type PromptHistoryEntry,
  listPins as fetchPins,
  setPin as apiSetPin,
  removePin as apiRemovePin,
  renamePin as apiRenamePin,
} from "../lib/api/meta";
import { useHoverPlayVideos } from "../lib/useHoverPlayVideos";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp"];
const VIDEO_EXTS = ["mp4", "webm", "mov", "mkv"];

export default function FileBrowser() {
  const {
    state: { entries, q, filterExt, selected, loading, connection },
    actions: { setQuery, setFilters, select, refreshTree, rename },
  } = useCatalog();

  const { jobs } = useQueue();
  const activeJobs = useMemo(() =>
    jobs.filter(j => j.status === "pending" || j.status === "processing"),
    [jobs]);

  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [sortByName, setSortByName] = useState(false);
  const [published, setPublished] = useState<PublishedMap>({});
  const [showRecent, setShowRecent] = useState(false);
  const [recentTab, setRecentTab] = useState<"references" | "prompts">("references");
  const [recentReferences, setRecentReferences] = useState<RecentReference[]>([]);
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

  // Multi-select mode state
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const lastClickedIdRef = useRef<string | null>(null);

  const [hoverPlayVideos] = useHoverPlayVideos();

  const iconButtonBase =
    "rounded-md border border-white/10 bg-black/60 p-1 text-xs text-slate-100 transition-opacity";
  const iconButtonHidden = "opacity-0 group-hover:opacity-100";
  const iconButtonVisible = "opacity-100";
  const toolbarIconButtonBase =
    "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-sm text-slate-200 transition hover:border-sky-400 hover:text-sky-200";

  const workspaceKey = useMemo(() => {
    if (!connection) return "";
    return `${connection.apiBase}|${connection.workspaceId}`;
  }, [connection]);

  const [pins, setPins] = useState<PinsMap>({});

  // Load pins from server
  const loadPinsFromServer = useCallback(async () => {
    if (!connection) {
      setPins({});
      return;
    }
    try {
      const serverPins = await fetchPins(connection);
      setPins(serverPins);
    } catch (error) {
      console.error("Failed to load pins:", error);
      setPins({});
    }
  }, [connection]);

  useEffect(() => {
    if (!workspaceKey) {
      setPins({});
      setPublished({});
      return;
    }
    void loadPinsFromServer();
    setPublished(loadPublished(workspaceKey));
  }, [workspaceKey, loadPinsFromServer]);

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
      void loadPinsFromServer();
    }
  }, [connection, pins, loadPinsFromServer]);

  const refreshReferences = useCallback(() => {
    if (!workspaceKey) return;
    setRecentReferences(loadRecentReferences(workspaceKey));
  }, [workspaceKey]);

  useEffect(() => {
    if (!workspaceKey) return;
    const off = onRecentReferencesChange(() => {
      setRecentReferences(loadRecentReferences(workspaceKey));
    });
    return off;
  }, [workspaceKey]);

  const getFileStyles = useCallback((entry: FileEntry) => {
    if (entry.mime.startsWith("image/")) {
      return {
        grid: "border-red-500/50 bg-red-500/5",
        list: "border-l-red-500/50",
      };
    }
    if (entry.mime.startsWith("video/")) {
      return {
        grid: "border-green-500/50 bg-green-500/5",
        list: "border-l-green-500/50",
      };
    }
    return {
      grid: "border-white/5 bg-slate-900/40 hover:bg-slate-800/60 hover:border-white/10",
      list: "border-l-transparent",
    };
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
      if (workspaceKey) {
        setRecentReferences(
          renameRecentReference(workspaceKey, entry.relPath, {
            relPath: newPath,
            name: nextName,
            mime: entry.mime,
          })
        );
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
        // Remove from recent references
        if (workspaceKey) {
          setRecentReferences(removeRecentReference(workspaceKey, entry.relPath));
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

    setBulkDeleting(true);
    try {
      const paths = entries
        .filter((e) => selectedIds.has(e.id))
        .map((e) => e.relPath);

      const result = await trashFiles(connection, paths);

      // Remove pins and recent refs for trashed files
      if (connection) {
        for (const relPath of result.success) {
          if (pins[relPath]) {
            await apiRemovePin(connection, relPath).catch(console.error);
          }
          setRecentReferences(removeRecentReference(workspaceKey, relPath));
        }
        // Refresh pins from server
        void loadPinsFromServer();
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
      refreshReferences();
    }
  }, [showRecent, recentTab, refreshPrompts, refreshReferences, connection?.workspaceId]);

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

  // Ref for grid container to calculate column count
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  // Arrow key navigation for file browser (full grid navigation with auto-scroll)
  useEffect(() => {
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
      // Only handle in grid view for up/down
      if (viewMode !== 'grid' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return;

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
  }, [selected, visibleEntries, select, editingId, viewMode]);

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
    <div className="flex h-full flex-col gap-2">
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
          className={`${toolbarIconButtonBase} ${showRecent ? "border-sky-400 text-sky-200" : ""
            }`}
          title="Recent"
          aria-label="Toggle recent panel"
        >
          🕘
        </button>
        <button
          type="button"
          onClick={() => {
            setMultiSelectMode((v) => !v);
            if (multiSelectMode) setSelectedIds(new Set());
          }}
          className={`${toolbarIconButtonBase} ${multiSelectMode ? "border-rose-400 text-rose-200 bg-rose-500/20" : ""}`}
          title={multiSelectMode ? "Exit Multi-Select (Esc)" : "Multi-Select"}
          aria-label="Toggle multi-select mode"
        >
          ☑
        </button>
        <button
          type="button"
          onClick={() => {
            refreshTree();
            setVisibleCount(30);
          }}
          className={toolbarIconButtonBase}
          title="Refresh"
          aria-label="Refresh file list"
        >
          ↻
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
                  onClick={() => setRecentTab("references")}
                  className={`rounded px-2 py-1 text-[11px] font-semibold transition ${recentTab === "references"
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  References
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
              onClick={() => void (recentTab === "prompts" ? refreshPrompts() : refreshReferences())}
              disabled={recentTab === "prompts" ? promptBusy : false}
              className="rounded-md border border-white/10 px-2 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-sky-400 hover:text-sky-200 disabled:opacity-60"
            >
              {recentTab === "prompts" && promptBusy ? "..." : "Refresh"}
            </button>
          </div>

          {recentTab === "references" ? (
            recentReferences.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-400">
                No recent references yet. Select an image and use “1st / Last / Ref” in the preview pane.
              </div>
            ) : (
              <div className="max-h-[220px] overflow-auto">
                {recentReferences.map((ref) => {
                  const match = entries.find((e) => e.relPath === ref.relPath);
                  const subtitle =
                    ref.lastUse === "startFrame"
                      ? "Start frame"
                      : ref.lastUse === "endFrame"
                        ? "End frame"
                        : "Reference";

                  return (
                    <button
                      key={ref.relPath}
                      type="button"
                      onClick={() => {
                        if (match) {
                          select(match);
                        } else {
                          void refreshTree(ref.relPath);
                        }
                      }}
                      className="group flex w-full items-center gap-3 border-b border-white/5 px-3 py-2 text-left text-xs transition hover:bg-white/5"
                      title={ref.relPath}
                    >
                      <div className="w-10 shrink-0 text-[10px] font-semibold text-slate-400">
                        {formatAgo(ref.lastUsedAt)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-slate-100">
                          {ref.name}
                        </div>
                        <div className="truncate text-[10px] text-slate-400">
                          {subtitle} · {ref.relPath}
                        </div>
                      </div>
                      {!match ? (
                        <div className="shrink-0 text-[10px] font-semibold text-amber-300">
                          Missing
                        </div>
                      ) : null}
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
                  onClick={() => setControlsPrompt(p.prompt)}
                  className="flex w-full items-center gap-3 border-b border-white/5 px-3 py-2 text-left text-xs transition hover:bg-white/5"
                  title="Click to use prompt"
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
        <button
          type="button"
          onClick={() => setSortByName((v) => !v)}
          className={`rounded-full px-3 py-1 font-semibold transition-colors ${sortByName
            ? "bg-violet-500/30 text-white"
            : "bg-white/10 text-slate-300 hover:text-white"
            }`}
          title={sortByName ? "Sorted A-Z" : "Sorted by recency"}
        >
          {sortByName ? "A→Z" : "New"}
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
              <div ref={gridContainerRef} className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3">
                {activeJobs.map((job) => (
                  <div
                    key={job.id}
                    className="relative flex aspect-square flex-col overflow-hidden rounded-xl border border-white/10 bg-black/40 animate-pulse"
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
                      className={`group relative flex aspect-square flex-col overflow-hidden rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${selected?.id === entry.id && !multiSelectMode ? "ring-2 ring-yellow-500" : ""
                        } ${selectedIds.has(entry.id) ? "ring-2 ring-rose-400" : ""
                        } ${isPublished(published, entry.relPath) ? "ring-2 ring-violet-400/70 shadow-lg shadow-violet-500/40" : ""
                        } ${styles.grid}`}
                    >
                      {/* Multi-select checkbox */}
                      {multiSelectMode && (
                        <div className={`absolute top-1 left-1 z-20 h-5 w-5 rounded border-2 flex items-center justify-center transition ${selectedIds.has(entry.id) ? "bg-rose-500 border-rose-500" : "bg-black/50 border-white/50"}`}>
                          {selectedIds.has(entry.id) && <span className="text-white text-xs font-bold">✓</span>}
                        </div>
                      )}
                      {/* Published star indicator */}
                      {isPublished(published, entry.relPath) && (
                        <div className="absolute top-1 left-1 z-10 rounded-full bg-violet-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-lg shadow-violet-500/50">
                          ⭐
                        </div>
                      )}
                      <div className="flex-1 w-full overflow-hidden rounded-t-xl bg-white/5">
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
                      <div className="absolute inset-x-0 bottom-0 rounded-b-xl bg-black/60 p-2 backdrop-blur-sm">
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
                            className="truncate text-xs font-semibold text-white cursor-text"
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
                    <li key={entry.id} data-file-id={entry.id}>
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
                        onKeyDown={(e) => handleKeyDown(e, entry)}
                        className={`group flex w-full items-center justify-between gap-3 border-l-4 px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${selected?.id === entry.id ? "bg-yellow-500/20" : ""
                          } ${isPublished(published, entry.relPath) ? "bg-violet-500/15 shadow-md shadow-violet-500/30" : ""
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
                                className="font-semibold text-white truncate flex items-center gap-1"
                                title={entry.name}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setEditingId(entry.id);
                                  setEditName(entry.name);
                                }}
                              >
                                {isPublished(published, entry.relPath) && <span className="text-violet-400">⭐</span>}
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
                              void handleTogglePin(entry.relPath);
                            }}
                            className={`${iconButtonBase} hover:bg-yellow-500 hover:text-black ${pins[entry.relPath] ? iconButtonVisible : iconButtonHidden
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
                            className={`${iconButtonBase} ${iconButtonHidden} hover:bg-sky-500 hover:text-white`}
                            title="Publish"
                          >
                            🚀
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(entry, e)}
                            className={`${iconButtonBase} ${iconButtonHidden} hover:bg-red-500 hover:text-white`}
                            title="Delete (Del)"
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
