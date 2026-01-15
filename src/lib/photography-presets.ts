
// ============================================================================
// SIMPLIFIED PHOTOGRAPHY PRESETS FOR PROMPT STUDIO
// Only keep what must be explicitly selected - framing/angle can be inferred
// ============================================================================

export interface Preset {
    id: string;
    name: string;
    description: string;
}

// ============================================================================
// LENS - Focal length with specific high-end cinema lens references
// ============================================================================

export interface LensType extends Preset {
    mm: number;
    effect: string;
    lensName: string; // High-end cinema lens for this focal length
}

export const LENS_TYPES: LensType[] = [
    { id: '24mm', name: '24mm', mm: 24, effect: 'Wide, environmental', lensName: 'Zeiss Master Prime 24mm', description: 'Shows context' },
    { id: '35mm', name: '35mm', mm: 35, effect: 'Natural wide', lensName: 'Cooke S4/i 35mm', description: 'Documentary feel' },
    { id: '50mm', name: '50mm', mm: 50, effect: 'Natural', lensName: 'Zeiss Master Prime 50mm', description: 'How we see' },
    { id: '85mm', name: '85mm', mm: 85, effect: 'Portrait', lensName: 'Panavision Primo 85mm', description: 'Flattering compression' },
    { id: '135mm', name: '135mm', mm: 135, effect: 'Telephoto', lensName: 'Cooke S4/i 135mm', description: 'Strong compression' },
    { id: 'ana-40', name: '40mm Ana', mm: 40, effect: 'Anamorphic wide', lensName: 'Panavision C-Series 40mm Anamorphic', description: 'Oval bokeh, flares' },
    { id: 'ana-75', name: '75mm Ana', mm: 75, effect: 'Anamorphic portrait', lensName: 'Cooke Anamorphic/i 75mm', description: 'Cinematic squeeze' },
];

// ============================================================================
// APERTURE - Depth of field control
// ============================================================================

export interface ApertureStop extends Preset {
    value: number;
    dof: string;
}

export const APERTURE_STOPS: ApertureStop[] = [
    { id: 'f1.4', name: 'f/1.4', value: 1.4, dof: 'Very shallow', description: 'Very blurry background' },
    { id: 'f2.8', name: 'f/2.8', value: 2.8, dof: 'Shallow', description: 'Blurry background' },
    { id: 'f4', name: 'f/4', value: 4, dof: 'Moderate', description: 'Some blur' },
    { id: 'f8', name: 'f/8', value: 8, dof: 'Deep', description: 'Sharp background' },
];

// ============================================================================
// OPTIONAL: Motion Blur
// ============================================================================

export interface MotionBlur extends Preset {
    value: string;
}

export const MOTION_BLUR_OPTIONS: MotionBlur[] = [
    { id: 'none', name: 'None', value: '', description: 'No motion blur' },
    { id: 'low', name: 'Low', value: 'slight motion blur', description: 'Subtle movement' },
    { id: 'high', name: 'High', value: 'strong motion blur, long exposure', description: 'Visible trails' },
];

// ============================================================================
// OPTIONAL: Camera Body (with color indicator)
// ============================================================================

export interface CameraBody extends Preset {
    value: string;
    color: string;
}

export const CAMERA_BODIES: CameraBody[] = [
    { id: 'none', name: 'None', value: '', color: '#64748b', description: 'No specific camera' },
    { id: 'arri', name: 'ARRI', value: 'shot on ARRI Alexa', color: '#22c55e', description: 'Cinematic, organic' },
    { id: 'red', name: 'RED', value: 'shot on RED camera', color: '#ef4444', description: 'Sharp, digital' },
    { id: 'sony', name: 'Sony', value: 'shot on Sony Venice', color: '#3b82f6', description: 'Modern, clean' },
    { id: 'film', name: '35mm Film', value: 'shot on 35mm film', color: '#f59e0b', description: 'Analog grain' },
];

// ============================================================================
// OPTIONAL: Film Stock (with color palette)
// ============================================================================

export interface FilmStock extends Preset {
    value: string;
    colors: { primary: string; secondary: string };
}

export const FILM_STOCKS: FilmStock[] = [
    { id: 'none', name: 'None', value: '', colors: { primary: '#64748b', secondary: '#475569' }, description: 'No film stock look' },
    { id: 'portra', name: 'Portra', value: 'Kodak Portra 400 film look, warm skin tones', colors: { primary: '#fcd9b6', secondary: '#e6a87c' }, description: 'Warm, portrait' },
    { id: 'cinestill', name: 'Cinestill', value: 'Cinestill 800T film look, cool tones', colors: { primary: '#67e8f9', secondary: '#0891b2' }, description: 'Neon, night' },
    { id: 'velvia', name: 'Velvia', value: 'Fuji Velvia film look, saturated colors', colors: { primary: '#f472b6', secondary: '#db2777' }, description: 'Vivid, punchy' },
    { id: 'bw', name: 'B&W', value: 'black and white film, high contrast', colors: { primary: '#ffffff', secondary: '#000000' }, description: 'Monochrome' },
];
