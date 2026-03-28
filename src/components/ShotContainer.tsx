import type { Shot, ShotCandidate } from "../state/shots";

type Props = {
  shot: Shot;
  isActive: boolean;
  onActivate: () => void;
  onNavigate: (dir: "prev" | "next") => void;
  /** Element avatars to show next to shot name */
  taggedElements?: { id: string; name: string; thumbnailPath?: string }[];
};

function CandidateTile({
  c,
  isPublished,
}: {
  c: ShotCandidate;
  isPublished: boolean;
}) {
  let borderClass = "border border-transparent hover:border-amber-400/30";
  if (c.role === "pinned") {
    borderClass = "border-2 border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.25)]";
  } else if (c.role === "input") {
    borderClass = "border-2 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.25)]";
  }

  return (
    <div className={`group/tile relative aspect-video overflow-hidden rounded-[14px] bg-[#111318] transition ${borderClass}`}>
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

      {isPublished && (
        <div className="absolute left-1.5 top-1.5 rounded-full bg-violet-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-lg shadow-violet-500/50">
          ★
        </div>
      )}

      {c.role === "pinned" && (
        <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/90 text-white shadow-lg shadow-indigo-500/30 backdrop-blur-sm">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>
        </div>
      )}

      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover/tile:opacity-100">
        <span className="rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white/90 backdrop-blur-sm">
          r{c.revision}
        </span>
        {c.isVideo && c.duration > 0 && (
          <span className="rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white/90 backdrop-blur-sm">
            {Math.round(c.duration)}s
          </span>
        )}
      </div>
    </div>
  );
}

export default function ShotContainer({
  shot,
  isActive,
  onActivate,
  onNavigate,
  taggedElements = [],
}: Props) {
  const publishedId = shot.previewFileId;

  return (
    <div
      className={`rounded-[20px] border transition-all ${
        isActive
          ? "border-amber-400/20 bg-[#0d0e12]"
          : "border-white/[0.04] bg-[#0a0b0e] opacity-50 hover:opacity-70"
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center gap-2 px-4 py-2.5 ${
          !isActive ? "cursor-pointer" : ""
        }`}
        onClick={!isActive ? onActivate : undefined}
      >
        {/* Nav arrows */}
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate("prev");
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-slate-500 transition hover:bg-white/5 hover:text-white"
            aria-label="Previous shot"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate("next");
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-slate-500 transition hover:bg-white/5 hover:text-white"
            aria-label="Next shot"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        </div>

        {/* Shot name */}
        <div className="min-w-0 flex-1">
          <span className="kv-mono text-sm font-semibold text-amber-200/90">
            {shot.name}
          </span>
          {shot.directionNote && (
            <span className="ml-2 text-xs text-slate-500">
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

      {/* Candidate grid */}
      {(isActive || shot.candidates.length > 0) && (
        <div className="px-3 pb-3">
          <div className={`grid gap-2 ${isActive ? "grid-cols-3" : "grid-cols-6"}`}>
            {(isActive ? shot.candidates : shot.candidates.slice(0, 6)).map(
              (c) => (
                <CandidateTile
                  key={c.id}
                  c={c}
                  isPublished={c.id === publishedId}
                />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
