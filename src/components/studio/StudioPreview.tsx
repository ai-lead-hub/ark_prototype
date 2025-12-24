import { LivePreview } from '../PromptStudio/LivePreview';
import { Spinner } from '../ui/Spinner';
import { getFramingFromScale } from '../../lib/photography-presets';
import type {
    HorizontalPosition,
    VerticalPosition,
    LensType,
    ApertureStop,
    IsoValue,
    CameraBody,
    FilmStock,
} from '../../lib/photography-presets';

interface StudioPreviewProps {
    prompt: string;
    setPrompt: (p: string) => void;
    horizontalPos?: HorizontalPosition;
    verticalPos?: VerticalPosition;
    framingScale: number;
    lens?: LensType;
    aperture?: ApertureStop;
    iso?: IsoValue;
    camera?: CameraBody;
    filmStock?: FilmStock;
    dutchTilt?: number;
    onApply: () => void;
    onMagicDraft: () => void;
    isGenerating: boolean;
    error: string | null;
}

export function StudioPreview({
    prompt,
    setPrompt,
    horizontalPos,
    verticalPos,
    framingScale,
    lens,
    aperture,
    iso,
    camera,
    filmStock,
    dutchTilt,
    onApply,
    onMagicDraft,
    isGenerating,
    error,
}: StudioPreviewProps) {
    const currentFraming = getFramingFromScale(framingScale);

    return (
        <div className="flex h-full flex-col bg-black">
            {/* 3D Preview Area - Constrained to prevent pushing prompt box down */}
            <div className="flex-shrink-0 flex items-center justify-center bg-black overflow-hidden p-6 min-h-0">
                <div className="relative w-full max-w-[800px] aspect-video shadow-2xl overflow-hidden rounded-lg border border-white/5 bg-[#0a0a0a]">
                    <LivePreview
                        horizontalPos={horizontalPos}
                        verticalPos={verticalPos}
                        framingScale={framingScale}
                        lens={lens}
                        aperture={aperture}
                        iso={iso}
                        camera={camera}
                        filmStock={filmStock}
                        roll={dutchTilt}
                    />

                    {/* HUD Overlay */}
                    <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
                        {/* Top HUD */}
                        <div className="flex justify-between items-start">
                            <div className="text-[9px] font-mono bg-black/70 backdrop-blur px-2 py-1.5 rounded border border-white/10">
                                <div className="text-green-400 font-bold flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                    REC
                                </div>
                            </div>
                            <div className="text-right text-[9px] font-mono bg-black/70 backdrop-blur px-2 py-1.5 rounded border border-white/10">
                                <div className="text-sky-400 font-bold">{currentFraming.abbr}</div>
                                <div className="text-white/60">{horizontalPos?.name} • {verticalPos?.name}</div>
                            </div>
                        </div>

                        {/* Bottom HUD */}
                        <div className="flex justify-between items-end">
                            <div className="text-[9px] font-mono bg-black/70 backdrop-blur px-2 py-1.5 rounded border border-white/10">
                                <div className="text-amber-400 font-bold">
                                    {lens?.name} • f/{aperture?.value} • ISO {iso?.value}
                                </div>
                                {camera && <div className="text-white/50">{camera.name}</div>}
                            </div>
                            {filmStock && filmStock.id !== 'neutral' && (
                                <div className="flex items-center gap-1.5 text-[9px] font-mono bg-black/70 backdrop-blur px-2 py-1.5 rounded border border-white/10">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full"
                                        style={{ background: `linear-gradient(135deg, ${filmStock.colors.highlights}, ${filmStock.colors.midtones})` }}
                                    />
                                    <span className="text-purple-300">{filmStock.name}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Grid overlay */}
                    <div className="absolute inset-0 pointer-events-none opacity-10">
                        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#grid)" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Bottom Input - Expanded to fill remaining space */}
            <div className="flex-1 min-h-0 flex flex-col p-3 bg-[#0a0a0a] border-t border-white/5 space-y-2">

                <div className="relative flex-1">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe your subject and scene..."
                        className="w-full h-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 pr-8 text-sm text-white placeholder:text-slate-600 outline-none focus:border-sky-500 resize-none"
                    />
                    {prompt && (
                        <button
                            type="button"
                            onClick={() => setPrompt('')}
                            className="absolute right-2 top-2 text-white/30 hover:text-white transition-colors"
                            title="Clear prompt"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                            </svg>
                        </button>
                    )}
                </div>

                {error && (
                    <div className="text-[10px] text-red-400 bg-red-500/10 px-2 py-1 rounded">{error}</div>
                )}

                <div className="flex gap-2 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onMagicDraft}
                        disabled={isGenerating}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold disabled:opacity-50"
                    >
                        {isGenerating ? <Spinner size="sm" /> : <><span>✨</span> Draft</>}
                    </button>
                    <button
                        type="button"
                        onClick={onApply}
                        disabled={isGenerating || !prompt.trim()}
                        className="flex-[1.5] flex items-center justify-center gap-1 py-2 rounded-lg bg-white text-black text-xs font-bold disabled:opacity-50"
                    >
                        Inject →
                    </button>
                </div>
            </div>
        </div>
    );
}
