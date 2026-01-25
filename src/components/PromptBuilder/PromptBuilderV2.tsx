import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    defaultState,
    buildPromptText,
    buildPromptData,
    parsePromptText,
    cameraOptions,
    type PromptBuilderState,
    type ScenePreset,
} from '../../lib/prompt-builder/types';
import {
    presets,
    styles,
    lighting,
    mood,
    composition,
    flattenToOptions,
    getPresetOptions,
} from '../../lib/prompt-builder';
import cameraSystems from '../../lib/prompt-builder/camera-systems.json';

interface PromptBuilderV2Props {
    onClose: () => void;
    onApply: (prompt: string) => void;
    currentPrompt?: string;
    initialImages?: string[];
}

// Simple dropdown component
function Dropdown({
    value,
    options,
    placeholder,
    onChange,
    disabled = false,
}: {
    value: string;
    options: { value: string; label: string; disabled?: boolean }[];
    placeholder?: string;
    onChange: (v: string) => void;
    disabled?: boolean;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-2 text-xs text-white focus:border-purple-500 outline-none appearance-none cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
                paddingRight: '30px',
            }}
        >
            <option value="">{placeholder || '— select —'}</option>
            {options.map((opt, i) => (
                <option key={i} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                </option>
            ))}
        </select>
    );
}

// Combo input with dropdown
function ComboInput({
    value,
    placeholder,
    options,
    onChange,
}: {
    value: string;
    placeholder: string;
    options: Record<string, { value: string; label: string }[]>;
    onChange: (v: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        if (!open) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    return (
        <div className="relative" ref={containerRef}>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-2 pr-8 text-xs text-white placeholder:text-slate-600 focus:border-purple-500 outline-none"
            />
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="absolute right-0.5 top-0.5 bottom-0.5 w-7 bg-[#2a2a2a] border-l border-white/10 rounded-r text-slate-500 hover:text-slate-300 text-[10px]"
            >
                ▼
            </button>
            {open && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1e1e1e] border border-white/10 rounded max-h-48 overflow-y-auto z-50">
                    {Object.entries(options).map(([group, items]) => (
                        <div key={group}>
                            <div className="px-2.5 py-1 text-[10px] text-slate-500 uppercase bg-[#252525]">
                                {group}
                            </div>
                            {items.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(item.value);
                                        setOpen(false);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-[#2a2a2a] hover:text-white"
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Style selector with edit toggle
function StyleSelector({
    value,
    options,
    onChange,
}: {
    value: string;
    options: { value: string; label: string; disabled?: boolean }[];
    onChange: (v: string) => void;
}) {
    const [editMode, setEditMode] = useState(false);

    return (
        <div className="flex gap-1">
            {editMode ? (
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Enter custom value..."
                    className="flex-1 bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-2 text-xs text-white placeholder:text-slate-600 focus:border-purple-500 outline-none"
                    autoFocus
                />
            ) : (
                <Dropdown value={value} options={options} onChange={onChange} />
            )}
            <button
                type="button"
                onClick={() => setEditMode(!editMode)}
                className={`w-8 h-8 flex items-center justify-center rounded border transition-all ${editMode
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : 'bg-[#333] border-white/20 text-slate-400 hover:text-white hover:border-purple-500'
                    }`}
                title="Edit raw text"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                </svg>
            </button>
        </div>
    );
}

// Helper to detect if a prompt matches a preset
function detectPresetFromPrompt(promptText: string): string | null {
    if (!promptText) return null;
    for (const [key, preset] of Object.entries(presets)) {
        if (preset.prompt && promptText.startsWith(preset.prompt)) {
            return key;
        }
    }
    return null;
}

// Type for camera system data
type CameraSystemData = {
    name: string;
    bodies: { id: string; name: string; prompt: string }[];
    lenses: { id: string; name: string; prompt: string }[];
    filmLooks: string[];
};

export function PromptBuilderV2({
    onClose,
    onApply,
    currentPrompt = '',
    initialImages = [],
}: PromptBuilderV2Props) {
    // Parse the current prompt to extract field values, or start fresh
    const [state, setState] = useState<PromptBuilderState>(() => {
        if (currentPrompt) {
            const detectedPreset = detectPresetFromPrompt(currentPrompt);
            if (detectedPreset && presets[detectedPreset]) {
                const preset = presets[detectedPreset] as ScenePreset;
                return {
                    ...defaultState(),
                    preset: detectedPreset,
                    prompt: preset.prompt || '',
                    style: preset.style || '',
                    cameraAngle: preset.camera?.angle || '',
                    cameraShot: preset.camera?.shot || '',
                    lighting: preset.lighting || '',
                    colorMood: preset.colors?.mood || '',
                    composition: preset.composition || '',
                };
            }
            const parsed = parsePromptText(currentPrompt);
            if (Object.keys(parsed).length > 1) {
                return { ...defaultState(), ...parsed };
            }
        }
        return defaultState();
    });

    // Update a field in state
    const updateField = useCallback(<K extends keyof PromptBuilderState>(
        key: K,
        value: PromptBuilderState[K]
    ) => {
        setState((prev) => ({ ...prev, [key]: value }));
    }, []);

    // Get camera system options (cinema first)
    const systemOptions = useMemo(() => {
        const systems = cameraSystems.systems as Record<string, CameraSystemData>;
        // Order: IMAX, Panavision, ARRI, RED, Sony VENICE, Blackmagic, then photography cameras
        const cinemaOrder = ['imax', 'panavision', 'arri', 'red', 'sony_venice', 'blackmagic'];
        const photoOrder = ['sony', 'canon_dslr', 'nikon', 'fujifilm', 'leica'];
        const orderedKeys = [...cinemaOrder, ...photoOrder].filter(k => systems[k]);

        return orderedKeys.map(key => ({
            value: key,
            label: systems[key].name,
        }));
    }, []);

    // Get bodies for selected system
    const bodyOptions = useMemo(() => {
        if (!state.cameraSystem) return [];
        const systems = cameraSystems.systems as Record<string, CameraSystemData>;
        const system = systems[state.cameraSystem];
        if (!system) return [];
        return system.bodies.map(b => ({ value: b.prompt, label: b.name }));
    }, [state.cameraSystem]);

    // Get lenses for selected system
    const lensOptions = useMemo(() => {
        if (!state.cameraSystem) return [];
        const systems = cameraSystems.systems as Record<string, CameraSystemData>;
        const system = systems[state.cameraSystem];
        if (!system) return [];
        return system.lenses.map(l => ({ value: l.prompt, label: l.name }));
    }, [state.cameraSystem]);

    // Get film looks for selected system
    const filmLookOptions = useMemo(() => {
        if (!state.cameraSystem) {
            // Show all film looks
            return Object.values(cameraSystems.filmLooks).map((data) => ({
                value: (data as { prompt: string }).prompt,
                label: (data as { name: string }).name,
            }));
        }
        const systems = cameraSystems.systems as Record<string, CameraSystemData>;
        const system = systems[state.cameraSystem];
        if (!system) return [];
        const filmLooks = cameraSystems.filmLooks as Record<string, { name: string; prompt: string }>;
        return system.filmLooks
            .filter(key => filmLooks[key])
            .map(key => ({
                value: filmLooks[key].prompt,
                label: filmLooks[key].name,
            }));
    }, [state.cameraSystem]);

    // Focal length options
    const focalLengthOptions = cameraSystems.focalLengths.map(f => ({
        value: f.value,
        label: f.label,
    }));

    // Handle system change - reset dependent fields
    const handleSystemChange = useCallback((systemKey: string) => {
        setState(prev => ({
            ...prev,
            cameraSystem: systemKey,
            cameraBody: '',
            lensType: '',
            filmLook: '',
        }));
    }, []);

    // Load preset
    const loadPreset = useCallback((presetKey: string) => {
        if (presetKey === 'custom' || !presets[presetKey]) {
            updateField('preset', 'custom');
            return;
        }

        const preset = presets[presetKey] as ScenePreset;
        setState({
            ...defaultState(),
            preset: presetKey,
            prompt: preset.prompt || '',
            style: preset.style || '',
            cameraAngle: preset.camera?.angle || '',
            cameraShot: preset.camera?.shot || '',
            focalLength: preset.camera?.lens || '',
            cameraAperture: preset.camera?.aperture || '',
            lighting: preset.lighting || '',
            colorMood: preset.colors?.mood || '',
            composition: preset.composition || '',
        });
    }, []);

    // Handle apply
    const handleApply = useCallback(() => {
        const data = buildPromptData(state);
        const text = buildPromptText(data);
        onApply(text);
        onClose();
    }, [state, onApply, onClose]);

    // Build options for other fields
    const styleOptions = flattenToOptions(styles);
    const lightingOptions = flattenToOptions(lighting);
    const moodOptions = flattenToOptions(mood);
    const compositionOptions = flattenToOptions(composition);
    const presetOptions = getPresetOptions();

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
        >
            <div className="relative flex flex-col h-[90vh] w-full max-w-[900px] overflow-hidden rounded-xl border border-white/10 bg-[#2a2a2a] shadow-2xl">
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-white/20 rounded flex items-center justify-center text-xs">✨</div>
                        <span className="font-semibold text-sm">Prompt Builder</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-6 h-6 flex items-center justify-center rounded bg-white/20 hover:bg-white/30 transition"
                    >
                        <span className="text-sm">×</span>
                    </button>
                </div>

                {/* Body - Two columns */}
                <div className="flex-1 flex min-h-0 overflow-hidden">
                    {/* Left column - Controls */}
                    <div className="w-[45%] border-r border-white/5 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {/* Preset */}
                        <div className="pb-3 border-b border-white/10">
                            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Load Preset</label>
                            <Dropdown
                                value={state.preset}
                                options={presetOptions.map(o => ({ value: o.value, label: o.label }))}
                                onChange={loadPreset}
                            />
                        </div>

                        {/* Main Prompt */}
                        <div>
                            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Main Prompt</label>
                            <textarea
                                value={state.prompt}
                                onChange={(e) => updateField('prompt', e.target.value)}
                                placeholder="Describe your scene in detail..."
                                className="w-full h-24 bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-2 text-xs text-white placeholder:text-slate-600 focus:border-purple-500 outline-none resize-none"
                            />
                        </div>

                        {/* Style */}
                        <div>
                            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Style</label>
                            <StyleSelector
                                value={state.style}
                                options={styleOptions}
                                onChange={(v) => updateField('style', v)}
                            />
                        </div>

                        {/* Camera Settings */}
                        <div className="bg-[#252525] rounded-lg p-3 space-y-3">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-400">
                                <div className="w-2 h-2 bg-purple-500 rounded-sm" />
                                Camera Settings
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] text-slate-500 mb-1">Angle</label>
                                    <ComboInput
                                        value={state.cameraAngle}
                                        placeholder="eye level"
                                        options={cameraOptions.angle}
                                        onChange={(v) => updateField('cameraAngle', v)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-500 mb-1">Shot / Distance</label>
                                    <ComboInput
                                        value={state.cameraShot}
                                        placeholder="medium shot"
                                        options={cameraOptions.shot}
                                        onChange={(v) => updateField('cameraShot', v)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] text-slate-500 mb-1">Focal Length</label>
                                    <Dropdown
                                        value={state.focalLength}
                                        options={focalLengthOptions}
                                        placeholder="Select focal length"
                                        onChange={(v) => updateField('focalLength', v)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-500 mb-1">Aperture</label>
                                    <ComboInput
                                        value={state.cameraAperture}
                                        placeholder="f/2.8"
                                        options={cameraOptions.aperture}
                                        onChange={(v) => updateField('cameraAperture', v)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Camera System (cascading) */}
                        <div className="bg-[#252525] rounded-lg p-3 space-y-3">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
                                <div className="w-2 h-2 bg-amber-500 rounded-sm" />
                                Camera System
                            </div>

                            <div>
                                <label className="block text-[10px] text-slate-500 mb-1">Camera Brand</label>
                                <Dropdown
                                    value={state.cameraSystem}
                                    options={systemOptions}
                                    placeholder="Select camera system"
                                    onChange={handleSystemChange}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] text-slate-500 mb-1">Camera Body</label>
                                <Dropdown
                                    value={state.cameraBody}
                                    options={bodyOptions}
                                    placeholder={state.cameraSystem ? "Select body" : "Select system first"}
                                    onChange={(v) => updateField('cameraBody', v)}
                                    disabled={!state.cameraSystem}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] text-slate-500 mb-1">Lens Type</label>
                                <Dropdown
                                    value={state.lensType}
                                    options={lensOptions}
                                    placeholder={state.cameraSystem ? "Select lens" : "Select system first"}
                                    onChange={(v) => updateField('lensType', v)}
                                    disabled={!state.cameraSystem}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] text-slate-500 mb-1">Film Look</label>
                                <Dropdown
                                    value={state.filmLook}
                                    options={filmLookOptions}
                                    placeholder="Select film look"
                                    onChange={(v) => updateField('filmLook', v)}
                                />
                            </div>
                        </div>

                        {/* Lighting */}
                        <div className="bg-[#252525] rounded-lg p-3">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-400 mb-2">
                                <div className="w-2 h-2 bg-purple-500 rounded-sm" />
                                Lighting
                            </div>
                            <StyleSelector
                                value={state.lighting}
                                options={lightingOptions}
                                onChange={(v) => updateField('lighting', v)}
                            />
                        </div>

                        {/* Mood */}
                        <div className="bg-[#252525] rounded-lg p-3">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-400 mb-2">
                                <div className="w-2 h-2 bg-purple-500 rounded-sm" />
                                Mood
                            </div>
                            <StyleSelector
                                value={state.colorMood}
                                options={moodOptions}
                                onChange={(v) => updateField('colorMood', v)}
                            />
                        </div>

                        {/* Composition */}
                        <div className="bg-[#252525] rounded-lg p-3">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-400 mb-2">
                                <div className="w-2 h-2 bg-purple-500 rounded-sm" />
                                Composition
                            </div>
                            <StyleSelector
                                value={state.composition}
                                options={compositionOptions}
                                onChange={(v) => updateField('composition', v)}
                            />
                        </div>
                    </div>

                    {/* Right column - Preview */}
                    <div className="w-[55%] flex flex-col bg-black overflow-hidden">
                        {/* Reference Images */}
                        <div className="flex-shrink-0 p-4 bg-[#0a0a0a] border-b border-white/5">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    Reference Images
                                </h3>
                                <span className="text-[9px] text-slate-500">
                                    {initialImages.length > 0 ? `${initialImages.length} image${initialImages.length > 1 ? 's' : ''}` : 'None'}
                                </span>
                            </div>
                            {initialImages.length > 0 ? (
                                <div className="grid grid-cols-4 gap-2">
                                    {initialImages.slice(0, 4).map((img, idx) => (
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
                                <div className="flex items-center justify-center h-12 rounded-lg border border-dashed border-white/10 bg-white/5">
                                    <span className="text-[10px] text-slate-500">
                                        Add references in Controls
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Preview */}
                        <div className="flex-1 min-h-0 p-4 overflow-y-auto">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-green-400 mb-2">
                                Generated Prompt
                            </h3>
                            <pre className="text-[10px] font-mono text-green-300 bg-[#0d0d0d] border border-white/10 rounded-lg p-3 whitespace-pre-wrap break-words">
                                {buildPromptText(buildPromptData(state)) || '(Select options to build prompt)'}
                            </pre>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 flex justify-end gap-2 px-4 py-3 border-t border-white/10 bg-[#222]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold text-slate-400 bg-[#333] border border-white/10 rounded hover:bg-[#444] transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleApply}
                        className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded hover:opacity-90 transition"
                    >
                        Apply to Prompt
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
