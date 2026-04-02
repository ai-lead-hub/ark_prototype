"use client";

import { useState } from "react";
import ControlsPane from "../components/ControlsPane";
import ElementsModal from "../components/ElementsModal";
import FileBrowser from "../components/FileBrowser";
import HomeScreen from "../components/HomeScreen";
import ModeRail, { type GenerationTab } from "../components/ModeRail";
import { CatalogProvider } from "../state/catalog";
import { QueueProvider } from "../state/queue";
import { ElementsProvider, useElements } from "../state/elements";
import { ShotsProvider } from "../state/shots";

function MainLayout({ onBack }: { onBack: () => void }) {
  const { isManagerOpen } = useElements();
  const [activeTab, setActiveTab] = useState<GenerationTab>("image");

  return (
    <div className="kv-shell flex h-dvh flex-col overflow-hidden text-slate-100">
      <div className="relative flex flex-1 gap-3 overflow-hidden px-3 py-3">
        <ModeRail activeTab={activeTab} onTabChange={setActiveTab} />

        <aside className="kv-panel flex w-[350px] shrink-0 min-h-0 flex-col rounded-[28px]">
          <div className="flex-1 min-h-0 overflow-hidden px-4 py-4">
            <ControlsPane
              activeTab={activeTab}
              onActiveTabChange={setActiveTab}
            />
          </div>
        </aside>

        <section className="kv-panel flex min-h-0 min-w-0 flex-1 flex-col rounded-[28px] overscroll-none">
          <div className="flex-1 min-h-0 overflow-hidden overscroll-none px-4 py-4">
            <FileBrowser disableKeyboardNav={isManagerOpen} onBack={onBack} />
          </div>
        </section>

        {isManagerOpen && <ElementsModal />}
      </div>
    </div>
  );
}

export default function Page() {
  const [activeProject, setActiveProject] = useState<string | null>(null);

  if (!activeProject) {
    return <HomeScreen onOpenProject={setActiveProject} />;
  }

  return (
    <CatalogProvider>
      <QueueProvider>
        <ElementsProvider>
          <ShotsProvider>
            <MainLayout onBack={() => setActiveProject(null)} />
          </ShotsProvider>
        </ElementsProvider>
      </QueueProvider>
    </CatalogProvider>
  );
}
