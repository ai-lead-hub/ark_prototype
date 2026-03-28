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
        className="flex h-[min(88vh,860px)] w-full max-w-6xl overflow-hidden rounded-2xl shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <ElementsManager />
      </div>
    </div>
  );
}
