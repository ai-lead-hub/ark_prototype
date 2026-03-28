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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-4 backdrop-blur-md"
      onClick={closeManager}
    >
      <div
        className="kv-panel flex h-[min(72vh,620px)] w-[min(78vw,920px)] overflow-hidden rounded-[28px]"
        onClick={(event) => event.stopPropagation()}
      >
        <ElementsManager />
      </div>
    </div>
  );
}
