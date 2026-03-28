import { useState } from "react";
import type { Element } from "../state/elementTypes";
import { useElements } from "../state/elements";
import {
  ELEMENT_CHARACTER_SHEET_MIME,
  type ElementCharacterSheetDragPayload,
} from "../lib/drag-constants";

const API_BASE = import.meta.env.VITE_FILE_API_BASE ?? "http://localhost:8787";
const API_TOKEN = import.meta.env.VITE_FILE_API_TOKEN;

function getElementFileUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const url = new URL(`${API_BASE}${path}`);
  if (API_TOKEN) {
    url.searchParams.set("token", API_TOKEN);
  }
  return url.toString();
}

interface ElementCardProps {
  element: Element;
  isSelected: boolean;
  isSelectionMode: boolean;
  onSelect: (element: Element) => void;
  onEdit?: (element: Element) => void;
  onDelete?: (element: Element) => void;
}

export default function ElementCard({
  element,
  isSelected,
  isSelectionMode,
  onSelect,
  onEdit,
  onDelete,
}: ElementCardProps) {
  const { deleteElement, deselectElement } = useElements();
  const [isDeleting, setIsDeleting] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete element "${element.name}"?`)) return;
    setIsDeleting(true);
    try {
      if (onDelete) {
        onDelete(element);
      } else {
        await deleteElement(element.id);
      }
    } catch (err) {
      console.error("Failed to delete element:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(element);
  };

  const handleCardClick = () => {
    if (isSelectionMode) {
      onSelect(element);
    }
  };

  const hasSheet = Boolean(element.characterSheetUrl);
  const frontalUrl = getElementFileUrl(element.frontalImageUrl);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    if (!element.characterSheetUrl || /^https?:\/\//.test(element.characterSheetUrl)) {
      event.preventDefault();
      return;
    }

    const payload: ElementCharacterSheetDragPayload = {
      elementId: element.id,
      elementName: element.name,
      characterSheetUrl: element.characterSheetUrl,
    };

    event.dataTransfer.setData(
      ELEMENT_CHARACTER_SHEET_MIME,
      JSON.stringify(payload)
    );
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      className={`group relative aspect-square overflow-hidden rounded-2xl border transition ${isSelected
        ? "border-sky-400 bg-sky-500/10 ring-1 ring-sky-400/50"
        : "border-white/10 bg-black/20 hover:border-white/30"
        } ${isSelectionMode ? "cursor-pointer" : ""}`}
      draggable={hasSheet}
      onDragStart={handleDragStart}
      onClick={handleCardClick}
    >
      {imageError ? (
        <div className="flex h-full w-full items-center justify-center bg-slate-800 text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
        </div>
      ) : (
        <img
          src={frontalUrl}
          alt={element.name}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setImageError(true)}
        />
      )}

      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2">
        <div className="flex items-center gap-1">
          {isSelected && (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M14 4v5l4 4v2h-5v5l-2-1-2 1v-5H4v-2l4-4V4z"/></svg>
            </div>
          )}
          {hasSheet && (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-slate-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><line x1="3" x2="21" y1="9" y2="9" /><line x1="9" x2="9" y1="21" y2="9" /></svg>
            </div>
          )}
        </div>

        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={handleEdit}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/55 text-slate-100 transition hover:border-white/30 hover:bg-black/70"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-rose-400/25 bg-black/55 text-rose-100 transition hover:bg-rose-500/25 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
          </button>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-2.5">
        <div className="mb-2">
          <p className="truncate text-sm font-semibold text-white">{element.name}</p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-300">
            <span className="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="17 2 22 2 22 7"/><line x1="9" x2="22" y1="15" y2="2"/></svg>
              {element.referenceImageUrls.length}
            </span>
          </div>
        </div>

        <div className="flex justify-end">
          {isSelected ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                deselectElement(element.id);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-red-500/35 bg-red-500/15 text-red-100 transition hover:bg-red-500/25"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M14 4v5l4 4v2h-5v5l-2-1-2 1v-5H4v-2l4-4V4z"/></svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(element);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-sky-500/35 bg-sky-500/15 text-sky-100 transition hover:bg-sky-500/25"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M14 4v5l4 4v2h-5v5l-2-1-2 1v-5H4v-2l4-4V4z"/></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
