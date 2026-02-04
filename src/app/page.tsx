import { useState } from "react";
import ControlsPane from "../components/ControlsPane";
import FileBrowser from "../components/FileBrowser";
import PreviewPane from "../components/PreviewPane";
import ProjectBar from "../components/ProjectBar";
import ElementsManager from "../components/ElementsManager";
import { CatalogProvider } from "../state/catalog";
import { QueueProvider } from "../state/queue";
import { ElementsProvider, useElements } from "../state/elements";

function MainLayout() {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const { isManagerOpen } = useElements();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-950 text-slate-100">
      <div className="flex-shrink-0">
        <ProjectBar />
      </div>
      <div className="flex flex-1 gap-1.5 p-1.5 overflow-hidden bg-gradient-to-b from-slate-950 to-slate-900/50">
        {/* Left - Controls */}
        <aside className={`flex w-[420px] min-h-0 flex-col rounded-xl border border-white/5 bg-slate-900/60 backdrop-blur-sm ${isFullScreen ? "hidden" : ""}`}>
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <ControlsPane />
          </div>
        </aside>

        {/* Center - File Browser */}
        <section className={`flex min-h-0 min-w-[420px] flex-[1.1] flex-col rounded-xl border border-white/5 bg-slate-900/50 backdrop-blur-sm ${isFullScreen ? "hidden" : ""}`}>
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <FileBrowser disableKeyboardNav={isFullScreen || isManagerOpen} />
          </div>
        </section>

        {/* Right - Preview Pane OR Elements Manager */}
        <main
          className={`flex min-h-0 flex-shrink-0 flex-col rounded-xl border border-white/5 backdrop-blur-sm ${isManagerOpen ? "bg-[#2a2a2a] border-amber-500/30" : "bg-slate-900/40"
            } ${isFullScreen ? "flex-1 w-full" : "w-[420px]"}`}
        >
          {isManagerOpen ? (
            <ElementsManager />
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto p-3">
              <PreviewPane
                isFullScreen={isFullScreen}
                onToggleFullScreen={() => setIsFullScreen(!isFullScreen)}
              />
            </div>
          )}
        </main>
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
