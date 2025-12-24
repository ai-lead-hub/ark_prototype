
// ============================================================================
// 3D CAMERA POSITION MODEL
// Think of camera orbiting around a single subject in 3D space
// ============================================================================

export interface Preset {
    id: string;
    name: string;
    description: string;
    icon?: string;
}

// ============================================================================
// 1. HORIZONTAL ROTATION - Camera's position around the subject (azimuth)
// ============================================================================

export interface HorizontalPosition extends Preset {
    value: string;
    angle: number; // 0 = front, 45 = 3/4, 90 = profile, 135 = OTS, 180 = behind
}

export const HORIZONTAL_POSITIONS: HorizontalPosition[] = [
    { id: 'front', name: 'Frontal', value: 'frontal view straight on', angle: 0, description: 'Facing camera', icon: '⬤' },
    { id: 'perspective', name: '3/4 View', value: 'three quarter view perspective', angle: 45, description: 'Classic portrait', icon: '◐' },
    { id: 'profile', name: 'Profile', value: 'profile view side shot', angle: 90, description: 'Side-on', icon: '◑' },
    { id: 'ots', name: 'Over Shoulder', value: 'over the shoulder shot', angle: 135, description: 'Behind looking forward', icon: '◔' },
    { id: 'behind', name: 'Behind', value: 'shot from behind back view', angle: 180, description: 'Back of subject', icon: '○' },
];

// ============================================================================
// 2. VERTICAL ROTATION - Camera's height relative to subject (elevation)
// ============================================================================

export interface VerticalPosition extends Preset {
    value: string;
    angle: number; // -90 = worm, -45 = low, 0 = eye, 45 = high, 90 = overhead
}

export const VERTICAL_POSITIONS: VerticalPosition[] = [
    { id: 'overhead', name: 'Overhead', value: 'overhead shot birds eye view top down', angle: 90, description: 'Looking straight down', icon: '⬇' },
    { id: 'high', name: 'High Angle', value: 'high angle shot looking down', angle: 45, description: 'Above, looking down', icon: '↘' },
    { id: 'eye', name: 'Eye Level', value: 'eye level shot', angle: 0, description: 'Natural height', icon: '→' },
    { id: 'low', name: 'Low Angle', value: 'low angle shot looking up', angle: -45, description: 'Below, looking up', icon: '↗' },
];

// ============================================================================
// 3. DISTANCE/FRAMING - How close the camera is to subject
// ============================================================================

export interface FramingLevel extends Preset {
    abbr: string;
    value: string;
    scale: number; // 0 = far (EWS), 100 = close (ECU)
}

export const FRAMING_LEVELS: FramingLevel[] = [
    { id: 'ews', name: 'Extreme Wide', abbr: 'EWS', value: 'extreme wide shot', scale: 0, description: 'Tiny in landscape' },
    { id: 'ws', name: 'Wide Shot', abbr: 'WS', value: 'wide shot', scale: 15, description: 'Full scene' },
    { id: 'fs', name: 'Full Shot', abbr: 'FS', value: 'full shot', scale: 30, description: 'Full body' },
    { id: 'mfs', name: 'Medium Full', abbr: 'MFS', value: 'medium full shot', scale: 40, description: 'Knees up' },
    { id: 'ms', name: 'Medium Shot', abbr: 'MS', value: 'medium shot', scale: 55, description: 'Waist up' },
    { id: 'mcu', name: 'Medium Close-Up', abbr: 'MCU', value: 'medium close up', scale: 70, description: 'Chest up' },
    { id: 'cu', name: 'Close-Up', abbr: 'CU', value: 'close up', scale: 85, description: 'Face' },
    { id: 'ecu', name: 'Extreme Close-Up', abbr: 'ECU', value: 'extreme close up', scale: 100, description: 'Detail only' },
];

export const getFramingFromScale = (scale: number): FramingLevel => {
    return FRAMING_LEVELS.reduce((prev, curr) =>
        Math.abs(curr.scale - scale) < Math.abs(prev.scale - scale) ? curr : prev
    );
};

// ============================================================================
// 4. CAMERA SETTINGS - Technical parameters
// ============================================================================

// Lens Types - named by effect, with distortion/compression values for preview
export interface LensType extends Preset {
    mm: number;
    effect: string;     // Visual effect description
    distortion: number; // -1 to 1: negative = barrel distortion (wide), positive = pincushion/compression (tele)
}

export const LENS_TYPES: LensType[] = [
    { id: 'ultra-wide', name: 'Ultra Wide', mm: 14, effect: 'Bent & Distorted', distortion: -0.8, description: 'Dramatic, surreal' },
    { id: 'wide', name: 'Wide', mm: 24, effect: 'Environment & Character', distortion: -0.4, description: 'Context, action' },
    { id: 'normal', name: 'Normal', mm: 50, effect: 'How We See', distortion: 0, description: 'Natural, honest' },
    { id: 'portrait', name: 'Portrait', mm: 85, effect: 'Flattering', distortion: 0.3, description: 'Subject isolation' },
    { id: 'macro', name: 'Macro', mm: 100, effect: 'Micro World', distortion: 0, description: 'Extreme detail' },
    { id: 'telephoto', name: 'Telephoto', mm: 135, effect: 'Distant & Compressed', distortion: 0.6, description: 'Flattened depth' },
];

// Aperture - affects depth of field
export interface ApertureStop extends Preset {
    value: number;
    dof: string;
    light: string;
}

export const APERTURE_STOPS: ApertureStop[] = [
    { id: 'f1.2', name: 'f/1.2', value: 1.2, dof: 'Razor thin', light: 'Most light', description: 'Dreamy bokeh' },
    { id: 'f1.4', name: 'f/1.4', value: 1.4, dof: 'Very shallow', light: 'Very bright', description: 'Creamy blur' },
    { id: 'f2', name: 'f/2', value: 2.0, dof: 'Shallow', light: 'Bright', description: 'Subject isolation' },
    { id: 'f2.8', name: 'f/2.8', value: 2.8, dof: 'Portrait', light: 'Good', description: 'Standard portrait' },
    { id: 'f4', name: 'f/4', value: 4.0, dof: 'Moderate', light: 'Medium', description: 'Context visible' },
    { id: 'f5.6', name: 'f/5.6', value: 5.6, dof: 'Deep', light: 'Less', description: 'Group sharp' },
    { id: 'f8', name: 'f/8', value: 8.0, dof: 'Very deep', light: 'Low', description: 'Landscape sharp' },
    { id: 'f11', name: 'f/11', value: 11, dof: 'Everything sharp', light: 'Very low', description: 'Max sharpness' },
];

// Shutter Speed - affects motion blur
export interface ShutterSpeed extends Preset {
    fraction: string;
    seconds: number;
    motion: string;
}

export const SHUTTER_SPEEDS: ShutterSpeed[] = [
    { id: '1/1000', name: '1/1000', fraction: '1/1000', seconds: 0.001, motion: 'Frozen', description: 'Action freeze' },
    { id: '1/500', name: '1/500', fraction: '1/500', seconds: 0.002, motion: 'Sharp', description: 'Sports' },
    { id: '1/250', name: '1/250', fraction: '1/250', seconds: 0.004, motion: 'Crisp', description: 'General action' },
    { id: '1/125', name: '1/125', fraction: '1/125', seconds: 0.008, motion: 'Normal', description: 'Handheld' },
    { id: '1/60', name: '1/60', fraction: '1/60', seconds: 0.016, motion: 'Slight blur', description: 'Tripod' },
    { id: '1/30', name: '1/30', fraction: '1/30', seconds: 0.033, motion: 'Motion blur', description: 'Panning' },
    { id: '1/15', name: '1/15', fraction: '1/15', seconds: 0.066, motion: 'Streaking', description: 'Long exposure' },
];

// ISO - affects noise/grain and exposure
export interface IsoValue extends Preset {
    value: number;
    grain: string;
    exposure: string;
}

export const ISO_VALUES: IsoValue[] = [
    { id: 'iso50', name: 'ISO 50', value: 50, grain: 'None', exposure: 'Needs bright light', description: 'Cleanest' },
    { id: 'iso100', name: 'ISO 100', value: 100, grain: 'Minimal', exposure: 'Daylight', description: 'Very clean' },
    { id: 'iso200', name: 'ISO 200', value: 200, grain: 'Fine', exposure: 'Overcast', description: 'Clean' },
    { id: 'iso400', name: 'ISO 400', value: 400, grain: 'Visible', exposure: 'Indoor', description: 'Standard' },
    { id: 'iso800', name: 'ISO 800', value: 800, grain: 'Noticeable', exposure: 'Dim', description: 'Low light' },
    { id: 'iso1600', name: 'ISO 1600', value: 1600, grain: 'Gritty', exposure: 'Dark', description: 'Night' },
    { id: 'iso3200', name: 'ISO 3200', value: 3200, grain: 'Heavy', exposure: 'Very dark', description: 'Extreme low light' },
];

// ============================================================================
// 5. LOOK - Camera body and film stock
// ============================================================================

export interface CameraBody extends Preset {
    brand: string;
    type: 'cinema' | 'mirrorless' | 'dslr' | 'film';
    sensor: string;
    character: string;
}

export const CAMERA_BODIES: CameraBody[] = [
    { id: 'arri', name: 'ARRI Alexa', brand: 'ARRI', type: 'cinema', sensor: 'Large Format', character: 'Organic, natural skin, cinema standard', description: 'Hollywood standard', icon: '🎬' },
    { id: 'red', name: 'RED', brand: 'RED', type: 'cinema', sensor: 'Super 35', character: 'Sharp, punchy contrast, high resolution', description: 'Digital precision', icon: '🔴' },
    { id: 'sony', name: 'Sony Venice', brand: 'Sony', type: 'cinema', sensor: 'Full Frame', character: 'Clean, modern, excellent low light', description: 'Versatile digital', icon: '📷' },
    { id: 'panavision', name: 'Panavision', brand: 'Panavision', type: 'cinema', sensor: 'Large Format', character: 'Warm, classic Hollywood', description: 'Film heritage', icon: '🎥' },
    { id: 'film35', name: '35mm Film', brand: 'Analog', type: 'film', sensor: '35mm', character: 'Organic grain, rich colors', description: 'Classic analog', icon: '🎞️' },
    { id: 'film65', name: '65mm IMAX', brand: 'IMAX', type: 'film', sensor: '65mm', character: 'Epic scale, incredible detail', description: 'Ultimate format', icon: '📽️' },
];

export interface FilmStock extends Preset {
    type: 'color' | 'black-white';
    look: string;
    colors: { highlights: string; midtones: string; shadows: string };
}

export const FILM_STOCKS: FilmStock[] = [
    { id: 'neutral', name: 'Neutral', type: 'color', look: 'Clean digital', description: 'No grade', colors: { highlights: '#ffffff', midtones: '#888888', shadows: '#222222' } },
    { id: 'portra', name: 'Portra 400', type: 'color', look: 'Warm, soft skin', description: 'Portrait film', colors: { highlights: '#fff5e6', midtones: '#e6cba8', shadows: '#2e2620' } },
    { id: 'cinestill', name: 'Cinestill 800T', type: 'color', look: 'Cool, neon glow', description: 'Night city', colors: { highlights: '#e6f5ff', midtones: '#a8cbe6', shadows: '#1a2633' } },
    { id: 'velvia', name: 'Velvia 50', type: 'color', look: 'Vivid, saturated', description: 'Landscape', colors: { highlights: '#ffe6f0', midtones: '#e6a8c0', shadows: '#331a26' } },
    { id: 'gold', name: 'Gold 200', type: 'color', look: 'Warm, golden', description: 'Nostalgic', colors: { highlights: '#fffacd', midtones: '#daa520', shadows: '#4b3621' } },
    { id: 'trix', name: 'Tri-X 400', type: 'black-white', look: 'High contrast B&W', description: 'Street', colors: { highlights: '#ffffff', midtones: '#555555', shadows: '#000000' } },
];

// ============================================================================
// PREVIEW
// ============================================================================

export const PREVIEW_IMAGES = {
    default: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&h=600&fit=crop',
};
