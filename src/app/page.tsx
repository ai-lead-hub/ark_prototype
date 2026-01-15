import { useState } from "react";
import ControlsPane from "../components/ControlsPane";
import FileBrowser from "../components/FileBrowser";
import PreviewPane from "../components/PreviewPane";
import ProjectBar from "../components/ProjectBar";
import { CatalogProvider } from "../state/catalog";
import { QueueProvider } from "../state/queue";

export default function Page() {
  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <CatalogProvider>
      <QueueProvider>
        <div className="flex h-dvh flex-col overflow-hidden bg-slate-950 text-slate-100">
          <div className="flex-shrink-0">
            <ProjectBar />
          </div>
          <div className="flex flex-1 gap-1.5 p-1.5 overflow-hidden bg-gradient-to-b from-slate-950 to-slate-900/50">
            {/* Left and center panels - hidden instead of unmounted when fullscreen to preserve scroll position */}
            <aside className={`flex w-[420px] min-h-0 flex-col rounded-xl border border-white/5 bg-slate-900/60 backdrop-blur-sm ${isFullScreen ? "hidden" : ""}`}>
              <div className="flex-1 min-h-0 overflow-y-auto p-3">
                <ControlsPane />
              </div>
            </aside>
            <section className={`flex min-h-0 min-w-[420px] flex-[1.1] flex-col rounded-xl border border-white/5 bg-slate-900/50 backdrop-blur-sm ${isFullScreen ? "hidden" : ""}`}>
              <div className="flex-1 min-h-0 overflow-y-auto p-3">
                <FileBrowser />
              </div>
            </section>
            <main
              className={`flex min-h-0 flex-shrink-0 flex-col rounded-xl border border-white/5 bg-slate-900/40 backdrop-blur-sm ${isFullScreen ? "flex-1 w-full" : "w-[420px]"
                }`}
            >
              <div className="flex-1 min-h-0 overflow-y-auto p-3">
                <PreviewPane
                  isFullScreen={isFullScreen}
                  onToggleFullScreen={() => setIsFullScreen(!isFullScreen)}
                />
              </div>
            </main>
          </div>
        </div>
      </QueueProvider>
    </CatalogProvider>
  );
}
