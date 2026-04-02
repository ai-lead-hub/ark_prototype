import { useState, useMemo } from "react";
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
    mood,
    styles,
    flattenToOptions,
} from "../lib/prompt-builder";
import cameraSystems from "../lib/prompt-builder/camera-systems.json";

// ── Camera system types ────────────────────────────────────────────────

type CameraSystemData = {
    name: string;
    bodies: { id: string; name: string; prompt: string }[];
    lenses: { id: string; name: string; prompt: string }[];
    filmStocks: string[];
};

type FilmStockEntry = { name: string; prompt: string };

// Pre-build lighting & inspiration & style options
const LIGHTING_OPTIONS = flattenToOptions(lighting);
const INSPIRATION_OPTIONS = flattenToOptions(mood);
const STYLE_OPTIONS = flattenToOptions(styles);

// ── Compact dropdown ───────────────────────────────────────────────────

function Sel({
    label,
    value,
    options,
    placeholder,
    onChange,
    disabled,
}: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    placeholder?: string;
    onChange: (v: string) => void;
    disabled?: boolean;
}) {
    return (
        <div>
            <span className="text-[9px] font-medium uppercase tracking-wider text-slate-500">{label}</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className={`kv-input mt-0.5 w-full appearance-none rounded-xl px-2 py-1 text-[11px] text-white cursor-pointer ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 6px center",
                    paddingRight: "22px",
                }}
            >
                <option value="">{placeholder || "—"}</option>
                {options.map((o, i) => (
                    <option key={`${o.value}-${i}`} value={o.value}>{o.label}</option>
                ))}
            </select>
        </div>
    );
}

// Grouped variant (for camera angle/shot/lens/aperture which use Record<string, ...>)
function SelGrouped({
    label,
    value,
    groups,
    onChange,
}: {
    label: string;
    value: string;
    groups: Record<string, { value: string; label: string }[]>;
    onChange: (v: string) => void;
}) {
    return (
        <div>
            <span className="text-[9px] font-medium uppercase tracking-wider text-slate-500">{label}</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="kv-input mt-0.5 w-full appearance-none rounded-xl px-2 py-1 text-[11px] text-white cursor-pointer"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 6px center",
                    paddingRight: "22px",
                }}
            >
                <option value="">—</option>
                {Object.entries(groups).map(([g, items]) => (
                    <optgroup key={g} label={g}>
                        {items.map((o, i) => (
                            <option key={`${o.value}-${i}`} value={o.value}>{o.label}</option>
                        ))}
                    </optgroup>
                ))}
            </select>
        </div>
    );
}

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
    accent,
    children,
    onClose,
    onClear,
    hasValues,
}: {
    title: string;
    accent: string;
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
            <div className="kv-panel w-full max-w-sm overflow-hidden rounded-[24px]">
                <div className={`flex items-center justify-between px-3 py-2 bg-gradient-to-r ${accent}`}>
                    <span className="text-xs font-semibold text-white">{title}</span>
                    <button type="button" onClick={onClose} className="kv-icon-button flex h-6 w-6 items-center justify-center rounded-full text-xs">×</button>
                </div>
                <div className="p-3 space-y-2">{children}</div>
                <div className="kv-panel-soft flex justify-between px-3 py-2">
                    {hasValues ? (
                        <button type="button" onClick={onClear} className="kv-icon-button rounded-full px-2 py-1 text-[10px] text-slate-300 transition">Clear</button>
                    ) : <div />}
                    <button type="button" onClick={onClose} className="kv-cta rounded-full px-3 py-1 text-[10px] font-semibold transition hover:opacity-90">Done</button>
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

    // ── Cascading camera system options (same logic as PromptBuilderV2) ──

    const systemOptions = useMemo(() => {
        const systems = cameraSystems.systems as Record<string, CameraSystemData>;
        const order = ["imax", "panavision", "arri", "red", "sony_venice", "blackmagic", "sony", "canon_dslr", "nikon", "fujifilm", "leica"];
        return order.filter((k) => systems[k]).map((k) => ({ value: k, label: systems[k].name }));
    }, []);

    const bodyOptions = useMemo(() => {
        if (!lookSettings.cameraSystem) return [];
        const sys = (cameraSystems.systems as Record<string, CameraSystemData>)[lookSettings.cameraSystem];
        return sys ? sys.bodies.map((b) => ({ value: b.prompt, label: b.name })) : [];
    }, [lookSettings.cameraSystem]);

    const lensOptions = useMemo(() => {
        if (!lookSettings.cameraSystem) return [];
        const sys = (cameraSystems.systems as Record<string, CameraSystemData>)[lookSettings.cameraSystem];
        return sys ? sys.lenses.map((l) => ({ value: l.prompt, label: l.name })) : [];
    }, [lookSettings.cameraSystem]);

    const filmStockOptions = useMemo(() => {
        const stocks = cameraSystems.filmStocks as Record<string, FilmStockEntry>;
        if (!lookSettings.cameraSystem) {
            return Object.values(stocks).map((s) => ({ value: s.prompt, label: s.name }));
        }
        const sys = (cameraSystems.systems as Record<string, CameraSystemData>)[lookSettings.cameraSystem];
        if (!sys) return [];
        return sys.filmStocks.filter((k) => stocks[k]).map((k) => ({ value: stocks[k].prompt, label: stocks[k].name }));
    }, [lookSettings.cameraSystem]);

    const handleSystemChange = (system: string) => {
        onLookChange({ ...lookSettings, cameraSystem: system, cameraBody: "", lens: "", filmStock: "" });
    };

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
                <Modal title="Cinematographer" accent="from-amber-600 to-orange-600" onClose={() => setOpenModal(null)} onClear={() => { onShotChange(DEFAULT_SHOT); onLookChange(DEFAULT_LOOK); }} hasValues={!!hasSettings}>
                    {/* Shot Section */}
                    <div className="mb-3">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">Shot</div>
                        <div className="grid grid-cols-2 gap-2">
                            <SelGrouped label="Angle" value={shotSettings.angle} groups={cameraOptions.angle} onChange={(v) => onShotChange({ ...shotSettings, angle: v })} />
                            <SelGrouped label="Shot" value={shotSettings.shot} groups={cameraOptions.shot} onChange={(v) => onShotChange({ ...shotSettings, shot: v })} />
                            <SelGrouped label="Focal" value={shotSettings.focalLength} groups={cameraOptions.lens} onChange={(v) => onShotChange({ ...shotSettings, focalLength: v })} />
                            <SelGrouped label="Aperture" value={shotSettings.aperture} groups={cameraOptions.aperture} onChange={(v) => onShotChange({ ...shotSettings, aperture: v })} />
                        </div>
                    </div>

                    {/* Look Section */}
                    <div className="mb-3">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">Look</div>
                        <Sel label="Style" value={lookSettings.style} options={STYLE_OPTIONS} onChange={(v) => onLookChange({ ...lookSettings, style: v })} />
                        <div className="grid grid-cols-2 gap-2">
                            <Sel label="System" value={lookSettings.cameraSystem} options={systemOptions} placeholder="All" onChange={handleSystemChange} />
                            <Sel label="Body" value={lookSettings.cameraBody} options={bodyOptions} placeholder={lookSettings.cameraSystem ? "Select" : "Pick system"} onChange={(v) => onLookChange({ ...lookSettings, cameraBody: v })} disabled={!lookSettings.cameraSystem} />
                            <Sel label="Lens" value={lookSettings.lens} options={lensOptions} placeholder={lookSettings.cameraSystem ? "Select" : "Pick system"} onChange={(v) => onLookChange({ ...lookSettings, lens: v })} disabled={!lookSettings.cameraSystem} />
                            <Sel label="Film Stock" value={lookSettings.filmStock} options={filmStockOptions} onChange={(v) => onLookChange({ ...lookSettings, filmStock: v })} />
                        </div>
                        <Sel label="Lighting" value={lookSettings.lighting} options={LIGHTING_OPTIONS} onChange={(v) => onLookChange({ ...lookSettings, lighting: v })} />
                        <Sel label="Inspiration" value={lookSettings.inspiration} options={INSPIRATION_OPTIONS} onChange={(v) => onLookChange({ ...lookSettings, inspiration: v })} />
                    </div>
                </Modal>
            )}
        </>
    );
}
