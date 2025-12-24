import { useMemo } from 'react';
import type {
    HorizontalPosition,
    VerticalPosition,
    LensType,
    FilmStock,
    ApertureStop,
    IsoValue,
    CameraBody,
} from '../../lib/photography-presets';

interface LivePreviewProps {
    horizontalPos?: HorizontalPosition;
    verticalPos?: VerticalPosition;
    framingScale: number;
    lens?: LensType;
    filmStock?: FilmStock;
    aperture?: ApertureStop;
    iso?: IsoValue;
    camera?: CameraBody;
    roll?: number;
}

// ============================================================================
// SOLID GEOMETRY HELPERS
// ============================================================================

// Simple 2D Plane (Cardboard Cutout style)
const Plane = ({ width, height, x, y, z, color, backColor, blur = 0 }: { width: number, height: number, x: number, y: number, z: number, color: string, backColor?: string, blur?: number }) => {
    return (
        <div
            className="absolute"
            style={{
                width, height,
                transform: `translate3d(${x}px, ${y}px, ${z}px)`,
                transformStyle: 'preserve-3d',
                filter: blur > 0 ? `blur(${blur}px)` : 'none',
                transition: 'filter 0.3s ease-out'
            }}
        >
            {/* Front Face */}
            <div
                className="absolute inset-0"
                style={{
                    backgroundColor: color,
                    backfaceVisibility: 'hidden',
                    border: '1px solid rgba(0,0,0,0.1)'
                }}
            />
            {/* Back Face */}
            <div
                className="absolute inset-0"
                style={{
                    backgroundColor: backColor || color,
                    transform: 'rotateY(180deg)',
                    backfaceVisibility: 'hidden',
                    border: '1px solid rgba(0,0,0,0.1)'
                }}
            />
        </div>
    );
};

// ============================================================================
// SPHERICAL TRANSFORM LOGIC
// ============================================================================

const SPIN_Y: Record<string, number> = {
    'front': 0,
    'perspective': 35,
    'profile': 90,
    'ots': 135,
    'behind': 180,
};

// TILT_X: 
// Overhead/High: Pure rotation (Negative = Top Forward = Looking Down)
// Low/Worm: Translation DOWN + Reduced Rotation (Positive = Top Back = Looking Up)
const TILT_X: Record<string, { deg: number, y: number }> = {
    'overhead': { deg: -60, y: 0 },
    'high': { deg: -30, y: 0 },
    'eye': { deg: 0, y: 0 },
    'low': { deg: 7, y: 30 },        // Slightly increased tilt
    'worm': { deg: 12, y: 45 },      // Reduced from 20/80 to prevent breaking/clipping
};

export function LivePreview({
    horizontalPos,
    verticalPos,
    framingScale,
    lens,
    aperture,
    iso,
    camera,
    filmStock,
    roll = 0,
}: LivePreviewProps) {

    // 1. Horizontal (Inner) - Azimuth
    const spin = SPIN_Y[horizontalPos?.id ?? 'front'] ?? 0;

    // 2. Vertical (Outer) - Elevation & Height Translation
    const { deg: tilt, y: tiltY } = TILT_X[verticalPos?.id ?? 'eye'] ?? TILT_X['eye'];

    // 3. Focal Length & Perspective
    const mm = lens?.mm ?? 50;

    // Perspective (FOV):
    // Wide angle (14mm) = LOW perspective value (creates extreme distortion/depth) e.g., 300px
    // Telephoto (135mm) = HIGH perspective value (flattens depth) e.g., 2000px
    const computedPerspective = Math.max(300, mm * 18);

    // Zoom Compensation:
    // Global Zoom based on Framing Slider (0-100)
    // Increased max zoom for ECU (was * 3.0, now * 5.0) for extreme closeups
    const baseZoom = 0.5 + (framingScale / 100) * 5.0;

    // Combined scale: Adjust baseZoom slightly by lens to keep subject roughly same size
    const zoom = baseZoom * (1 + (Math.log(mm / 50) * 0.2));


    // 4. Aperture / Depth of Field Blur
    const fStop = aperture?.value ?? 5.6;
    // Blur factor: (1 / fStop) scaled. 
    const bgBlur = Math.max(0, (2.8 / fStop) - 0.2) * 2;

    // 5. ISO Exposure (Brightness)
    // ISO 100 = 1.0, ISO 6400 = 1.5 (50% brighter)
    const isoVal = typeof iso?.value === 'number' ? iso.value : 100;
    const exposure = 0.9 + (isoVal / 3200) * 0.4;


    // Film Stock & Camera Body Filters
    const filmFilter = useMemo(() => {
        let filters = [`brightness(${exposure})`];

        if (filmStock) {
            if (filmStock.type === 'black-white' || filmStock.id.includes('bw')) {
                filters.push('grayscale(100%)', 'contrast(120%)');
            } else if (filmStock.id === 'portra') {
                filters.push('sepia(20%)', 'saturate(110%)', 'contrast(95%)');
            } else if (filmStock.id === 'ektar') {
                filters.push('saturate(130%)', 'contrast(110%)');
            } else if (filmStock.id === 'cinestill') {
                filters.push('contrast(105%)', 'hue-rotate(-5deg)'); // Slight cool push
            } else if (filmStock.id === 'fujicolor') {
                filters.push('saturate(105%)', 'hue-rotate(5deg)'); // Slight green/magenta shift
            }
        }

        if (camera) {
            // Simulate "Color Science"
            if (camera.name.includes('Canon')) filters.push('sepia(10%)', 'contrast(105%)'); // Warm skin tones
            if (camera.name.includes('Sony')) filters.push('contrast(110%)', 'hue-rotate(-5deg)'); // Cool/Sharp
            if (camera.name.includes('Nikon')) filters.push('contrast(108%)', 'saturate(105%)'); // Punchy
            if (camera.name.includes('Fujifilm')) filters.push('saturate(115%)'); // Vibrant
            if (camera.name.includes('Leica')) filters.push('contrast(115%)', 'saturate(90%)'); // Artistic/Moody
        }

        return filters.join(' ');
    }, [filmStock, camera, exposure]);

    // Offset to center the puppet
    const MODEL_CENTER_Y = 60;
    const finalY = MODEL_CENTER_Y + tiltY;

    // Orientation Colors
    const FRONT_COLOR = "#E0C890"; // Tan
    const BACK_COLOR = "#60a5fa";  // Blue

    return (
        <div className="relative w-full h-full overflow-hidden bg-sky-300" style={{ filter: filmFilter }}>

            {/* Viewport */}
            <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ perspective: `${computedPerspective}px` }}
            >
                {/* GLOBAL ZOOM */}
                <div
                    className="relative transition-transform duration-500 cubic-bezier(0.2, 0.8, 0.2, 1)"
                    style={{
                        transform: `scale(${zoom})`,
                        transformStyle: 'preserve-3d'
                    }}
                >
                    {/* DUTCH TILT (Roll) */}
                    <div
                        className="relative transition-transform duration-300"
                        style={{
                            transform: `rotateZ(${roll}deg)`,
                            transformStyle: 'preserve-3d'
                        }}
                    >

                        {/* OUTER: VERTICAL TILT */}
                        <div
                            className="relative transition-transform duration-500 cubic-bezier(0.2, 0.8, 0.2, 1)"
                            style={{
                                transformStyle: 'preserve-3d',
                                transform: `rotateX(${tilt}deg)`
                            }}
                        >
                            {/* INNER: HORIZONTAL SPIN */}
                            <div
                                className="relative transition-transform duration-500 cubic-bezier(0.2, 0.8, 0.2, 1)"
                                style={{
                                    transformStyle: 'preserve-3d',
                                    transform: `rotateY(${spin}deg)`
                                }}
                            >
                                {/* === WORLD CONTENT === */}
                                <div className="absolute" style={{ transformStyle: 'preserve-3d', transform: `translateY(${finalY}px)` }}>

                                    {/* GROUND PLANE */}
                                    <div
                                        className="absolute left-[-600px] top-[-600px] w-[1200px] h-[1200px]"
                                        style={{
                                            transform: 'rotateX(90deg) translateZ(0px)',
                                            background: 'radial-gradient(circle at center, #86efac 0%, #22c55e 30%, #15803d 70%)',
                                            borderRadius: '50%',
                                            filter: `blur(${Math.max(0, bgBlur + (verticalPos?.id === 'overhead' ? -2 : 0))}px)`,
                                            transition: 'filter 0.3s ease-out'
                                        }}
                                    />

                                    {/* ENVIRONMENT SCATTER (blurred by aperture) */}
                                    <Plane width={40} height={40} x={-80} y={-20} z={50} color="#15803d" blur={bgBlur * 1.5} />
                                    <Plane width={30} height={50} x={70} y={-25} z={-40} color="#166534" blur={bgBlur * 1.5} />
                                    <Plane width={50} height={20} x={90} y={-10} z={60} color="#64748b" blur={bgBlur * 1.5} />


                                    {/* === 2D FLAT PUPPET (Always Sharp) === */}
                                    <div className="absolute" style={{ transformStyle: 'preserve-3d' }}>

                                        {/* 1. BODY (Big Flat Box) */}
                                        <Plane
                                            width={50} height={70}
                                            x={-25} y={-70} z={0}
                                            color={FRONT_COLOR} backColor={BACK_COLOR}
                                            blur={0}
                                        />

                                        {/* 2. HEAD (Small Flat Box) */}
                                        <Plane
                                            width={25} height={25}
                                            x={-12.5} y={-100} z={0}
                                            color={FRONT_COLOR} backColor={BACK_COLOR}
                                            blur={0}
                                        />

                                        {/* Eyes */}
                                        <div className="absolute" style={{ transform: 'translate3d(0px, -92px, 1px)' }}>
                                            <div className="w-2 h-2 bg-black/80 rounded-full absolute left-[-6px] top-[-2px]" />
                                            <div className="w-2 h-2 bg-black/80 rounded-full absolute right-[-6px] top-[-2px]" />
                                        </div>

                                        {/* Shadow */}
                                        <div
                                            className="absolute w-[60px] h-[60px] bg-black blur-md rounded-full"
                                            style={{
                                                transform: 'rotateX(90deg) translateZ(1px)',
                                                opacity: 0.3,
                                                left: -30,
                                                top: -30
                                            }}
                                        />

                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* OVERLAYS */}
            {lens?.distortion && lens.distortion !== 0 && (
                <div className="absolute inset-0 pointer-events-none" style={{
                    boxShadow: lens.distortion < 0 ? `inset 0 0 ${Math.abs(lens.distortion) * 150}px rgba(0,0,0,0.5)` : 'none',
                    borderRadius: lens.distortion < 0 ? `${Math.abs(lens.distortion) * 30}%` : '0',
                }} />
            )}
            <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[url('/noise.png')] mix-blend-overlay" />
        </div>
    );
}
