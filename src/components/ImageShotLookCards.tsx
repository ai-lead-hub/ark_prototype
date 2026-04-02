import { useState } from "react";
import { createPortal } from "react-dom";
import {
    cameraOptions,
    type ShotSettings,
    type LookSettings,
    DEFAULT_SHOT,
    DEFAULT_LOOK,
} from "../lib/prompt-builder/types";
import {
    lighting,
    styles,
} from "../lib/prompt-builder";
import cameraSystems from "../lib/prompt-builder/camera-systems.json";


// ── Summary helpers ────────────────────────────────────────────────────

function shotSummary(s: ShotSettings): string {
    const vals = [s.angle, s.shot, s.focalLength, s.aperture].filter(Boolean);
    if (vals.length === 0) return "Not set";
    const first = vals[0].split(" ")[0];
    return vals.length > 1 ? `${first} +${vals.length - 1}` : first;
}

function lookSummary(l: LookSettings): string {
    const vals = [l.style, l.cameraBody, l.lens, l.filmStock, l.lighting, l.inspiration].filter(Boolean);
    if (vals.length === 0) return "Not set";
    const first = vals[0].split(" ")[0];
    return vals.length > 1 ? `${first} +${vals.length - 1}` : first;
}

// ── Modal shell ────────────────────────────────────────────────────────

function Modal({
    title,
    children,
    onClose,
    onClear,
    hasValues,
}: {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
    onClear: () => void;
    hasValues: boolean;
}) {
    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-full max-w-4xl rounded-[24px] bg-[#1a1a1a] p-6 text-slate-100 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xl font-bold text-white">{title}</span>
                    <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition">×</button>
                </div>
                <div className="space-y-4 max-h-[600px] overflow-y-auto">{children}</div>
                <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                    {hasValues ? (
                        <button type="button" onClick={onClear} className="rounded-xl bg-white/10 px-6 py-2 text-sm font-medium text-slate-300 hover:bg-white/20 transition">Reset</button>
                    ) : <div />}
                    <button type="button" onClick={onClose} className="rounded-xl bg-emerald-500 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-600 transition">Apply</button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ── Main Component ─────────────────────────────────────────────────────

type Props = {
    shotSettings: ShotSettings;
    lookSettings: LookSettings;
    onShotChange: (s: ShotSettings) => void;
    onLookChange: (l: LookSettings) => void;
    isCinematographerOn: boolean;
    onCinematographerToggle: (on: boolean) => void;
};

export function ImageShotLookCards({ shotSettings, lookSettings, onShotChange, onLookChange, isCinematographerOn, onCinematographerToggle }: Props) {
    const [openModal, setOpenModal] = useState<"cinematographer" | null>(null);
    const [activeTab, setActiveTab] = useState<"camera" | "lighting" | "style" | "hexcodes">("camera");

    const hasSettings =
        shotSettings.angle ||
        shotSettings.focalLength ||
        shotSettings.aperture ||
        shotSettings.shot ||
        lookSettings.style ||
        lookSettings.cameraBody ||
        lookSettings.lens ||
        lookSettings.filmStock ||
        lookSettings.lighting ||
        lookSettings.inspiration;

    return (
        <>
            <div className="flex items-center gap-1.5 pt-1">
                <button
                    type="button"
                    onClick={() => setOpenModal("cinematographer")}
                    className={`flex flex-1 items-center gap-1.5 rounded-[18px] border px-2 py-1.5 text-left transition ${hasSettings ? "border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}
                >
                    <span className="text-amber-400 text-xs">🎬</span>
                    <div className="min-w-0 flex-1">
                        <div className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Cinematographer</div>
                        <div className={`truncate text-[10px] leading-tight ${hasSettings ? "text-slate-200" : "text-slate-500 italic"}`}>
                            {hasSettings ? `${shotSummary(shotSettings)}, ${lookSummary(lookSettings)}` : "Not set"}
                        </div>
                    </div>
                </button>
                <button
                    type="button"
                    onClick={() => onCinematographerToggle(!isCinematographerOn)}
                    className={`flex items-center justify-center rounded-[18px] border px-3 py-1.5 transition ${isCinematographerOn ? "border-amber-500/20 bg-amber-500/5 text-amber-400" : "border-white/10 bg-white/[0.03] text-slate-500"}`}
                >
                    <span className="text-[10px] font-semibold">{isCinematographerOn ? "ON" : "OFF"}</span>
                </button>
            </div>

            {/* Cinematographer Modal */}
            {openModal === "cinematographer" && (
                <Modal title="Cinematographer" onClose={() => setOpenModal(null)} onClear={() => { onShotChange(DEFAULT_SHOT); onLookChange(DEFAULT_LOOK); }} hasValues={!!hasSettings}>
                    {/* Tabs */}
                    <div className="flex gap-2 mb-3">
                        {["camera", "lighting", "style", "hexcodes"].map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTab(tab as "camera" | "lighting" | "style" | "hexcodes")}
                                className={`px-3 py-1 rounded-full text-[10px] font-semibold transition ${activeTab === tab ? "bg-amber-500/20 text-amber-200 border border-amber-500/30" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                            >
                                {tab.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    {activeTab === "camera" && (
                        <div className="grid grid-cols-4 gap-3">
                            {/* All Camera Bodies Column */}
                            <div className="space-y-1">
                                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">Camera Body</div>
                                <div className="h-[300px] overflow-y-auto pr-1">
                                    {Object.values(cameraSystems.systems).flatMap(sys => sys.bodies).map((body) => (
                                        <button
                                            key={body.prompt}
                                            type="button"
                                            onClick={() => onLookChange({ ...lookSettings, cameraBody: body.prompt })}
                                            className={`w-full text-left rounded-lg px-2 py-1.5 text-xs transition ${lookSettings.cameraBody === body.prompt ? "bg-amber-500/20 text-amber-200 border border-amber-500/30" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                                        >
                                            {body.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* All Camera Lenses Column */}
                            <div className="space-y-1">
                                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">Lens</div>
                                <div className="h-[300px] overflow-y-auto pr-1">
                                    {Object.values(cameraSystems.systems).flatMap(sys => sys.lenses).map((lens) => (
                                        <button
                                            key={lens.prompt}
                                            type="button"
                                            onClick={() => onLookChange({ ...lookSettings, lens: lens.prompt })}
                                            className={`w-full text-left rounded-lg px-2 py-1.5 text-xs transition ${lookSettings.lens === lens.prompt ? "bg-amber-500/20 text-amber-200 border border-amber-500/30" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                                        >
                                            {lens.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Focal Length Column */}
                            <div className="space-y-1">
                                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">Focal Length</div>
                                <div className="h-[300px] overflow-y-auto pr-1">
                                    {cameraSystems.focalLengths.map((focal) => (
                                        <button
                                            key={focal.value}
                                            type="button"
                                            onClick={() => onShotChange({ ...shotSettings, focalLength: focal.value })}
                                            className={`w-full text-left rounded-lg px-2 py-1.5 text-xs transition ${shotSettings.focalLength === focal.value ? "bg-amber-500/20 text-amber-200 border border-amber-500/30" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                                        >
                                            {focal.value}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Aperture Column */}
                            <div className="space-y-1">
                                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">Aperture</div>
                                <div className="h-[300px] overflow-y-auto pr-1">
                                    {Object.entries(cameraOptions.aperture).flatMap(([, items]) => items).map((aperture) => (
                                        <button
                                            key={aperture.value}
                                            type="button"
                                            onClick={() => onShotChange({ ...shotSettings, aperture: aperture.value })}
                                            className={`w-full text-left rounded-lg px-2 py-1.5 text-xs transition ${shotSettings.aperture === aperture.value ? "bg-amber-500/20 text-amber-200 border border-amber-500/30" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                                        >
                                            {aperture.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "lighting" && (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {Object.entries(lighting).map(([category, presets]) => (
                                <div key={category} className="space-y-1">
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">{category}</div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {presets.map((preset) => (
                                            <div
                                                key={preset.prompt}
                                                className={`rounded-lg overflow-hidden transition ${lookSettings.lighting === preset.prompt ? "border-2 border-amber-500/30" : "border border-white/10"}`}
                                            >
                                                <div className="aspect-video bg-slate-800 relative">
                                                    <img
                                                        src={`https://picsum.photos/seed/lighting-${preset.name}/200/150`}
                                                        alt={preset.name}
                                                        className="h-full w-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                                                    <div className="absolute bottom-2 left-2 text-xs text-white font-medium">
                                                        {preset.name}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => onLookChange({ ...lookSettings, lighting: preset.prompt })}
                                                    className={`w-full px-3 py-1.5 text-xs transition ${lookSettings.lighting === preset.prompt ? "bg-amber-500/20 text-amber-200" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                                                >
                                                    Select
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === "style" && (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {Object.entries(styles).map(([category, presets]) => (
                                <div key={category} className="space-y-1">
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">{category}</div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {presets.map((preset) => (
                                            <div
                                                key={preset.prompt}
                                                className={`rounded-lg overflow-hidden transition ${lookSettings.style === preset.prompt ? "border-2 border-amber-500/30" : "border border-white/10"}`}
                                            >
                                                <div className="aspect-video bg-slate-800 relative">
                                                    <img
                                                        src={`https://picsum.photos/seed/style-${preset.name}/200/150`}
                                                        alt={preset.name}
                                                        className="h-full w-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                                                    <div className="absolute bottom-2 left-2 text-xs text-white font-medium">
                                                        {preset.name}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => onLookChange({ ...lookSettings, style: preset.prompt })}
                                                    className={`w-full px-3 py-1.5 text-xs transition ${lookSettings.style === preset.prompt ? "bg-amber-500/20 text-amber-200" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                                                >
                                                    Select
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === "hexcodes" && (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                            <div>
                                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">Hex Codes</div>
                                <div
                                    className="border-2 border-dashed border-white/20 rounded-lg p-4 text-center cursor-pointer hover:border-sky-400 transition"
                                    onClick={() => console.log("Open file picker")}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = "copy";
                                    }}
                                    onDragLeave={(e) => {
                                        e.preventDefault();
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        console.log("Image dropped for color extraction");
                                        // TODO: Implement color extraction from dropped image
                                    }}
                                >
                                    <div className="text-slate-400 text-sm mb-2">Drop an image to extract colors</div>
                                    <div className="grid grid-cols-5 gap-2">
                                        {["#FF6B00", "#FFB84D", "#FFE66D", "#4ECDC4", "#556270"].map((hex) => (
                                            <div key={hex} className="flex flex-col items-center gap-1">
                                                <div className="w-8 h-8 rounded-full" style={{ backgroundColor: hex }}></div>
                                                <span className="text-[8px] text-slate-400">{hex}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Summary */}
                    <div className="mt-4 pt-2 border-t border-white/10">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Summary</div>
                        <div className="text-[10px] text-slate-300">
                            {shotSummary(shotSettings)}, {lookSummary(lookSettings)}
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
}
