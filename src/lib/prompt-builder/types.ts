// TypeScript types for Prompt Builder

export interface StylePreset {
    name: string;
    prompt: string;
}

export interface CameraPreset {
    name: string;
    prompt: string;
}

export interface LightingPreset {
    name: string;
    prompt: string;
}

export interface MoodPreset {
    name: string;
    prompt: string;
}

export interface CompositionPreset {
    name: string;
    prompt: string;
}

export interface ScenePreset {
    name?: string;
    prompt: string;
    style: string;
    camera: {
        angle: string;
        shot: string;
        lens: string;
        aperture: string;
        iso: string;
        focus: string;
        model: string;
    };
    lighting: string;
    colors: {
        palette: string[];
        mood: string;
    };
    composition: string;
}

export type PromptBuilderMode = 'default' | 'cinematic';

export interface PromptBuilderState {
    mode: PromptBuilderMode;
    preset: string;
    prompt: string;
    style: string;
    cameraAngle: string;
    cameraShot: string;
    // New cascading camera fields
    cameraSystem: string;     // e.g., "arri", "canon_dslr"
    cameraBody: string;       // e.g., "alexa_mini_lf", "eos_r5"
    lensType: string;         // e.g., "cooke_s4", "canon_rf"
    focalLength: string;      // e.g., "35mm", "85mm"
    cameraAperture: string;   // e.g., "f/2.8"
    filmLook: string;         // e.g., "kodak_portra", "kodak_vision3_500t"
    lighting: string;
    colorMood: string;
    composition: string;
    // Cinematic mode fields
    subject: string;
    environment: string;
    camera: string;           // Camera body for cinematic (e.g., "ARRI ALEXA 65")
    filmStock: string;        // Film stock (e.g., "CineStill 800T")
    lightingSource: string;   // e.g., "Neon signs"
    lightingStyle: string;    // e.g., "low key"
    atmosphere: string;       // e.g., "mysterious" (legacy)
    movieAesthetic: string;   // e.g., "Blade Runner 2049 inspired" (legacy)
    filmInspiration: string;  // e.g., "inspired by the vast desolate orange-teal foggy look of Blade Runner 2049"
    filter: string;           // e.g., "Pro mist diffusion"
    aspectRatio: string;      // e.g., "2.39:1"
}

export interface PromptBuilderData {
    prompt: string;
    style: string;
    camera: {
        angle?: string;
        distance?: string;
        'lens-mm'?: number;
        lens?: string;
        'f-number'?: string;
        ISO?: number | string;
        focus?: string;
    };
    film_stock?: string;
    lighting: string;
    colors: {
        palette: string[];
        mood: string;
    };
    composition: string;
}

export type ShotSettings = {
    angle: string;
    focalLength: string;
    aperture: string;
    shot: string;
};

export type LookSettings = {
    cameraSystem: string;
    cameraBody: string;
    lens: string;
    filmStock: string;
    lighting: string;
    inspiration: string;
    style: string;
};

export const DEFAULT_SHOT: ShotSettings = {
    angle: "",
    focalLength: "",
    aperture: "",
    shot: "",
};

export const DEFAULT_LOOK: LookSettings = {
    cameraSystem: "",
    cameraBody: "",
    lens: "",
    filmStock: "",
    lighting: "",
    inspiration: "",
    style: "",
};

export function buildCardsSuffix(shot: ShotSettings, look: LookSettings): string {
    const camera: PromptBuilderData["camera"] = {};
    if (shot.angle) camera.angle = shot.angle;
    if (shot.shot) camera.distance = shot.shot;
    if (shot.focalLength) {
        const digits = shot.focalLength.replace(/[^0-9]/g, "");
        if (digits) camera["lens-mm"] = parseInt(digits, 10);
        else camera.lens = shot.focalLength;
    }
    if (shot.aperture) camera["f-number"] = shot.aperture;

    const filmParts: string[] = [];
    if (look.cameraBody) filmParts.push(wrapKeywordName(look.cameraBody));
    if (look.lens) filmParts.push(wrapKeywordName(look.lens));
    if (look.filmStock) filmParts.push(wrapKeywordName(look.filmStock));

    const data: PromptBuilderData = {
        prompt: "",
        style: "",
        camera,
        film_stock: filmParts.length ? filmParts.join(", ") : undefined,
        lighting: look.lighting,
        colors: { palette: [], mood: look.inspiration },
        composition: "",
    };

    const raw = buildPromptText(data);
    return raw.replace(/^\.\s*/, "").trim();
}

// Camera dropdown options
export const cameraOptions = {
    angle: {
        "Common Angles": [
            { value: "eye level", label: "eye level (natural)" },
            { value: "low angle", label: "low angle (powerful)" },
            { value: "high angle", label: "high angle (diminishing)" },
            { value: "bird's-eye", label: "bird's-eye (architectural)" },
            { value: "worm's-eye", label: "worm's-eye (dramatic)" },
        ],
        "Subtle Variations": [
            { value: "slightly low", label: "slightly low" },
            { value: "slightly high", label: "slightly high" },
        ],
        "Creative Angles": [
            { value: "Dutch angle", label: "Dutch angle (tilted)" },
            { value: "over-the-shoulder", label: "over-the-shoulder (intimate)" },
            { value: "overhead flat lay", label: "overhead flat lay" },
            { value: "ground level", label: "ground level" },
            { value: "dynamic angle", label: "dynamic angle" },
        ],
    },
    shot: {
        "Standard Shots": [
            { value: "extreme close-up", label: "extreme close-up" },
            { value: "close-up", label: "close-up" },
            { value: "medium close-up", label: "medium close-up" },
            { value: "medium shot", label: "medium shot" },
            { value: "medium full shot", label: "medium full shot" },
            { value: "full body", label: "full body" },
            { value: "wide shot", label: "wide shot" },
        ],
        "Specialized": [
            { value: "macro detail", label: "macro detail" },
            { value: "tight detail", label: "tight detail" },
            { value: "product close-up", label: "product close-up" },
            { value: "intimate close-up", label: "intimate close-up" },
        ],
        "Motion Shots": [
            { value: "tracking shot", label: "tracking shot" },
            { value: "action shot", label: "action shot" },
            { value: "full body action", label: "full body action" },
        ],
    },
    lens: {
        "Wide (Dramatic)": [
            { value: "14mm", label: "14mm (ultra-wide)" },
            { value: "24mm", label: "24mm (wide)" },
            { value: "28mm", label: "28mm (wide)" },
        ],
        "Natural": [
            { value: "35mm", label: "35mm (natural)" },
            { value: "50mm", label: "50mm (standard)" },
        ],
        "Portrait / Telephoto": [
            { value: "70mm", label: "70mm" },
            { value: "85mm", label: "85mm (portrait)" },
            { value: "100mm", label: "100mm" },
            { value: "135mm", label: "135mm (telephoto)" },
            { value: "200mm", label: "200mm (telephoto)" },
        ],
        "Specialty": [
            { value: "100mm macro", label: "100mm macro" },
            { value: "fisheye", label: "fisheye" },
            { value: "tilt-shift", label: "tilt-shift" },
        ],
    },
    aperture: {
        "Shallow DOF (Blurred BG)": [
            { value: "f/1.2", label: "f/1.2 (very shallow)" },
            { value: "f/1.4", label: "f/1.4 (shallow)" },
            { value: "f/1.8", label: "f/1.8" },
            { value: "f/2.0", label: "f/2.0" },
            { value: "f/2.8", label: "f/2.8 (portrait)" },
        ],
        "Moderate DOF": [
            { value: "f/4", label: "f/4" },
            { value: "f/5.6", label: "f/5.6 (balanced)" },
        ],
        "Deep DOF (Sharp BG)": [
            { value: "f/8", label: "f/8 (landscape)" },
            { value: "f/11", label: "f/11 (sharp)" },
            { value: "f/16", label: "f/16 (deep focus)" },
        ],
    },
    iso: {
        "Low (Clean)": [
            { value: "100", label: "100 (cleanest)" },
            { value: "200", label: "200" },
            { value: "400", label: "400" },
        ],
        "Medium": [
            { value: "800", label: "800" },
            { value: "1600", label: "1600" },
        ],
        "High (Grainy)": [
            { value: "3200", label: "3200 (noisy)" },
            { value: "6400", label: "6400 (grainy)" },
        ],
    },
};

export function defaultState(): PromptBuilderState {
    return {
        mode: "default",
        preset: "custom",
        prompt: "",
        style: "",
        cameraAngle: "",
        cameraShot: "",
        cameraSystem: "",
        cameraBody: "",
        lensType: "",
        focalLength: "",
        cameraAperture: "",
        filmLook: "",
        lighting: "",
        colorMood: "",
        composition: "",
        // Cinematic mode fields
        subject: "",
        environment: "",
        camera: "",
        filmStock: "",
        lightingSource: "",
        lightingStyle: "",
        atmosphere: "",
        movieAesthetic: "",
        filmInspiration: "",
        filter: "",
        aspectRatio: "",
    };
}

/**
 * Wrap the keyword/name portion of a camera prompt in $...$ delimiters.
 * Handles formats: "shot on NAME — desc", "with NAME — desc", "NAME — desc"
 */
export function wrapKeywordName(prompt: string): string {
    // Split on em-dash (—) to separate name from description
    const dashIdx = prompt.indexOf('—');
    if (dashIdx === -1) {
        // No description, wrap the whole thing
        return `$${prompt.trim()}$`;
    }

    const before = prompt.slice(0, dashIdx).trim();
    const after = prompt.slice(dashIdx); // includes "— description"

    // Extract the keyword name from prefixes like "shot on" or "with"
    const shotOnMatch = before.match(/^(shot on\s+)(.+)$/i);
    if (shotOnMatch) {
        return `${shotOnMatch[1]}$${shotOnMatch[2].trim()}$ ${after}`;
    }

    const withMatch = before.match(/^(with\s+)(.+)$/i);
    if (withMatch) {
        return `${withMatch[1]}$${withMatch[2].trim()}$ ${after}`;
    }

    // No prefix, wrap the name directly
    return `$${before}$ ${after}`;
}

export function buildPromptData(state: PromptBuilderState): PromptBuilderData {
    const camera: PromptBuilderData['camera'] = {};

    if (state.cameraAngle) camera.angle = state.cameraAngle;
    if (state.cameraShot) camera.distance = state.cameraShot;
    if (state.focalLength) {
        const digits = `${state.focalLength}`.replace(/[^0-9]/g, "");
        if (digits) camera['lens-mm'] = parseInt(digits, 10);
        else camera.lens = state.focalLength;
    }
    if (state.cameraAperture) camera['f-number'] = state.cameraAperture;

    const data: PromptBuilderData = {
        prompt: state.prompt,
        style: state.style,
        camera,
        lighting: state.lighting,
        colors: {
            palette: [],
            mood: state.colorMood,
        },
        composition: state.composition,
    };

    // Build film_stock from camera body + lens + film look
    // Wrap keyword names in $...$ for emphasis (e.g., "shot on $ARRI ALEXA 35$ — organic color science")
    const stockParts: string[] = [];
    if (state.cameraBody) stockParts.push(wrapKeywordName(state.cameraBody));
    if (state.lensType) stockParts.push(wrapKeywordName(state.lensType));
    if (state.filmLook) stockParts.push(wrapKeywordName(state.filmLook));
    if (stockParts.length) data.film_stock = stockParts.join(', ');

    return data;
}

export function buildPromptText(data: PromptBuilderData): string {
    const parts: string[] = [];

    // Style now prepends the prompt (e.g., "a cinematic still of [prompt]")
    if (data.style && data.prompt) {
        // Check if style already ends with "of" pattern
        const styleEndsWithOf = /\bof$/i.test(data.style.trim());
        parts.push(styleEndsWithOf ? `${data.style} ${data.prompt}` : `${data.style} of ${data.prompt}`);
    } else if (data.prompt) {
        parts.push(data.prompt);
    } else if (data.style) {
        parts.push(data.style);
    }

    const camera = data.camera || {};
    if (Object.keys(camera).length) {
        const desc: string[] = [];
        if (camera.angle) {
            const formattedAngle = formatCameraAngle(camera.angle);
            if (formattedAngle) desc.push(formattedAngle);
        }
        if (camera.distance) desc.push(camera.distance);
        if (camera['lens-mm'] !== undefined) desc.push(`$${camera['lens-mm']}mm$ lens`);
        if (camera.lens) desc.push(`$${camera.lens}$ lens`);
        if (camera['f-number']) desc.push(`$${camera['f-number']}$`);
        if (desc.length) parts.push(`Camera: ${desc.join(", ")}`);
    }

    if (data.film_stock) parts.push(`${data.film_stock}`);
    if (data.lighting) parts.push(`Lighting: ${data.lighting}`);

    const colors = data.colors || {};
    if (colors.mood) parts.push(colors.mood);  // Changed: mood already contains "inspired by..." format
    if (data.composition) parts.push(`Composition: ${data.composition}`);

    return parts.join(". ");
}

function normalizeCameraAngleValue(value: string): string {
    return value
        .trim()
        .replace(/\s+/g, " ")
        .replace(/\b(angle)(\s+\1\b)+/gi, "$1");
}

function formatCameraAngle(value: string): string {
    const normalized = normalizeCameraAngleValue(value);
    if (!normalized) return "";
    if (/\bangle\b/i.test(normalized)) {
        return normalized;
    }
    return `${normalized} angle`;
}

const CAMERA_ANGLE_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
    { pattern: /\b(eye[- ]?level)\s*(?:angle|shot|view)?/i, value: "eye level" },
    { pattern: /\b(low[- ]?angle)\b/i, value: "low angle" },
    { pattern: /\b(high[- ]?angle)\b/i, value: "high angle" },
    { pattern: /\b(bird'?s?[- ]?eye)\s*(?:view|angle)?/i, value: "bird's-eye" },
    { pattern: /\b(worm'?s?[- ]?eye)\s*(?:view|angle)?/i, value: "worm's-eye" },
    { pattern: /\b(dutch[- ]?angle)\b/i, value: "Dutch angle" },
    { pattern: /\b(dynamic[- ]?angle)\b/i, value: "dynamic angle" },
    { pattern: /\b(over[- ]?the[- ]?shoulder)\b/i, value: "over-the-shoulder" },
    { pattern: /\b(overhead|flat[- ]?lay)\b/i, value: "overhead flat lay" },
    { pattern: /\b(ground[- ]?level)\b/i, value: "ground level" },
    { pattern: /\b(slightly\s+low)\b/i, value: "slightly low" },
    { pattern: /\b(slightly\s+high)\b/i, value: "slightly high" },
];

function detectCameraAngle(text: string): string | undefined {
    for (const { pattern, value } of CAMERA_ANGLE_PATTERNS) {
        if (pattern.test(text)) {
            return value;
        }
    }
    return undefined;
}

// Import camera systems data for comprehensive parsing
import cameraSystems from './camera-systems.json';

// Types for camera systems data
type CameraSystemData = {
    name: string;
    bodies: { id: string; name: string; prompt: string }[];
    lenses: { id: string; name: string; prompt: string }[];
    filmStocks: string[];
};

type FilmStockData = {
    name: string;
    prompt: string;
};

/**
 * Build comprehensive camera body patterns from camera-systems.json
 * Returns patterns sorted by specificity (longer patterns first)
 */
function buildCameraBodyPatterns(): { pattern: RegExp; value: string; system: string }[] {
    const patterns: { pattern: RegExp; value: string; system: string; length: number }[] = [];
    const systems = cameraSystems.systems as Record<string, CameraSystemData>;

    for (const [systemKey, system] of Object.entries(systems)) {
        for (const body of system.bodies) {
            // Extract key identifiers from the prompt to build a flexible regex
            const prompt = body.prompt;

            // Create patterns from the prompt text - extract the camera name portion
            // e.g., "shot on ARRI ALEXA 35 — organic color..." -> match "ARRI ALEXA 35"
            const shotOnMatch = prompt.match(/shot on (.+?)(?:\s*[—\-–,]|$)/i);
            if (shotOnMatch) {
                const cameraName = shotOnMatch[1].trim();
                // Escape special regex characters and create flexible pattern
                const escapedName = cameraName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // Allow for variations like "shot on" prefix being optional
                patterns.push({
                    pattern: new RegExp(`(?:shot on\\s+)?${escapedName}`, 'i'),
                    value: prompt,
                    system: systemKey,
                    length: cameraName.length
                });
            }

            // Also add patterns for common variations
            // Handle specific camera names that might appear differently
            if (prompt.includes('ALEXA Mini LF')) {
                patterns.push({ pattern: /ALEXA\s*Mini\s*LF/i, value: prompt, system: systemKey, length: 13 });
            }
            if (prompt.includes('ALEXA 35')) {
                patterns.push({ pattern: /ALEXA\s*35/i, value: prompt, system: systemKey, length: 8 });
            }
            if (prompt.includes('ALEXA 65')) {
                patterns.push({ pattern: /ALEXA\s*65/i, value: prompt, system: systemKey, length: 8 });
            }
            if (prompt.includes('V-RAPTOR')) {
                patterns.push({ pattern: /V[- ]?RAPTOR(?:\s*XL)?/i, value: prompt, system: systemKey, length: 10 });
            }
            if (prompt.includes('Komodo')) {
                patterns.push({ pattern: /\bKomodo\b/i, value: prompt, system: systemKey, length: 6 });
            }
            if (prompt.includes('VENICE')) {
                patterns.push({ pattern: /VENICE\s*2?/i, value: prompt, system: systemKey, length: 8 });
            }
            if (prompt.includes('GFX')) {
                patterns.push({ pattern: /GFX\s*\d+/i, value: prompt, system: systemKey, length: 6 });
            }
        }
    }

    // Sort by length descending to match more specific patterns first
    patterns.sort((a, b) => b.length - a.length);

    // Remove duplicates (keep first occurrence which is the longest/most specific)
    const seen = new Set<string>();
    return patterns.filter(p => {
        const key = p.pattern.source;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Build comprehensive lens patterns from camera-systems.json
 */
function buildLensPatterns(): { pattern: RegExp; value: string; systems: string[] }[] {
    const patterns: { pattern: RegExp; value: string; systems: string[]; length: number }[] = [];
    const systems = cameraSystems.systems as Record<string, CameraSystemData>;
    const lensMap = new Map<string, { value: string; systems: string[] }>();

    for (const [systemKey, system] of Object.entries(systems)) {
        for (const lens of system.lenses) {
            const prompt = lens.prompt;

            // Extract lens name from prompt
            // e.g., "with Cooke S4/i — warm organic..." -> "Cooke S4/i"
            const withMatch = prompt.match(/with (.+?)(?:\s*[—\-–,]|$)/i);
            if (withMatch) {
                const lensName = withMatch[1].trim();
                const key = lensName.toLowerCase();

                if (lensMap.has(key)) {
                    lensMap.get(key)!.systems.push(systemKey);
                } else {
                    lensMap.set(key, { value: prompt, systems: [systemKey] });
                }

                // Create flexible pattern
                const escapedName = lensName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                patterns.push({
                    pattern: new RegExp(`(?:with\\s+)?${escapedName}`, 'i'),
                    value: prompt,
                    systems: [systemKey],
                    length: lensName.length
                });
            }
        }
    }

    // Sort by length descending
    patterns.sort((a, b) => b.length - a.length);

    // Remove duplicates
    const seen = new Set<string>();
    return patterns.filter(p => {
        const key = p.pattern.source;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Build comprehensive film stock patterns from camera-systems.json
 */
function buildFilmStockPatterns(): { pattern: RegExp; value: string }[] {
    const patterns: { pattern: RegExp; value: string; length: number }[] = [];
    const filmStocks = cameraSystems.filmStocks as Record<string, FilmStockData>;

    for (const [, stock] of Object.entries(filmStocks)) {
        const prompt = stock.prompt;
        const name = stock.name;

        // Create pattern from name - handle variations
        // e.g., "Kodak Portra 400" should match "Kodak Portra 400", "Portra 400", etc.
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        patterns.push({
            pattern: new RegExp(escapedName, 'i'),
            value: prompt,
            length: name.length
        });

        // Add variations without brand prefix
        if (name.includes('Kodak ')) {
            const withoutBrand = name.replace('Kodak ', '');
            patterns.push({
                pattern: new RegExp(withoutBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
                value: prompt,
                length: withoutBrand.length
            });
        }
        if (name.includes('Fujifilm ') || name.includes('Fujichrome ')) {
            const withoutBrand = name.replace(/Fujifilm |Fujichrome /, '');
            patterns.push({
                pattern: new RegExp(withoutBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
                value: prompt,
                length: withoutBrand.length
            });
        }
        if (name.includes('Ilford ')) {
            const withoutBrand = name.replace('Ilford ', '');
            patterns.push({
                pattern: new RegExp(withoutBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
                value: prompt,
                length: withoutBrand.length
            });
        }
    }

    // Add common variations and shorthand
    const extraPatterns = [
        { pattern: /Vision\s*3?\s*500\s*T/i, value: (cameraSystems.filmStocks as Record<string, FilmStockData>).kodak_vision3_500t?.prompt || '' },
        { pattern: /Vision\s*3?\s*250\s*D/i, value: (cameraSystems.filmStocks as Record<string, FilmStockData>).kodak_vision3_250d?.prompt || '' },
        { pattern: /Vision\s*3?\s*50\s*D/i, value: (cameraSystems.filmStocks as Record<string, FilmStockData>).kodak_vision3_50d?.prompt || '' },
        { pattern: /5219/i, value: (cameraSystems.filmStocks as Record<string, FilmStockData>).kodak_5219?.prompt || '' },
        { pattern: /CineStill\s*800\s*T/i, value: (cameraSystems.filmStocks as Record<string, FilmStockData>).cinestill_800t?.prompt || '' },
        { pattern: /CineStill\s*50\s*D/i, value: (cameraSystems.filmStocks as Record<string, FilmStockData>).cinestill_50d?.prompt || '' },
        { pattern: /Tri[- ]?X/i, value: (cameraSystems.filmStocks as Record<string, FilmStockData>).kodak_trix?.prompt || '' },
        { pattern: /T[- ]?Max/i, value: (cameraSystems.filmStocks as Record<string, FilmStockData>).kodak_tmax?.prompt || '' },
        { pattern: /HP5/i, value: (cameraSystems.filmStocks as Record<string, FilmStockData>).ilford_hp5?.prompt || '' },
        { pattern: /Delta\s*3200/i, value: (cameraSystems.filmStocks as Record<string, FilmStockData>).ilford_delta?.prompt || '' },
        { pattern: /Velvia/i, value: (cameraSystems.filmStocks as Record<string, FilmStockData>).fuji_velvia?.prompt || '' },
        { pattern: /Provia/i, value: (cameraSystems.filmStocks as Record<string, FilmStockData>).fuji_provia?.prompt || '' },
        { pattern: /Pro\s*400\s*H/i, value: (cameraSystems.filmStocks as Record<string, FilmStockData>).fuji_pro400h?.prompt || '' },
    ];

    for (const p of extraPatterns) {
        if (p.value) {
            patterns.push({ ...p, length: 10 });
        }
    }

    // Sort by length descending
    patterns.sort((a, b) => b.length - a.length);

    return patterns;
}

// Cache the built patterns
let _cameraBodyPatterns: ReturnType<typeof buildCameraBodyPatterns> | null = null;
let _lensPatterns: ReturnType<typeof buildLensPatterns> | null = null;
let _filmStockPatterns: ReturnType<typeof buildFilmStockPatterns> | null = null;

function getCameraBodyPatterns() {
    if (!_cameraBodyPatterns) {
        _cameraBodyPatterns = buildCameraBodyPatterns();
    }
    return _cameraBodyPatterns;
}

function getLensPatterns() {
    if (!_lensPatterns) {
        _lensPatterns = buildLensPatterns();
    }
    return _lensPatterns;
}

function getFilmStockPatterns() {
    if (!_filmStockPatterns) {
        _filmStockPatterns = buildFilmStockPatterns();
    }
    return _filmStockPatterns;
}

/**
 * Parse a formatted prompt string back into state fields.
 * Handles new format where style prepends prompt and mood uses "inspired by" directly.
 * Uses comprehensive pattern matching from camera-systems.json for accurate detection.
 */
export function parsePromptText(text: string): Partial<PromptBuilderState> {
    if (!text) return {};

    const result: Partial<PromptBuilderState> = {
        preset: 'custom',
    };

    let remaining = text;

    // Extract Composition (at end)
    const compositionMatch = remaining.match(/\. Composition: (.+?)$/);
    if (compositionMatch) {
        result.composition = compositionMatch[1];
        remaining = remaining.replace(/\. Composition: .+?$/, '');
    }

    // Extract "inspired by" mood pattern (new format - no "Mood:" label)
    const inspiredByMatch = remaining.match(/\. (inspired by [^.]+)/i);
    if (inspiredByMatch) {
        result.colorMood = inspiredByMatch[1];
        remaining = remaining.replace(/\. inspired by [^.]+/i, '');
    } else {
        // Fallback: Extract legacy Mood format
        const moodMatch = remaining.match(/\. Mood: (.+?)(?=\. |$)/);
        if (moodMatch) {
            result.colorMood = moodMatch[1];
            remaining = remaining.replace(/\. Mood: .+?(?=\. |$)/, '');
        }
    }

    // Extract Lighting
    const lightingMatch = remaining.match(/\. Lighting: (.+?)(?=\. |$)/);
    if (lightingMatch) {
        result.lighting = lightingMatch[1];
        remaining = remaining.replace(/\. Lighting: .+?(?=\. |$)/, '');
    }

    // Extract camera body using comprehensive patterns from camera-systems.json
    const cameraBodyPatterns = getCameraBodyPatterns();
    for (const { pattern, value, system } of cameraBodyPatterns) {
        if (pattern.test(text)) {  // Search in original text, not remaining
            result.cameraBody = value;
            result.cameraSystem = system;
            break;
        }
    }

    // Extract lens type using comprehensive patterns
    const lensPatterns = getLensPatterns();
    for (const { pattern, value } of lensPatterns) {
        if (pattern.test(text)) {
            result.lensType = value;
            break;
        }
    }

    // Extract film stock/look using comprehensive patterns
    const filmStockPatterns = getFilmStockPatterns();
    for (const { pattern, value } of filmStockPatterns) {
        if (pattern.test(text)) {
            result.filmLook = value;
            break;
        }
    }

    // Remove the film/camera section from remaining
    remaining = remaining.replace(/\. shot on [^.]+/g, '');
    remaining = remaining.replace(/\. with [^.]+lens[^.]*/gi, '');

    // Extract Camera settings
    const cameraMatch = remaining.match(/\. Camera: (.+?)(?=\. |$)/);
    if (cameraMatch) {
        const cameraStr = cameraMatch[1];

        // Parse angle
        const parsedAngle = detectCameraAngle(cameraStr);
        if (parsedAngle) {
            result.cameraAngle = parsedAngle;
        }

        // Parse shot/distance - order from most specific to least specific to avoid false matches
        const shotPatterns = [
            'extreme close-up',
            'medium close-up',
            'medium full shot',
            'medium shot',
            'full body',
            'wide shot',
            'macro detail',
            'close-up',  // Must come after more specific variants
        ];
        for (const pattern of shotPatterns) {
            // Use word boundary check to avoid partial matches
            const regex = new RegExp(`\\b${pattern.replace(/-/g, '[- ]?')}\\b`, 'i');
            if (regex.test(cameraStr)) {
                result.cameraShot = pattern;
                break;
            }
        }

        // Parse focal length
        const lensMatch = cameraStr.match(/(\d+)mm(?: lens)?/);
        if (lensMatch) {
            result.focalLength = `${lensMatch[1]}mm`;
        }

        // Parse aperture
        const apertureMatch = cameraStr.match(/(f\/[\d.]+)/);
        if (apertureMatch) {
            result.cameraAperture = apertureMatch[1];
        }

        remaining = remaining.replace(/\. Camera: .+?(?=\. |$)/, '');
    }

    // Also try to extract focal length from remaining text (not original text,
    // because original may contain mm values in camera body prompts like "65mm large format").
    if (!result.focalLength) {
        const focalMatch = remaining.match(/\b(\d{2,3})mm\b/);
        if (focalMatch) {
            result.focalLength = `${focalMatch[1]}mm`;
        }
    }

    // Also try to extract aperture from remaining text
    if (!result.cameraAperture) {
        const apertureMatch = remaining.match(/\b(f\/[\d.]+)\b/);
        if (apertureMatch) {
            result.cameraAperture = apertureMatch[1];
        }
    }

    // Extract Style (legacy format: "Style: X")
    const styleMatch = remaining.match(/\. Style: (.+?)(?=\. |$)/);
    if (styleMatch) {
        result.style = styleMatch[1];
        remaining = remaining.replace(/\. Style: .+?(?=\. |$)/, '');
    } else {
        // Try to detect style prepend patterns from styles.json format
        // These are patterns like "a cinematic still of", "an aerial photograph of", etc.
        const stylePatterns = [
            // Photography styles
            { pattern: /^a?\s*cinematic\s+(?:still|photograph|photography)\s+of\s*/i, style: 'a cinematic still of' },
            { pattern: /^an?\s*aerial\s+photograph\s+of\s*/i, style: 'an aerial photograph of' },
            { pattern: /^an?\s*architectural\s+photograph\s+of\s*/i, style: 'an architectural photograph of' },
            { pattern: /^a?\s*black\s+and\s+white\s+photograph\s+of\s*/i, style: 'a black and white photograph of' },
            { pattern: /^a?\s*documentary\s+photograph\s+of\s*/i, style: 'a documentary photograph of' },
            { pattern: /^an?\s*experimental\s+photograph\s+of\s*/i, style: 'an experimental photograph of' },
            { pattern: /^a?\s*(?:high\s+)?fashion\s+(?:editorial\s+)?photograph\s+of\s*/i, style: 'a high fashion photograph of' },
            { pattern: /^a?\s*fine\s+art\s+photograph\s+of\s*/i, style: 'a fine art photograph of' },
            { pattern: /^a?\s*food\s+photograph\s+of\s*/i, style: 'a food photograph of' },
            { pattern: /^a?\s*landscape\s+photograph\s+of\s*/i, style: 'a landscape photograph of' },
            { pattern: /^a?\s*long\s+exposure\s+photograph\s+of\s*/i, style: 'a long exposure photograph of' },
            { pattern: /^a?\s*low\s+key\s+photograph\s+of\s*/i, style: 'a low key photograph of' },
            { pattern: /^a?\s*macro\s+photograph\s+of\s*/i, style: 'a macro photograph of' },
            { pattern: /^a?\s*minimalist\s+photograph\s+of\s*/i, style: 'a minimalist photograph of' },
            { pattern: /^a?\s*night\s+photograph\s+of\s*/i, style: 'a night photograph of' },
            { pattern: /^a?\s*(?:cinematic\s+|closeup\s+|fantasy\s+)?portrait\s+(?:photograph\s+)?of\s*/i, style: 'a portrait photograph of' },
            { pattern: /^a?\s*product\s+photograph\s+of\s*/i, style: 'a product photograph of' },
            { pattern: /^a?\s*sports?\s+(?:action\s+)?photograph\s+of\s*/i, style: 'a sports action photograph of' },
            { pattern: /^a?\s*still\s+life\s+photograph\s+of\s*/i, style: 'a still life photograph of' },
            { pattern: /^a?\s*surreal\s+photograph\s+of\s*/i, style: 'a surreal photograph of' },
            { pattern: /^an?\s*underwater\s+photograph\s+of\s*/i, style: 'an underwater photograph of' },
            { pattern: /^a?\s*vintage\s+photograph\s+of\s*/i, style: 'a vintage photograph of' },
            { pattern: /^a?\s*wildlife\s+photograph\s+of\s*/i, style: 'a wildlife photograph of' },
            // Painting styles
            { pattern: /^an?\s*abstract\s+expressionist\s+painting\s+of\s*/i, style: 'an abstract expressionist painting of' },
            { pattern: /^an?\s*acrylic\s+painting\s+of\s*/i, style: 'an acrylic painting of' },
            { pattern: /^a?\s*Chinese\s+ink\s+brush\s+painting\s+of\s*/i, style: 'a Chinese ink brush painting of' },
            { pattern: /^a?\s*digital\s+painting\s+of\s*/i, style: 'a digital painting of' },
            { pattern: /^a?\s*fantasy\s+painting\s+of\s*/i, style: 'a fantasy painting of' },
            { pattern: /^a?\s*gouache\s+painting\s+of\s*/i, style: 'a gouache painting of' },
            { pattern: /^a?\s*graffiti\s+(?:mural|painting)\s+of\s*/i, style: 'a graffiti mural of' },
            { pattern: /^an?\s*impasto\s+painting\s+of\s*/i, style: 'an impasto painting of' },
            { pattern: /^an?\s*impressionist\s+painting\s+of\s*/i, style: 'an impressionist painting of' },
            { pattern: /^an?\s*oil\s+painting\s+of\s*/i, style: 'an oil painting of' },
            { pattern: /^a?\s*Renaissance\s+(?:oil\s+)?painting\s+of\s*/i, style: 'a Renaissance oil painting of' },
            { pattern: /^a?\s*Sumi-e\s+(?:ink\s+wash\s+)?painting\s+of\s*/i, style: 'a Sumi-e ink wash painting of' },
            { pattern: /^a?\s*watercolor\s+painting\s+of\s*/i, style: 'a watercolor painting of' },
            // Illustration styles
            { pattern: /^an?\s*(?:realistic\s+|chibi\s+|kawaii\s+)?anime\s+illustration\s+of\s*/i, style: 'an anime illustration of' },
            { pattern: /^an?\s*Art\s+Deco\s+illustration\s+of\s*/i, style: 'an Art Deco illustration of' },
            { pattern: /^a?\s*cartoon\s+illustration\s+of\s*/i, style: 'a cartoon illustration of' },
            { pattern: /^a?\s*children'?s?\s+book\s+illustration\s+of\s*/i, style: "a children's book illustration of" },
            { pattern: /^a?\s*fantasy\s+illustration\s+of\s*/i, style: 'a fantasy illustration of' },
            { pattern: /^a?\s*fashion\s+illustration\s+of\s*/i, style: 'a fashion illustration of' },
            { pattern: /^a?\s*game\s+art\s+illustration\s+of\s*/i, style: 'a game art illustration of' },
            { pattern: /^a?\s*pop\s+art\s+illustration\s+of\s*/i, style: 'a pop art illustration of' },
            { pattern: /^a?\s*retro\s+illustration\s+of\s*/i, style: 'a retro illustration of' },
            // Drawing styles
            { pattern: /^a?\s*charcoal\s+drawing\s+of\s*/i, style: 'a charcoal drawing of' },
            { pattern: /^a?\s*colored\s+pencil\s+drawing\s+of\s*/i, style: 'a colored pencil drawing of' },
            { pattern: /^a?\s*graphite\s+drawing\s+of\s*/i, style: 'a graphite drawing of' },
            { pattern: /^an?\s*ink\s+drawing\s+of\s*/i, style: 'an ink drawing of' },
            { pattern: /^a?\s*pastel\s+drawing\s+of\s*/i, style: 'a pastel drawing of' },
            { pattern: /^a?\s*pencil\s+drawing\s+of\s*/i, style: 'a pencil drawing of' },
            // 3D styles
            { pattern: /^an?\s*(?:abstract\s+)?(?:fluid\s+(?:dynamics\s+)?)?3D\s+render\s+of\s*/i, style: 'an abstract 3D render of' },
            { pattern: /^a?\s*3D\s+architectural\s+render\s+of\s*/i, style: 'a 3D architectural render of' },
            { pattern: /^a?\s*3D\s+character\s+render\s+of\s*/i, style: 'a 3D character render of' },
            // Generic photography patterns (fallback)
            { pattern: /^(Cinematic photography)[,.]?\s*/i, style: 'Cinematic photography' },
            { pattern: /^(Aerial photography)[,.]?\s*/i, style: 'Aerial photography' },
            { pattern: /^(Portrait photography)[,.]?\s*/i, style: 'Portrait photography' },
            { pattern: /^(Landscape photography)[,.]?\s*/i, style: 'Landscape photography' },
            { pattern: /^(Fashion photography)[,.]?\s*/i, style: 'Fashion photography' },
            { pattern: /^(Fine art photography)[,.]?\s*/i, style: 'Fine art photography' },
            { pattern: /^(Documentary photography)[,.]?\s*/i, style: 'Documentary photography' },
        ];
        for (const { pattern, style } of stylePatterns) {
            const match = remaining.match(pattern);
            if (match) {
                result.style = style;
                remaining = remaining.replace(pattern, '');
                break;
            }
        }
    }

    // Try to extract camera angle from anywhere in the text if not found
    if (!result.cameraAngle) {
        const parsedAngle = detectCameraAngle(text);
        if (parsedAngle) {
            result.cameraAngle = parsedAngle;
        }
    }

    // Try to extract camera shot from anywhere in the text if not found
    if (!result.cameraShot) {
        const shotExtractPatterns = [
            { pattern: /\b(extreme\s+close[- ]?up)\b/i, value: 'extreme close-up' },
            { pattern: /\b(medium\s+close[- ]?up)\b/i, value: 'medium close-up' },
            { pattern: /\b(medium\s+full\s+shot)\b/i, value: 'medium full shot' },
            { pattern: /\b(medium\s+shot)\b/i, value: 'medium shot' },
            { pattern: /\b(full\s+body)\b/i, value: 'full body' },
            { pattern: /\b(wide\s+shot)\b/i, value: 'wide shot' },
            { pattern: /\b(macro\s+(?:detail|shot))\b/i, value: 'macro detail' },
            { pattern: /\b(close[- ]?up)\b/i, value: 'close-up' },
            { pattern: /\b(tracking\s+shot)\b/i, value: 'tracking shot' },
            { pattern: /\b(action\s+shot)\b/i, value: 'action shot' },
        ];
        for (const { pattern, value } of shotExtractPatterns) {
            if (pattern.test(text)) {
                result.cameraShot = value;
                break;
            }
        }
    }

    // What's left is the main prompt
    result.prompt = remaining.trim();

    return result;
}

// Cinematic mode dropdown options
export const cinematicOptions = {
    style: [
        { value: "A cinematic film still of", label: "Cinematic film still" },
        { value: "A noir film still of", label: "Noir film still" },
        { value: "A sci-fi film still of", label: "Sci-fi film still" },
        { value: "A dramatic film still of", label: "Dramatic" },
        { value: "A moody portrait of", label: "Moody portrait" },
        { value: "An epic cinematic shot of", label: "Epic shot" },
        { value: "A vintage photograph of", label: "Vintage" },
        { value: "A documentary shot of", label: "Documentary" },
        { value: "A thriller film still of", label: "Thriller" },
        { value: "A romantic film still of", label: "Romantic" },
        { value: "A horror film still of", label: "Horror" },
        { value: "A fantasy film still of", label: "Fantasy" },
    ],
    camera: [
        { value: "ARRI ALEXA 35", label: "ALEXA 35 — organic color, wide dynamic range" },
        { value: "ARRI ALEXA 65", label: "ALEXA 65 — 65mm large format, epic scope" },
        { value: "ARRI ALEXA Mini LF", label: "ALEXA Mini LF — large format, shallow depth" },
        { value: "RED V-RAPTOR", label: "RED V-RAPTOR — vibrant color, global shutter" },
        { value: "RED Monstro", label: "RED Monstro — full frame, incredible low-light" },
        { value: "Sony VENICE 2", label: "VENICE 2 — dual ISO, rich organic color" },
        { value: "Panavision Millennium DXL2", label: "DXL2 — smooth highlights, organic skin" },
        { value: "Blackmagic URSA Mini Pro", label: "URSA Mini — wide dynamic range" },
        { value: "Canon C500 Mark II", label: "C500 II — rich color, cinema EOS" },
        { value: "35mm Panavision Panaflex", label: "Panaflex 35mm — mechanical, classic Hollywood" },
        { value: "IMAX 70mm film", label: "IMAX 70mm — massive frame, immersive scale" },
    ],
    focalLength: [
        { value: "18mm", label: "18mm — wide, environmental" },
        { value: "24mm", label: "24mm — documentary feel" },
        { value: "35mm", label: "35mm — cinematic standard" },
        { value: "50mm", label: "50mm — human eye perspective" },
        { value: "65mm", label: "65mm — IMAX standard" },
        { value: "85mm", label: "85mm — classic portrait" },
        { value: "100mm", label: "100mm — tight portrait" },
        { value: "135mm", label: "135mm — dreamy compression" },
    ],
    lensType: [
        { value: "anamorphic lens, oval bokeh, horizontal flares", label: "Anamorphic — oval bokeh, streak flares" },
        { value: "spherical lens, round bokeh", label: "Spherical — round bokeh, neutral" },
        { value: "Cooke S4/i, warm organic Cooke look", label: "Cooke S4/i — warm organic, subtle flare" },
        { value: "Cooke Anamorphic/i, blue streak flares, vintage", label: "Cooke Anamorphic — blue flares, vintage" },
        { value: "Zeiss Master Prime, clinical sharpness, clean", label: "Zeiss Master — clinical sharpness" },
        { value: "Zeiss Supreme Prime, large format, soft edges", label: "Zeiss Supreme — soft edges, gentle falloff" },
        { value: "ARRI Signature Prime, organic flares, smooth bokeh", label: "ARRI Signature — organic flares, smooth" },
        { value: "Panavision Primo 70, ultra-sharp, smooth falloff", label: "Primo 70 — ultra-sharp, smooth falloff" },
        { value: "Panavision C-Series anamorphic, vintage warmth", label: "C-Series — vintage warmth, flares" },
        { value: "Atlas Orion anamorphic, blue streak flares", label: "Atlas Orion — modern vintage, blue streaks" },
        { value: "Kowa Cine Prominar, soft dreamy vintage", label: "Kowa Prominar — soft dreamy Japanese" },
    ],
    filmStock: [
        { value: "Kodak Vision3 500T, tungsten, rich shadows", label: "Vision3 500T — tungsten, rich shadows" },
        { value: "Kodak Vision3 250D, daylight, natural color", label: "Vision3 250D — daylight, natural color" },
        { value: "Kodak Vision3 50D, fine grain, maximum sharpness", label: "Vision3 50D — fine grain, sharp" },
        { value: "CineStill 800T, red halation, neon-friendly", label: "CineStill 800T — halation glow, neon" },
        { value: "Kodak Portra 400, warm skin, soft pastels", label: "Portra 400 — warm skin, soft pastels" },
        { value: "Kodak Tri-X 400 B&W, iconic contrast, grain", label: "Tri-X 400 B&W — iconic contrast, grain" },
        { value: "Ilford HP5 Plus B&W, classic grain, pushable", label: "HP5 B&W — classic grain, versatile" },
        { value: "Fujichrome Velvia 50, extreme saturation", label: "Velvia 50 — extreme saturation, punchy" },
    ],
    lightingSource: [
        { value: "Neon signs", label: "Neon signs" },
        { value: "Moonlight", label: "Moonlight" },
        { value: "Candlelight", label: "Candlelight" },
        { value: "Streetlamps", label: "Streetlamps" },
        { value: "Golden hour sunlight", label: "Golden hour" },
        { value: "Firelight", label: "Firelight" },
        { value: "Fluorescent lights", label: "Fluorescent" },
        { value: "Tungsten practicals", label: "Tungsten practicals" },
        { value: "Harsh midday sun", label: "Harsh midday sun" },
        { value: "Overcast diffused daylight", label: "Overcast diffused" },
    ],
    lightingStyle: [
        { value: "low key, deep shadows", label: "Low key — deep shadows" },
        { value: "high key, bright and airy", label: "High key — bright, airy" },
        { value: "chiaroscuro, dramatic contrast", label: "Chiaroscuro — dramatic contrast" },
        { value: "silhouette, backlit", label: "Silhouette — backlit" },
        { value: "rim lighting, edge glow", label: "Rim lighting — edge glow" },
        { value: "Rembrandt lighting, triangle shadow", label: "Rembrandt — triangle shadow" },
        { value: "split lighting, half-face shadow", label: "Split — half-face shadow" },
        { value: "butterfly lighting, glamour", label: "Butterfly — glamour" },
    ],
    filmInspiration: [
        { value: "inspired by the vast desolate orange-teal foggy look of Blade Runner 2049", label: "Blade Runner 2049" },
        { value: "inspired by the warm chiaroscuro shadowy intimate look of The Godfather", label: "The Godfather" },
        { value: "inspired by the natural-light brutal cold immersive look of The Revenant", label: "The Revenant" },
        { value: "inspired by the vast muted desert ancient-future look of Dune", label: "Dune" },
        { value: "inspired by the IMAX black-and-white intimate epic look of Oppenheimer", label: "Oppenheimer" },
        { value: "inspired by the neon-noir pink-purple 80s look of Drive", label: "Drive" },
        { value: "inspired by the warm green-yellow whimsical Parisian look of Amélie", label: "Amélie" },
        { value: "inspired by the warm soft-focus pastel intimate look of Her", label: "Her" },
        { value: "inspired by the gritty 70s amber-teal Gotham look of Joker", label: "Joker" },
        { value: "inspired by the saturated Technicolor magic-hour look of La La Land", label: "La La Land" },
        { value: "inspired by the green-tinted digital cold sterile look of The Matrix", label: "The Matrix" },
        { value: "inspired by the saturated chrome kinetic desert look of Mad Max: Fury Road", label: "Mad Max: Fury Road" },
        { value: "inspired by the intimate teal-magenta poetic look of Moonlight", label: "Moonlight" },
        { value: "inspired by the symmetrical pastel storybook look of The Grand Budapest Hotel", label: "Grand Budapest Hotel" },
        { value: "inspired by the rain-soaked neon noir smoky look of Blade Runner", label: "Blade Runner (1982)" },
        { value: "inspired by the cold precise symmetrical futuristic look of 2001: A Space Odyssey", label: "2001: A Space Odyssey" },
        { value: "inspired by the surreal smoky jungle golden-hour look of Apocalypse Now", label: "Apocalypse Now" },
        { value: "inspired by the candlelit painterly natural-light look of Barry Lyndon", label: "Barry Lyndon" },
        { value: "inspired by the rain-drenched red-noir Gotham look of The Batman", label: "The Batman" },
        { value: "inspired by the slow-motion saturated-red romantic look of In the Mood for Love", label: "In the Mood for Love" },
        { value: "inspired by the epic golden desert sweeping look of Lawrence of Arabia", label: "Lawrence of Arabia" },
        { value: "inspired by the foggy muted contemplative mysterious look of Arrival", label: "Arrival" },
        { value: "inspired by the class-contrast architectural green-tinted look of Parasite", label: "Parasite" },
        { value: "inspired by the continuous-take immersive WWI mud-and-fire look of 1917", label: "1917" },
    ],
    filter: [
        { value: "Pro mist diffusion, soft glow", label: "Pro mist — soft glow" },
        { value: "Black pro mist 1/4, subtle halation", label: "Black pro mist — subtle halation" },
        { value: "Vintage halation, warm bloom", label: "Halation — warm bloom" },
        { value: "Glimmerglass, skin-flattering softness", label: "Glimmerglass — flattering softness" },
        { value: "Soft focus filter", label: "Soft focus" },
        { value: "No filter, clean and sharp", label: "No filter — clean, sharp" },
    ],
    aspectRatio: [
        { value: "2.39:1", label: "2.39:1 — Cinemascope" },
        { value: "1.85:1", label: "1.85:1 — Widescreen" },
        { value: "16:9", label: "16:9 — HD" },
        { value: "4:3", label: "4:3 — Academy" },
        { value: "2.76:1", label: "2.76:1 — Ultra Panavision" },
        { value: "1.33:1", label: "1.33:1 — Classic" },
        { value: "1.43:1", label: "1.43:1 — IMAX" },
    ],
};


/**
 * Build cinematic prompt in template format:
 * Line 1: [STYLE] [SUBJECT], set in [ENVIRONMENT].
 * Line 2: Captured with [CAMERA], [FOCAL LENGTH], [LENS TYPE], [FILM STOCK].
 * Line 3: [LIGHTING SOURCE], [LIGHTING STYLE].
 * Line 4: [FILM INSPIRATION]. [FILTER].
 */
export function buildCinematicPromptText(state: PromptBuilderState): string {
    const lines: string[] = [];

    // Line 1: [STYLE] [SUBJECT], set in [ENVIRONMENT].
    // Style now ends with "of" (e.g., "A cinematic film still of")
    if (state.style || state.subject || state.environment) {
        const style = state.style || "A cinematic film still of";
        const subject = state.subject || "[subject]";
        const environment = state.environment ? `, set in ${state.environment}` : "";
        lines.push(`${style} ${subject}${environment}.`);
    }

    // Line 2: Captured with [CAMERA], [FOCAL LENGTH], [LENS TYPE], [FILM STOCK].
    const line2Parts: string[] = [];
    if (state.camera) line2Parts.push(state.camera);
    if (state.focalLength) line2Parts.push(state.focalLength);
    if (state.lensType) line2Parts.push(state.lensType);
    if (state.filmStock) line2Parts.push(state.filmStock);
    if (line2Parts.length > 0) {
        lines.push(`Captured with ${line2Parts.join(", ")}.`);
    }

    // Line 3: [LIGHTING SOURCE], [LIGHTING STYLE].
    const line3Parts: string[] = [];
    if (state.lightingSource) line3Parts.push(state.lightingSource);
    if (state.lightingStyle) line3Parts.push(state.lightingStyle);
    if (line3Parts.length > 0) {
        lines.push(`${line3Parts.join(", ")}.`);
    }

    // Line 4: [FILM INSPIRATION]. [FILTER].
    const line4Parts: string[] = [];
    // Use filmInspiration (new) or fall back to movieAesthetic (legacy) or atmosphere (legacy)
    if (state.filmInspiration) {
        line4Parts.push(state.filmInspiration);
    } else if (state.movieAesthetic) {
        line4Parts.push(state.movieAesthetic);
    } else if (state.atmosphere) {
        line4Parts.push(`${state.atmosphere} mood`);
    }
    if (state.filter) line4Parts.push(state.filter);
    if (line4Parts.length > 0) {
        lines.push(line4Parts.join(". ") + ".");
    }

    return lines.join("\n");
}
