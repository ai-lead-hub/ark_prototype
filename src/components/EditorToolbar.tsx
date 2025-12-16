import type { ToolType } from "./ImageEditor";

interface EditorToolbarProps {
    tool: ToolType;
    setTool: (tool: ToolType) => void;
    color: "white" | "red";
    setColor: (color: "white" | "red") => void;
    brushSize: number;
    setBrushSize: (size: number) => void;
    cropAspect: string;
    setCropAspect: (aspect: string) => void;
    cropArea: { x: number; y: number; w: number; h: number } | null;
    onApplyCrop: () => void;
    onUndo: () => void;
    onClear: () => void;
    onSave: () => void;
    onOpenPhotopea: () => void;
    onClose: () => void;
    saving: boolean;
    hasAnnotations: boolean;
}

const CROP_PRESETS = [
    { value: "free", label: "Free" },
    { value: "1:1", label: "1:1" },
    { value: "16:9", label: "16:9" },
    { value: "9:16", label: "9:16" },
    { value: "4:3", label: "4:3" },
    { value: "3:2", label: "3:2" },
];

export default function EditorToolbar({
    tool,
    setTool,
    color,
    setColor,
    brushSize,
    setBrushSize,
    cropAspect,
    setCropAspect,
    cropArea,
    onApplyCrop,
    onUndo,
    onClear,
    onSave,
    onOpenPhotopea,
    onClose,
    saving,
    hasAnnotations,
}: EditorToolbarProps) {
    const buttonClass = (active?: boolean) =>
        `flex h-9 w-9 items-center justify-center rounded-lg transition ${active
            ? "bg-sky-500 text-white"
            : "text-slate-300 hover:bg-white/10 hover:text-white"
        }`;

    return (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-xl bg-black/80 px-2 py-1.5 backdrop-blur-md border border-white/10 shadow-xl">
            {/* Select/Pan tool */}
            <button
                onClick={() => setTool("select")}
                className={buttonClass(tool === "select")}
                title="Pan (hold Shift while drawing)"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
                    <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
                    <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                </svg>
            </button>

            <div className="w-px h-6 bg-white/20 mx-1" />

            {/* Rectangle tool */}
            <button
                onClick={() => setTool("rect")}
                className={buttonClass(tool === "rect")}
                title="Rectangle"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
            </button>

            {/* Circle tool */}
            <button
                onClick={() => setTool("circle")}
                className={buttonClass(tool === "circle")}
                title="Circle"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="12" cy="12" r="10" />
                </svg>
            </button>

            {/* Text tool */}
            <button
                onClick={() => setTool("text")}
                className={buttonClass(tool === "text")}
                title="Text"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <polyline points="4 7 4 4 20 4 20 7" />
                    <line x1="9" y1="20" x2="15" y2="20" />
                    <line x1="12" y1="4" x2="12" y2="20" />
                </svg>
            </button>

            {/* Brush/Paintbrush tool */}
            <button
                onClick={() => setTool("brush")}
                className={buttonClass(tool === "brush")}
                title="Brush (freehand drawing)"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z" />
                    <path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7" />
                    <path d="M14.5 17.5 4.5 15" />
                </svg>
            </button>

            {/* Brush size slider (always visible but more prominent when brush selected) */}
            <div className="flex items-center gap-1.5 px-1">
                <div
                    className="w-2 h-2 rounded-full bg-current"
                    style={{
                        transform: `scale(${0.5 + (brushSize / 100) * 2.5})`,
                        color: color === "white" ? "#ffffff" : "#ef4444"
                    }}
                />
                <input
                    type="range"
                    min="2"
                    max="100"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                    title={`Brush size: ${brushSize}px`}
                />
                <span className="text-[10px] text-slate-400 w-6">{brushSize}</span>
            </div>

            <div className="w-px h-6 bg-white/20 mx-1" />

            {/* Color toggle */}
            <button
                onClick={() => setColor(color === "white" ? "red" : "white")}
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-white/10`}
                title={`Color: ${color} (click to toggle)`}
            >
                <div
                    className={`h-5 w-5 rounded-full border-2 border-white/50 ${color === "white" ? "bg-white" : "bg-red-500"
                        }`}
                />
            </button>

            <div className="w-px h-6 bg-white/20 mx-1" />

            {/* Crop tool */}
            <button
                onClick={() => setTool("crop")}
                className={buttonClass(tool === "crop")}
                title="Crop"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M6 2v14a2 2 0 0 0 2 2h14" />
                    <path d="M18 22V8a2 2 0 0 0-2-2H2" />
                </svg>
            </button>

            {/* Crop aspect ratio (only show when crop tool active) */}
            {tool === "crop" && (
                <>
                    <select
                        value={cropAspect}
                        onChange={(e) => setCropAspect(e.target.value)}
                        className="h-8 rounded-md bg-white/10 px-2 text-xs text-white border border-white/20 outline-none focus:border-sky-400"
                    >
                        {CROP_PRESETS.map((p) => (
                            <option key={p.value} value={p.value} className="bg-slate-800">
                                {p.label}
                            </option>
                        ))}
                    </select>

                    {cropArea && cropArea.w > 10 && cropArea.h > 10 && (
                        <button
                            onClick={onApplyCrop}
                            className="h-8 rounded-md bg-emerald-500 px-3 text-xs font-medium text-white transition hover:bg-emerald-600"
                        >
                            Apply
                        </button>
                    )}
                </>
            )}

            <div className="w-px h-6 bg-white/20 mx-1" />

            {/* Undo */}
            <button
                onClick={onUndo}
                className={`${buttonClass()} ${!hasAnnotations ? "opacity-40 cursor-not-allowed" : ""}`}
                disabled={!hasAnnotations}
                title="Undo (⌘Z)"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M3 7v6h6" />
                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                </svg>
            </button>

            {/* Clear all */}
            <button
                onClick={onClear}
                className={`${buttonClass()} ${!hasAnnotations ? "opacity-40 cursor-not-allowed" : ""}`}
                disabled={!hasAnnotations}
                title="Clear all"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
            </button>

            <div className="w-px h-6 bg-white/20 mx-1" />

            {/* Photopea */}
            <button
                onClick={onOpenPhotopea}
                className={buttonClass()}
                title="Open in Photopea"
            >
                <span className="text-sm font-bold">P</span>
            </button>

            {/* Save */}
            <button
                onClick={onSave}
                disabled={saving}
                className={`flex h-9 items-center gap-1.5 rounded-lg bg-sky-500 px-3 text-sm font-medium text-white transition hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed`}
                title="Save annotated image"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                </svg>
                {saving ? "Saving..." : "Save"}
            </button>

            <div className="w-px h-6 bg-white/20 mx-1" />

            {/* Close */}
            <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-red-500/20 hover:text-red-400"
                title="Close (Esc)"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>
        </div>
    );
}
