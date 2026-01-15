import { Spinner } from '../ui/Spinner';
import type { LensType, ApertureStop } from '../../lib/photography-presets';

interface StudioPreviewProps {
    prompt: string;
    setPrompt: (p: string) => void;
    lens: LensType;
    aperture: ApertureStop;
    referenceImages: string[];
    onApply: () => void;
    onMagicDraft: () => void;
    isGenerating: boolean;
    error: string | null;
    // Undo/Redo
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
}

export function StudioPreview({
    prompt,
    setPrompt,
    lens,
    aperture,
    referenceImages,
    onApply,
    onMagicDraft,
    isGenerating,
    error,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
}: StudioPreviewProps) {
    return (
        <div className="flex h-full flex-col bg-black">

            {/* Reference Images Display */}
            <div className="flex-shrink-0 p-4 bg-[#0a0a0a] border-b border-white/5">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Reference Images
                    </h3>
                    <span className="text-[9px] text-slate-500">
                        {referenceImages.length > 0 ? `${referenceImages.length} image${referenceImages.length > 1 ? 's' : ''}` : 'None uploaded'}
                    </span>
                </div>

                {referenceImages.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                        {referenceImages.map((img, idx) => (
                            <div
                                key={idx}
                                className="aspect-square rounded-lg overflow-hidden border border-white/10 bg-black/50"
                            >
                                <img
                                    src={img}
                                    alt={`Reference ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-20 rounded-lg border border-dashed border-white/10 bg-white/5">
                        <span className="text-[10px] text-slate-500">
                            References uploaded in Controls will appear here
                        </span>
                    </div>
                )}
            </div>

            {/* Settings Summary HUD */}
            <div className="flex-shrink-0 p-3 bg-black/80 border-b border-white/5">
                <div className="flex flex-wrap gap-2 text-[9px] font-mono">
                    <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {lens.lensName}
                    </span>
                    <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        f/{aperture.value}
                    </span>
                    <span className="text-[9px] text-slate-500 flex items-center">
                        Framing & angle inferred from your description
                    </span>
                </div>
            </div>

            {/* Prompt Input - Expanded to fill remaining space */}
            <div className="flex-1 min-h-0 flex flex-col p-3 bg-[#0a0a0a] space-y-2">

                <div className="relative flex-1">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe your subject, scene, framing, and angle..."
                        className="w-full h-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 pr-8 pb-10 text-sm text-white placeholder:text-slate-600 outline-none focus:border-sky-500 resize-none"
                    />

                    {/* Bottom left: Undo/Redo */}
                    <div className="absolute bottom-2 left-2 flex gap-1">
                        <button
                            type="button"
                            onClick={onUndo}
                            disabled={!canUndo || isGenerating}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-500/30 bg-rose-500/20 text-rose-200 transition hover:bg-rose-500/30 hover:text-white disabled:opacity-30"
                            title="Undo"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
                        </button>
                        <button
                            type="button"
                            onClick={onRedo}
                            disabled={!canRedo || isGenerating}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-500/30 bg-rose-500/20 text-rose-200 transition hover:bg-rose-500/30 hover:text-white disabled:opacity-30"
                            title="Redo"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></svg>
                        </button>
                    </div>

                    {/* Bottom right: Clear button */}
                    {prompt && (
                        <button
                            type="button"
                            onClick={() => setPrompt('')}
                            className="absolute right-2 bottom-2 text-white/30 hover:text-white transition-colors h-7 w-7 flex items-center justify-center"
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
