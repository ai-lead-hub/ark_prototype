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
      className={`group relative overflow-hidden rounded-2xl border transition ${isSelected
        ? "border-sky-400 bg-sky-500/10 ring-1 ring-sky-400/50"
        : "border-white/10 bg-black/20 hover:border-white/30"
        } ${isSelectionMode ? "cursor-pointer" : ""}`}
      draggable={hasSheet}
      onDragStart={handleDragStart}
      onClick={handleCardClick}
    >
      <div className="relative aspect-square">
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

        {isSelected && (
          <div className="absolute left-2 top-2 rounded-full bg-sky-500 px-2 py-1 text-[10px] font-semibold text-white">
            Pinned
          </div>
        )}
      </div>

      <div className="space-y-2 p-3">
        <div>
          <p className="truncate text-sm font-semibold text-white">{element.name}</p>
          <p className="mt-1 text-[11px] text-slate-400">
            {hasSheet ? "Sheet ready" : "No sheet"}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleEdit}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
          >
            Delete
          </button>
        </div>

        {isSelectionMode && (
          <div className="flex gap-2">
            {isSelected ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deselectElement(element.id);
                }}
                className="flex-1 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-500/20"
              >
                Remove
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(element);
                }}
                className="flex-1 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-200 transition hover:bg-sky-500/20"
              >
                Pin
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
