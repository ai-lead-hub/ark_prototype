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
    updateElement,
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

  const handleEditElement = async (element: Element) => {
    const nextName = prompt("Rename element", element.name)?.trim();
    if (!nextName || nextName === element.name) return;

    if (usingDemoElements || element.id.startsWith("demo-element-")) {
      setDemoElements((prev) =>
        prev.map((entry) =>
          entry.id === element.id
            ? { ...entry, name: nextName, updatedAt: Date.now() }
            : entry
        )
      );
      return;
    }

    try {
      await updateElement(element.id, { name: nextName });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update element");
    }
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
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_22%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))]">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Element Store
          </div>
          <div className="mt-1 flex items-center gap-3">
            <h2 className="truncate text-lg font-semibold text-white">
              {isFormOpen ? "Create a new element" : "Project elements"}
            </h2>
            {isSelectionMode && (
              <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200">
                Selection mode
              </span>
            )}
            {usingDemoElements && !isFormOpen && (
              <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
                Demo content
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

      <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
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
        ) : visibleElements.length === 0 ? (
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
          <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4">
            <section className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    Pinned Elements
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    Keep your active cast and reusable references in reach.
                  </div>
                </div>
                <div className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200">
                  {pinnedElements.length}
                </div>
              </div>

              {pinnedElements.length > 0 ? (
                <div className="grid grid-cols-4 gap-3">
                  {pinnedElements.map((element) => (
                    <ElementCard
                      key={element.id}
                      element={element}
                      isSelected
                      isSelectionMode={isSelectionMode && !usingDemoElements}
                      onSelect={selectElement}
                      onEdit={handleEditElement}
                      onDelete={handleDeleteElement}
                      previewLabel={usingDemoElements ? "Demo" : undefined}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-5 text-sm text-slate-400">
                  No pinned elements yet. As we wire the per-project pinning flow, pinned items will live here at the top.
                </div>
              )}
            </section>

            <section className="flex min-h-0 flex-col rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    Library
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    {libraryElements.length} element{libraryElements.length === 1 ? "" : "s"} in the remaining library
                  </div>
                </div>
              </div>

              {libraryElements.length > 0 ? (
                <div className="custom-scrollbar grid min-h-0 flex-1 grid-cols-4 gap-3 overflow-y-auto pr-1">
                  {libraryElements.map((element) => (
                    <ElementCard
                      key={element.id}
                      element={element}
                      isSelected={pinnedIds.has(element.id)}
                      isSelectionMode={isSelectionMode && !usingDemoElements}
                      onSelect={selectElement}
                      onEdit={handleEditElement}
                      onDelete={handleDeleteElement}
                      previewLabel={usingDemoElements ? "Demo" : undefined}
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
        )}
      </div>
    </div>
  );
}
