"use client";

import { useState } from "react";
import ControlsPane from "../components/ControlsPane";
import ElementsModal from "../components/ElementsModal";
import FileBrowser from "../components/FileBrowser";
import HomeScreen from "../components/HomeScreen";
import CreateProjectScreen from "../components/CreateProjectScreen";
import CreateShotsScreen from "../components/CreateShotsScreen";
import { CatalogProvider } from "../state/catalog";
import { QueueProvider } from "../state/queue";
import { ElementsProvider, useElements } from "../state/elements";
import { ShotsProvider } from "../state/shots";

function MainLayout({ onBack }: { onBack: () => void }) {
  const { isManagerOpen } = useElements();

  return (
    <div className="kv-shell flex h-dvh flex-col overflow-hidden text-slate-100">
      <div className="relative flex flex-1 gap-3 overflow-hidden px-3 py-3">
        <aside className="kv-panel flex w-[398px] shrink-0 min-h-0 flex-col rounded-[28px]">
          <div className="flex-1 min-h-0 overflow-hidden px-4 py-4">
            <ControlsPane />
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

type AppState = "home" | "create-project" | "create-shots" | "main";

export default function Page() {
  const [appState, setAppState] = useState<AppState>("home");
  const [projectData, setProjectData] = useState<any>(null);

  const handleCreateProjectNext = (data: any) => {
    console.log("Project data:", data);
    setProjectData(data);
    setAppState("create-shots");
  };

  const handleCreateShotsSubmit = (data: any) => {
    console.log("Shots data:", data);
    setAppState("main");
  };

  if (appState === "home") {
    return (
      <HomeScreen
        onOpenProject={() => setAppState("main")}
        onCreateProject={() => setAppState("create-project")}
      />
    );
  }

  if (appState === "create-project") {
    return (
      <CreateProjectScreen
        onBack={() => setAppState("home")}
        onNext={handleCreateProjectNext}
      />
    );
  }

  if (appState === "create-shots") {
    return (
      <CreateShotsScreen
        onBack={() => setAppState("create-project")}
        onSubmit={handleCreateShotsSubmit}
        projectData={projectData}
      />
    );
  }

  return (
    <CatalogProvider>
      <QueueProvider>
        <ElementsProvider>
          <ShotsProvider>
            <MainLayout onBack={() => setAppState("home")} />
          </ShotsProvider>
        </ElementsProvider>
      </QueueProvider>
    </CatalogProvider>
  );
}
