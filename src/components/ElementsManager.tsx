import { useElements } from "../state/elements";
import ElementCard from "./ElementCard";
import ElementForm from "./ElementForm";

export default function ElementsManager() {
  const {
    elements,
    isLoading,
    error,
    isFormOpen,
    isSelectionMode,
    selectedElements,
    closeManager,
    openForm,
    selectElement,
  } = useElements();

  const selectedCount = selectedElements.length;
  const sheetCount = elements.filter((element) => Boolean(element.characterSheetUrl)).length;
  const referenceRichCount = elements.filter((element) => element.referenceImageUrls.length > 0).length;

  return (
    <div className="grid h-full min-h-0 w-full grid-cols-[280px_minmax(0,1fr)] overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_24%),radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))]">
      <aside className="flex min-h-0 flex-col border-r border-white/10 bg-black/20 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10 text-amber-200 shadow-[0_0_30px_rgba(251,191,36,0.18)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.24em] text-amber-200/70">
              Element Store
            </div>
            <h2 className="truncate text-xl font-semibold text-white">Project Elements</h2>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-300">
          Build a reusable cast library for this workspace. Character sheets stay ready for drag-and-drop,
          and reference sets remain close to the prompt flow.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Library</div>
            <div className="mt-2 text-2xl font-semibold text-white">{elements.length}</div>
            <div className="text-xs text-slate-400">saved element{elements.length === 1 ? "" : "s"}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Pinned To Session</div>
            <div className="mt-2 text-2xl font-semibold text-sky-200">{selectedCount}</div>
            <div className="text-xs text-slate-400">
              {isSelectionMode ? "selection mode active" : "ready to use"}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
            Coverage
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <StatRow label="With character sheets" value={sheetCount} tone="amber" />
            <StatRow label="With extra refs" value={referenceRichCount} tone="sky" />
            <StatRow label="Ready for drag-drop" value={sheetCount} tone="emerald" />
          </div>
        </div>

        <div className="mt-auto rounded-3xl border border-dashed border-white/15 bg-black/25 p-4">
          <div className="text-sm font-medium text-white">Workflow hint</div>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Drag images from the file grid into the creator to build a new element fast. Character sheets can
            then be dragged back into generation as references.
          </p>
        </div>
      </aside>

      <section className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
              {isFormOpen ? "Create Mode" : "Library View"}
            </div>
            <div className="mt-1 flex items-center gap-3">
              <h3 className="truncate text-lg font-semibold text-white">
                {isFormOpen ? "Create a new reusable element" : "Browse your saved elements"}
              </h3>
              {isSelectionMode && (
                <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200">
                  Selection mode
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!isFormOpen && (
              <button
                onClick={openForm}
                className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20"
              >
                + New Element
              </button>
            )}
            <button
              onClick={closeManager}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              title="Close element store"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-6 py-5">
          {isFormOpen ? (
            <div className="min-h-0 overflow-y-auto rounded-[24px] border border-white/10 bg-black/25 p-5 custom-scrollbar">
              <ElementForm />
            </div>
          ) : isLoading ? (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-[24px] border border-white/10 bg-black/20 text-sm text-slate-400">
              <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading elements...
            </div>
          ) : error ? (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-[24px] border border-rose-500/20 bg-rose-500/5 text-sm text-rose-300">
              {error}
            </div>
          ) : elements.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-[24px] border border-dashed border-white/15 bg-black/20 px-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              </div>
              <h4 className="mt-5 text-lg font-semibold text-white">No elements yet</h4>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                Start a cast library for this project by saving a character, prop, or look-dev pack with a clean
                frontal image and a few support angles.
              </p>
              <button
                onClick={openForm}
                className="mt-6 rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20"
              >
                Create your first element
              </button>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="text-sm text-slate-300">
                  {elements.length} element{elements.length === 1 ? "" : "s"} in this workspace
                </div>
                {selectedCount > 0 && (
                  <div className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200">
                    {selectedCount} selected for prompting
                  </div>
                )}
              </div>

              <div className="custom-scrollbar grid min-h-0 flex-1 grid-cols-3 gap-4 overflow-y-auto pr-1">
                {elements.map((element) => (
                  <ElementCard
                    key={element.id}
                    element={element}
                    isSelected={selectedElements.some((sel) => sel.element.id === element.id)}
                    isSelectionMode={isSelectionMode}
                    onSelect={selectElement}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "sky" | "emerald";
}) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-400/10 text-amber-200"
      : tone === "sky"
        ? "bg-sky-400/10 text-sky-200"
        : "bg-emerald-400/10 text-emerald-200";

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}
