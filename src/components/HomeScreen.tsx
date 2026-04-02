import { useState } from "react";

type DemoProject = {
  id: string;
  name: string;
  thumbnail: string;
  scenes: number;
  shots: number;
  status: string;
  updatedAt: string;
};

const DEMO_PROJECTS: DemoProject[] = [
  {
    id: "scarecrow",
    name: "Scarecrow",
    thumbnail: "/kitsu-previews/demo-video.mp4",
    scenes: 5,
    shots: 47,
    status: "In Production",
    updatedAt: "2 hours ago",
  },
  {
    id: "moonrise",
    name: "Moonrise",
    thumbnail: "",
    scenes: 3,
    shots: 28,
    status: "Pre-Production",
    updatedAt: "1 day ago",
  },
  {
    id: "deep-current",
    name: "Deep Current",
    thumbnail: "",
    scenes: 8,
    shots: 112,
    status: "In Production",
    updatedAt: "3 days ago",
  },
  {
    id: "ember-trail",
    name: "Ember Trail",
    thumbnail: "",
    scenes: 4,
    shots: 56,
    status: "Review",
    updatedAt: "5 days ago",
  },
  {
    id: "ghost-frequency",
    name: "Ghost Frequency",
    thumbnail: "",
    scenes: 6,
    shots: 73,
    status: "Pre-Production",
    updatedAt: "1 week ago",
  },
];

const STATUS_COLORS: Record<string, string> = {
  "In Production": "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  "Pre-Production": "bg-amber-500/15 text-amber-300 border-amber-500/20",
  Review: "bg-violet-500/15 text-violet-300 border-violet-500/20",
};

type Props = {
  onOpenProject: (projectId: string) => void;
  onCreateProject?: () => void;
};

export default function HomeScreen({ onOpenProject, onCreateProject }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // The modal is now managed in page.tsx
  const handleNewProjectClick = () => {
    if (onCreateProject) {
      onCreateProject();
    } else {
      // Fallback to old behavior
      onOpenProject(`project-${Date.now()}`);
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-[#08090c] text-slate-100">

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 text-sm font-black text-black">
            A
          </div>
          <span className="text-lg font-semibold tracking-tight text-slate-100">Ark</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/8"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Search projects...
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-[11px] font-bold">
            AJ
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">Projects</h1>
          <p className="mt-1 text-sm text-slate-500">Select a project to open the workspace</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {DEMO_PROJECTS.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => onOpenProject(project.id)}
              onMouseEnter={() => setHoveredId(project.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="group flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#0d0e12] text-left transition-all hover:border-amber-400/20 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video w-full overflow-hidden bg-[#111318]">
                {project.thumbnail ? (
                  project.thumbnail.endsWith(".mp4") ? (
                    <video
                      src={project.thumbnail}
                      className="h-full w-full object-cover"
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      ref={(el) => {
                        if (!el) return;
                        if (hoveredId === project.id) void el.play();
                        else { el.pause(); el.currentTime = 0; }
                      }}
                    />
                  ) : (
                    <img src={project.thumbnail} alt={project.name} className="h-full w-full object-cover" />
                  )
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#15171e] to-[#0c0d10]">
                    <span className="text-3xl font-black text-white/[0.04]">{project.name[0]}</span>
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-semibold text-slate-100">{project.name}</h3>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[project.status] ?? "bg-white/5 text-slate-400 border-white/10"}`}>
                    {project.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span>{project.scenes} scenes</span>
                  <span className="text-slate-700">/</span>
                  <span>{project.shots} shots</span>
                  <span className="ml-auto">{project.updatedAt}</span>
                </div>
              </div>
            </button>
          ))}

          {/* New project card */}
          <button
            type="button"
            onClick={handleNewProjectClick}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/8 bg-transparent text-slate-500 transition hover:border-amber-400/20 hover:text-slate-300"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            </div>
            <span className="text-xs font-medium">New Project</span>
          </button>
        </div>
      </div>
    </div>
  );
}
