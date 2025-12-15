import { CanvasProvider } from "../state/CanvasContext";
import CanvasSidebar from "./CanvasSidebar";
import InfiniteCanvas from "./InfiniteCanvas";

export default function CanvasWorkspace() {
    return (
        <CanvasProvider>
            <div className="flex h-full w-full overflow-hidden">
                <CanvasSidebar />
                <InfiniteCanvas />
            </div>
        </CanvasProvider>
    );
}
