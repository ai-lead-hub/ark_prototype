import ControlsPane from "../components/ControlsPane";
import ElementsModal from "../components/ElementsModal";
import FileBrowser from "../components/FileBrowser";
import { CatalogProvider } from "../state/catalog";
import { QueueProvider } from "../state/queue";
import { ElementsProvider, useElements } from "../state/elements";

function MainLayout() {
  const { isManagerOpen } = useElements();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-950 text-slate-100">
      <div className="relative flex flex-1 gap-1.5 overflow-hidden bg-gradient-to-b from-slate-950 to-slate-900/50 p-1.5">
        <aside className="flex w-[420px] min-h-0 flex-col rounded-xl border border-white/5 bg-slate-900/60 backdrop-blur-sm">
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <ControlsPane />
          </div>
        </aside>

        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-white/5 bg-slate-900/50 backdrop-blur-sm">
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <FileBrowser disableKeyboardNav={isManagerOpen} />
          </div>
        </section>

        {isManagerOpen && <ElementsModal />}
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
