import { useCallback, useEffect, useRef, useState } from "react";

interface VideoPlayerProps {
    videoUrl: string;
    videoName: string;
    onSave: (blob: Blob, filename: string) => Promise<void>;
    onClose: () => void;
    onPrevious?: () => void;
    onNext?: () => void;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;
const FRAME_RATE = 30; // Assumed frame rate for frame stepping

export default function VideoPlayer({
    videoUrl,
    videoName,
    onSave,
    onClose,
    onPrevious,
    onNext,
}: VideoPlayerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const timelineRef = useRef<HTMLDivElement>(null);

    const [zoom, setZoom] = useState(1);
    const [initialZoomSet, setInitialZoomSet] = useState(false);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isSeeking, setIsSeeking] = useState(false);
    const [hoverTime, setHoverTime] = useState<number | null>(null);

    const [status, setStatus] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Handle video metadata loaded
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleLoadedMetadata = () => {
            setDuration(video.duration);
        };

        const handleTimeUpdate = () => {
            if (!isSeeking) {
                setCurrentTime(video.currentTime);
            }
        };

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleEnded = () => setIsPlaying(false);

        video.addEventListener("loadedmetadata", handleLoadedMetadata);
        video.addEventListener("timeupdate", handleTimeUpdate);
        video.addEventListener("play", handlePlay);
        video.addEventListener("pause", handlePause);
        video.addEventListener("ended", handleEnded);

        // If already loaded
        if (video.readyState >= 1 && video.duration) {
            setDuration(video.duration);
        }

        return () => {
            video.removeEventListener("loadedmetadata", handleLoadedMetadata);
            video.removeEventListener("timeupdate", handleTimeUpdate);
            video.removeEventListener("play", handlePlay);
            video.removeEventListener("pause", handlePause);
            video.removeEventListener("ended", handleEnded);
        };
    }, [isSeeking]);

    // Calculate fit-to-screen zoom when video dimensions are available
    useEffect(() => {
        if (initialZoomSet) return;
        const video = videoRef.current;
        const container = containerRef.current;
        if (!video || !container) return;

        const handleCanPlay = () => {
            const containerW = container.clientWidth;
            const containerH = container.clientHeight - 120; // Account for controls
            const videoW = video.videoWidth;
            const videoH = video.videoHeight;

            if (videoW && videoH && containerW && containerH) {
                const scaleX = containerW / videoW;
                const scaleY = containerH / videoH;
                const fitZoom = Math.min(scaleX, scaleY, 1) * 0.9; // 90% of fit for padding
                setZoom(fitZoom);
                setInitialZoomSet(true);
            }
        };

        video.addEventListener("canplay", handleCanPlay);
        // In case already loaded
        if (video.readyState >= 3) {
            handleCanPlay();
        }

        return () => video.removeEventListener("canplay", handleCanPlay);
    }, [initialZoomSet]);

    // Use a ref to track the target seek time for smoother scrubbing
    const seekTargetRef = useRef<number | null>(null);
    const rafIdRef = useRef<number | null>(null);

    // Global mouse tracking for live scrubbing
    useEffect(() => {
        if (!isSeeking) return;

        const performSeek = () => {
            const video = videoRef.current;
            if (video && seekTargetRef.current !== null) {
                const targetTime = seekTargetRef.current;
                // Use fastSeek if available (faster but less accurate), otherwise use currentTime
                if ('fastSeek' in video && typeof video.fastSeek === 'function') {
                    video.fastSeek(targetTime);
                } else {
                    video.currentTime = targetTime;
                }
                seekTargetRef.current = null;
            }
            rafIdRef.current = null;
        };

        const handleGlobalMouseMove = (e: MouseEvent) => {
            const timeline = timelineRef.current;
            if (!timeline || duration === 0) return;

            const rect = timeline.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percent = Math.max(0, Math.min(1, x / rect.width));
            const newTime = percent * duration;

            // Update UI immediately
            setCurrentTime(newTime);
            setHoverTime(newTime);

            // Queue seek operation
            seekTargetRef.current = newTime;
            if (!rafIdRef.current) {
                rafIdRef.current = requestAnimationFrame(performSeek);
            }
        };

        const handleGlobalMouseUp = () => {
            // Final seek to exact position
            if (seekTargetRef.current !== null && videoRef.current) {
                videoRef.current.currentTime = seekTargetRef.current;
            }
            setIsSeeking(false);
        };

        window.addEventListener("mousemove", handleGlobalMouseMove);
        window.addEventListener("mouseup", handleGlobalMouseUp);

        return () => {
            window.removeEventListener("mousemove", handleGlobalMouseMove);
            window.removeEventListener("mouseup", handleGlobalMouseUp);
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
            }
        };
    }, [isSeeking, duration]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            } else if (e.code === "Space") {
                e.preventDefault();
                togglePlay();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                stepFrame(-1);
            } else if (e.key === "ArrowRight") {
                e.preventDefault();
                stepFrame(1);
            } else if (e.key === "ArrowUp" && onPrevious) {
                e.preventDefault();
                onPrevious();
            } else if (e.key === "ArrowDown" && onNext) {
                e.preventDefault();
                onNext();
            } else if ((e.metaKey || e.ctrlKey) && e.key === "0") {
                e.preventDefault();
                resetZoom();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, onPrevious, onNext]);

    // Zoom handler
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setZoom((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)));
    }, []);

    // Pan handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        setIsPanning(true);
        setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }, [panOffset]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isPanning) return;
        setPanOffset({
            x: e.clientX - panStart.x,
            y: e.clientY - panStart.y,
        });
    }, [isPanning, panStart]);

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    // Reset zoom to fit
    const resetZoom = useCallback(() => {
        const video = videoRef.current;
        const container = containerRef.current;
        if (video && container) {
            const containerW = container.clientWidth;
            const containerH = container.clientHeight - 120;
            const videoW = video.videoWidth;
            const videoH = video.videoHeight;

            if (videoW && videoH) {
                const scaleX = containerW / videoW;
                const scaleY = containerH / videoH;
                const fitZoom = Math.min(scaleX, scaleY, 1) * 0.9;
                setZoom(fitZoom);
            } else {
                setZoom(1);
            }
        } else {
            setZoom(1);
        }
        setPanOffset({ x: 0, y: 0 });
    }, []);

    // Playback controls
    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    }, []);

    const stepFrame = useCallback((direction: number) => {
        const video = videoRef.current;
        if (!video) return;
        video.pause();
        const frameTime = 1 / FRAME_RATE;
        const newTime = Math.max(0, Math.min(duration, video.currentTime + direction * frameTime));
        video.currentTime = newTime;
        setCurrentTime(newTime);
    }, [duration]);

    const changePlaybackRate = useCallback(() => {
        const rates = [0.5, 1, 1.5, 2];
        const currentIndex = rates.indexOf(playbackRate);
        const nextRate = rates[(currentIndex + 1) % rates.length];
        setPlaybackRate(nextRate);
        if (videoRef.current) {
            videoRef.current.playbackRate = nextRate;
        }
    }, [playbackRate]);

    // Timeline seeking
    const handleTimelineClick = useCallback((e: React.MouseEvent) => {
        const timeline = timelineRef.current;
        const video = videoRef.current;
        if (!timeline || !video || duration === 0) return;

        const rect = timeline.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = Math.max(0, Math.min(1, x / rect.width));
        const newTime = percent * duration;
        video.currentTime = newTime;
        setCurrentTime(newTime);
    }, [duration]);

    const handleTimelineMouseDown = useCallback((e: React.MouseEvent) => {
        setIsSeeking(true);
        handleTimelineClick(e);
    }, [handleTimelineClick]);

    const handleTimelineMouseMove = useCallback((e: React.MouseEvent) => {
        const timeline = timelineRef.current;
        if (!timeline || duration === 0) return;

        const rect = timeline.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = Math.max(0, Math.min(1, x / rect.width));
        setHoverTime(percent * duration);

        if (isSeeking && videoRef.current) {
            const newTime = percent * duration;
            videoRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    }, [duration, isSeeking]);

    const handleTimelineMouseUp = useCallback(() => {
        setIsSeeking(false);
    }, []);

    const handleTimelineMouseLeave = useCallback(() => {
        setHoverTime(null);
        setIsSeeking(false);
    }, []);

    // Frame extraction
    const extractFrame = useCallback(async () => {
        const video = videoRef.current;
        if (!video) {
            setStatus("Video not ready");
            return;
        }

        setSaving(true);
        setStatus("Extracting frame...");

        try {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Could not get canvas context");

            ctx.drawImage(video, 0, 0);

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to create blob"))), "image/png");
            });

            const baseName = videoName.replace(/\.[^.]+$/, "");
            const frameTime = currentTime.toFixed(2).replace(".", "_");
            const filename = `${baseName}_frame_${frameTime}s.png`;

            await onSave(blob, filename);
            setStatus("Frame saved!");
        } catch (err) {
            setStatus(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
            setSaving(false);
            setTimeout(() => setStatus(null), 3000);
        }
    }, [videoName, currentTime, onSave]);

    // Format time as MM:SS.ms
    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        const ms = Math.floor((time % 1) * 100);
        return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
    };

    // Generate frame markers for timeline
    const generateFrameMarkers = () => {
        if (duration === 0) return [];
        const markers: number[] = [];
        // Major markers every second
        for (let t = 0; t <= duration; t += 1) {
            markers.push(t);
        }
        return markers;
    };

    const frameMarkers = generateFrameMarkers();

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-50 flex flex-col bg-slate-950"
        >
            {/* Video area */}
            <div
                className="flex-1 relative overflow-hidden cursor-grab"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ cursor: isPanning ? "grabbing" : "grab" }}
            >
                <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                        transformOrigin: "center center",
                    }}
                >
                    <video
                        ref={videoRef}
                        src={videoUrl}
                        className="max-w-none"
                        crossOrigin="anonymous"
                        preload="metadata"
                        playsInline
                        onClick={togglePlay}
                    />
                </div>

                {/* Zoom indicator */}
                <div className="absolute top-4 left-4 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                    {Math.round(zoom * 100)}%
                </div>

                {/* Status */}
                {status && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-lg bg-black/80 px-4 py-2 text-sm text-white backdrop-blur-sm">
                        {status}
                    </div>
                )}

                {/* Play overlay when paused */}
                {!isPlaying && (
                    <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                        <div className="w-20 h-20 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                                <polygon points="5,3 19,12 5,21" />
                            </svg>
                        </div>
                    </div>
                )}
            </div>

            {/* Timeline and controls */}
            <div className="bg-black/90 border-t border-white/10 p-3">
                {/* Timeline */}
                <div
                    ref={timelineRef}
                    className="relative h-12 bg-slate-800 rounded-lg cursor-pointer mb-3 overflow-hidden"
                    onMouseDown={handleTimelineMouseDown}
                    onMouseMove={handleTimelineMouseMove}
                    onMouseUp={handleTimelineMouseUp}
                    onMouseLeave={handleTimelineMouseLeave}
                >
                    {/* Frame markers */}
                    <div className="absolute inset-0">
                        {frameMarkers.map((time) => (
                            <div
                                key={time}
                                className="absolute top-0 h-full border-l border-white/20"
                                style={{ left: `${(time / duration) * 100}%` }}
                            >
                                <span className="absolute top-1 left-1 text-[9px] text-white/40">
                                    {Math.floor(time)}s
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Progress bar */}
                    <div
                        className="absolute top-0 left-0 h-full bg-sky-500/30"
                        style={{ width: `${(currentTime / duration) * 100}%` }}
                    />

                    {/* Playhead */}
                    <div
                        className="absolute top-0 h-full w-0.5 bg-sky-400 shadow-lg shadow-sky-400/50"
                        style={{ left: `${(currentTime / duration) * 100}%` }}
                    >
                        <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-sky-400 rotate-45" />
                        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-sky-300 whitespace-nowrap font-mono bg-slate-900 px-1 rounded">
                            {formatTime(currentTime)}
                        </div>
                    </div>

                    {/* Hover time indicator */}
                    {hoverTime !== null && (
                        <div
                            className="absolute top-0 h-full w-0.5 bg-white/30"
                            style={{ left: `${(hoverTime / duration) * 100}%` }}
                        >
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-white/70 whitespace-nowrap font-mono bg-slate-800 px-1 rounded">
                                {formatTime(hoverTime)}
                            </div>
                        </div>
                    )}
                </div>

                {/* Controls bar */}
                <div className="flex items-center justify-between gap-4">
                    {/* Left controls */}
                    <div className="flex items-center gap-2">
                        {/* Play/Pause */}
                        <button
                            onClick={togglePlay}
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition"
                            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                        >
                            {isPlaying ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="6" y="4" width="4" height="16" />
                                    <rect x="14" y="4" width="4" height="16" />
                                </svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <polygon points="5,3 19,12 5,21" />
                                </svg>
                            )}
                        </button>

                        {/* Frame backward */}
                        <button
                            onClick={() => stepFrame(-1)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition"
                            title="Previous frame (←)"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polygon points="11,19 2,12 11,5" fill="currentColor" />
                                <line x1="22" y1="5" x2="22" y2="19" />
                            </svg>
                        </button>

                        {/* Frame forward */}
                        <button
                            onClick={() => stepFrame(1)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition"
                            title="Next frame (→)"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polygon points="13,19 22,12 13,5" fill="currentColor" />
                                <line x1="2" y1="5" x2="2" y2="19" />
                            </svg>
                        </button>

                        <div className="w-px h-6 bg-white/20 mx-1" />

                        {/* Speed */}
                        <button
                            onClick={changePlaybackRate}
                            className="flex h-9 px-3 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition text-sm font-medium"
                            title="Change playback speed"
                        >
                            {playbackRate}x
                        </button>
                    </div>

                    {/* Center - time display */}
                    <div className="text-sm text-white font-mono">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </div>

                    {/* Right controls */}
                    <div className="flex items-center gap-2">
                        {/* Extract frame */}
                        <button
                            onClick={extractFrame}
                            disabled={saving}
                            className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Extract current frame as PNG"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <path d="M21 15l-5-5L5 21" />
                            </svg>
                            {saving ? "Saving..." : "Extract Frame"}
                        </button>

                        <div className="w-px h-6 bg-white/20 mx-1" />

                        {/* File navigation */}
                        {(onPrevious || onNext) && (
                            <>
                                <button
                                    onClick={onPrevious}
                                    disabled={!onPrevious}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Previous file (↑)"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="15 18 9 12 15 6" />
                                    </svg>
                                </button>
                                <button
                                    onClick={onNext}
                                    disabled={!onNext}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Next file (↓)"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                </button>
                                <div className="w-px h-6 bg-white/20 mx-1" />
                            </>
                        )}

                        {/* Close */}
                        <button
                            onClick={onClose}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-red-500/20 hover:text-red-400"
                            title="Close (Esc)"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
