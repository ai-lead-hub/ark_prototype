import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Shot, ShotCandidate } from "../state/shots";
import VideoPlayer from "./VideoPlayer";
import ImageEditor from "./ImageEditor";

type Props = {
  shot: Shot;
  isActive: boolean;
  onActivate: () => void;
  /** Element avatars to show next to shot name */
  taggedElements?: { id: string; name: string; thumbnailPath?: string }[];
  demoQueuePhase?: string;
  demoQueueProgress?: number;
};

function CandidateTile({
  c,
  isPublished,
  onClick,
}: {
  c: ShotCandidate;
  isPublished: boolean;
  onClick: () => void;
}) {
  let borderClass = "border border-transparent hover:border-amber-400/30";
  if (c.role === "pinned") {
    borderClass = "border-2 border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.25)]";
  } else if (c.role === "input") {
    borderClass = "border-2 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.25)]";
  }

  return (
    <div 
      className={`group/tile relative aspect-video overflow-hidden rounded-[14px] bg-[#111318] transition cursor-pointer ${borderClass}`}
      onClick={onClick}
    >
      {c.isVideo ? (
        <video
          src={c.previewPath}
          className="h-full w-full object-cover"
          preload="metadata"
          muted
          loop
          playsInline
          onMouseEnter={(e) => void e.currentTarget.play()}
          onMouseLeave={(e) => {
            e.currentTarget.pause();
            e.currentTarget.currentTime = 0;
          }}
        />
      ) : (
        <img
          src={c.previewPath}
          alt={c.originalName}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      )}

      {/* Center play indicator for videos */}
      {c.isVideo && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none transition-opacity group-hover/tile:opacity-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
      )}

      {/* Darkening vignette for hover controls */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/80 opacity-0 transition-opacity duration-200 group-hover/tile:opacity-100 pointer-events-none" />

      {/* Legacy published indicator (only visible when not hovering, or we can keep it always) */}
      {isPublished && (
        <div className="absolute left-1.5 top-1.5 z-10 rounded-full bg-violet-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-lg shadow-violet-500/50 transition-opacity group-hover/tile:opacity-0">
          ★
        </div>
      )}

      {/* Top Left: Hole punch checkbox for multi-select */}
      <div className="absolute left-2 top-2 z-20 flex items-center justify-center opacity-0 transition-opacity group-hover/tile:opacity-100">
        <button
          type="button"
          aria-label="Select"
          onClick={(e) => e.stopPropagation()}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-500/40 bg-black/40 text-transparent transition hover:border-slate-300 hover:text-white"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </button>
      </div>

      {/* Top Right: Pin & Kebab Menu */}
      <div className="absolute right-2 top-2 z-20 flex items-center gap-1 opacity-0 transition-opacity group-hover/tile:opacity-100">
        <button
          type="button"
          aria-label="Pin"
          onClick={(e) => e.stopPropagation()}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white/80 transition hover:bg-yellow-500 hover:text-black backdrop-blur-sm"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>
        </button>
        <button
          type="button"
          aria-label="More"
          onClick={(e) => e.stopPropagation()}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white/80 transition hover:bg-white/20 hover:text-white backdrop-blur-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
      </div>

      {/* Global pinned icon indicator (always visible when pinned, independent of hover) */}
      {c.role === "pinned" && (
        <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/90 text-white shadow-lg shadow-indigo-500/30 backdrop-blur-sm transition-opacity group-hover/tile:opacity-0">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>
        </div>
      )}

      {/* Bottom Left: Utilities (Retry, Copy Prompt, Use as Ref) */}
      <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1 opacity-0 transition-opacity group-hover/tile:opacity-100">
        <button
          type="button"
          aria-label="Retry"
          onClick={(e) => e.stopPropagation()}
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-black/50 text-white/80 transition hover:bg-white/20 hover:text-white backdrop-blur-sm"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
        <button
          type="button"
          aria-label="Copy Prompt"
          onClick={(e) => e.stopPropagation()}
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-black/50 text-white/80 transition hover:bg-white/20 hover:text-white backdrop-blur-sm"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button
          type="button"
          aria-label="Use as Reference"
          onClick={(e) => e.stopPropagation()}
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-black/50 text-white/80 transition hover:bg-white/20 hover:text-white backdrop-blur-sm"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        </button>
      </div>

      {/* Bottom Right: Download */}
      <div className="absolute bottom-2 right-2 z-20 flex items-center opacity-0 transition-opacity group-hover/tile:opacity-100">
        <button
          type="button"
          aria-label="Download"
          onClick={(e) => e.stopPropagation()}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white/80 transition hover:bg-white/20 hover:text-white backdrop-blur-sm"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
      </div>
    </div>
  );
}

export default function ShotContainer({
  shot,
  isActive,
  onActivate,
  taggedElements = [],
  demoQueuePhase,
  demoQueueProgress,
}: Props) {
  const publishedId = shot.previewFileId;
  const [fullscreenCandidate, setFullscreenCandidate] = useState<ShotCandidate | null>(null);
  const [showShotPicker, setShowShotPicker] = useState(false);

  const navigateCandidate = useCallback((dir: "prev" | "next") => {
    if (!fullscreenCandidate) return;
    const idx = shot.candidates.findIndex((c) => c.id === fullscreenCandidate.id);
    if (idx === -1) return;
    const next = dir === "next" ? idx + 1 : idx - 1;
    if (next >= 0 && next < shot.candidates.length) {
      setFullscreenCandidate(shot.candidates[next]);
    }
  }, [fullscreenCandidate, shot.candidates]);

  const fullscreenIdx = fullscreenCandidate
    ? shot.candidates.findIndex((c) => c.id === fullscreenCandidate.id)
    : -1;
  const hasPrev = fullscreenIdx > 0;
  const hasNext = fullscreenIdx >= 0 && fullscreenIdx < shot.candidates.length - 1;
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showShotPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowShotPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showShotPicker]);

  return (
    <>
      <div
        className={`rounded-[20px] border transition-all ${
          isActive
            ? "border-amber-400/20 bg-[#0d0e12]"
            : "border-transparent bg-[#0a0b0e] opacity-50 hover:opacity-70"
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center gap-2 px-4 py-2.5 ${
            !isActive ? "cursor-pointer" : ""
          }`}
          onClick={!isActive ? onActivate : undefined}
        >

          {/* Shot name */}
          <div className="min-w-0 flex-1">
            <span className="kv-mono text-sm font-semibold text-amber-200/90">
              {shot.name}
            </span>
            {shot.directionNote && (
              <span className="ml-1 text-xs text-slate-500">
                — {shot.directionNote}
              </span>
            )}
          </div>

          {/* Tagged element avatars */}
          {taggedElements.length > 0 && (
            <div className="flex -space-x-1.5">
              {taggedElements.slice(0, 5).map((el) => (
                <div
                  key={el.id}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-[#1a1c22] bg-slate-700 text-[9px] font-bold text-white"
                  aria-label={el.name}
                >
                  {el.thumbnailPath ? (
                    <img
                      src={el.thumbnailPath}
                      alt={el.name}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    el.name.slice(0, 2).toUpperCase()
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Candidate count */}
          <span className="kv-mono text-[10px] text-slate-600">
            {shot.candidates.length} candidate{shot.candidates.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Candidate grid — grouped by role when active */}
        {(isActive || shot.candidates.length > 0) && (
          <div className="px-3 pb-3">
            {isActive ? (
              <div className="grid grid-cols-3 gap-2">
                {/* Pinned and input candidates come first (already sorted from provider) */}
                {shot.candidates.filter((c) => c.role !== "output").map((c) => (
                  <CandidateTile key={c.id} c={c} isPublished={c.id === publishedId} onClick={() => setFullscreenCandidate(c)} />
                ))}

                {/* Demo queue tile */}
                {demoQueuePhase === "processing" && (
                  <div className="group/tile relative aspect-video flex-col overflow-hidden rounded-[14px] border border-amber-400/20 bg-[#17191f]">
                    <div className="absolute inset-x-0 top-0 h-1 bg-white/5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                        style={{ width: `${demoQueueProgress ?? 0}%`, transition: "width 0.3s ease" }}
                      />
                    </div>
                    <div className="flex h-full flex-col justify-between p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="kv-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Image job</div>
                          <div className="text-sm font-semibold text-white">Generating...</div>
                        </div>
                        <div className="kv-mono rounded-full bg-amber-500/12 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200 animate-pulse">
                          Processing
                        </div>
                      </div>
                      <div className="flex-1 my-2 overflow-hidden rounded-[8px] bg-[radial-gradient(circle_at_35%_18%,rgba(249,115,22,0.14),transparent_0_28%),linear-gradient(135deg,rgba(44,48,58,0.92),rgba(14,15,19,0.96))]" />
                      <div className="truncate text-[11px] text-slate-400">
                        {(demoQueueProgress ?? 0) < 30 ? "Initializing..." : (demoQueueProgress ?? 0) < 80 ? "Rendering frame..." : "Finalizing..."}
                      </div>
                    </div>
                  </div>
                )}

                {demoQueuePhase === "completed" && (() => {
                  const dummyCandidate: ShotCandidate = {
                    id: "demo-result",
                    extension: "jpg",
                    isVideo: false,
                    revision: 1,
                    width: 640,
                    height: 360,
                    duration: 0,
                    originalName: "demo_generated.jpg",
                    createdAt: new Date().toISOString(),
                    taskTypeId: "",
                    thumbnailPath: "https://picsum.photos/seed/demo-queue-result/640/360",
                    previewPath: "https://picsum.photos/seed/demo-queue-result/640/360",
                    role: "output",
                  };
                  return (
                    <CandidateTile key="demo-result" isPublished={false} c={dummyCandidate} onClick={() => setFullscreenCandidate(dummyCandidate)} />
                  );
                })()}

                {/* Output candidates */}
                {shot.candidates.filter((c) => c.role === "output").map((c) => (
                  <CandidateTile key={c.id} c={c} isPublished={c.id === publishedId} onClick={() => setFullscreenCandidate(c)} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {shot.candidates.filter((c) => c.role !== "pinned").map((c) => (
                  <CandidateTile key={c.id} c={c} isPublished={c.id === publishedId} onClick={() => setFullscreenCandidate(c)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {fullscreenCandidate && createPortal(
        fullscreenCandidate.isVideo ? (
          <VideoPlayer
            videoUrl={fullscreenCandidate.previewPath}
            videoName={fullscreenCandidate.originalName}
            onSave={async () => {}}
            onClose={() => setFullscreenCandidate(null)}
            onPrevious={hasPrev ? () => navigateCandidate("prev") : undefined}
            onNext={hasNext ? () => navigateCandidate("next") : undefined}
          />
        ) : (
          <ImageEditor
            imageUrl={fullscreenCandidate.previewPath}
            imageName={fullscreenCandidate.originalName}
            onSave={async () => {}}
            onClose={() => setFullscreenCandidate(null)}
            onPrevious={hasPrev ? () => navigateCandidate("prev") : undefined}
            onNext={hasNext ? () => navigateCandidate("next") : undefined}
          />
        ),
        document.body,
      )}
    </>
  );
}
