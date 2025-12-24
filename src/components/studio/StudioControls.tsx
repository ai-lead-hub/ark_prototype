import {
    HORIZONTAL_POSITIONS,
    VERTICAL_POSITIONS,
    LENS_TYPES,
    APERTURE_STOPS,
    SHUTTER_SPEEDS,
    ISO_VALUES,
    CAMERA_BODIES,
    FILM_STOCKS,
    getFramingFromScale,
    type HorizontalPosition,
    type VerticalPosition,
    type LensType,
    type ApertureStop,
    type ShutterSpeed,
    type IsoValue,
    type CameraBody,
    type FilmStock,
} from '../../lib/photography-presets';

interface StudioControlsProps {
    horizontalPos: HorizontalPosition | undefined;
    setHorizontalPos: (h: HorizontalPosition) => void;
    verticalPos: VerticalPosition | undefined;
    setVerticalPos: (v: VerticalPosition) => void;
    framingScale: number;
    setFramingScale: (s: number) => void;
    lens: LensType | undefined;
    setLens: (l: LensType) => void;
    aperture: ApertureStop | undefined;
    setAperture: (a: ApertureStop) => void;
    shutterSpeed: ShutterSpeed | undefined;
    setShutterSpeed: (s: ShutterSpeed) => void;
    iso: IsoValue | undefined;
    setIso: (i: IsoValue) => void;
    camera: CameraBody | undefined;
    setCamera: (c: CameraBody) => void;
    filmStock: FilmStock | undefined;
    setFilmStock: (f: FilmStock) => void;
    dutchTilt: number;
    setDutchTilt: (d: number) => void;
    useReferences: boolean;
    setUseReferences: (u: boolean) => void;
}

export function StudioControls({
    horizontalPos,
    setHorizontalPos,
    verticalPos,
    setVerticalPos,
    framingScale,
    setFramingScale,
    lens,
    setLens,
    aperture,
    setAperture,
    shutterSpeed,
    setShutterSpeed,
    iso,
    setIso,
    camera,
    setCamera,
    filmStock,
    setFilmStock,
    dutchTilt,
    setDutchTilt,
    useReferences,
    setUseReferences,
}: StudioControlsProps) {

    const currentFraming = getFramingFromScale(framingScale);

    return (
        <div className="flex w-full h-full flex-col overflow-y-auto custom-scrollbar">

            {/* SECTION: CONTEXT */}
            <section className="p-4 border-b border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Context</label>
                    <button
                        type="button"
                        onClick={() => setUseReferences(!useReferences)}
                        className={`
                            relative inline-flex h-4 w-8 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                            ${useReferences ? 'bg-sky-500' : 'bg-slate-700'}
                        `}
                        title="Include uploaded images in prompt generation"
                    >
                        <span className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${useReferences ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                </div>
                <div className="text-[9px] text-slate-500">
                    {useReferences ? 'Uploaded images will influence the prompt.' : 'Uploaded images will be ignored.'}
                </div>
            </section>

            {/* SECTION: POSITION */}
            <section className="p-4 border-b border-white/5 space-y-4">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-sky-400">Camera Position</h2>

                {/* Horizontal Rotation */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-slate-500 flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[8px]">↻</span>
                        Horizontal (Orbit)
                    </label>
                    <div className="flex gap-1">
                        {HORIZONTAL_POSITIONS.map((h) => (
                            <button
                                key={h.id}
                                type="button"
                                onClick={() => {
                                    setHorizontalPos(h);
                                    // Reset vertical to eye level
                                    const eyeLevel = VERTICAL_POSITIONS.find(v => v.id === 'eye');
                                    if (eyeLevel) setVerticalPos(eyeLevel);

                                    // Reset framing to default (MS)
                                    setFramingScale(55);

                                    // Reset Dutch Tilt
                                    setDutchTilt(0);
                                }}
                                className={`flex-1 py-2 rounded border text-center transition-all ${horizontalPos?.id === h.id
                                    ? 'border-sky-500 bg-sky-500/20 text-sky-300'
                                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                                    }`}
                                title={h.description}
                            >
                                <div className="text-sm">{h.icon}</div>
                                <div className="text-[9px] font-medium">{h.name}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Vertical Rotation */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-slate-500 flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[8px]">↕</span>
                        Vertical (Height)
                    </label>
                    <div className="flex gap-1">
                        {VERTICAL_POSITIONS.map((v) => (
                            <button
                                key={v.id}
                                type="button"
                                onClick={() => setVerticalPos(v)}
                                className={`flex-1 py-2 rounded border text-center transition-all ${verticalPos?.id === v.id
                                    ? 'border-sky-500 bg-sky-500/20 text-sky-300'
                                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                                    }`}
                                title={v.description}
                            >
                                <div className="text-sm">{v.icon}</div>
                                <div className="text-[9px] font-medium">{v.name.split(' ')[0]}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Dutch Tilt (Roll) */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-medium text-slate-500 flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[8px]">⟲</span>
                            Roll / Dutch Tilt
                        </label>
                        <span className="text-xs font-mono font-bold text-sky-400">{dutchTilt}°</span>
                    </div>
                    <input
                        type="range"
                        min={-45}
                        max={45}
                        step={1}
                        value={dutchTilt}
                        onChange={(e) => setDutchTilt(Number(e.target.value))}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                    <div className="flex justify-between text-[9px] text-slate-600">
                        <span>-45°</span>
                        <span className="text-slate-400">0°</span>
                        <span>+45°</span>
                    </div>
                </div>

                {/* Distance (Framing) */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-medium text-slate-500 flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[8px]">⟷</span>
                            Distance
                        </label>
                        <span className="text-xs font-mono font-bold text-sky-400">{currentFraming.abbr}</span>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={framingScale}
                        onChange={(e) => setFramingScale(Number(e.target.value))}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                    <div className="flex justify-between text-[9px] text-slate-600">
                        <span>Far (Wide)</span>
                        <span className="text-slate-400">{currentFraming.description}</span>
                        <span>Close (Tight)</span>
                    </div>
                </div>
            </section>

            {/* SECTION: CAMERA SETTINGS */}
            <section className="p-4 border-b border-white/5 space-y-4">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-amber-400">Camera Settings</h2>

                {/* Lens */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-medium text-slate-500">Lens</label>
                        <span className="text-[9px] text-slate-500">{lens?.effect}</span>
                    </div>
                    <div className="flex gap-1">
                        {LENS_TYPES.map((l) => (
                            <button
                                key={l.id}
                                type="button"
                                onClick={() => setLens(l)}
                                className={`flex-1 py-1.5 rounded border text-center transition-all ${lens?.id === l.id
                                    ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                                    }`}
                                title={l.description}
                            >
                                <div className="text-[10px] font-bold">{l.name}</div>
                                <div className="text-[8px] text-slate-500">{l.mm}mm</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Aperture */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-medium text-slate-500">Aperture</label>
                        <span className="text-[9px] text-slate-500">{aperture?.dof} DOF</span>
                    </div>
                    <div className="flex gap-1 overflow-x-auto pb-1">
                        {APERTURE_STOPS.map((a) => (
                            <button
                                key={a.id}
                                type="button"
                                onClick={() => setAperture(a)}
                                className={`flex-shrink-0 w-11 py-1.5 rounded border text-center transition-all ${aperture?.id === a.id
                                    ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                                    }`}
                            >
                                <div className="text-[10px] font-bold">f/{a.value}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Shutter Speed */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-medium text-slate-500">Shutter Speed</label>
                        <span className="text-[9px] text-slate-500">{shutterSpeed?.motion}</span>
                    </div>
                    <div className="flex gap-1 overflow-x-auto pb-1">
                        {SHUTTER_SPEEDS.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setShutterSpeed(s)}
                                className={`flex-shrink-0 px-2 py-1.5 rounded border text-center transition-all ${shutterSpeed?.id === s.id
                                    ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                                    }`}
                            >
                                <div className="text-[10px] font-bold">{s.fraction}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ISO */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-medium text-slate-500">ISO</label>
                        <span className="text-[9px] text-slate-500">{iso?.grain} grain</span>
                    </div>
                    <div className="flex gap-1 overflow-x-auto pb-1">
                        {ISO_VALUES.map((i) => (
                            <button
                                key={i.id}
                                type="button"
                                onClick={() => setIso(i)}
                                className={`flex-shrink-0 w-12 py-1.5 rounded border text-center transition-all ${iso?.id === i.id
                                    ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                                    }`}
                            >
                                <div className="text-[10px] font-bold">{i.value}</div>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION: LOOK */}
            <section className="p-4 space-y-4">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-purple-400">Look & Feel</h2>

                {/* Camera Body */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-slate-500">Camera</label>
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {CAMERA_BODIES.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => setCamera(c)}
                                className={`flex-shrink-0 px-2.5 py-1.5 rounded border text-[10px] font-medium whitespace-nowrap transition-all ${camera?.id === c.id
                                    ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                                    }`}
                                title={c.description}
                            >
                                {c.icon} {c.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Film Stock */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-slate-500">Film Stock</label>
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {FILM_STOCKS.map((f) => (
                            <button
                                key={f.id}
                                type="button"
                                onClick={() => setFilmStock(f)}
                                title={f.description} // Tooltip
                                className={`
                                    flex-shrink-0 px-2.5 py-1.5 rounded border text-[10px] font-medium flex items-center gap-1.5 whitespace-nowrap transition-all
                                    ${filmStock?.id === f.id
                                        ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                                        : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                                    }
                                `}
                            >
                                <span
                                    className="w-2.5 h-2.5 rounded-full border border-white/20"
                                    style={{ background: `linear-gradient(135deg, ${f.colors.highlights}, ${f.colors.midtones}, ${f.colors.shadows})` }}
                                />
                                {f.name}
                            </button>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
