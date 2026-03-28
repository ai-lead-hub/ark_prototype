import { useMemo, useState } from "react";
import type { Element } from "../state/elementTypes";
import { useElements } from "../state/elements";
import ElementCard from "./ElementCard";
import ElementForm from "./ElementForm";

const DEMO_ELEMENTS: Element[] = [
  {
    id: "demo-element-1",
    name: "Captain Vale",
    frontalImageUrl: "https://picsum.photos/seed/demo-element-1/640/640",
    referenceImageUrls: [
      "https://picsum.photos/seed/demo-element-1-ref-a/640/640",
      "https://picsum.photos/seed/demo-element-1-ref-b/640/640",
    ],
    characterSheetUrl: "https://picsum.photos/seed/demo-element-1-sheet/640/640",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "demo-element-2",
    name: "Neon Courier",
    frontalImageUrl: "https://picsum.photos/seed/demo-element-2/640/640",
    referenceImageUrls: ["https://picsum.photos/seed/demo-element-2-ref-a/640/640"],
    characterSheetUrl: "https://picsum.photos/seed/demo-element-2-sheet/640/640",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "demo-element-3",
    name: "The Glass Market",
    frontalImageUrl: "https://picsum.photos/seed/demo-element-3/640/640",
    referenceImageUrls: ["https://picsum.photos/seed/demo-element-3-ref-a/640/640"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "demo-element-4",
    name: "Orbit Bike",
    frontalImageUrl: "https://picsum.photos/seed/demo-element-4/640/640",
    referenceImageUrls: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

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
    deleteElement,
  } = useElements();
  const [demoElements, setDemoElements] = useState<Element[]>(DEMO_ELEMENTS);

  const usingDemoElements = elements.length === 0;
  const visibleElements = usingDemoElements ? demoElements : elements;

  const pinnedElements = useMemo(
    () => usingDemoElements ? visibleElements.slice(0, 2) : selectedElements.map(({ element }) => element),
    [selectedElements, usingDemoElements, visibleElements]
  );
  const pinnedIds = useMemo(
    () => new Set(pinnedElements.map((element) => element.id)),
    [pinnedElements]
  );
  const libraryElements = useMemo(
    () => visibleElements.filter((element) => !pinnedIds.has(element.id)),
    [pinnedIds, visibleElements]
  );
  const showLoading = isLoading && !usingDemoElements;
  const showError = Boolean(error) && !usingDemoElements;

  const handleEditElement = (element: Element) => {
    const nextName = prompt("Rename element", element.name)?.trim();
    if (!nextName || nextName === element.name) return;

    setDemoElements((prev) =>
      prev.map((entry) =>
        entry.id === element.id
          ? { ...entry, name: nextName, updatedAt: Date.now() }
          : entry
      )
    );
  };

  const handleDeleteElement = async (element: Element) => {
    if (usingDemoElements || element.id.startsWith("demo-element-")) {
      setDemoElements((prev) => prev.filter((entry) => entry.id !== element.id));
      return;
    }

    try {
      await deleteElement(element.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete element");
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.12),transparent_24%),linear-gradient(180deg,rgba(17,19,23,0.98),rgba(8,9,12,0.98))]">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="kv-display truncate text-lg font-semibold text-white">
              {isFormOpen ? "Create a new element" : "Project elements"}
            </h2>
            {isSelectionMode && (
              <span className="kv-pill kv-mono rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]">
                Selection mode
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!isFormOpen && (
            <button
              onClick={openForm}
              className="kv-icon-button flex h-10 w-10 items-center justify-center rounded-full border-amber-400/30 bg-amber-500/10 text-amber-200"
              aria-label="Create a new element"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            </button>
          )}
          <button
            onClick={closeManager}
            className="kv-icon-button flex h-10 w-10 items-center justify-center rounded-full"
            aria-label="Close elements manager"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
        {isFormOpen ? (
          <div className="kv-panel-soft custom-scrollbar min-h-0 overflow-y-auto rounded-[24px] p-5">
            <ElementForm />
          </div>
        ) : showLoading ? (
          <div className="kv-panel-soft flex min-h-0 flex-1 items-center justify-center rounded-[24px] text-sm text-slate-400">
            <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading elements...
          </div>
        ) : showError ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-[24px] border border-rose-500/20 bg-rose-500/5 text-sm text-rose-300">
            {error}
          </div>
        ) : visibleElements.length === 0 ? (
          <div className="kv-panel-soft flex min-h-0 flex-1 flex-col items-center justify-center rounded-[24px] px-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            </div>
            <h4 className="kv-display mt-5 text-lg font-semibold text-white">No elements yet</h4>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
              Start a cast library for this project by saving a character, prop, or look-dev pack with a clean
              frontal image and a few support angles.
            </p>
            <button
              onClick={openForm}
              className="kv-cta mt-6 rounded-full px-4 py-2 text-sm font-semibold"
            >
              Create your first element
            </button>
          </div>
        ) : (
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-4 pb-1">
            <section className="kv-panel-soft rounded-[24px] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="kv-display text-sm font-medium text-white">Pinned elements</div>
                  <div className="kv-mono mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Quick access
                  </div>
                </div>
                <div className="kv-pill kv-mono rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.16em]">
                  {pinnedElements.length}
                </div>
              </div>

              {pinnedElements.length > 0 ? (
                <div className="grid grid-cols-5 gap-3">
                  {pinnedElements.map((element) => (
                    <ElementCard
                      key={element.id}
                      element={element}
                      isSelected
                      isSelectionMode={isSelectionMode && !usingDemoElements}
                      onSelect={selectElement}
                      onEdit={usingDemoElements ? handleEditElement : undefined}
                      onDelete={handleDeleteElement}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-5 text-sm text-slate-400">
                  No pinned elements yet. As we wire the per-project pinning flow, pinned items will live here at the top.
                </div>
              )}
            </section>

            <section className="kv-panel-soft rounded-[24px] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="kv-display text-sm font-medium text-white">Elements library</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {libraryElements.length} element{libraryElements.length === 1 ? "" : "s"} in the remaining library
                  </div>
                </div>
              </div>

              {libraryElements.length > 0 ? (
                <div className="grid grid-cols-5 gap-3">
                  {libraryElements.map((element) => (
                    <ElementCard
                      key={element.id}
                      element={element}
                      isSelected={pinnedIds.has(element.id)}
                      isSelectionMode={isSelectionMode && !usingDemoElements}
                      onSelect={selectElement}
                      onEdit={usingDemoElements ? handleEditElement : undefined}
                      onDelete={handleDeleteElement}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/10 text-sm text-slate-400">
                  Everything is currently pinned.
                </div>
              )}
            </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
