import { useRef, useState } from "react";
import { useCanvas, type CanvasElement } from "../state/CanvasContext";

interface CanvasElementProps {
    element: CanvasElement;
    isSelected: boolean;
    zoom: number;
    onSelect: () => void;
}

function CanvasElementComponent({
    element,
    isSelected,
    zoom,
    onSelect,
}: CanvasElementProps) {
    const { actions } = useCanvas();
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0, elX: 0, elY: 0 });
    const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        onSelect();
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            elX: element.x,
            elY: element.y,
        };

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = (moveEvent.clientX - dragStartRef.current.x) / zoom;
            const dy = (moveEvent.clientY - dragStartRef.current.y) / zoom;
            actions.updateElement(element.id, {
                x: dragStartRef.current.elX + dx,
                y: dragStartRef.current.elY + dy,
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    };

    const handleResizeMouseDown = (
        e: React.MouseEvent,
        corner: "se" | "sw" | "ne" | "nw"
    ) => {
        e.stopPropagation();
        e.preventDefault();
        onSelect();
        resizeStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            width: element.width,
            height: element.height,
        };

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = (moveEvent.clientX - resizeStartRef.current.x) / zoom;
            const dy = (moveEvent.clientY - resizeStartRef.current.y) / zoom;

            let newWidth = resizeStartRef.current.width;
            let newHeight = resizeStartRef.current.height;
            let newX = element.x;
            let newY = element.y;

            // Determine resize direction
            if (corner === "se") {
                newWidth = Math.max(50, resizeStartRef.current.width + dx);
            } else if (corner === "sw") {
                const widthDelta = -dx;
                newWidth = Math.max(50, resizeStartRef.current.width + widthDelta);
                newX = element.x - (newWidth - resizeStartRef.current.width);
            } else if (corner === "ne") {
                newWidth = Math.max(50, resizeStartRef.current.width + dx);
                const heightDelta = -dy;
                newHeight = Math.max(50, resizeStartRef.current.height + heightDelta);
                newY = element.y - (newHeight - resizeStartRef.current.height);
            } else if (corner === "nw") {
                const widthDelta = -dx;
                const heightDelta = -dy;
                newWidth = Math.max(50, resizeStartRef.current.width + widthDelta);
                newHeight = Math.max(50, resizeStartRef.current.height + heightDelta);
                newX = element.x - (newWidth - resizeStartRef.current.width);
                newY = element.y - (newHeight - resizeStartRef.current.height);
            }

            // Maintain aspect ratio if Shift is held
            if (moveEvent.shiftKey && element.aspectRatio > 0) {
                newHeight = newWidth / element.aspectRatio;
            }

            actions.updateElement(element.id, {
                width: newWidth,
                height: newHeight,
                x: newX,
                y: newY,
            });
        };

        const handleMouseUp = () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    };

    const handleDoubleClick = () => {
        if (element.type === "video" && videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play();
            } else {
                videoRef.current.pause();
            }
        }
    };

    return (
        <div
            className={`absolute group ${isDragging ? "cursor-grabbing" : "cursor-grab"} ${isSelected ? "ring-2 ring-sky-400 ring-offset-2 ring-offset-transparent" : ""
                }`}
            style={{
                left: `${element.x}px`,
                top: `${element.y}px`,
                width: `${element.width}px`,
                height: `${element.height}px`,
                backgroundColor: 'rgba(0,0,0,0.3)',
                minWidth: '50px',
                minHeight: '50px',
            }}
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
        >
            {element.type === "image" ? (
                <img
                    src={element.url}
                    alt={element.name}
                    className="w-full h-full object-contain rounded-lg pointer-events-none select-none"
                    draggable={false}
                />
            ) : (
                <video
                    ref={videoRef}
                    src={element.url}
                    className="w-full h-full object-contain rounded-lg pointer-events-none"
                    loop
                    muted
                    playsInline
                />
            )}

            {/* Element name overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 truncate rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                {element.name}
                {element.type === "video" && (
                    <span className="ml-1 text-sky-300">▶ Double-click to play</span>
                )}
            </div>

            {/* Resize handles - only shown when selected */}
            {isSelected && !isDragging && (
                <>
                    <ResizeHandle corner="nw" onMouseDown={handleResizeMouseDown} />
                    <ResizeHandle corner="ne" onMouseDown={handleResizeMouseDown} />
                    <ResizeHandle corner="sw" onMouseDown={handleResizeMouseDown} />
                    <ResizeHandle corner="se" onMouseDown={handleResizeMouseDown} />
                </>
            )}
        </div>
    );
}

function ResizeHandle({
    corner,
    onMouseDown,
}: {
    corner: "se" | "sw" | "ne" | "nw";
    onMouseDown: (e: React.MouseEvent, corner: "se" | "sw" | "ne" | "nw") => void;
}) {
    const positionClasses = {
        nw: "-top-1.5 -left-1.5 cursor-nw-resize",
        ne: "-top-1.5 -right-1.5 cursor-ne-resize",
        sw: "-bottom-1.5 -left-1.5 cursor-sw-resize",
        se: "-bottom-1.5 -right-1.5 cursor-se-resize",
    };

    return (
        <div
            className={`absolute w-3 h-3 bg-sky-400 border-2 border-white rounded-sm ${positionClasses[corner]}`}
            onMouseDown={(e) => onMouseDown(e, corner)}
        />
    );
}

export default CanvasElementComponent;
