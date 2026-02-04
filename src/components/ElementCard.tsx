import { useState, useEffect, useRef } from "react";
import type { Element, ElementUseMode } from "../state/elementTypes";
import { useElements } from "../state/elements";

const API_BASE = import.meta.env.VITE_FILE_API_BASE ?? "http://localhost:8787";
const API_TOKEN = import.meta.env.VITE_FILE_API_TOKEN;

function getElementFileUrl(path: string): string {
    const url = new URL(`${API_BASE}${path}`);
    if (API_TOKEN) {
        url.searchParams.set("token", API_TOKEN);
    }
    return url.toString();
}

interface ElementCardProps {
    element: Element;
    isSelected: boolean;
    selectedMode?: ElementUseMode;
    isSelectionMode: boolean;
    onSelect: (element: Element, mode: ElementUseMode) => void;
}

export default function ElementCard({
    element,
    isSelected,
    selectedMode,
    isSelectionMode,
    onSelect,
}: ElementCardProps) {
    const { deleteElement, deselectElement } = useElements();
    const [isDeleting, setIsDeleting] = useState(false);
    const [showModeDropdown, setShowModeDropdown] = useState(false);
    const [imageError, setImageError] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        if (!showModeDropdown) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowModeDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showModeDropdown]);

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Delete element "${element.name}"?`)) return;
        setIsDeleting(true);
        try {
            await deleteElement(element.id);
        } catch (err) {
            console.error("Failed to delete element:", err);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCardClick = () => {
        if (isSelectionMode) {
            // Default to image mode
            onSelect(element, "image");
        }
    };

    const handleModeSelect = (mode: ElementUseMode) => {
        onSelect(element, mode);
        setShowModeDropdown(false);
    };

    const hasVideo = Boolean(element.videoReferenceUrl);
    const hasSheet = Boolean(element.characterSheetUrl);
    const frontalUrl = getElementFileUrl(element.frontalImageUrl);

    return (
        <div
            className={`group relative rounded-xl border overflow-hidden transition cursor-pointer ${isSelected
                ? "border-sky-400 bg-sky-500/10 ring-1 ring-sky-400/50"
                : "border-white/10 bg-black/20 hover:border-white/30"
                }`}
            onClick={handleCardClick}
        >
            {/* Image */}
            <div className="aspect-square relative">
                {imageError ? (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    </div>
                ) : (
                    <img
                        src={frontalUrl}
                        alt={element.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={() => setImageError(true)}
                    />
                )}

                {/* Badges */}
                <div className="absolute top-1 right-1 flex gap-1">
                    {hasVideo && (
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-black/60 text-[10px] text-emerald-400" title="Video reference">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z" /><rect width="14" height="12" x="2" y="6" rx="2" ry="2" /></svg>
                        </span>
                    )}
                    {hasSheet && (
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-black/60 text-[10px] text-amber-400" title="Character sheet">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><line x1="3" x2="21" y1="9" y2="9" /><line x1="9" x2="9" y1="21" y2="9" /></svg>
                        </span>
                    )}
                    {element.referenceImageUrls.length > 0 && (
                        <span className="flex h-5 items-center justify-center rounded bg-black/60 px-1.5 text-[10px] text-slate-300">
                            +{element.referenceImageUrls.length}
                        </span>
                    )}
                </div>

                {/* Delete button */}
                <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="absolute top-1 left-1 flex h-6 w-6 items-center justify-center rounded bg-black/60 text-slate-400 opacity-0 transition hover:bg-rose-500/20 hover:text-rose-400 group-hover:opacity-100 disabled:opacity-50"
                    title="Delete element"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                </button>

                {/* Selection indicator */}
                {isSelected && (
                    <div className="absolute inset-0 bg-sky-500/20 flex items-center justify-center">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${selectedMode === "video" ? "bg-emerald-500 text-white" : "bg-sky-500 text-white"}`}>
                            {selectedMode === "video" ? "Video" : "Image"}
                        </span>
                    </div>
                )}
            </div>

            {/* Name & Controls */}
            <div className="p-2">
                <p className="text-xs text-white truncate font-medium">{element.name}</p>

                {isSelectionMode && (
                    <div className="mt-1.5 flex gap-1">
                        {/* Deselect if selected */}
                        {isSelected ? (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deselectElement(element.id);
                                }}
                                className="flex-1 rounded border border-red-500/50 bg-red-500/10 py-0.5 text-[10px] text-red-300 hover:bg-red-500/20 transition"
                            >
                                Remove
                            </button>
                        ) : (
                            <>
                                {/* Image mode (default) */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleModeSelect("image");
                                    }}
                                    className="flex-1 rounded border border-sky-500/50 bg-sky-500/10 py-0.5 text-[10px] text-sky-300 hover:bg-sky-500/20 transition"
                                >
                                    Image
                                </button>

                                {/* Video mode (dropdown) */}
                                {hasVideo && (
                                    <div className="relative" ref={dropdownRef}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowModeDropdown(!showModeDropdown);
                                            }}
                                            className="rounded border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-500/20 transition"
                                        >
                                            ▾
                                        </button>

                                        {showModeDropdown && (
                                            <div className="absolute right-0 bottom-full mb-1 rounded border border-white/10 bg-slate-900 shadow-xl z-10 overflow-hidden">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleModeSelect("video");
                                                    }}
                                                    className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[10px] text-emerald-300 hover:bg-emerald-500/20 transition whitespace-nowrap"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z" /><rect width="14" height="12" x="2" y="6" rx="2" ry="2" /></svg>
                                                    Use Video
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
