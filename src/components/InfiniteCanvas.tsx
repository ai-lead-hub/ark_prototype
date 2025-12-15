import { useCallback, useRef, useState, useEffect } from "react";
import { useCanvas } from "../state/CanvasContext";
import CanvasElementComponent from "./CanvasElement";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const ZOOM_SPEED = 0.001;
const GRID_SIZE = 50;

export default function InfiniteCanvas() {
    const { state, actions } = useCanvas();
    const containerRef = useRef<HTMLDivElement>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [isSpaceHeld, setIsSpaceHeld] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0, viewX: 0, viewY: 0 });

    // Keyboard handling for space key and delete
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === "Space" && !e.repeat) {
                e.preventDefault();
                setIsSpaceHeld(true);
            }
            if ((e.key === "Delete" || e.key === "Backspace") && state.selectedId) {
                // Don't delete if focused on an input
                if (
                    document.activeElement?.tagName === "INPUT" ||
                    document.activeElement?.tagName === "TEXTAREA"
                ) {
                    return;
                }
                e.preventDefault();
                actions.removeElement(state.selectedId);
            }
            // Escape to deselect
            if (e.key === "Escape") {
                actions.setSelected(null);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === "Space") {
                setIsSpaceHeld(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, [state.selectedId, actions]);

    // Zoom with scroll wheel (centered on cursor)
    const handleWheel = useCallback(
        (e: React.WheelEvent) => {
            e.preventDefault();
            const container = containerRef.current;
            if (!container) return;

            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Calculate new zoom
            const delta = -e.deltaY * ZOOM_SPEED;
            const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.viewport.zoom * (1 + delta)));
            const zoomRatio = newZoom / state.viewport.zoom;

            // Adjust viewport to keep mouse position stable
            const newX = mouseX - (mouseX - state.viewport.x) * zoomRatio;
            const newY = mouseY - (mouseY - state.viewport.y) * zoomRatio;

            actions.setViewport({ zoom: newZoom, x: newX, y: newY });
        },
        [state.viewport, actions]
    );

    // Pan with middle mouse or space+left click
    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            // Middle mouse button or space + left click for panning
            if (e.button === 1 || (e.button === 0 && isSpaceHeld)) {
                e.preventDefault();
                setIsPanning(true);
                panStartRef.current = {
                    x: e.clientX,
                    y: e.clientY,
                    viewX: state.viewport.x,
                    viewY: state.viewport.y,
                };
            } else if (e.button === 0 && e.target === containerRef.current) {
                // Click on empty canvas area to deselect
                actions.setSelected(null);
            }
        },
        [isSpaceHeld, state.viewport, actions]
    );

    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (!isPanning) return;
            const dx = e.clientX - panStartRef.current.x;
            const dy = e.clientY - panStartRef.current.y;
            actions.setViewport({
                x: panStartRef.current.viewX + dx,
                y: panStartRef.current.viewY + dy,
            });
        },
        [isPanning, actions]
    );

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    // Drop handler for assets from sidebar
    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            const data = e.dataTransfer.getData("application/json");
            if (!data) return;

            try {
                const asset = JSON.parse(data) as {
                    url: string;
                    name: string;
                    type: "image" | "video";
                    width?: number;
                    height?: number;
                };

                const container = containerRef.current;
                if (!container) return;

                const rect = container.getBoundingClientRect();
                // Convert drop position to canvas coordinates
                const canvasX = (e.clientX - rect.left - state.viewport.x) / state.viewport.zoom;
                const canvasY = (e.clientY - rect.top - state.viewport.y) / state.viewport.zoom;

                // Default size
                const width = asset.width || 300;
                const height = asset.height || 200;
                const aspectRatio = width / height;

                console.log('Adding element to canvas:', {
                    type: asset.type,
                    url: asset.url,
                    name: asset.name,
                    x: canvasX - width / 2,
                    y: canvasY - height / 2,
                    width: Math.min(width, 400),
                    height: Math.min(height, 400 / aspectRatio),
                });

                actions.addElement({
                    type: asset.type,
                    url: asset.url,
                    name: asset.name,
                    x: canvasX - width / 2, // Center on drop point
                    y: canvasY - height / 2,
                    width: Math.min(width, 400), // Cap initial size
                    height: Math.min(height, 400 / aspectRatio),
                    aspectRatio,
                });
            } catch (err) {
                console.error("Failed to parse dropped asset", err);
            }
        },
        [state.viewport, actions]
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    }, []);

    return (
        <div
            ref={containerRef}
            className={`relative flex-1 overflow-hidden bg-slate-900 ${isPanning || isSpaceHeld ? "cursor-grabbing" : "cursor-default"
                }`}
            style={{
                backgroundImage: `
          linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
        `,
                backgroundSize: `${GRID_SIZE * state.viewport.zoom}px ${GRID_SIZE * state.viewport.zoom}px`,
                backgroundPosition: `${state.viewport.x}px ${state.viewport.y}px`,
            }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            {/* Transformed canvas content */}
            <div
                className="absolute origin-top-left"
                style={{
                    transform: `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.zoom})`,
                    width: '10000px',
                    height: '10000px',
                    position: 'relative',
                }}
            >
                {state.elements.map((element) => (
                    <CanvasElementComponent
                        key={element.id}
                        element={element}
                        isSelected={state.selectedId === element.id}
                        zoom={state.viewport.zoom}
                        onSelect={() => actions.setSelected(element.id)}
                    />
                ))}
            </div>

            {/* Zoom indicator */}
            <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs text-slate-300 font-medium">
                {Math.round(state.viewport.zoom * 100)}%
            </div>

            {/* Empty state */}
            {state.elements.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center text-slate-500">
                        <div className="text-4xl mb-2">🖼️</div>
                        <p className="text-sm font-medium">Drag assets from the sidebar</p>
                        <p className="text-xs mt-1">Scroll to zoom • Space+drag to pan</p>
                    </div>
                </div>
            )}

            {/* Help tooltip */}
            <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-slate-400">
                <div>🖱️ Scroll: Zoom</div>
                <div>⎵ Space+Drag: Pan</div>
                <div>⌫ Delete: Remove selected</div>
            </div>
        </div>
    );
}
