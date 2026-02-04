import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    defaultState,
    buildPromptText,
    buildPromptData,
    buildCinematicPromptText,
    parsePromptText,
    cameraOptions,
    cinematicOptions,
    type PromptBuilderState,
} from '../../lib/prompt-builder/types';
import {
    styles,
    lighting,
    mood,
    composition,
    flattenToOptions,
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

// Type for camera system data
type CameraSystemData = {
    name: string;
    bodies: { id: string; name: string; prompt: string }[];
    lenses: { id: string; name: string; prompt: string }[];
    filmStocks: string[];
};

/**
 * Parse a cinematic format prompt back into state fields.
 */
function parseCinematicPromptText(text: string): Partial<PromptBuilderState> {
    if (!text) return {};

    const result: Partial<PromptBuilderState> = {
        mode: 'cinematic',
    };

    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    // Line 1: [STYLE] of a [SUBJECT], set in [ENVIRONMENT].
    if (lines[0]) {
        const line1Match = lines[0].match(/^(.+?) of (.+?), set in (.+?)\.?$/i);
        if (line1Match) {
            result.style = line1Match[1];
            result.subject = line1Match[2];
            result.environment = line1Match[3].replace(/\.$/, '');
        }
    }

    // Line 2: Captured with [CAMERA], [FOCAL LENGTH], [LENS TYPE], [FILM STOCK].
    if (lines[1]) {
        const line2Match = lines[1].match(/^Captured with (.+?)\.?$/i);
        if (line2Match) {
            const parts = line2Match[1].split(',').map(p => p.trim());
            if (parts[0]) result.camera = parts[0];
            if (parts[1]) result.focalLength = parts[1];
            if (parts[2]) result.lensType = parts[2];
            if (parts[3]) result.filmStock = parts[3];
        }
    }

    // Line 3: [LIGHTING SOURCE], [LIGHTING STYLE], [ATMOSPHERE] mood.
    if (lines[2]) {
        const parts = lines[2].replace(/\.$/, '').split(',').map(p => p.trim());
        if (parts[0]) result.lightingSource = parts[0];
        if (parts[1]) result.lightingStyle = parts[1];
        if (parts[2]) {
            const atmoMatch = parts[2].match(/(.+?) mood$/i);
            result.atmosphere = atmoMatch ? atmoMatch[1] : parts[2];
        }
    }

    // Line 4: [MOVIE AESTHETIC]. [FILTER].
    if (lines[3]) {
        const line4Parts = lines[3].split('.').map(p => p.trim()).filter(p => p);
        for (const part of line4Parts) {
            if (part.includes('inspired') || part.includes('aesthetic')) {
                result.movieAesthetic = part;
            } else if (part) {
                result.filter = part;
            }
        }
    }

    return result;
}

export function PromptBuilderV2({
    onClose,
    onApply,
    currentPrompt = '',
    initialImages = [],
}: PromptBuilderV2Props) {
    // Parse the current prompt to extract field values, or start fresh
    const [state, setState] = useState<PromptBuilderState>(() => {
        if (currentPrompt) {
            // Try to detect if it's a cinematic format prompt (has newlines with "Captured with")
            if (currentPrompt.includes('\n') && currentPrompt.includes('Captured with')) {
                const parsed = parseCinematicPromptText(currentPrompt);
                if (Object.keys(parsed).length > 1) {
                    return { ...defaultState(), ...parsed, mode: 'cinematic' };
                }
            }
            // Try default parsing
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

    // Get film stocks for selected system
    const filmLookOptions = useMemo(() => {
        if (!state.cameraSystem) {
            return Object.values(cameraSystems.filmStocks).map((data) => ({
                value: (data as { prompt: string }).prompt,
                label: (data as { name: string }).name,
            }));
        }
        const systems = cameraSystems.systems as Record<string, CameraSystemData>;
        const system = systems[state.cameraSystem];
        if (!system) return [];
        const filmStocks = cameraSystems.filmStocks as Record<string, { name: string; prompt: string }>;
        return system.filmStocks
            .filter((key: string) => filmStocks[key])
            .map((key: string) => ({
                value: filmStocks[key].prompt,
                label: filmStocks[key].name,
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

    // Handle apply
    const handleApply = useCallback(() => {
        let text: string;
        if (state.mode === 'cinematic') {
            text = buildCinematicPromptText(state);
        } else {
            const data = buildPromptData(state);
            text = buildPromptText(data);
        }
        onApply(text);
        onClose();
    }, [state, onApply, onClose]);

    // Build options for default mode fields
    const styleOptions = flattenToOptions(styles);
    const lightingOptions = flattenToOptions(lighting);
    const moodOptions = flattenToOptions(mood);
    const compositionOptions = flattenToOptions(composition);

    // Get current preview text
    const previewText = useMemo(() => {
        if (state.mode === 'cinematic') {
            return buildCinematicPromptText(state);
        }
        return buildPromptText(buildPromptData(state));
    }, [state]);

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

                {/* Mode Header */}
                <div className="flex-shrink-0 flex border-b border-white/10 bg-[#252525] px-4 py-2.5">
                    <div className="flex items-center text-xs font-medium text-white">
                        <span className="mr-1.5">📷</span> Prompt Builder
                    </div>
                </div>

                {/* Body - Two columns */}
                <div className="flex-1 flex min-h-0 overflow-hidden">
                    {/* Left column - Controls */}
                    <div className="w-[45%] border-r border-white/5 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {state.mode === 'cinematic' ? (
                            /* CINEMATIC MODE UI */
                            <>
                                {/* Line 1: Style, Subject, Environment */}
                                <div className="bg-[#252525] rounded-lg p-3 space-y-3">
                                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
                                        <div className="w-2 h-2 bg-amber-500 rounded-sm" />
                                        Line 1: Scene Description
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-500 mb-1">Style</label>
                                        <Dropdown
                                            value={state.style}
                                            options={cinematicOptions.style}
                                            placeholder="Select style..."
                                            onChange={(v) => updateField('style', v)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-500 mb-1">Subject</label>
                                        <input
                                            type="text"
                                            value={state.subject}
                                            onChange={(e) => updateField('subject', e.target.value)}
                                            placeholder="a detective walking"
                                            className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-2 text-xs text-white placeholder:text-slate-600 focus:border-amber-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-500 mb-1">Environment</label>
                                        <input
                                            type="text"
                                            value={state.environment}
                                            onChange={(e) => updateField('environment', e.target.value)}
                                            placeholder="rain-soaked Tokyo streets"
                                            className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-2 text-xs text-white placeholder:text-slate-600 focus:border-amber-500 outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Line 2: Camera, Focal Length, Lens Type, Film Stock */}
                                <div className="bg-[#252525] rounded-lg p-3 space-y-3">
                                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
                                        <div className="w-2 h-2 bg-amber-500 rounded-sm" />
                                        Line 2: Camera & Film
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[10px] text-slate-500 mb-1">Camera</label>
                                            <Dropdown
                                                value={state.camera}
                                                options={cinematicOptions.camera}
                                                placeholder="Select camera..."
                                                onChange={(v) => updateField('camera', v)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-slate-500 mb-1">Focal Length</label>
                                            <Dropdown
                                                value={state.focalLength}
                                                options={cinematicOptions.focalLength}
                                                placeholder="Select..."
                                                onChange={(v) => updateField('focalLength', v)}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[10px] text-slate-500 mb-1">Lens Type</label>
                                            <Dropdown
                                                value={state.lensType}
                                                options={cinematicOptions.lensType}
                                                placeholder="Select lens..."
                                                onChange={(v) => updateField('lensType', v)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-slate-500 mb-1">Film Stock</label>
                                            <Dropdown
                                                value={state.filmStock}
                                                options={cinematicOptions.filmStock}
                                                placeholder="Select film..."
                                                onChange={(v) => updateField('filmStock', v)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Line 3: Lighting Source, Lighting Style, Atmosphere */}
                                <div className="bg-[#252525] rounded-lg p-3 space-y-3">
                                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
                                        <div className="w-2 h-2 bg-amber-500 rounded-sm" />
                                        Line 3: Lighting & Mood
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[10px] text-slate-500 mb-1">Lighting Source</label>
                                            <Dropdown
                                                value={state.lightingSource}
                                                options={cinematicOptions.lightingSource}
                                                placeholder="Select source..."
                                                onChange={(v) => updateField('lightingSource', v)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-slate-500 mb-1">Lighting Style</label>
                                            <Dropdown
                                                value={state.lightingStyle}
                                                options={cinematicOptions.lightingStyle}
                                                placeholder="Select style..."
                                                onChange={(v) => updateField('lightingStyle', v)}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-500 mb-1">Inspired by Film</label>
                                        <Dropdown
                                            value={state.filmInspiration}
                                            options={cinematicOptions.filmInspiration}
                                            placeholder="Select film inspiration..."
                                            onChange={(v) => updateField('filmInspiration', v)}
                                        />
                                    </div>
                                </div>

                                {/* Line 4: Movie Aesthetic, Filter, Aspect Ratio */}
                                <div className="bg-[#252525] rounded-lg p-3 space-y-3">
                                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
                                        <div className="w-2 h-2 bg-amber-500 rounded-sm" />
                                        Line 4: Aesthetic & Format
                                    </div>

                                    <div>
                                        <label className="block text-[10px] text-slate-500 mb-1">Filter</label>
                                        <Dropdown
                                            value={state.filter}
                                            options={cinematicOptions.filter}
                                            placeholder="Select filter..."
                                            onChange={(v) => updateField('filter', v)}
                                        />
                                    </div>
                                    <p className="text-[9px] text-slate-500 italic">Aspect ratio is set in the main controls panel.</p>
                                </div>
                            </>
                        ) : (
                            /* DEFAULT MODE UI */
                            <>
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

                                {/* Film Inspiration */}
                                <div className="bg-[#252525] rounded-lg p-3">
                                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-400 mb-2">
                                        <div className="w-2 h-2 bg-purple-500 rounded-sm" />
                                        Inspired by the Look of
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
                            </>
                        )}
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
                            <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${state.mode === 'cinematic' ? 'text-amber-400' : 'text-green-400'}`}>
                                Generated Prompt
                            </h3>
                            <pre className={`text-[10px] font-mono bg-[#0d0d0d] border border-white/10 rounded-lg p-3 whitespace-pre-wrap break-words ${state.mode === 'cinematic' ? 'text-amber-300' : 'text-green-300'}`}>
                                {previewText || '(Select options to build prompt)'}
                            </pre>

                            {/* Template Preview for Cinematic */}
                            {state.mode === 'cinematic' && (
                                <div className="mt-4 p-3 bg-[#0d0d0d] border border-white/10 rounded-lg">
                                    <h4 className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Template Format</h4>
                                    <div className="text-[9px] font-mono text-slate-500 space-y-1">
                                        <div>1. [STYLE] of a [SUBJECT], set in [ENVIRONMENT].</div>
                                        <div>2. Captured with [CAMERA], [FOCAL LENGTH], [LENS], [FILM].</div>
                                        <div>3. [LIGHTING SOURCE], [LIGHTING STYLE], [ATMOSPHERE] mood.</div>
                                        <div>4. [MOVIE AESTHETIC]. [FILTER]. [ASPECT RATIO] format.</div>
                                    </div>
                                </div>
                            )}
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
                        className={`px-4 py-2 text-xs font-semibold text-white rounded hover:opacity-90 transition ${state.mode === 'cinematic'
                            ? 'bg-gradient-to-r from-amber-600 to-orange-600'
                            : 'bg-gradient-to-r from-purple-600 to-indigo-600'
                            }`}
                    >
                        Apply to Prompt
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
