import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
import { expandPromptWithPresets } from '../../lib/llm';
import { StudioControls } from '../studio/StudioControls';
import { StudioPreview } from '../studio/StudioPreview';

interface PromptStudioProps {
    onClose: () => void;
    onApply: (prompt: string) => void;
    currentPrompt?: string;
    initialImages?: string[];
}

export function PromptStudio({
    onClose,
    onApply,
    currentPrompt = '',
    initialImages = [],
}: PromptStudioProps) {
    // Prompt with history for undo/redo
    const [promptHistory, setPromptHistory] = useState<string[]>([currentPrompt]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const prompt = promptHistory[historyIndex];

    const setPrompt = useCallback((newPrompt: string) => {
        setPromptHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(newPrompt);
            return newHistory;
        });
        setHistoryIndex(prev => prev + 1);
    }, [historyIndex]);

    const undo = useCallback(() => {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
        }
    }, [historyIndex]);

    const redo = useCallback(() => {
        if (historyIndex < promptHistory.length - 1) {
            setHistoryIndex(prev => prev + 1);
        }
    }, [historyIndex, promptHistory.length]);

    // Core controls - with sensible defaults
    const [lens, setLens] = useState<LensType>(
        LENS_TYPES.find(l => l.id === '50mm') || LENS_TYPES[2]
    );
    const [aperture, setAperture] = useState<ApertureStop>(
        APERTURE_STOPS.find(a => a.id === 'f2.8') || APERTURE_STOPS[1]
    );

    // Optional controls - default to "None"
    const [motionBlur, setMotionBlur] = useState<MotionBlur>(MOTION_BLUR_OPTIONS[0]);
    const [camera, setCamera] = useState<CameraBody>(CAMERA_BODIES[0]);
    const [filmStock, setFilmStock] = useState<FilmStock>(FILM_STOCKS[0]);

    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleMagicDraft = async () => {
        if (!prompt.trim()) {
            setError('Please describe the scene first.');
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            // Build technical specs - describe EFFECTS, not brand names
            const specs: string[] = [];

            // Core specs - describe the visual effects
            specs.push(lens.promptEffect);
            specs.push(aperture.promptEffect);

            // Optional specs (only if not "None")
            if (motionBlur.value) specs.push(motionBlur.value);
            if (camera.value) specs.push(camera.value);
            if (filmStock.value) specs.push(filmStock.value);

            const expandedPrompt = await expandPromptWithPresets(
                prompt,
                specs.join('\n'),
                initialImages // Always pass reference images
            );
            setPrompt(expandedPrompt);
        } catch (err) {
            console.error('Prompt generation error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            setError(`Failed: ${errorMessage}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="relative flex h-[80vh] w-full max-w-[850px] overflow-hidden rounded-xl border border-white/10 bg-[#080808] shadow-2xl">

                {/* Close */}
                <button
                    onClick={onClose}
                    className="absolute right-3 top-3 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 hover:bg-white/10 transition border border-white/10"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>

                {/* Left: Controls */}
                <div className="w-[35%] h-full border-r border-white/5 bg-[#0a0a0a] overflow-y-auto">
                    <StudioControls
                        lens={lens}
                        setLens={setLens}
                        aperture={aperture}
                        setAperture={setAperture}
                        motionBlur={motionBlur}
                        setMotionBlur={setMotionBlur}
                        camera={camera}
                        setCamera={setCamera}
                        filmStock={filmStock}
                        setFilmStock={setFilmStock}
                    />
                </div>

                {/* Right: Preview with References */}
                <div className="w-[65%] h-full bg-black">
                    <StudioPreview
                        prompt={prompt}
                        setPrompt={setPrompt}
                        lens={lens}
                        aperture={aperture}
                        referenceImages={initialImages}
                        onApply={() => {
                            onApply(prompt);
                            onClose();
                        }}
                        onMagicDraft={handleMagicDraft}
                        isGenerating={isGenerating}
                        error={error}
                        canUndo={historyIndex > 0}
                        canRedo={historyIndex < promptHistory.length - 1}
                        onUndo={undo}
                        onRedo={redo}
                    />
                </div>
            </div>
        </div>,
        document.body
    );
}
