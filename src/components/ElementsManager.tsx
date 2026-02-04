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
        toggleManager,
        openForm,
        selectElement,
    } = useElements();

    return (
        <div className="flex flex-col h-full bg-slate-900/95 rounded-xl border border-white/10">
            {/* Header - Matching app aesthetic */}
            <div className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-amber-500/20 text-amber-300">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    </div>
                    <span className="font-semibold text-sm text-slate-200">
                        Elements
                        {isSelectionMode && (
                            <span className="ml-2 text-xs font-normal text-slate-400">
                                (Select to add)
                            </span>
                        )}
                    </span>
                    {selectedElements.length > 0 && (
                        <span className="ml-2 rounded-full bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300">
                            {selectedElements.length}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {!isFormOpen && (
                        <button
                            onClick={openForm}
                            className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-400 transition hover:bg-sky-500/20"
                        >
                            + New
                        </button>
                    )}
                    <button
                        onClick={toggleManager}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                        title="Close"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {isFormOpen ? (
                    <ElementForm />
                ) : isLoading ? (
                    <div className="flex items-center justify-center h-full text-sm text-slate-400">
                        <svg className="animate-spin mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Loading...
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full text-sm text-rose-400">
                        {error}
                    </div>
                ) : elements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-slate-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                        </div>
                        <p className="text-slate-400 text-sm">No elements yet</p>
                        <button
                            onClick={openForm}
                            className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:border-sky-500/30 hover:text-sky-400"
                        >
                            Create your first element
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        {elements.map((element) => (
                            <ElementCard
                                key={element.id}
                                element={element}
                                isSelected={selectedElements.some(
                                    (sel) => sel.element.id === element.id
                                )}
                                selectedMode={
                                    selectedElements.find((sel) => sel.element.id === element.id)
                                        ?.mode
                                }
                                isSelectionMode={isSelectionMode}
                                onSelect={selectElement}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer hint */}
            <div className="flex-shrink-0 border-t border-white/10 px-4 py-2 bg-black/20">
                <p className="text-[10px] text-slate-500">
                    Drag images/videos from the file browser to create elements
                </p>
            </div>
        </div>
    );
}
