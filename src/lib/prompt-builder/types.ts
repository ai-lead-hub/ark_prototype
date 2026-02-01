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
    atmosphere: string;       // e.g., "mysterious"
    movieAesthetic: string;   // e.g., "Blade Runner 2049 inspired"
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
        filter: "",
        aspectRatio: "",
    };
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
    const stockParts: string[] = [];
    if (state.cameraBody) stockParts.push(state.cameraBody);
    if (state.lensType) stockParts.push(state.lensType);
    if (state.filmLook) stockParts.push(state.filmLook);
    if (stockParts.length) data.film_stock = stockParts.join(', ');

    return data;
}

export function buildPromptText(data: PromptBuilderData): string {
    const parts: string[] = [];

    if (data.prompt) parts.push(data.prompt);
    if (data.style) parts.push(`Style: ${data.style}`);

    const camera = data.camera || {};
    if (Object.keys(camera).length) {
        const desc: string[] = [];
        if (camera.angle) desc.push(`${camera.angle} angle`);
        if (camera.distance) desc.push(camera.distance);
        if (camera['lens-mm'] !== undefined) desc.push(`${camera['lens-mm']}mm lens`);
        if (camera.lens) desc.push(`${camera.lens} lens`);
        if (camera['f-number']) desc.push(camera['f-number']);
        if (desc.length) parts.push(`Camera: ${desc.join(", ")}`);
    }

    if (data.film_stock) parts.push(`${data.film_stock}`);
    if (data.lighting) parts.push(`Lighting: ${data.lighting}`);

    const colors = data.colors || {};
    if (colors.mood) parts.push(`Mood: ${colors.mood}`);
    if (data.composition) parts.push(`Composition: ${data.composition}`);

    return parts.join(". ");
}

/**
 * Parse a formatted prompt string back into state fields.
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

    // Extract Mood
    const moodMatch = remaining.match(/\. Mood: (.+?)(?=\. |$)/);
    if (moodMatch) {
        result.colorMood = moodMatch[1];
        remaining = remaining.replace(/\. Mood: .+?(?=\. |$)/, '');
    }

    // Extract Lighting
    const lightingMatch = remaining.match(/\. Lighting: (.+?)(?=\. |$)/);
    if (lightingMatch) {
        result.lighting = lightingMatch[1];
        remaining = remaining.replace(/\. Lighting: .+?(?=\. |$)/, '');
    }

    // Extract camera body, lens type, and film look
    // These can appear in various formats, search the whole remaining text

    // Camera body patterns
    const cameraPatterns = [
        { pattern: /shot on ARRI ALEXA Mini LF/i, value: 'shot on ARRI ALEXA Mini LF, large format' },
        { pattern: /ARRI ALEXA Mini LF/i, value: 'shot on ARRI ALEXA Mini LF, large format' },
        { pattern: /shot on ARRI ALEXA 35/i, value: 'shot on ARRI ALEXA 35, Super 35mm' },
        { pattern: /ARRI ALEXA 35/i, value: 'shot on ARRI ALEXA 35, Super 35mm' },
        { pattern: /shot on ARRI ALEXA 65/i, value: 'shot on ARRI ALEXA 65, 65mm large format' },
        { pattern: /ARRI ALEXA 65/i, value: 'shot on ARRI ALEXA 65, 65mm large format' },
        { pattern: /shot on RED V-RAPTOR/i, value: 'shot on RED V-RAPTOR 8K' },
        { pattern: /RED V-RAPTOR/i, value: 'shot on RED V-RAPTOR 8K' },
        { pattern: /shot on RED Komodo/i, value: 'shot on RED Komodo 6K' },
        { pattern: /RED Komodo/i, value: 'shot on RED Komodo 6K' },
        { pattern: /Sony VENICE/i, value: 'shot on Sony VENICE 2, full-frame cinema' },
        { pattern: /Panavision.*DXL/i, value: 'shot on Panavision Millennium DXL2, 8K large format' },
        { pattern: /Canon EOS R5/i, value: 'shot on Canon EOS R5' },
        { pattern: /Sony A7 IV/i, value: 'shot on Sony A7 IV' },
        { pattern: /Sony A7R IV/i, value: 'shot on Sony A7R IV' },
        { pattern: /Blackmagic URSA/i, value: 'shot on Blackmagic URSA Mini Pro 12K' },
        { pattern: /Blackmagic Pocket/i, value: 'shot on Blackmagic Pocket 6K Pro' },
    ];

    for (const { pattern, value } of cameraPatterns) {
        if (pattern.test(remaining)) {
            result.cameraBody = value;
            break;
        }
    }

    // Infer camera system from body to populate dropdowns
    if (result.cameraBody) {
        if (result.cameraBody.includes("ARRI")) result.cameraSystem = "arri";
        else if (result.cameraBody.includes("RED")) result.cameraSystem = "red";
        else if (result.cameraBody.includes("Blackmagic")) result.cameraSystem = "blackmagic";
        else if (result.cameraBody.includes("Sony VENICE") || result.cameraBody.includes("Sony FX9")) result.cameraSystem = "sony_venice";
        else if (result.cameraBody.includes("Sony")) result.cameraSystem = "sony";
        else if (result.cameraBody.includes("Canon")) result.cameraSystem = "canon_dslr";
        else if (result.cameraBody.includes("Nikon")) result.cameraSystem = "nikon";
        else if (result.cameraBody.includes("Fujifilm")) result.cameraSystem = "fujifilm";
        else if (result.cameraBody.includes("Leica")) result.cameraSystem = "leica";
        else if (result.cameraBody.includes("Panavision") || result.cameraBody.includes("Genesis")) result.cameraSystem = "panavision";
        else if (result.cameraBody.includes("IMAX")) result.cameraSystem = "imax";
    }

    // Lens type patterns
    const lensPatterns = [
        { pattern: /Cooke S4/i, value: 'with Cooke S4/i prime lenses, warm organic look' },
        { pattern: /Cooke S7/i, value: 'with Cooke S7/i full-frame lenses' },
        { pattern: /Cooke Anamorphic/i, value: 'with Cooke Anamorphic lenses, oval bokeh' },
        { pattern: /Zeiss Master Prime/i, value: 'with Zeiss Master Prime lenses, sharp and clean' },
        { pattern: /Zeiss Supreme/i, value: 'with Zeiss Supreme Prime lenses' },
        { pattern: /ARRI Signature/i, value: 'with ARRI Signature Prime lenses' },
        { pattern: /Panavision Primo 70/i, value: 'with Panavision Primo 70 large format lenses' },
        { pattern: /Panavision Primo/i, value: 'with Panavision Primo 70 large format lenses' },
        { pattern: /G Master/i, value: 'with G Master lens' },
        { pattern: /Canon RF L/i, value: 'with Canon RF L-series lens' },
        { pattern: /Sigma Art/i, value: 'with Sigma Art lens' },
        { pattern: /Sigma Cine/i, value: 'with Sigma Cine lenses' },
    ];

    for (const { pattern, value } of lensPatterns) {
        if (pattern.test(remaining)) {
            result.lensType = value;
            break;
        }
    }

    // Film look patterns
    const filmLookPatterns = [
        { pattern: /Kodak Vision3 500T/i, value: 'Kodak Vision3 500T motion picture film, tungsten balanced, cinematic colors' },
        { pattern: /Kodak Vision3 250D/i, value: 'Kodak Vision3 250D motion picture film, daylight balanced, rich tones' },
        { pattern: /Kodak Vision3 50D/i, value: 'Kodak Vision3 50D motion picture film, finest grain, maximum detail' },
        { pattern: /Kodak Portra 400/i, value: 'Kodak Portra 400 film look, warm tones, fine grain' },
        { pattern: /Kodak Portra 800/i, value: 'Kodak Portra 800 film, versatile color negative' },
        { pattern: /Kodak Ektar/i, value: 'Kodak Ektar 100 film look, vivid colors, fine grain' },
        { pattern: /Kodak Tri-X/i, value: 'Kodak Tri-X 400 black and white, iconic contrast' },
        { pattern: /CineStill 800T/i, value: 'CineStill 800T film look, tungsten cinematic, halation glow' },
        { pattern: /Fujifilm Pro 400H/i, value: 'Fujifilm Pro 400H film look, soft pastel colors' },
        { pattern: /Ilford HP5/i, value: 'Ilford HP5 Plus black and white, classic grain' },
    ];

    for (const { pattern, value } of filmLookPatterns) {
        if (pattern.test(remaining)) {
            result.filmLook = value;
            break;
        }
    }

    // Remove the film/camera section from remaining
    remaining = remaining.replace(/\. shot on [^.]+/g, '');

    // Extract Camera settings
    const cameraMatch = remaining.match(/\. Camera: (.+?)(?=\. |$)/);
    if (cameraMatch) {
        const cameraStr = cameraMatch[1];

        // Parse angle
        const angleMatch = cameraStr.match(/(.+?) angle/);
        if (angleMatch) {
            result.cameraAngle = angleMatch[1];
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

    // Extract Style
    const styleMatch = remaining.match(/\. Style: (.+?)(?=\. |$)/);
    if (styleMatch) {
        result.style = styleMatch[1];
        remaining = remaining.replace(/\. Style: .+?(?=\. |$)/, '');
    }

    // What's left is the main prompt
    result.prompt = remaining.trim();

    return result;
}

// Cinematic mode dropdown options
export const cinematicOptions = {
    style: [
        { value: "A cinematic film still", label: "Cinematic film still" },
        { value: "A noir film still", label: "Noir film still" },
        { value: "A sci-fi film still", label: "Sci-fi film still" },
        { value: "A dramatic film still", label: "Dramatic film still" },
        { value: "A moody cinematic portrait", label: "Moody cinematic portrait" },
        { value: "An epic cinematic shot", label: "Epic cinematic shot" },
        { value: "A vintage film photograph", label: "Vintage film photograph" },
        { value: "A documentary-style shot", label: "Documentary-style shot" },
    ],
    camera: [
        { value: "ARRI ALEXA 65", label: "ARRI ALEXA 65" },
        { value: "ARRI ALEXA Mini LF", label: "ARRI ALEXA Mini LF" },
        { value: "RED V-Raptor 8K", label: "RED V-Raptor 8K" },
        { value: "Sony VENICE 2", label: "Sony VENICE 2" },
        { value: "Panavision Millennium DXL2", label: "Panavision Millennium DXL2" },
        { value: "Blackmagic URSA Mini Pro 12K", label: "Blackmagic URSA Mini Pro 12K" },
        { value: "Canon EOS C500 Mark II", label: "Canon EOS C500 Mark II" },
    ],
    focalLength: [
        { value: "18mm", label: "18mm (ultra wide)" },
        { value: "24mm", label: "24mm (wide)" },
        { value: "35mm", label: "35mm (natural)" },
        { value: "50mm", label: "50mm (standard)" },
        { value: "85mm", label: "85mm (portrait)" },
        { value: "100mm", label: "100mm (telephoto)" },
        { value: "135mm", label: "135mm (long)" },
    ],
    lensType: [
        { value: "anamorphic lens", label: "Anamorphic lens" },
        { value: "spherical lens", label: "Spherical lens" },
        { value: "prime lens", label: "Prime lens" },
        { value: "Cooke S4/i lens", label: "Cooke S4/i lens" },
        { value: "Zeiss Master Prime lens", label: "Zeiss Master Prime lens" },
        { value: "Panavision Primo 70 lens", label: "Panavision Primo 70 lens" },
    ],
    filmStock: [
        { value: "CineStill 800T film", label: "CineStill 800T" },
        { value: "Kodak Vision3 500T film", label: "Kodak Vision3 500T" },
        { value: "Kodak Vision3 250D film", label: "Kodak Vision3 250D" },
        { value: "Kodak Portra 400 film", label: "Kodak Portra 400" },
        { value: "Fujifilm Eterna 500 film", label: "Fujifilm Eterna 500" },
        { value: "Ilford HP5 Plus film", label: "Ilford HP5 Plus (B&W)" },
    ],
    lightingSource: [
        { value: "Neon signs", label: "Neon signs" },
        { value: "Moonlight", label: "Moonlight" },
        { value: "Candlelight", label: "Candlelight" },
        { value: "Streetlamps", label: "Streetlamps" },
        { value: "Sunset glow", label: "Sunset glow" },
        { value: "Firelight", label: "Firelight" },
        { value: "Fluorescent lights", label: "Fluorescent lights" },
        { value: "Tungsten lights", label: "Tungsten lights" },
    ],
    lightingStyle: [
        { value: "low key", label: "Low key (dark)" },
        { value: "high key", label: "High key (bright)" },
        { value: "chiaroscuro", label: "Chiaroscuro" },
        { value: "silhouette", label: "Silhouette" },
        { value: "rim lighting", label: "Rim lighting" },
        { value: "Rembrandt", label: "Rembrandt" },
        { value: "split lighting", label: "Split lighting" },
    ],
    atmosphere: [
        { value: "mysterious", label: "Mysterious" },
        { value: "melancholic", label: "Melancholic" },
        { value: "tense", label: "Tense" },
        { value: "romantic", label: "Romantic" },
        { value: "nostalgic", label: "Nostalgic" },
        { value: "eerie", label: "Eerie" },
        { value: "hopeful", label: "Hopeful" },
        { value: "dreamy", label: "Dreamy" },
    ],
    movieAesthetic: [
        { value: "Blade Runner 2049 inspired aesthetic", label: "Blade Runner 2049" },
        { value: "The Matrix inspired aesthetic", label: "The Matrix" },
        { value: "Interstellar inspired aesthetic", label: "Interstellar" },
        { value: "Dune inspired aesthetic", label: "Dune" },
        { value: "Drive inspired aesthetic", label: "Drive" },
        { value: "Amélie inspired aesthetic", label: "Amélie" },
        { value: "Her inspired aesthetic", label: "Her" },
        { value: "The Godfather inspired aesthetic", label: "The Godfather" },
        { value: "Joker inspired aesthetic", label: "Joker" },
        { value: "La La Land inspired aesthetic", label: "La La Land" },
    ],
    filter: [
        { value: "Pro mist diffusion", label: "Pro mist diffusion" },
        { value: "Black pro mist 1/4", label: "Black pro mist 1/4" },
        { value: "Vintage halation", label: "Vintage halation" },
        { value: "Glimmerglass", label: "Glimmerglass" },
        { value: "Soft focus", label: "Soft focus" },
        { value: "No filter", label: "No filter" },
    ],
    aspectRatio: [
        { value: "2.39:1", label: "2.39:1 (Cinemascope)" },
        { value: "1.85:1", label: "1.85:1 (Widescreen)" },
        { value: "16:9", label: "16:9 (HD)" },
        { value: "4:3", label: "4:3 (Academy)" },
        { value: "2.76:1", label: "2.76:1 (Ultra Panavision)" },
        { value: "1.33:1", label: "1.33:1 (Classic)" },
    ],
};

/**
 * Build cinematic prompt in 4-line template format:
 * Line 1: [STYLE] of a [SUBJECT], set in [ENVIRONMENT].
 * Line 2: Captured with [CAMERA], [FOCAL LENGTH], [LENS TYPE], [FILM STOCK].
 * Line 3: [LIGHTING SOURCE], [LIGHTING STYLE], [ATMOSPHERE] mood.
 * Line 4: [MOVIE AESTHETIC]. [FILTER]. [ASPECT RATIO] format.
 */
export function buildCinematicPromptText(state: PromptBuilderState): string {
    const lines: string[] = [];

    // Line 1: [STYLE] of a [SUBJECT], set in [ENVIRONMENT].
    if (state.style || state.subject || state.environment) {
        const style = state.style || "A cinematic film still";
        const subject = state.subject || "[subject]";
        const environment = state.environment || "[environment]";
        lines.push(`${style} of ${subject}, set in ${environment}.`);
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

    // Line 3: [LIGHTING SOURCE], [LIGHTING STYLE], [ATMOSPHERE] mood.
    const line3Parts: string[] = [];
    if (state.lightingSource) line3Parts.push(state.lightingSource);
    if (state.lightingStyle) line3Parts.push(state.lightingStyle);
    if (state.atmosphere) line3Parts.push(`${state.atmosphere} mood`);
    if (line3Parts.length > 0) {
        lines.push(`${line3Parts.join(", ")}.`);
    }

    // Line 4: [MOVIE AESTHETIC]. [FILTER].
    const line4Parts: string[] = [];
    if (state.movieAesthetic) line4Parts.push(state.movieAesthetic);
    if (state.filter) line4Parts.push(state.filter);
    if (line4Parts.length > 0) {
        lines.push(line4Parts.join(". ") + ".");
    }

    return lines.join("\n");
}
