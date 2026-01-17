import {
    LENS_TYPES,
    APERTURE_STOPS,
    MOTION_BLUR_OPTIONS,
    CAMERA_BODIES,
    FILM_STOCKS,
    type LensType,
    type ApertureStop,
    type MotionBlur,
    type CameraBody,
    type FilmStock,
} from '../../lib/photography-presets';

interface StudioControlsProps {
    lens: LensType;
    setLens: (l: LensType) => void;
    aperture: ApertureStop;
    setAperture: (a: ApertureStop) => void;
    motionBlur: MotionBlur;
    setMotionBlur: (m: MotionBlur) => void;
    camera: CameraBody;
    setCamera: (c: CameraBody) => void;
    filmStock: FilmStock;
    setFilmStock: (f: FilmStock) => void;
}

export function StudioControls({
    lens,
    setLens,
    aperture,
    setAperture,
    motionBlur,
    setMotionBlur,
    camera,
    setCamera,
    filmStock,
    setFilmStock,
}: StudioControlsProps) {
    return (
        <div className="flex w-full h-full flex-col overflow-y-auto custom-scrollbar">

            {/* SECTION: LENS & APERTURE */}
            <section className="p-4 border-b border-white/5 space-y-4">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-amber-400">Lens & Aperture</h2>

                {/* Lens */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-medium text-slate-500">Focal Length</label>
                        <span className="text-[9px] text-slate-500">{lens.effect}</span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                        {LENS_TYPES.map((l) => (
                            <button
                                key={l.id}
                                type="button"
                                onClick={() => setLens(l)}
                                className={`px-2 py-1.5 rounded border text-center transition-all ${lens.id === l.id
                                    ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                                    }`}
                                title={l.description}
                            >
                                <div className="text-[10px] font-bold">{l.name}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Aperture */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-medium text-slate-500">Aperture</label>
                        <span className="text-[9px] text-slate-500">{aperture.dof} DOF</span>
                    </div>
                    <div className="flex gap-1">
                        {APERTURE_STOPS.map((a) => (
                            <button
                                key={a.id}
                                type="button"
                                onClick={() => setAperture(a)}
                                className={`flex-1 py-1.5 rounded border text-center transition-all ${aperture.id === a.id
                                    ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                                    }`}
                                title={a.description}
                            >
                                <div className="text-[10px] font-bold">f/{a.value}</div>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION: OPTIONAL LOOK */}
            <section className="p-4 space-y-4">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-purple-400">Look (Optional)</h2>

                {/* Motion Blur */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-slate-500">Motion Blur</label>
                    <div className="flex gap-1">
                        {MOTION_BLUR_OPTIONS.map((m) => (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => setMotionBlur(m)}
                                className={`flex-1 py-1.5 rounded border text-center transition-all ${motionBlur.id === m.id
                                    ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                                    }`}
                                title={m.description}
                            >
                                <div className="text-[10px] font-medium">{m.name}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Camera Body (with color indicator) */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-slate-500">Camera</label>
                    <div className="flex gap-1.5 flex-wrap">
                        {CAMERA_BODIES.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => setCamera(c)}
                                className={`px-2.5 py-1.5 rounded border text-center transition-all flex items-center gap-1.5 ${camera.id === c.id
                                    ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                                    }`}
                                title={c.description}
                            >
                                <span
                                    className="w-2.5 h-2.5 rounded-full border border-white/20"
                                    style={{ backgroundColor: c.color }}
                                />
                                <span className="text-[10px] font-medium">{c.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Film Stock (with color gradient indicator) */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-slate-500">Film Stock</label>
                    <div className="flex gap-1.5 flex-wrap">
                        {FILM_STOCKS.map((f) => (
                            <button
                                key={f.id}
                                type="button"
                                onClick={() => setFilmStock(f)}
                                className={`px-2.5 py-1.5 rounded border text-center transition-all flex items-center gap-1.5 ${filmStock.id === f.id
                                    ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                                    }`}
                                title={f.description}
                            >
                                <span
                                    className="w-2.5 h-2.5 rounded-full border border-white/20"
                                    style={{ background: `linear-gradient(135deg, ${f.colors.primary}, ${f.colors.secondary})` }}
                                />
                                <span className="text-[10px] font-medium">{f.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
