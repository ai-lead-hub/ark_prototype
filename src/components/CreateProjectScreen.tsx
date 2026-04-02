import { useState } from "react";

type ProjectType = "Short" | "TV Show" | "Feature Film";
type StyleType = "2D Animation" | "3D Animation" | "Live Action" | "Motion Graphics";

type Props = {
  onBack: () => void;
  onNext: (projectData: any) => void;
};

export default function CreateProjectScreen({ onBack, onNext }: Props) {
  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("Short");
  const [style, setStyle] = useState<StyleType>("2D Animation");
  const [fps, setFps] = useState("25");
  const [ratio, setRatio] = useState("16:9");
  const [width, setWidth] = useState("1920");
  const [height, setHeight] = useState("1080");
  const [startDate, setStartDate] = useState("2026-04-02");
  const [endDate, setEndDate] = useState("2026-07-02");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext({
      name: projectName,
      type: projectType,
      style,
      fps: parseInt(fps),
      ratio,
      resolution: { width: parseInt(width), height: parseInt(height) },
      startDate,
      endDate,
    });
  };

  return (
    <div className="flex h-dvh flex-col bg-[#1a1a1a] text-slate-100">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/20 transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-[11px] font-bold">
          AJ
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold text-white mb-8">Create Production</h1>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Step 1: Project Name */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                  1
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-emerald-400">
                    Give your production a name
                  </h2>
                  <p className="text-sm text-slate-500">
                    Start by giving your production a meaningful name.
                  </p>
                </div>
              </div>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Awesome Production"
                className="w-full rounded-xl bg-[#2a2a2a] px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            {/* Step 2: Production Parameters */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                  2
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-emerald-400">
                    Set your production parameters
                  </h2>
                  <p className="text-sm text-slate-500">
                    Define your production type, the format of your video previews and schedule your production.
                  </p>
                </div>
              </div>

              {/* Type and Style */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400">Type</label>
                  <select
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value as ProjectType)}
                    className="w-full rounded-xl bg-[#2a2a2a] px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Short">Short</option>
                    <option value="TV Show">TV Show</option>
                    <option value="Feature Film">Feature Film</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400">Style</label>
                  <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value as StyleType)}
                    className="w-full rounded-xl bg-[#2a2a2a] px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="2D Animation">2D Animation</option>
                    <option value="3D Animation">3D Animation</option>
                    <option value="Live Action">Live Action</option>
                    <option value="Motion Graphics">Motion Graphics</option>
                  </select>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Selecting TV Show will split the production into episodes.
              </p>

              {/* Technical Specs */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400">FPS</label>
                  <input
                    type="text"
                    value={fps}
                    onChange={(e) => setFps(e.target.value)}
                    className="w-full rounded-xl bg-[#2a2a2a] px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400">Ratio</label>
                  <input
                    type="text"
                    value={ratio}
                    onChange={(e) => setRatio(e.target.value)}
                    className="w-full rounded-xl bg-[#2a2a2a] px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400">Resolution</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                      className="flex-1 rounded-xl bg-[#2a2a2a] px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="flex items-center text-slate-500">x</span>
                    <input
                      type="text"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      className="flex-1 rounded-xl bg-[#2a2a2a] px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                These settings are used to normalize the uploaded videos.
              </p>

              {/* Dates */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400">Start and End Dates</label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-xl bg-[#2a2a2a] px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-xl bg-[#2a2a2a] px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                These dates are needed to set up your schedule.
              </p>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-8 border-t border-white/10">
              <button
                type="button"
                onClick={onBack}
                className="rounded-xl bg-white/10 px-8 py-3 text-sm font-medium text-slate-300 hover:bg-white/20 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-emerald-500 px-8 py-3 text-sm font-medium text-white hover:bg-emerald-600 transition"
              >
                Next: Create Shots
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
