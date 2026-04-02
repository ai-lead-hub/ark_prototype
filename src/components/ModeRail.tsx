"use client";

import type { Dispatch, SetStateAction } from "react";

export type GenerationTab = "image" | "video" | "special" | "audio" | "chat";

interface ModeRailProps {
  activeTab: GenerationTab;
  onTabChange: Dispatch<SetStateAction<GenerationTab>>;
  isGenerating?: boolean;
}

const generationTabs: Array<{
  id: GenerationTab;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
}> = [
  {
    id: "image",
    label: "Image",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
  },
  {
    id: "video",
    label: "Video",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ),
  },
  {
    id: "special",
    label: "Tools",
    disabled: true,
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    id: "audio",
    label: "Audio",
    disabled: true,
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    id: "chat",
    label: "Chat",
    disabled: true,
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

const utilityTabs: Array<{
  id: "history" | "settings";
  label: string;
  icon: React.ReactNode;
}> = [
  {
    id: "history",
    label: "History",
    icon: (
      <svg
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
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function ModeRail({
  activeTab,
  onTabChange,
  isGenerating = false,
}: ModeRailProps) {
  return (
    <aside className="flex w-12 shrink-0 flex-col items-center gap-1 rounded-2xl bg-black/20 py-3">
      {/* Logo */}
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl border border-orange-500/50 bg-gradient-to-br from-orange-600 to-amber-400 font-bold text-black shadow-[0_4px_16px_rgba(249,115,22,0.25)]">
        A
      </div>

      {/* Divider */}
      <div className="h-px w-6 bg-white/10" />

      {/* Mode buttons */}
      <div className="flex flex-col gap-1 pt-1">
        {generationTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            title={tab.label}
            disabled={tab.disabled || (isGenerating && !tab.disabled)}
            onClick={() => onTabChange(tab.id)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
              activeTab === tab.id
                ? "bg-gradient-to-br from-orange-600 to-amber-400 text-black shadow-[0_4px_16px_rgba(249,115,22,0.3)]"
                : tab.disabled
                  ? "text-slate-600 cursor-not-allowed"
                  : "text-slate-500 hover:bg-white/5 hover:text-slate-200"
            } ${!tab.disabled && isGenerating ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {tab.icon}
          </button>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Divider */}
      <div className="h-px w-6 bg-white/10" />

      {/* Utility buttons */}
      <div className="flex flex-col gap-1 pb-1">
        {utilityTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            title={tab.label}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-white/5 hover:text-slate-200"
          >
            {tab.icon}
          </button>
        ))}
      </div>
    </aside>
  );
}
