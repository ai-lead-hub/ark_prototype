import { useState, useCallback, useRef, useEffect } from "react";
import { useCatalog } from "../state/useCatalog";
import { getFileUrl } from "../lib/api/files";
import { FILE_ENTRY_MIME } from "../lib/drag-constants";

export default function ImageComparer() {
    const {
        state: { connection },
    } = useCatalog();
    const [leftImage, setLeftImage] = useState<{ url: string; name: string } | null>(null);
    const [rightImage, setRightImage] = useState<{ url: string; name: string } | null>(null);
    const [sliderPosition, setSliderPosition] = useState(50);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Zoom state — zoom toward cursor via transform-origin
    const [zoom, setZoom] = useState(1);
    const [origin, setOrigin] = useState({ x: 50, y: 50 }); // percentage

    const handleDrop = useCallback(
        (event: React.DragEvent, side: "left" | "right") => {
            event.preventDefault();
            setIsDragging(false);
            if (!connection) return;

            try {
                const data = event.dataTransfer.getData(FILE_ENTRY_MIME);
                if (!data) return;
                const payload = JSON.parse(data);
                if (payload.workspaceId !== connection.workspaceId) return;
                if (!payload.mime?.startsWith("image/")) {
                    alert("Please drop an image file.");
                    return;
                }

                const url = getFileUrl(connection, payload.path, { includeToken: true });
                const image = { url, name: payload.name };

                if (side === "left") setLeftImage(image);
                else setRightImage(image);
            } catch (e) {
                console.error("Failed to parse drop data", e);
            }
        },
        [connection]
    );

    const handleDragOver = (event: React.DragEvent) => {
        event.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleMouseMove = useCallback(
        (event: React.MouseEvent | React.TouchEvent) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const clientX = "touches" in event ? event.touches[0].clientX : event.clientX;
            const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
            const percentage = (x / rect.width) * 100;
            setSliderPosition(percentage);
        },
        []
    );

    // Simple drag handling for the slider
    const [isSliding, setIsSliding] = useState(false);

    useEffect(() => {
        const handleUp = () => setIsSliding(false);
        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (isSliding) {
                // @ts-expect-error - simple casting for shared event logic
                handleMouseMove(e);
            }
        };

        if (isSliding) {
            window.addEventListener("mouseup", handleUp);
            window.addEventListener("touchend", handleUp);
            window.addEventListener("mousemove", handleMove);
            window.addEventListener("touchmove", handleMove);
        }

        return () => {
            window.removeEventListener("mouseup", handleUp);
            window.removeEventListener("touchend", handleUp);
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("touchmove", handleMove);
        };
    }, [isSliding, handleMouseMove]);

    // Zoom toward cursor on scroll
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        // Set transform-origin to cursor position (percentage)
        const xPct = ((e.clientX - rect.left) / rect.width) * 100;
        const yPct = ((e.clientY - rect.top) / rect.height) * 100;
        setOrigin({ x: xPct, y: yPct });

        setZoom((prev) => {
            const delta = e.deltaY > 0 ? -0.15 : 0.15;
            return Math.min(10, Math.max(1, prev + delta * prev));
        });
    }, []);

    const zoomIn = () => setZoom((prev) => Math.min(10, prev * 1.3));
    const zoomOut = () => setZoom((prev) => Math.max(1, prev / 1.3));
    const resetZoom = () => {
        setZoom(1);
        setOrigin({ x: 50, y: 50 });
    };

    const imageStyle = {
        transform: `scale(${zoom})`,
        transformOrigin: `${origin.x}% ${origin.y}%`,
    };

    if (!leftImage || !rightImage) {
        return (
            <div className="flex h-full gap-4 p-4">
                <div
                    onDrop={(e) => handleDrop(e, "left")}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${leftImage
                        ? "border-sky-500/50 bg-sky-500/10"
                        : isDragging
                            ? "border-sky-400 bg-sky-400/10"
                            : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                        }`}
                >
                    {leftImage ? (
                        <img
                            src={leftImage.url}
                            alt="Left"
                            className="max-h-full max-w-full object-contain p-2"
                        />
                    ) : (
                        <div className="text-center text-slate-400">
                            <div className="text-2xl mb-2">👈</div>
                            <div className="text-sm font-semibold">Drop Left Image</div>
                        </div>
                    )}
                </div>
                <div
                    onDrop={(e) => handleDrop(e, "right")}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${rightImage
                        ? "border-sky-500/50 bg-sky-500/10"
                        : isDragging
                            ? "border-sky-400 bg-sky-400/10"
                            : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                        }`}
                >
                    {rightImage ? (
                        <img
                            src={rightImage.url}
                            alt="Right"
                            className="max-h-full max-w-full object-contain p-2"
                        />
                    ) : (
                        <div className="text-center text-slate-400">
                            <div className="text-2xl mb-2">👉</div>
                            <div className="text-sm font-semibold">Drop Right Image</div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Compute slider handle screen position that accounts for zoom from the origin point
    // When transform-origin is at origin.x%, scaling by `zoom` shifts the slider position:
    // screenPos = origin.x% + (sliderPosition - origin.x) * zoom  (in percentage of container width)
    const adjustedSliderPct = origin.x + (sliderPosition - origin.x) * zoom;

    return (
        <div className="flex h-full flex-col min-h-0">
            <div
                ref={containerRef}
                className="relative flex-1 overflow-hidden rounded-xl border border-white/10 bg-black/50 select-none touch-none"
                onMouseDown={(e) => { setIsSliding(true); handleMouseMove(e); }}
                onTouchStart={(e) => { setIsSliding(true); handleMouseMove(e); }}
                onWheel={handleWheel}
            >
                {/* Background Image (Right) */}
                <img
                    src={rightImage.url}
                    alt="Right"
                    className="absolute inset-0 h-full w-full object-contain pointer-events-none"
                    style={imageStyle}
                />

                {/* Foreground Image (Left) - Clipped */}
                <img
                    src={leftImage.url}
                    alt="Left"
                    className="absolute inset-0 h-full w-full object-contain pointer-events-none"
                    style={{
                        clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
                        ...imageStyle,
                    }}
                />

                {/* Slider Handle — position adjusted for zoom origin */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white cursor-ew-resize shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                    style={{ left: `${adjustedSliderPct}%` }}
                >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/50 shadow-sm">
                        <div className="flex gap-0.5">
                            <div className="w-0.5 h-3 bg-white/80"></div>
                            <div className="w-0.5 h-3 bg-white/80"></div>
                        </div>
                    </div>
                </div>

                {/* Zoom Controls */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1.5 backdrop-blur-sm border border-white/10">
                    <button
                        onClick={(e) => { e.stopPropagation(); zoomOut(); }}
                        disabled={zoom <= 1}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Zoom Out"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); resetZoom(); }}
                        className="flex h-7 min-w-[3rem] items-center justify-center rounded-md text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
                        title="Reset Zoom"
                    >
                        {Math.round(zoom * 100)}%
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); zoomIn(); }}
                        disabled={zoom >= 10}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Zoom In"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
                    </button>
                </div>

                {/* Image Labels */}
                <div className="absolute top-4 left-4 z-10 rounded-md bg-black/60 px-2 py-1 text-xs font-semibold text-white/80 backdrop-blur-sm">{leftImage.name}</div>
                <div className="absolute top-4 right-16 z-10 rounded-md bg-black/60 px-2 py-1 text-xs font-semibold text-white/80 backdrop-blur-sm">{rightImage.name}</div>

                {/* Zoom hint */}
                {zoom <= 1 && (
                    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-10 text-[10px] text-white/30 whitespace-nowrap">
                        Scroll to zoom toward cursor
                    </div>
                )}

                {/* Reset Button */}
                <button
                    onClick={() => { setLeftImage(null); setRightImage(null); resetZoom(); }}
                    className="absolute top-4 right-4 z-10 rounded-lg bg-black/60 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-red-500/80"
                >
                    Reset
                </button>
            </div>
        </div>
    );
}
