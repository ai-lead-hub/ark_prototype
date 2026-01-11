
import React, { useState } from "react";

type CameraMovement = {
    id: string;
    label: string;
    description: string;
    promptText: string;
    icon: React.ReactNode;
    animationClass: string;
};

const MOVEMENTS: CameraMovement[] = [
    // === ROTATIONAL MOVEMENTS (Camera stays in place, rotates) ===
    {
        id: "pan_left",
        label: "Pan Left",
        description: "Camera turns left on a fixed axis",
        promptText: "Camera pans smoothly to the left",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5" />
                <path d="M5 12L9 16" />
                <path d="M5 12L9 8" />
                <rect x="2" y="4" width="20" height="16" rx="2" strokeOpacity="0.2" />
            </svg>
        ),
        animationClass: "group-hover:translate-x-[-10px] transition-transform duration-700",
    },
    {
        id: "pan_right",
        label: "Pan Right",
        description: "Camera turns right on a fixed axis",
        promptText: "Camera pans smoothly to the right",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12H19" />
                <path d="M19 12L15 16" />
                <path d="M19 12L15 8" />
                <rect x="2" y="4" width="20" height="16" rx="2" strokeOpacity="0.2" />
            </svg>
        ),
        animationClass: "group-hover:translate-x-[10px] transition-transform duration-700",
    },
    {
        id: "tilt_up",
        label: "Tilt Up",
        description: "Camera angles upwards",
        promptText: "Camera tilts upward",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19V5" />
                <path d="M12 5L8 9" />
                <path d="M12 5L16 9" />
                <rect x="4" y="2" width="16" height="20" rx="2" strokeOpacity="0.2" />
            </svg>
        ),
        animationClass: "group-hover:translate-y-[-10px] transition-transform duration-700",
    },
    {
        id: "tilt_down",
        label: "Tilt Down",
        description: "Camera angles downwards",
        promptText: "Camera tilts downward",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14" />
                <path d="M12 19l-4-4" />
                <path d="M12 19l4-4" />
                <rect x="4" y="2" width="16" height="20" rx="2" strokeOpacity="0.2" />
            </svg>
        ),
        animationClass: "group-hover:translate-y-[10px] transition-transform duration-700",
    },
    {
        id: "roll_cw",
        label: "Roll CW",
        description: "Camera rotates clockwise on its axis",
        promptText: "Camera rolls clockwise",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                <path d="M12 2v4" />
                <path d="M12 18v4" />
                <path d="M2 12h4" />
                <path d="M18 12h4" />
                <path d="M16 16l3 3" />
            </svg>
        ),
        animationClass: "group-hover:rotate-45 transition-transform duration-1000",
    },
    {
        id: "roll_ccw",
        label: "Roll CCW",
        description: "Camera rotates counter-clockwise on its axis",
        promptText: "Camera rolls counter-clockwise",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                <path d="M12 2v4" />
                <path d="M12 18v4" />
                <path d="M2 12h4" />
                <path d="M18 12h4" />
                <path d="M8 16l-3 3" />
            </svg>
        ),
        animationClass: "group-hover:rotate-[-45deg] transition-transform duration-1000",
    },

    // === LATERAL MOVEMENTS (Camera moves sideways) ===
    {
        id: "truck_left",
        label: "Truck Left",
        description: "Camera physically moves left",
        promptText: "Camera trucks left, moving parallel to the scene",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="8" width="20" height="10" rx="2" />
                <circle cx="6" cy="20" r="2" />
                <circle cx="18" cy="20" r="2" />
                <path d="M19 13H5" />
                <path d="M5 13L9 17" />
                <path d="M5 13L9 9" />
            </svg>
        ),
        animationClass: "group-hover:translate-x-[-15px] transition-transform duration-1000 ease-linear",
    },
    {
        id: "truck_right",
        label: "Truck Right",
        description: "Camera physically moves right",
        promptText: "Camera trucks right, moving parallel to the scene",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="8" width="20" height="10" rx="2" />
                <circle cx="6" cy="20" r="2" />
                <circle cx="18" cy="20" r="2" />
                <path d="M5 13h14" />
                <path d="M19 13l-4 4" />
                <path d="M19 13l-4-4" />
            </svg>
        ),
        animationClass: "group-hover:translate-x-[15px] transition-transform duration-1000 ease-linear",
    },

    // === VERTICAL MOVEMENTS (Camera moves up/down) ===
    {
        id: "pedestal_up",
        label: "Pedestal Up",
        description: "Camera physically moves up",
        promptText: "Camera pedestals up, rising vertically",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="6" y="6" width="12" height="8" rx="2" />
                <path d="M12 14v6" />
                <path d="M8 22h8" />
                <path d="M12 10V2" />
                <path d="M9 5l3-3 3 3" />
            </svg>
        ),
        animationClass: "group-hover:translate-y-[-15px] transition-transform duration-1000 ease-linear",
    },
    {
        id: "pedestal_down",
        label: "Pedestal Down",
        description: "Camera physically moves down",
        promptText: "Camera pedestals down, lowering vertically",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="6" y="6" width="12" height="8" rx="2" />
                <path d="M12 14v6" />
                <path d="M8 22h8" />
                <path d="M12 2v6" />
                <path d="M9 19l3 3 3-3" />
            </svg>
        ),
        animationClass: "group-hover:translate-y-[15px] transition-transform duration-1000 ease-linear",
    },
    {
        id: "crane_up",
        label: "Crane Up",
        description: "Camera rises on a crane/jib arm",
        promptText: "Crane shot rising upward, revealing the scene from above",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 20l8-8" />
                <rect x="10" y="4" width="10" height="8" rx="2" />
                <path d="M15 8V2" />
                <path d="M12 5l3-3 3 3" />
            </svg>
        ),
        animationClass: "group-hover:translate-y-[-12px] group-hover:translate-x-[8px] transition-transform duration-1000",
    },
    {
        id: "crane_down",
        label: "Crane Down",
        description: "Camera lowers on a crane/jib arm",
        promptText: "Crane shot descending downward, lowering into the scene",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4l8 8" />
                <rect x="10" y="12" width="10" height="8" rx="2" />
                <path d="M15 16v6" />
                <path d="M12 19l3 3 3-3" />
            </svg>
        ),
        animationClass: "group-hover:translate-y-[12px] group-hover:translate-x-[8px] transition-transform duration-1000",
    },

    // === DEPTH MOVEMENTS (Camera moves toward/away from subject) ===
    {
        id: "dolly_in",
        label: "Dolly In",
        description: "Camera moves toward the subject",
        promptText: "Camera dollies in toward the subject",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="8" width="10" height="8" rx="2" />
                <circle cx="5" cy="18" r="2" />
                <circle cx="9" cy="18" r="2" />
                <path d="M14 12h8" />
                <path d="M18 8l4 4-4 4" />
            </svg>
        ),
        animationClass: "group-hover:scale-110 group-hover:translate-x-[5px] transition-transform duration-1000",
    },
    {
        id: "dolly_out",
        label: "Dolly Out",
        description: "Camera moves away from the subject",
        promptText: "Camera dollies out away from the subject",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="12" y="8" width="10" height="8" rx="2" />
                <circle cx="15" cy="18" r="2" />
                <circle cx="19" cy="18" r="2" />
                <path d="M10 12H2" />
                <path d="M6 8l-4 4 4 4" />
            </svg>
        ),
        animationClass: "group-hover:scale-90 group-hover:translate-x-[-5px] transition-transform duration-1000",
    },
    {
        id: "zoom_in",
        label: "Zoom In",
        description: "Lens focal length increases (no camera movement)",
        promptText: "Camera zooms in optically",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
        ),
        animationClass: "group-hover:scale-125 transition-transform duration-700",
    },
    {
        id: "zoom_out",
        label: "Zoom Out",
        description: "Lens focal length decreases (no camera movement)",
        promptText: "Camera zooms out optically",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
        ),
        animationClass: "group-hover:scale-75 transition-transform duration-700",
    },

    // === ORBITAL MOVEMENTS (Camera circles around subject) ===
    {
        id: "orbit_left",
        label: "Orbit Left",
        description: "Camera circles around the subject to the left",
        promptText: "Camera orbits left around the subject",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <ellipse cx="12" cy="12" rx="10" ry="4" strokeOpacity="0.3" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
                <path d="M4 10l-2 2 2 2" />
            </svg>
        ),
        animationClass: "group-hover:rotate-[-15deg] transition-transform duration-1000",
    },
    {
        id: "orbit_right",
        label: "Orbit Right",
        description: "Camera circles around the subject to the right",
        promptText: "Camera orbits right around the subject",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <ellipse cx="12" cy="12" rx="10" ry="4" strokeOpacity="0.3" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
                <path d="M20 10l2 2-2 2" />
            </svg>
        ),
        animationClass: "group-hover:rotate-[15deg] transition-transform duration-1000",
    },
    {
        id: "orbit_up",
        label: "Orbit Up",
        description: "Camera arcs upward around the subject",
        promptText: "Camera orbits upward around the subject, rising in an arc",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <ellipse cx="12" cy="12" rx="4" ry="10" strokeOpacity="0.3" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
                <path d="M10 4l2-2 2 2" />
            </svg>
        ),
        animationClass: "group-hover:translate-y-[-8px] transition-transform duration-1000",
    },
    {
        id: "orbit_down",
        label: "Orbit Down",
        description: "Camera arcs downward around the subject",
        promptText: "Camera orbits downward around the subject, descending in an arc",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <ellipse cx="12" cy="12" rx="4" ry="10" strokeOpacity="0.3" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
                <path d="M10 20l2 2 2-2" />
            </svg>
        ),
        animationClass: "group-hover:translate-y-[8px] transition-transform duration-1000",
    },

    // === SPECIAL MOVEMENTS ===
    {
        id: "dolly_zoom_in",
        label: "Dolly Zoom In",
        description: "Vertigo effect: Camera moves in while zooming out",
        promptText: "Dolly zoom (vertigo effect), camera moves forward while zooming out, creating an unsettling perspective shift",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20" />
                <path d="M9 5l3-3 3 3" />
                <path d="M6 12h12" strokeOpacity="0.5" strokeDasharray="2 2" />
                <path d="M8 8l-2-2" />
                <path d="M16 8l2-2" />
                <path d="M8 16l-2 2" />
                <path d="M16 16l2 2" />
            </svg>
        ),
        animationClass: "group-hover:scale-110 transition-transform duration-1000",
    },
    {
        id: "dolly_zoom_out",
        label: "Dolly Zoom Out",
        description: "Reverse vertigo: Camera moves back while zooming in",
        promptText: "Reverse dolly zoom, camera moves backward while zooming in, creating a compression effect",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20" />
                <path d="M9 19l3 3 3-3" />
                <path d="M6 12h12" strokeOpacity="0.5" strokeDasharray="2 2" />
                <path d="M6 6l2 2" />
                <path d="M18 6l-2 2" />
                <path d="M6 18l2-2" />
                <path d="M18 18l-2-2" />
            </svg>
        ),
        animationClass: "group-hover:scale-90 transition-transform duration-1000",
    },
    {
        id: "static",
        label: "Static",
        description: "Camera does not move",
        promptText: "Static camera, locked off with no movement",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="6" width="16" height="12" rx="2" />
                <path d="M12 18v4" />
                <path d="M8 22h8" />
                <circle cx="12" cy="12" r="3" strokeOpacity="0.5" />
            </svg>
        ),
        animationClass: "",
    },
];

interface CameraMovementSelectorProps {
    onSelect: (promptText: string) => void;
    onClose: () => void;
}

export function CameraMovementSelector({ onSelect, onClose }: CameraMovementSelectorProps) {
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    return (
        <div className="w-[400px] overflow-hidden rounded-xl border border-white/10 bg-[#121212] shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-3 py-2">
                <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z" /><rect width="14" height="12" x="2" y="6" rx="2" ry="2" /></svg>
                    </div>
                    <div>
                        <h3 className="text-xs font-semibold text-white">Camera Movements</h3>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-4 gap-1 p-2 max-h-[180px] overflow-y-auto custom-scrollbar">
                {MOVEMENTS.map((move) => (
                    <button
                        key={move.id}
                        onClick={() => {
                            onSelect(move.promptText);
                        }}
                        onMouseEnter={() => setHoveredId(move.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        className="group relative flex flex-col items-center justify-center gap-1 rounded-lg border border-white/5 bg-white/5 p-2 transition-all hover:border-indigo-500/50 hover:bg-white/10 hover:shadow-lg hover:shadow-indigo-500/10 active:scale-95 text-center"
                    >
                        {/* Preview Container */}
                        <div className="relative flex h-10 w-10 items-center justify-center rounded-md bg-black/40 overflow-hidden">
                            <div className={`text-slate-200 scale-75 transition-transform duration-500 ${move.animationClass}`}>
                                {move.icon}
                            </div>

                            {/* Grid overlay for motion reference */}
                            <div className="absolute inset-0 pointer-events-none opacity-20"
                                style={{
                                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                                    backgroundSize: '8px 8px'
                                }}
                            />
                        </div>

                        {/* Text */}
                        <div className="text-[9px] font-semibold text-slate-200 group-hover:text-indigo-300 truncate w-full">
                            {move.label}
                        </div>
                    </button>
                ))}
            </div>

            {/* Info Footer */}
            {hoveredId ? (
                <div className="border-t border-white/5 bg-black/20 px-3 py-2 text-center text-[10px] text-slate-400">
                    {MOVEMENTS.find(m => m.id === hoveredId)?.description}
                </div>
            ) : (
                <div className="border-t border-white/5 bg-black/20 px-3 py-2 text-center text-[10px] text-slate-500 italic">
                    Select a movement to alter prompt
                </div>
            )}
        </div>
    );
}
