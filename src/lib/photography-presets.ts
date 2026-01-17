
// ============================================================================
// SIMPLIFIED PHOTOGRAPHY PRESETS FOR PROMPT STUDIO
// Focus on EFFECTS that AI models understand, not brand names
// ============================================================================

export interface Preset {
    id: string;
    name: string;
    description: string;
}

// ============================================================================
// LENS - Focal length with EFFECT descriptions (not brand names)
// ============================================================================

export interface LensType extends Preset {
    mm: number;
    effect: string;
    promptEffect: string; // What to include in the prompt
}

export const LENS_TYPES: LensType[] = [
    { id: '24mm', name: '24mm', mm: 24, effect: 'Wide, environmental', promptEffect: '24mm wide-angle lens, visible barrel distortion, exaggerated perspective, deep depth of field', description: 'Shows context' },
    { id: '35mm', name: '35mm', mm: 35, effect: 'Natural wide', promptEffect: '35mm lens, natural perspective with slight wide-angle distortion, documentary feel', description: 'Documentary feel' },
    { id: '50mm', name: '50mm', mm: 50, effect: 'Natural', promptEffect: '50mm lens, natural human-eye perspective, no distortion, true-to-life geometry', description: 'How we see' },
    { id: '85mm', name: '85mm', mm: 85, effect: 'Portrait', promptEffect: '85mm portrait lens, flattering compression, beautiful subject separation, creamy bokeh', description: 'Flattering compression' },
    { id: '135mm', name: '135mm', mm: 135, effect: 'Telephoto', promptEffect: '135mm telephoto lens, strong background compression, stacked layers, flattened depth', description: 'Strong compression' },
    { id: 'ana-40', name: '40mm Ana', mm: 40, effect: 'Anamorphic wide', promptEffect: '40mm anamorphic lens, widescreen cinematic aspect ratio, oval bokeh, horizontal lens flares, slight squeeze distortion', description: 'Oval bokeh, flares' },
    { id: 'ana-75', name: '75mm Ana', mm: 75, effect: 'Anamorphic portrait', promptEffect: '75mm anamorphic lens, cinematic widescreen, oval bokeh, subtle horizontal lens flares, flattering compression', description: 'Cinematic squeeze' },
];

// ============================================================================
// APERTURE - Depth of field control with EFFECT descriptions
// ============================================================================

export interface ApertureStop extends Preset {
    value: number;
    dof: string;
    promptEffect: string;
}

export const APERTURE_STOPS: ApertureStop[] = [
    { id: 'f1.4', name: 'f/1.4', value: 1.4, dof: 'Very shallow', promptEffect: 'f/1.4 aperture, razor-thin focus plane, extremely blurry background, creamy bokeh, only eyes sharp', description: 'Very blurry background' },
    { id: 'f2.8', name: 'f/2.8', value: 2.8, dof: 'Shallow', promptEffect: 'f/2.8 aperture, shallow depth of field, subject isolated from soft blurred background', description: 'Blurry background' },
    { id: 'f4', name: 'f/4', value: 4, dof: 'Moderate', promptEffect: 'f/4 aperture, moderate depth of field, subject and immediate surroundings sharp', description: 'Some blur' },
    { id: 'f8', name: 'f/8', value: 8, dof: 'Deep', promptEffect: 'f/8 aperture, deep focus, tack-sharp from foreground to background', description: 'Sharp background' },
];

// ============================================================================
// OPTIONAL: Motion Blur
// ============================================================================

export interface MotionBlur extends Preset {
    value: string;
}

export const MOTION_BLUR_OPTIONS: MotionBlur[] = [
    { id: 'none', name: 'None', value: '', description: 'No motion blur' },
    { id: 'low', name: 'Low', value: 'slight motion blur on moving elements', description: 'Subtle movement' },
    { id: 'high', name: 'High', value: 'heavy motion blur, streaking lights, dreamlike movement trails', description: 'Visible trails' },
];

// ============================================================================
// OPTIONAL: Camera Body - describe the LOOK/EFFECT, not the brand
// ============================================================================

export interface CameraBody extends Preset {
    value: string;
    color: string;
}

export const CAMERA_BODIES: CameraBody[] = [
    { id: 'none', name: 'None', value: '', color: '#64748b', description: 'No specific camera' },
    { id: 'cinema', name: 'Cinema', value: 'organic cinema camera colors, natural skin rendering, smooth highlight rolloff, high dynamic range', color: '#22c55e', description: 'Cinematic, organic' },
    { id: 'digital', name: 'Digital', value: 'razor-sharp digital capture, punchy contrast, hyper-resolved textures, clean modern look', color: '#ef4444', description: 'Sharp, digital' },
    { id: 'vintage', name: 'Vintage', value: 'vintage camera aesthetic, slightly soft focus, gentle highlight bloom, nostalgic quality', color: '#3b82f6', description: 'Soft, nostalgic' },
    { id: 'film', name: 'Film', value: 'organic film grain texture, photochemical color, tactile analog quality, rich shadows', color: '#f59e0b', description: 'Analog grain' },
];

// ============================================================================
// OPTIONAL: Film Stock - describe the COLOR/LOOK effect
// ============================================================================

export interface FilmStock extends Preset {
    value: string;
    colors: { primary: string; secondary: string };
}

export const FILM_STOCKS: FilmStock[] = [
    { id: 'none', name: 'None', value: '', colors: { primary: '#64748b', secondary: '#475569' }, description: 'No film stock look' },
    { id: 'portra', name: 'Warm', value: 'warm color grading, natural skin tones, pastel highlights, warm lifted shadows', colors: { primary: '#fcd9b6', secondary: '#e6a87c' }, description: 'Warm, portrait' },
    { id: 'cinestill', name: 'Cool', value: 'cool color grading, cyan-blue shadows, neon glow around lights, night photography aesthetic', colors: { primary: '#67e8f9', secondary: '#0891b2' }, description: 'Neon, night' },
    { id: 'velvia', name: 'Vivid', value: 'highly saturated vibrant colors, deep rich blacks, punchy contrast, vivid color pop', colors: { primary: '#f472b6', secondary: '#db2777' }, description: 'Vivid, punchy' },
    { id: 'bw', name: 'B&W', value: 'black and white, high contrast, dramatic shadows, noir aesthetic', colors: { primary: '#ffffff', secondary: '#000000' }, description: 'Monochrome' },
];
