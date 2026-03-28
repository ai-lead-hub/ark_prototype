import ControlsPane from "../components/ControlsPane";
import ElementsModal from "../components/ElementsModal";
import FileBrowser from "../components/FileBrowser";
import { CatalogProvider } from "../state/catalog";
import { QueueProvider } from "../state/queue";
import { ElementsProvider, useElements } from "../state/elements";

function MainLayout() {
  const { isManagerOpen } = useElements();

  return (
    <div className="kv-shell flex h-dvh flex-col overflow-hidden text-slate-100">
      <div className="relative flex flex-1 gap-3 overflow-hidden px-3 py-3">
        <aside className="kv-panel flex w-[398px] min-h-0 flex-col rounded-[28px]">
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
            <ControlsPane />
          </div>
        </aside>

        <section className="kv-panel flex min-h-0 flex-1 flex-col rounded-[28px]">
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
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
