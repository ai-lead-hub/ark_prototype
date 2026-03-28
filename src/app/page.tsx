import ControlsPane from "../components/ControlsPane";
import FileBrowser from "../components/FileBrowser";
import ProjectBar from "../components/ProjectBar";
import ElementsManager from "../components/ElementsManager"; // Will be moved to a modal soon
import { CatalogProvider } from "../state/catalog";
import { QueueProvider } from "../state/queue";
import { ElementsProvider, useElements } from "../state/elements";

function MainLayout() {
  const { isManagerOpen } = useElements();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-950 text-slate-100">
      <div className="flex flex-1 gap-1.5 p-1.5 overflow-hidden bg-gradient-to-b from-slate-950 to-slate-900/50 relative">
        {/* Left - Controls */}
        <aside className="flex w-[420px] min-h-0 flex-col rounded-xl border border-white/5 bg-slate-900/60 backdrop-blur-sm">
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <ControlsPane />
          </div>
        </aside>

        {/* Right - File Browser (Expands fully) */}
        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-white/5 bg-slate-900/50 backdrop-blur-sm">
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <FileBrowser disableKeyboardNav={isManagerOpen} />
          </div>
        </section>

        {/* Temporary: ElementsManager acting as a basic overlay if needed before full Modal refactor */}
        {isManagerOpen && (
          <div className="absolute right-4 top-4 bottom-4 w-[420px] rounded-xl border border-amber-500/30 backdrop-blur-sm bg-[#2a2a2a] shadow-2xl z-50 flex flex-col">
            <ElementsManager />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <CatalogProvider>
      <QueueProvider>
        <ElementsProvider>
          <MainLayout />
        </ElementsProvider>
      </QueueProvider>
    </CatalogProvider>
  );
}
