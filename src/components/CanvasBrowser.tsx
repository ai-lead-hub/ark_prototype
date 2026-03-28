import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { FileEntry } from "../lib/api/files";
import type { Shot } from "../state/shots";

const MIN_CARD_WIDTH = 220;
const MIN_CARD_HEIGHT = 138;
const MAX_CARD_WIDTH = 780;
const MAX_CARD_HEIGHT = 560;
const PSEUDO_GRID = 40;
const TILE_GAP = 28;
const SLOT_ORIGIN_X = 80;
const SLOT_ORIGIN_Y = 80;
const SLOT_STEP_X = 300;
const SLOT_STEP_Y = 212;
const SNAP_PREVIEW_RANGE = 52;

type CanvasLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
};

type QueueCanvasItem = {
  id: string;
  type: "queue";
  name: string;
  status: "pending" | "processing" | "failed";
  jobType: "image" | "video" | "upscale";
  logs: string[];
  progress: number;
  error?: string;
  retryable?: boolean;
};

type FileCanvasItem = {
  id: string;
  type: "file";
  entry: FileEntry;
  url: string;
  isVideo: boolean;
  durationLabel: string | null;
  isPublished: boolean;
};

type ResultCanvasItem = {
  id: string;
  type: "result";
  name: string;
  url: string;
};

export type CanvasBrowserItem = QueueCanvasItem | FileCanvasItem | ResultCanvasItem;

interface CanvasBrowserProps {
  items: CanvasBrowserItem[];
  selectedId?: string;
  onSelectFile: (entry: FileEntry) => void;
  onRetryQueueJob: (jobId: string) => void;
  hoverPlayVideos?: boolean;
  storageKey?: string;
  shots?: Shot[];
}

type InteractionState = {
  mode: "drag" | "resize";
  id: string;
  pointerX: number;
  pointerY: number;
  start: CanvasLayout;
};

type ViewportState = {
  x: number;
  y: number;
  zoom: number;
};

type PanState = {
  pointerX: number;
  pointerY: number;
  startX: number;
  startY: number;
};

type SnapPreview = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function getDefaultLayout(index: number): CanvasLayout {
  return {
    x: SLOT_ORIGIN_X + (index % 4) * SLOT_STEP_X,
    y: SLOT_ORIGIN_Y + Math.floor(index / 4) * SLOT_STEP_Y,
    width: 272,
    height: 168,
    z: index + 1,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getCardStyle(layout: CanvasLayout): CSSProperties {
  return {
    left: `${layout.x}px`,
    top: `${layout.y}px`,
    width: `${layout.width}px`,
    height: `${layout.height}px`,
    zIndex: layout.z,
  };
}

function findSnapPreview(
  id: string,
  layout: CanvasLayout,
  allLayouts: Record<string, CanvasLayout>
): SnapPreview | null {
  let bestPreview: SnapPreview | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  Object.entries(allLayouts).forEach(([otherId, other]) => {
    if (otherId === id) return;

    const horizontalCandidates: SnapPreview[] = [
      {
        x: other.x + other.width + TILE_GAP,
        y: other.y,
        width: layout.width,
        height: layout.height,
      },
      {
        x: other.x - layout.width - TILE_GAP,
        y: other.y,
        width: layout.width,
        height: layout.height,
      },
    ];

    const verticalCandidates: SnapPreview[] = [
      {
        x: other.x,
        y: other.y + other.height + TILE_GAP,
        width: layout.width,
        height: layout.height,
      },
      {
        x: other.x,
        y: other.y - layout.height - TILE_GAP,
        width: layout.width,
        height: layout.height,
      },
    ];

    [...horizontalCandidates, ...verticalCandidates].forEach((candidate) => {
      const dx = Math.abs(candidate.x - layout.x);
      const dy = Math.abs(candidate.y - layout.y);
      const isHorizontal = candidate.y === other.y;
      const primaryDelta = isHorizontal ? dx : dy;
      const alignmentDelta = isHorizontal ? dy : dx;

      if (primaryDelta > SNAP_PREVIEW_RANGE || alignmentDelta > SNAP_PREVIEW_RANGE) {
        return;
      }

      const score = primaryDelta + alignmentDelta * 0.75;
      if (score < bestScore) {
        bestScore = score;
        bestPreview = candidate;
      }
    });
  });

  return bestPreview;
}

/* ── Storyboard layout constants ── */
const SB_LABEL_WIDTH = 100;
const SB_CARD_WIDTH = 220;
const SB_CARD_HEIGHT = 138;
const SB_ROW_GAP = 20;
const SB_COL_GAP = 12;
const SB_ORIGIN_X = SB_LABEL_WIDTH + 16;
const SB_ORIGIN_Y = 20;

export default function CanvasBrowser({
  items,
  selectedId,
  onSelectFile,
  onRetryQueueJob,
  hoverPlayVideos = false,
  storageKey,
  shots = [],
}: CanvasBrowserProps) {
  const isStoryboard = shots.length > 0;
  const [layouts, setLayouts] = useState<Record<string, CanvasLayout>>({});
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [snapPreview, setSnapPreview] = useState<SnapPreview | null>(null);
  const [viewport, setViewport] = useState<ViewportState>({
    x: 120,
    y: 96,
    zoom: 0.72,
  });
  const [panState, setPanState] = useState<PanState | null>(null);
  const highestZRef = useRef(1);
  const layoutsRef = useRef<Record<string, CanvasLayout>>({});
  const playingVideoRef = useRef<HTMLVideoElement | null>(null);
  const snapPreviewRef = useRef<SnapPreview | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const tileMetaIconChip =
    "flex h-7 w-7 items-center justify-center rounded-full bg-[#b7ae9d]/42 text-white/92 shadow-[0_8px_18px_rgba(0,0,0,0.12)] backdrop-blur-[10px]";
  const tileMetaInfoChip =
    "flex items-center gap-1.5 rounded-full bg-[#b7ae9d]/42 px-2.5 py-1.5 text-[11px] font-medium text-white/92 shadow-[0_8px_18px_rgba(0,0,0,0.12)] backdrop-blur-[10px]";

  useEffect(() => {
    if (!storageKey || typeof sessionStorage === "undefined") return;

    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        layouts?: Record<string, CanvasLayout>;
        viewport?: ViewportState;
      };
      const nextLayouts = parsed.layouts ?? {};
      setLayouts(nextLayouts);
      if (parsed.viewport) {
        setViewport(parsed.viewport);
      }

      const zValues = Object.values(nextLayouts).map((layout) => layout.z);
      highestZRef.current = zValues.length > 0 ? Math.max(...zValues) : highestZRef.current;
    } catch {
      // Ignore malformed layout cache.
    }
  }, [storageKey]);

  useEffect(() => {
    setLayouts((previous) => {
      const next: Record<string, CanvasLayout> = {};

      items.forEach((item, index) => {
        const existing = previous[item.id];
        next[item.id] = existing ?? getDefaultLayout(index);
        highestZRef.current = Math.max(highestZRef.current, next[item.id].z);
      });

      return next;
    });
  }, [items]);

  useEffect(() => {
    if (!storageKey || typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(storageKey, JSON.stringify({ layouts, viewport }));
  }, [layouts, storageKey, viewport]);

  useEffect(() => {
    layoutsRef.current = layouts;
  }, [layouts]);

  useEffect(() => {
    snapPreviewRef.current = snapPreview;
  }, [snapPreview]);

  useEffect(() => {
    if (!interaction) return;

    const handlePointerMove = (event: PointerEvent) => {
      const deltaX = (event.clientX - interaction.pointerX) / viewport.zoom;
      const deltaY = (event.clientY - interaction.pointerY) / viewport.zoom;
      const current = layoutsRef.current[interaction.id];
      if (!current) return;

      const nextLayout =
        interaction.mode === "drag"
          ? {
              ...current,
              x: interaction.start.x + deltaX,
              y: interaction.start.y + deltaY,
            }
          : {
              ...current,
              width: clamp(
                interaction.start.width + deltaX,
                MIN_CARD_WIDTH,
                MAX_CARD_WIDTH
              ),
              height: clamp(
                interaction.start.height + deltaY,
                MIN_CARD_HEIGHT,
                MAX_CARD_HEIGHT
              ),
            };

      if (interaction.mode === "drag") {
        setSnapPreview(
          findSnapPreview(interaction.id, nextLayout, layoutsRef.current)
        );
      }

      setLayouts((previous) => {
        return {
          ...previous,
          [interaction.id]: nextLayout,
        };
      });
    };

    const handlePointerUp = () => {
      if (interaction.mode === "drag" && snapPreviewRef.current) {
        setLayouts((previous) => {
          const current = previous[interaction.id];
          if (!current) return previous;

          return {
            ...previous,
            [interaction.id]: {
              ...current,
              x: snapPreviewRef.current!.x,
              y: snapPreviewRef.current!.y,
            },
          };
        });
      }

      setSnapPreview(null);
      setInteraction(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [interaction, viewport.zoom]);

  useEffect(() => {
    if (!panState) return;

    const handlePointerMove = (event: PointerEvent) => {
      const deltaX = event.clientX - panState.pointerX;
      const deltaY = event.clientY - panState.pointerY;

      setViewport((previous) => ({
        ...previous,
        x: panState.startX + deltaX,
        y: panState.startY + deltaY,
      }));
    };

    const handlePointerUp = () => {
      setPanState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [panState]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      if (event.ctrlKey || event.metaKey) {
        setViewport((previous) => ({
          ...previous,
          zoom: clamp(previous.zoom - event.deltaY * 0.0012, 0.45, 1.4),
        }));
        return;
      }

      setViewport((previous) => ({
        ...previous,
        x: previous.x - event.deltaX,
        y: previous.y - event.deltaY,
      }));
    };

    element.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      element.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const orderedItems = useMemo(
    () =>
      [...items].sort((left, right) => {
        const leftZ = layouts[left.id]?.z ?? 0;
        const rightZ = layouts[right.id]?.z ?? 0;
        return leftZ - rightZ;
      }),
    [items, layouts]
  );

  const bringToFront = (id: string) => {
    setLayouts((previous) => {
      const current = previous[id];
      if (!current) return previous;

      const nextZ = highestZRef.current + 1;
      highestZRef.current = nextZ;

      return {
        ...previous,
        [id]: {
          ...current,
          z: nextZ,
        },
      };
    });
  };

  const startInteraction = (
    event: ReactPointerEvent<HTMLDivElement>,
    id: string,
    mode: "drag" | "resize"
  ) => {
    event.preventDefault();
    event.stopPropagation();
    bringToFront(id);

    const start = layouts[id];
    if (!start) return;

    setInteraction({
      mode,
      id,
      pointerX: event.clientX,
      pointerY: event.clientY,
      start,
    });
    if (mode !== "drag") {
      setSnapPreview(null);
    }
  };

  const updateZoom = (nextZoom: number) => {
    setViewport((previous) => ({
      ...previous,
      zoom: clamp(nextZoom, 0.45, 1.4),
    }));
  };

  const startPan = (clientX: number, clientY: number) => {
    setPanState({
      pointerX: clientX,
      pointerY: clientY,
      startX: viewport.x,
      startY: viewport.y,
    });
  };

  const resetViewport = () => {
    setViewport({
      x: 120,
      y: 96,
      zoom: 0.72,
    });
  };

  const gridOffsetX = ((viewport.x % PSEUDO_GRID) + PSEUDO_GRID) % PSEUDO_GRID;
  const gridOffsetY = ((viewport.y % PSEUDO_GRID) + PSEUDO_GRID) % PSEUDO_GRID;

  if (!isStoryboard && items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-slate-400">
        Nothing on the canvas yet.
      </div>
    );
  }

  /* ── Storyboard: shots vertical, candidates horizontal ── */
  if (isStoryboard) {
    return (
      <div className="relative h-full overflow-hidden overscroll-none px-4 py-4">
        {/* Zoom controls */}
        <div
          data-canvas-control="true"
          className="absolute right-8 top-8 z-20 flex items-center gap-2 rounded-full bg-black/38 px-2 py-1.5 backdrop-blur-md"
        >
          <button type="button" onClick={() => updateZoom(viewport.zoom - 0.12)} className="kv-icon-button flex h-8 w-8 items-center justify-center rounded-full" aria-label="Zoom out">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /></svg>
          </button>
          <button type="button" onClick={resetViewport} className="rounded-full px-2.5 py-1 text-[11px] font-medium text-slate-200 transition hover:bg-white/6">
            {Math.round(viewport.zoom * 100)}%
          </button>
          <button type="button" onClick={() => updateZoom(viewport.zoom + 0.12)} className="kv-icon-button flex h-8 w-8 items-center justify-center rounded-full" aria-label="Zoom in">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
          </button>
        </div>

        <div
          ref={viewportRef}
          className={`relative h-full overflow-hidden overscroll-none rounded-[28px] touch-none select-none ${panState ? "cursor-grabbing" : "cursor-grab"}`}
          onPointerDown={(event) => {
            const target = event.target as HTMLElement;
            if (target.closest("[data-canvas-card='true']") || target.closest("[data-canvas-control='true']")) return;
            startPan(event.clientX, event.clientY);
          }}
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px), radial-gradient(circle at top left, rgba(245,158,11,0.08), transparent 0 28%), linear-gradient(180deg, rgba(8,10,14,0.82), rgba(6,7,10,0.98))",
            backgroundSize: `${PSEUDO_GRID}px ${PSEUDO_GRID}px, ${PSEUDO_GRID}px ${PSEUDO_GRID}px, auto, auto`,
            backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px, ${gridOffsetX}px ${gridOffsetY}px, 0 0, 0 0`,
            overscrollBehavior: "none",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
              transformOrigin: "top left",
            }}
          >
            <div className="relative h-0 w-0">
              {shots.map((shot, rowIdx) => {
                const rowY = SB_ORIGIN_Y + rowIdx * (SB_CARD_HEIGHT + SB_ROW_GAP);

                return (
                  <div key={shot.id}>
                    {/* Shot label */}
                    <div
                      className="pointer-events-auto absolute flex items-center"
                      style={{
                        left: 8,
                        top: rowY,
                        width: SB_LABEL_WIDTH - 8,
                        height: SB_CARD_HEIGHT,
                      }}
                    >
                      <div className="w-full">
                        <div className="kv-mono text-[11px] font-semibold text-amber-200/80 truncate">
                          {shot.name}
                        </div>
                        {shot.directionNote && (
                          <div className="mt-0.5 text-[9px] text-slate-500 truncate leading-tight">
                            {shot.directionNote}
                          </div>
                        )}
                        <div className="mt-1 kv-mono text-[9px] text-slate-600">
                          {shot.candidates.length} rev
                        </div>
                      </div>
                    </div>

                    {/* Candidate cards */}
                    {shot.candidates.map((c, colIdx) => {
                      const cardX = SB_ORIGIN_X + colIdx * (SB_CARD_WIDTH + SB_COL_GAP);
                      const isPublished = c.id === shot.previewFileId;

                      return (
                        <div
                          key={c.id}
                          data-canvas-card="true"
                          className={`pointer-events-auto absolute overflow-hidden rounded-[14px] border transition-shadow hover:border-amber-400/30 ${
                            isPublished
                              ? "border-violet-400/40 shadow-[0_0_0_1px_rgba(139,92,246,0.2)]"
                              : c.role === "pinned"
                              ? "border-indigo-500/60 shadow-[0_0_8px_rgba(99,102,241,0.15)]"
                              : c.role === "input"
                              ? "border-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                              : "border-transparent shadow-[0_12px_40px_rgba(0,0,0,0.3)]"
                          } bg-[#111318]`}
                          style={{
                            left: cardX,
                            top: rowY,
                            width: SB_CARD_WIDTH,
                            height: SB_CARD_HEIGHT,
                          }}
                        >
                          <div className="absolute inset-0">
                            {c.isVideo ? (
                              <video
                                src={c.previewPath}
                                className="h-full w-full object-cover"
                                preload="metadata"
                                muted
                                loop
                                playsInline
                                draggable={false}
                                onMouseEnter={hoverPlayVideos ? (e) => void e.currentTarget.play() : undefined}
                                onMouseLeave={hoverPlayVideos ? (e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; } : undefined}
                              />
                            ) : (
                              <img
                                src={c.thumbnailPath}
                                alt={c.originalName}
                                className="h-full w-full object-cover"
                                loading="lazy"
                                draggable={false}
                              />
                            )}
                          </div>

                          {isPublished && (
                            <div className="absolute left-1.5 top-1.5 rounded-full bg-violet-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-lg shadow-violet-500/50">
                              ★
                            </div>
                          )}

                          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
                            <span className="rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] font-medium text-white/70 backdrop-blur-sm">
                              r{c.revision}
                            </span>
                            {c.isVideo && c.duration > 0 && (
                              <span className="rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] font-medium text-white/70 backdrop-blur-sm">
                                {Math.round(c.duration)}s
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Freeform canvas (original behavior) ── */
  return (
    <div className="relative h-full overflow-hidden overscroll-none px-4 py-4">
      <div
        data-canvas-control="true"
        className="absolute right-8 top-8 z-20 flex items-center gap-2 rounded-full bg-black/38 px-2 py-1.5 backdrop-blur-md"
      >
        <button
          type="button"
          onClick={() => updateZoom(viewport.zoom - 0.12)}
          className="kv-icon-button flex h-8 w-8 items-center justify-center rounded-full"
          aria-label="Zoom out"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /></svg>
        </button>
        <button
          type="button"
          onClick={resetViewport}
          className="rounded-full px-2.5 py-1 text-[11px] font-medium text-slate-200 transition hover:bg-white/6"
        >
          {Math.round(viewport.zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => updateZoom(viewport.zoom + 0.12)}
          className="kv-icon-button flex h-8 w-8 items-center justify-center rounded-full"
          aria-label="Zoom in"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
        </button>
      </div>

      <div
        ref={viewportRef}
        className={`relative h-full overflow-hidden overscroll-none rounded-[28px] touch-none select-none ${panState ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("[data-canvas-card='true']") || target.closest("[data-canvas-control='true']")) {
            return;
          }
          startPan(event.clientX, event.clientY);
        }}
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px), radial-gradient(circle at top left, rgba(245,158,11,0.08), transparent 0 28%), linear-gradient(180deg, rgba(8,10,14,0.82), rgba(6,7,10,0.98))",
          backgroundSize: `${PSEUDO_GRID}px ${PSEUDO_GRID}px, ${PSEUDO_GRID}px ${PSEUDO_GRID}px, auto, auto`,
          backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px, ${gridOffsetX}px ${gridOffsetY}px, 0 0, 0 0`,
          overscrollBehavior: "none",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            transformOrigin: "top left",
          }}
        >
          <div
            className="relative h-0 w-0 rounded-[28px]"
            style={{
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
            }}
          >
            {interaction?.mode === "drag" && snapPreview ? (
              <div
                className="pointer-events-none absolute rounded-[18px] border border-amber-300/55 bg-amber-400/8 shadow-[0_0_0_1px_rgba(251,191,36,0.16)]"
                style={getCardStyle({
                  ...snapPreview,
                  z: (layoutsRef.current[interaction.id]?.z ?? 0) - 1,
                })}
              >
                <div className="absolute inset-0 rounded-[18px] border border-dashed border-amber-200/55" />
              </div>
            ) : null}

            {orderedItems.map((item) => {
              const layout = layouts[item.id];
              if (!layout) return null;

              const isSelected = item.type === "file" && item.entry.id === selectedId;

              return (
                <div
                  key={item.id}
                  data-canvas-card="true"
                  className={`pointer-events-auto group absolute overflow-hidden rounded-[18px] border transition-shadow ${
                    isSelected
                      ? "border-amber-400/55 shadow-[0_0_0_1px_rgba(251,191,36,0.32),0_20px_70px_rgba(0,0,0,0.34)]"
                      : "border-transparent shadow-[0_18px_55px_rgba(0,0,0,0.34)]"
                  } ${interaction?.id === item.id ? "cursor-grabbing" : "cursor-grab"} bg-[#111318]`}
                  style={getCardStyle(layout)}
                  onPointerDown={(event) => {
                    if (item.type === "file") {
                      onSelectFile(item.entry);
                    }
                    startInteraction(event, item.id, "drag");
                  }}
                >
              {item.type === "queue" ? (
                <div className="flex h-full flex-col">
                  <div className="absolute inset-x-0 top-0 z-10 h-1 bg-white/5">
                    <div
                      className={`h-full ${
                        item.status === "failed"
                          ? "bg-rose-500/80"
                          : "bg-gradient-to-r from-orange-500 to-amber-400"
                      }`}
                      style={{ width: `${item.status === "failed" ? 100 : item.progress}%` }}
                    />
                  </div>

                  <div className="flex h-full flex-col justify-between gap-3 p-3">
                    <div className="space-y-1">
                      <div className="kv-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
                        {item.jobType} job
                      </div>
                      <div className="truncate text-sm font-semibold text-white">{item.name}</div>
                    </div>

                    <div className="flex flex-1 items-center justify-center rounded-[14px] bg-black/25">
                      {item.status === "failed" ? (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-rose-500/10 px-4 text-center">
                          <div className="text-sm font-medium text-rose-200">Generation failed</div>
                          <div className="mt-1 text-xs text-rose-200/80">Error preview space</div>
                        </div>
                      ) : (
                        <div className="h-full w-full bg-[radial-gradient(circle_at_35%_18%,rgba(249,115,22,0.14),transparent_0_28%),linear-gradient(135deg,rgba(44,48,58,0.92),rgba(14,15,19,0.96))]" />
                      )}
                    </div>

                    <div className="space-y-2 rounded-[14px] bg-black/30 p-2.5">
                      <div className="kv-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                        {item.status === "failed" ? (item.error ?? "Job failed") : "Latest status"}
                      </div>
                      <div className="space-y-1">
                        {item.logs.slice(-3).map((log, index) => (
                          <div
                            key={`${item.id}-log-${index}`}
                            className="truncate text-[11px] text-slate-400"
                          >
                            {log}
                          </div>
                        ))}
                      </div>
                      {item.status === "failed" && item.retryable ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRetryQueueJob(item.id);
                          }}
                          className="inline-flex rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20"
                        >
                          Retry
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="absolute inset-0">
                    {item.type === "result" ? (
                      <img
                        src={item.url}
                        alt={item.name}
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    ) : item.isVideo ? (
                      <video
                        src={item.url}
                        className="h-full w-full object-cover"
                        preload="metadata"
                        muted
                        loop
                        playsInline
                        draggable={false}
                        onMouseEnter={
                          hoverPlayVideos
                            ? (event) => {
                                const target = event.currentTarget;
                                if (
                                  playingVideoRef.current &&
                                  playingVideoRef.current !== target
                                ) {
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
                            ? (event) => {
                                const target = event.currentTarget;
                                target.pause();
                                target.currentTime = 0;
                                if (playingVideoRef.current === target) {
                                  playingVideoRef.current = null;
                                }
                              }
                            : undefined
                        }
                      />
                    ) : (
                      <img
                        src={item.url}
                        alt={item.entry.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        draggable={false}
                      />
                    )}
                  </div>

                  {item.type === "file" && item.isPublished ? (
                    <div className="absolute left-2 top-2 rounded-full bg-violet-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-lg shadow-violet-500/50">
                      ★
                    </div>
                  ) : null}

                  <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5">
                    <div className={tileMetaIconChip}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 3l1.9 4.4L18 9.3l-4.1 1.8L12 15.5l-1.9-4.4L6 9.3l4.1-1.9z" />
                      </svg>
                    </div>
                    <div className={tileMetaInfoChip}>
                      {item.type === "file" && item.isVideo ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m22 8-6 4 6 4V8Z" />
                          <rect x="2" y="6" width="14" height="12" rx="2" ry="2" />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                          <circle cx="12" cy="13" r="3" />
                        </svg>
                      )}
                      {item.type === "file" && item.durationLabel ? (
                        <span className="kv-mono text-[10px] tracking-[0.08em] text-white/85">
                          {item.durationLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </>
              )}

              <div
                className="absolute bottom-2 right-2 z-10 h-4 w-4 rounded-[5px] border border-amber-400/20 bg-black/30 opacity-0 transition-opacity group-hover:opacity-100"
                onPointerDown={(event) => startInteraction(event, item.id, "resize")}
              >
                <div className="absolute inset-[3px] border-b border-r border-amber-400/40" />
              </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
