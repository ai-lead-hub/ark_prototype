import { useEffect } from "react";
import { useElements } from "../state/elements";
import ElementsManager from "./ElementsManager";

export default function ElementsModal() {
  const { closeManager } = useElements();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeManager();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeManager]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={closeManager}
    >
      <div
        className="flex h-[min(84vh,780px)] w-[min(92vw,1180px)] overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/95 shadow-[0_30px_120px_rgba(0,0,0,0.65)]"
        onClick={(event) => event.stopPropagation()}
      >
        <ElementsManager />
      </div>
    </div>
  );
}
