import { useMemo } from 'react';
import { PREVIEW_IMAGES } from '../../lib/photography-presets';
import type {
    HorizontalPosition,
    VerticalPosition,
    LensType,
    ApertureStop,
    IsoValue,
    CameraBody,
    FilmStock,
} from '../../lib/photography-presets';

interface LivePreviewProps {
    horizontalPos?: HorizontalPosition;
    verticalPos?: VerticalPosition;
    framingScale: number;
    lens?: LensType;
    aperture?: ApertureStop;
    iso?: IsoValue;
    camera?: CameraBody;
    filmStock?: FilmStock;
}

export function LivePreview({
    horizontalPos,
    verticalPos,
    framingScale,
    lens,
    aperture,
    iso,
    camera,
    filmStock,
}: LivePreviewProps) {

    const previewUrl = PREVIEW_IMAGES.default;

    // Zoom based on framing
    const scale = 1 + (framingScale / 100) * 1.5;

    // Horizontal position affects X transform
    const translateX = useMemo(() => {
        if (!horizontalPos) return 0;
        const xMap: Record<string, number> = {
            'front': 0,
            'perspective': 5,
            'profile': 10,
            'ots': 15,
            'behind': 20,
        };
        return xMap[horizontalPos.id] || 0;
    }, [horizontalPos]);

    // Vertical position affects Y transform + rotation
    const { translateY, rotateX } = useMemo(() => {
        if (!verticalPos) return { translateY: 0, rotateX: 0 };
        const angle = verticalPos.angle;
        return {
            translateY: -angle * 0.15,
            rotateX: angle * 0.08,
        };
    }, [verticalPos]);

    // Lens distortion effect (barrel for wide, pincushion for tele)
    // distortion: -1 to 1 where negative = barrel, positive = pincushion
    const lensDistortion = lens?.distortion ?? 0;

    // Film stock filter
    const filters = useMemo(() => {
        const parts: string[] = ['contrast(1.05)'];

        if (camera?.id === 'red') parts.push('contrast(1.12)', 'saturate(1.1)');
        if (camera?.id === 'film35' || camera?.id === 'film65') parts.push('sepia(0.08)');

        if (filmStock) {
            if (filmStock.type === 'black-white') {
                parts.push('saturate(0)', 'contrast(1.2)');
            } else if (filmStock.id === 'portra') {
                parts.push('sepia(0.06)', 'saturate(0.95)');
            } else if (filmStock.id === 'cinestill') {
                parts.push('hue-rotate(-8deg)', 'saturate(0.9)');
            } else if (filmStock.id === 'velvia') {
                parts.push('saturate(1.3)', 'contrast(1.1)');
            } else if (filmStock.id === 'gold') {
                parts.push('sepia(0.15)', 'saturate(1.1)');
            }
        }
        return parts.join(' ');
    }, [filmStock, camera]);

    // ISO grain overlay opacity
    const grainOpacity = iso ? Math.min((iso.value - 100) / 3000, 0.3) : 0;

    return (
        <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-slate-900 to-black">
            {/* Lens distortion container */}
            <div
                className="absolute inset-0 transition-all duration-500 ease-out"
                style={{
                    // Barrel/pincushion distortion simulation using border-radius and scale
                    borderRadius: lensDistortion < 0 ? `${Math.abs(lensDistortion) * 30}%` : '0',
                    transform: `scale(${1 + Math.abs(lensDistortion) * 0.1})`,
                    overflow: 'hidden',
                }}
            >
                {/* Main transformed image */}
                <div
                    className="absolute inset-0 transition-all duration-500 ease-out"
                    style={{
                        transform: `
                            scale(${scale})
                            translateX(${translateX}%)
                            translateY(${translateY}%)
                            perspective(1000px)
                            rotateX(${rotateX}deg)
                        `,
                        transformOrigin: 'center center',
                    }}
                >
                    <img
                        src={previewUrl}
                        alt="Preview"
                        className="h-full w-full object-cover transition-all duration-300"
                        style={{ filter: filters }}
                    />
                </div>
            </div>

            {/* Barrel distortion edge darkening (for wide lenses) */}
            {lensDistortion < -0.3 && (
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: `radial-gradient(ellipse 100% 100% at center, transparent 50%, rgba(0,0,0,${Math.abs(lensDistortion) * 0.4}) 100%)`,
                    }}
                />
            )}

            {/* Telephoto compression effect (shallow plane) */}
            {lensDistortion > 0.3 && (
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: `linear-gradient(to bottom, rgba(0,0,0,0) 40%, rgba(0,0,0,${lensDistortion * 0.2}) 100%)`,
                    }}
                />
            )}

            {/* DOF blur effect */}
            {aperture && aperture.value <= 2.0 && (
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: 'radial-gradient(ellipse 50% 50% at center, transparent 30%, rgba(0,0,0,0.3) 100%)',
                    }}
                />
            )}

            {/* Grain overlay */}
            {grainOpacity > 0 && (
                <div
                    className="absolute inset-0 pointer-events-none mix-blend-overlay"
                    style={{
                        opacity: grainOpacity,
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
                    }}
                />
            )}

            {/* Vignette */}
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.6)]" />

            {/* Lens info overlay */}
            {lens && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="text-center text-white/20 text-xs font-mono">
                        {lens.effect}
                    </div>
                </div>
            )}
        </div>
    );
}
