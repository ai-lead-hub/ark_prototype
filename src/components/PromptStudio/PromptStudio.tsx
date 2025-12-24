import { useState } from 'react';
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
    const [prompt, setPrompt] = useState(currentPrompt);

    // Position state
    const [horizontalPos, setHorizontalPos] = useState<HorizontalPosition | undefined>(
        HORIZONTAL_POSITIONS.find(h => h.id === 'perspective')
    );
    const [verticalPos, setVerticalPos] = useState<VerticalPosition | undefined>(
        VERTICAL_POSITIONS.find(v => v.id === 'eye')
    );
    const [dutchTilt, setDutchTilt] = useState(0); // -45 to +45 degrees
    const [framingScale, setFramingScale] = useState(55);

    // Camera settings state
    const [lens, setLens] = useState<LensType | undefined>(
        LENS_TYPES.find(l => l.id === 'normal')
    );
    const [aperture, setAperture] = useState<ApertureStop | undefined>(
        APERTURE_STOPS.find(a => a.id === 'f2.8')
    );
    const [shutterSpeed, setShutterSpeed] = useState<ShutterSpeed | undefined>(
        SHUTTER_SPEEDS.find(s => s.id === '1/125')
    );
    const [iso, setIso] = useState<IsoValue | undefined>(
        ISO_VALUES.find(i => i.id === 'iso400')
    );

    // Look state
    const [camera, setCamera] = useState<CameraBody | undefined>(
        CAMERA_BODIES.find(c => c.id === 'arri')
    );
    const [filmStock, setFilmStock] = useState<FilmStock | undefined>(
        FILM_STOCKS.find(f => f.id === 'neutral')
    );
    const [useReferences, setUseReferences] = useState(true);

    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentFraming = getFramingFromScale(framingScale);

    const handleMagicDraft = async () => {
        if (!prompt.trim()) {
            setError('Please describe the scene first.');
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            const presetParts = [];

            // Position
            if (horizontalPos) presetParts.push(horizontalPos.value);
            if (verticalPos) presetParts.push(verticalPos.value);
            presetParts.push(currentFraming.value);

            // Camera settings
            if (lens) presetParts.push(`${lens.mm}mm ${lens.name.toLowerCase()} lens`);
            if (aperture) presetParts.push(`f/${aperture.value} aperture, ${aperture.dof} depth of field`);
            if (shutterSpeed) presetParts.push(`${shutterSpeed.fraction} shutter speed`);

            // Look
            if (camera) presetParts.push(`shot on ${camera.name}`);
            if (filmStock && filmStock.id !== 'neutral') {
                presetParts.push(`${filmStock.name} film look`);
            }

            const expandedPrompt = await expandPromptWithPresets(
                prompt,
                presetParts.join('\n'),
                useReferences && initialImages ? initialImages : []
            );
            setPrompt(expandedPrompt);
        } catch (err) {
            console.error(err);
            setError('Failed to generate prompt. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="relative flex h-[90vh] w-full max-w-[1000px] overflow-hidden rounded-xl border border-white/10 bg-[#080808] shadow-2xl">

                {/* Close */}
                <button
                    onClick={onClose}
                    className="absolute right-3 top-3 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 hover:bg-white/10 transition border border-white/10"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>

                {/* Left: Controls */}
                <div className="w-[45%] h-full border-r border-white/5 bg-[#0a0a0a] overflow-y-auto">
                    <StudioControls
                        horizontalPos={horizontalPos}
                        setHorizontalPos={setHorizontalPos}
                        verticalPos={verticalPos}
                        setVerticalPos={setVerticalPos}
                        dutchTilt={dutchTilt}
                        setDutchTilt={setDutchTilt}
                        useReferences={useReferences}
                        setUseReferences={setUseReferences}
                        framingScale={framingScale}
                        setFramingScale={setFramingScale}
                        lens={lens}
                        setLens={setLens}
                        aperture={aperture}
                        setAperture={setAperture}
                        shutterSpeed={shutterSpeed}
                        setShutterSpeed={setShutterSpeed}
                        iso={iso}
                        setIso={setIso}
                        camera={camera}
                        setCamera={setCamera}
                        filmStock={filmStock}
                        setFilmStock={setFilmStock}
                    />
                </div>

                {/* Right: Preview */}
                <div className="w-[55%] h-full bg-black">
                    <StudioPreview
                        prompt={prompt}
                        setPrompt={setPrompt}
                        horizontalPos={horizontalPos}
                        verticalPos={verticalPos}
                        dutchTilt={dutchTilt}
                        framingScale={framingScale}
                        lens={lens}
                        aperture={aperture}
                        iso={iso}
                        camera={camera}
                        filmStock={filmStock}
                        onApply={() => {
                            onApply(prompt);
                            onClose();
                        }}
                        onMagicDraft={handleMagicDraft}
                        isGenerating={isGenerating}
                        error={error}
                    />
                </div>
            </div>
        </div>
    );
}
