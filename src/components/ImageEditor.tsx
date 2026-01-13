import { useCallback, useEffect, useRef, useState } from "react";
import EditorToolbar from "./EditorToolbar";
import { uploadToFal } from "../lib/fal";

export type AnnotationType = "rect" | "circle" | "text" | "brush" | "arrow";
export type ToolType = "select" | "rect" | "circle" | "arrow" | "text" | "crop" | "brush";

export interface BrushPoint {
    x: number;
    y: number;
}

export interface Annotation {
    id: string;
    type: AnnotationType;
    x: number;
    y: number;
    w?: number;
    h?: number;
    r?: number;
    x2?: number; // Arrow end x
    y2?: number; // Arrow end y
    text?: string;
    color: string;
    fontSize?: number;
    points?: BrushPoint[]; // For brush strokes
    strokeWidth?: number; // For brush strokes
}

interface ImageEditorProps {
    imageUrl: string;
    imageName: string;
    onSave: (blob: Blob, filename: string) => Promise<void>;
    onClose: () => void;
    onPrevious?: () => void;
    onNext?: () => void;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;

export default function ImageEditor({
    imageUrl,
    imageName,
    onSave,
    onClose,
    onPrevious,
    onNext,
}: ImageEditorProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const textInputRef = useRef<HTMLInputElement>(null);

    const [zoom, setZoom] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    const [tool, setTool] = useState<ToolType>("select");
    const [color, setColor] = useState<"white" | "red">("red");
    const [brushSize, setBrushSize] = useState(3); // Default brush thickness
    const [annotations, setAnnotations] = useState<Annotation[]>([]);

    const [isDrawing, setIsDrawing] = useState(false);
    const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
    const [currentDraw, setCurrentDraw] = useState<Partial<Annotation> | null>(null);
    const [currentBrushStroke, setCurrentBrushStroke] = useState<BrushPoint[]>([]);

    const [textInput, setTextInput] = useState<{ x: number; y: number; visible: boolean }>({
        x: 0,
        y: 0,
        visible: false,
    });
    const [textValue, setTextValue] = useState("");

    const [cropArea, setCropArea] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const [cropAspect, setCropAspect] = useState<string>("free");

    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    // Focus text input when it becomes visible
    useEffect(() => {
        if (textInput.visible && textInputRef.current) {
            // Small delay to ensure the element is rendered
            requestAnimationFrame(() => {
                textInputRef.current?.focus();
            });
        }
    }, [textInput.visible]);

    // Load image
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            imageRef.current = img;
            setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            setImageLoaded(true);
        };
        img.onerror = () => {
            setStatus("Failed to load image");
        };
        img.src = imageUrl;
    }, [imageUrl]);

    // Fit image to container on load
    useEffect(() => {
        if (!imageLoaded || !containerRef.current) return;
        const container = containerRef.current;
        const containerW = container.clientWidth;
        const containerH = container.clientHeight - 60; // Account for toolbar
        const scaleX = containerW / imageDimensions.width;
        const scaleY = containerH / imageDimensions.height;
        const fitZoom = Math.min(scaleX, scaleY, 1) * 0.9;
        setZoom(fitZoom);
        setPanOffset({ x: 0, y: 0 });
    }, [imageLoaded, imageDimensions]);

    // Render canvas
    const render = useCallback(() => {
        const canvas = canvasRef.current;
        const img = imageRef.current;
        if (!canvas || !img || !imageLoaded) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const container = containerRef.current;
        if (!container) return;

        // Set canvas size to container size
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight - 60;

        // Clear canvas
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Calculate centered position
        const scaledW = img.naturalWidth * zoom;
        const scaledH = img.naturalHeight * zoom;
        const offsetX = (canvas.width - scaledW) / 2 + panOffset.x;
        const offsetY = (canvas.height - scaledH) / 2 + panOffset.y;

        // Draw image
        ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);

        // Draw annotations
        annotations.forEach((ann) => {
            ctx.strokeStyle = ann.color;
            ctx.fillStyle = ann.color;
            // Use stored strokeWidth if available (already in image pixels, multiply by zoom for display)
            ctx.lineWidth = (ann.strokeWidth || 2) * zoom;

            const annX = offsetX + ann.x * zoom;
            const annY = offsetY + ann.y * zoom;

            if (ann.type === "rect" && ann.w !== undefined && ann.h !== undefined) {
                ctx.strokeRect(annX, annY, ann.w * zoom, ann.h * zoom);
            } else if (ann.type === "circle" && ann.r !== undefined) {
                ctx.beginPath();
                ctx.arc(annX, annY, ann.r * zoom, 0, Math.PI * 2);
                ctx.stroke();
            } else if (ann.type === "text" && ann.text) {
                const fontSize = (ann.fontSize || 24) * zoom;
                ctx.font = `${fontSize}px sans-serif`;
                ctx.fillText(ann.text, annX, annY);
            } else if (ann.type === "brush" && ann.points && ann.points.length > 1) {
                // strokeWidth is stored in image pixels, so multiply by zoom for screen display
                ctx.lineWidth = (ann.strokeWidth || 8) * zoom;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.beginPath();
                const firstPt = ann.points[0];
                ctx.moveTo(offsetX + firstPt.x * zoom, offsetY + firstPt.y * zoom);
                for (let i = 1; i < ann.points.length; i++) {
                    const pt = ann.points[i];
                    ctx.lineTo(offsetX + pt.x * zoom, offsetY + pt.y * zoom);
                }
                ctx.stroke();
            } else if (ann.type === "arrow" && ann.x2 !== undefined && ann.y2 !== undefined) {
                // Draw arrow line
                const endX = offsetX + ann.x2 * zoom;
                const endY = offsetY + ann.y2 * zoom;
                ctx.beginPath();
                ctx.moveTo(annX, annY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
                // Draw arrowhead - proportional to stroke width
                const strokeW = (ann.strokeWidth || 2) * zoom;
                const headLen = Math.max(15, strokeW * 4) * zoom / zoom; // Head length scales with stroke
                const headLineW = Math.max(2, strokeW * 0.6); // Arrowhead line 60% of shaft
                const savedLineWidth = ctx.lineWidth;
                ctx.lineWidth = headLineW;
                const angle = Math.atan2(endY - annY, endX - annX);
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(endX - headLen * Math.cos(angle - Math.PI / 6), endY - headLen * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(endX, endY);
                ctx.lineTo(endX - headLen * Math.cos(angle + Math.PI / 6), endY - headLen * Math.sin(angle + Math.PI / 6));
                ctx.stroke();
                ctx.lineWidth = savedLineWidth;
            }
        });

        // Draw current drawing preview
        if (currentDraw) {
            ctx.strokeStyle = color === "white" ? "#ffffff" : "#ef4444";
            ctx.lineWidth = brushSize;
            const drawX = offsetX + (currentDraw.x || 0) * zoom;
            const drawY = offsetY + (currentDraw.y || 0) * zoom;

            if (currentDraw.type === "rect" && currentDraw.w !== undefined && currentDraw.h !== undefined) {
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(drawX, drawY, currentDraw.w * zoom, currentDraw.h * zoom);
                ctx.setLineDash([]);
            } else if (currentDraw.type === "circle" && currentDraw.r !== undefined) {
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(drawX, drawY, currentDraw.r * zoom, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            } else if (currentDraw.type === "arrow" && currentDraw.x2 !== undefined && currentDraw.y2 !== undefined) {
                const endX = offsetX + currentDraw.x2 * zoom;
                const endY = offsetY + currentDraw.y2 * zoom;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(drawX, drawY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
                // Arrowhead preview - proportional to brush size
                const headLen = Math.max(15, brushSize * 4);
                const headLineW = Math.max(2, brushSize * 0.6);
                const savedLineWidth = ctx.lineWidth;
                ctx.lineWidth = headLineW;
                const angle = Math.atan2(endY - drawY, endX - drawX);
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(endX - headLen * Math.cos(angle - Math.PI / 6), endY - headLen * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(endX, endY);
                ctx.lineTo(endX - headLen * Math.cos(angle + Math.PI / 6), endY - headLen * Math.sin(angle + Math.PI / 6));
                ctx.stroke();
                ctx.lineWidth = savedLineWidth;
                ctx.setLineDash([]);
            }
        }

        // Draw current brush stroke preview
        // brushSize is in screen pixels, so we use it directly (not multiplied by zoom)
        if (currentBrushStroke.length > 1) {
            ctx.strokeStyle = color === "white" ? "#ffffff" : "#ef4444";
            ctx.lineWidth = brushSize; // Screen pixels
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            const scaledW = img.naturalWidth * zoom;
            const scaledH = img.naturalHeight * zoom;
            const brushOffsetX = (canvas.width - scaledW) / 2 + panOffset.x;
            const brushOffsetY = (canvas.height - scaledH) / 2 + panOffset.y;
            const firstPt = currentBrushStroke[0];
            ctx.moveTo(brushOffsetX + firstPt.x * zoom, brushOffsetY + firstPt.y * zoom);
            for (let i = 1; i < currentBrushStroke.length; i++) {
                const pt = currentBrushStroke[i];
                ctx.lineTo(brushOffsetX + pt.x * zoom, brushOffsetY + pt.y * zoom);
            }
            ctx.stroke();
        }

        // Draw crop overlay
        if (cropArea && tool === "crop") {
            const cropX = offsetX + cropArea.x * zoom;
            const cropY = offsetY + cropArea.y * zoom;
            const cropW = cropArea.w * zoom;
            const cropH = cropArea.h * zoom;

            // Darken outside crop area
            ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
            ctx.fillRect(0, 0, canvas.width, cropY);
            ctx.fillRect(0, cropY + cropH, canvas.width, canvas.height - cropY - cropH);
            ctx.fillRect(0, cropY, cropX, cropH);
            ctx.fillRect(cropX + cropW, cropY, canvas.width - cropX - cropW, cropH);

            // Crop border
            ctx.strokeStyle = "#3b82f6";
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            ctx.strokeRect(cropX, cropY, cropW, cropH);
        }
    }, [imageLoaded, zoom, panOffset, annotations, currentDraw, currentBrushStroke, brushSize, cropArea, tool, color]);

    useEffect(() => {
        render();
    }, [render]);

    // Convert screen coords to image coords
    const screenToImage = useCallback(
        (screenX: number, screenY: number) => {
            const canvas = canvasRef.current;
            const img = imageRef.current;
            if (!canvas || !img) return { x: 0, y: 0 };

            const rect = canvas.getBoundingClientRect();
            const canvasX = screenX - rect.left;
            const canvasY = screenY - rect.top;

            const scaledW = img.naturalWidth * zoom;
            const scaledH = img.naturalHeight * zoom;
            const offsetX = (canvas.width - scaledW) / 2 + panOffset.x;
            const offsetY = (canvas.height - scaledH) / 2 + panOffset.y;

            return {
                x: (canvasX - offsetX) / zoom,
                y: (canvasY - offsetY) / zoom,
            };
        },
        [zoom, panOffset]
    );

    // Mouse wheel zoom
    const handleWheel = useCallback(
        (e: React.WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            setZoom((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
        },
        []
    );

    // Mouse down
    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (e.button !== 0) return;

            const imgCoords = screenToImage(e.clientX, e.clientY);

            if (tool === "select" || (e.button === 0 && e.shiftKey)) {
                // Pan mode
                setIsPanning(true);
                setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
            } else if (tool === "rect" || tool === "circle" || tool === "arrow") {
                setIsDrawing(true);
                setDrawStart(imgCoords);
                setCurrentDraw({
                    type: tool,
                    x: imgCoords.x,
                    y: imgCoords.y,
                    w: 0,
                    h: 0,
                    r: 0,
                    x2: imgCoords.x,
                    y2: imgCoords.y,
                });
            } else if (tool === "text") {
                // Calculate position relative to the canvas container
                const canvas = canvasRef.current;
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    setTextInput({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                        visible: true
                    });
                    setTextValue("");
                }
            } else if (tool === "crop") {
                setIsDrawing(true);
                setDrawStart(imgCoords);
                setCropArea({ x: imgCoords.x, y: imgCoords.y, w: 0, h: 0 });
            } else if (tool === "brush") {
                setIsDrawing(true);
                setCurrentBrushStroke([imgCoords]);
            }
        },
        [tool, panOffset, screenToImage]
    );

    // Mouse move
    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (isPanning) {
                setPanOffset({
                    x: e.clientX - panStart.x,
                    y: e.clientY - panStart.y,
                });
            } else if (isDrawing) {
                const imgCoords = screenToImage(e.clientX, e.clientY);

                if (tool === "rect") {
                    setCurrentDraw({
                        type: "rect",
                        x: Math.min(drawStart.x, imgCoords.x),
                        y: Math.min(drawStart.y, imgCoords.y),
                        w: Math.abs(imgCoords.x - drawStart.x),
                        h: Math.abs(imgCoords.y - drawStart.y),
                    });
                } else if (tool === "circle") {
                    // Circle scales from center - drawStart is center
                    const dx = imgCoords.x - drawStart.x;
                    const dy = imgCoords.y - drawStart.y;
                    const radius = Math.sqrt(dx * dx + dy * dy);
                    setCurrentDraw({
                        type: "circle",
                        x: drawStart.x,  // Center x
                        y: drawStart.y,  // Center y
                        r: radius,
                    });
                } else if (tool === "arrow") {
                    setCurrentDraw({
                        type: "arrow",
                        x: drawStart.x,
                        y: drawStart.y,
                        x2: imgCoords.x,
                        y2: imgCoords.y,
                    });
                } else if (tool === "crop") {
                    let w = imgCoords.x - drawStart.x;
                    let h = imgCoords.y - drawStart.y;

                    // Apply aspect ratio constraint
                    if (cropAspect !== "free") {
                        const [ratioW, ratioH] = cropAspect.split(":").map(Number);
                        const aspectRatio = ratioW / ratioH;
                        if (Math.abs(w) / Math.abs(h) > aspectRatio) {
                            w = Math.sign(w) * Math.abs(h) * aspectRatio;
                        } else {
                            h = Math.sign(h) * Math.abs(w) / aspectRatio;
                        }
                    }

                    setCropArea({
                        x: w > 0 ? drawStart.x : drawStart.x + w,
                        y: h > 0 ? drawStart.y : drawStart.y + h,
                        w: Math.abs(w),
                        h: Math.abs(h),
                    });
                } else if (tool === "brush") {
                    setCurrentBrushStroke((prev) => [...prev, imgCoords]);
                }
            }
        },
        [isPanning, isDrawing, panStart, drawStart, tool, cropAspect, screenToImage]
    );

    // Mouse up
    const handleMouseUp = useCallback(() => {
        if (isPanning) {
            setIsPanning(false);
        }

        if (isDrawing && currentDraw && (tool === "rect" || tool === "circle" || tool === "arrow")) {
            // Only add if it has some size
            const minSize = 5;
            let hasSize = false;
            if (tool === "arrow" && currentDraw.x2 !== undefined && currentDraw.y2 !== undefined) {
                const dx = currentDraw.x2 - (currentDraw.x || 0);
                const dy = currentDraw.y2 - (currentDraw.y || 0);
                hasSize = Math.sqrt(dx * dx + dy * dy) > minSize;
            } else {
                hasSize =
                    (currentDraw.w !== undefined && currentDraw.w > minSize) ||
                    (currentDraw.h !== undefined && currentDraw.h > minSize) ||
                    (currentDraw.r !== undefined && currentDraw.r > minSize);
            }

            if (hasSize) {
                const imagePixelStrokeWidth = brushSize / zoom;
                setAnnotations((prev) => [
                    ...prev,
                    {
                        ...currentDraw,
                        id: crypto.randomUUID(),
                        type: tool as AnnotationType,
                        color: color === "white" ? "#ffffff" : "#ef4444",
                        strokeWidth: imagePixelStrokeWidth,
                    } as Annotation,
                ]);
            }
            setCurrentDraw(null);
        }

        // Save brush stroke as annotation
        // Convert screen pixels to image pixels for consistent rendering
        if (isDrawing && tool === "brush" && currentBrushStroke.length > 1) {
            const imagePixelStrokeWidth = brushSize / zoom; // Convert screen px to image px
            setAnnotations((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    type: "brush",
                    x: 0,
                    y: 0,
                    color: color === "white" ? "#ffffff" : "#ef4444",
                    points: [...currentBrushStroke],
                    strokeWidth: imagePixelStrokeWidth,
                },
            ]);
            setCurrentBrushStroke([]);
        }

        setIsDrawing(false);
    }, [isPanning, isDrawing, currentDraw, currentBrushStroke, tool, color, brushSize, zoom]);

    // Handle text submit
    const handleTextSubmit = useCallback(() => {
        if (!textValue.trim()) {
            setTextInput((prev) => ({ ...prev, visible: false }));
            return;
        }

        // Convert text input position (relative to canvas) to image coordinates
        const canvas = canvasRef.current;
        const img = imageRef.current;
        if (!canvas || !img) {
            setTextInput((prev) => ({ ...prev, visible: false }));
            return;
        }

        const scaledW = img.naturalWidth * zoom;
        const scaledH = img.naturalHeight * zoom;
        const offsetX = (canvas.width - scaledW) / 2 + panOffset.x;
        const offsetY = (canvas.height - scaledH) / 2 + panOffset.y;

        const imgX = (textInput.x - offsetX) / zoom;
        const imgY = (textInput.y - offsetY) / zoom;

        setAnnotations((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                type: "text",
                x: imgX,
                y: imgY,
                text: textValue,
                color: color === "white" ? "#ffffff" : "#ef4444",
                fontSize: 24,
            },
        ]);
        setTextInput((prev) => ({ ...prev, visible: false }));
        setTextValue("");
    }, [textValue, textInput, color, zoom, panOffset]);

    // Undo
    const handleUndo = useCallback(() => {
        setAnnotations((prev) => prev.slice(0, -1));
    }, []);

    // Clear all
    const handleClear = useCallback(() => {
        setAnnotations([]);
        setCropArea(null);
    }, []);

    // Apply crop
    const handleApplyCrop = useCallback(async () => {
        if (!cropArea || !imageRef.current) return;

        const img = imageRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = cropArea.w;
        canvas.height = cropArea.h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(
            img,
            cropArea.x,
            cropArea.y,
            cropArea.w,
            cropArea.h,
            0,
            0,
            cropArea.w,
            cropArea.h
        );

        // Also draw annotations within crop area
        annotations.forEach((ann) => {
            ctx.strokeStyle = ann.color;
            ctx.fillStyle = ann.color;
            ctx.lineWidth = ann.strokeWidth || 2;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            const annX = ann.x - cropArea.x;
            const annY = ann.y - cropArea.y;

            if (ann.type === "rect" && ann.w !== undefined && ann.h !== undefined) {
                ctx.lineWidth = ann.strokeWidth || 3;
                ctx.strokeRect(annX, annY, ann.w, ann.h);
            } else if (ann.type === "circle" && ann.r !== undefined) {
                ctx.lineWidth = ann.strokeWidth || 3;
                ctx.beginPath();
                ctx.arc(annX, annY, ann.r, 0, Math.PI * 2);
                ctx.stroke();
            } else if (ann.type === "text" && ann.text) {
                ctx.font = `${ann.fontSize || 24}px sans-serif`;
                ctx.fillText(ann.text, annX, annY);
            } else if (ann.type === "brush" && ann.points && ann.points.length > 1) {
                ctx.lineWidth = ann.strokeWidth || 8;
                ctx.beginPath();
                ctx.moveTo(ann.points[0].x - cropArea.x, ann.points[0].y - cropArea.y);
                for (let i = 1; i < ann.points.length; i++) {
                    ctx.lineTo(ann.points[i].x - cropArea.x, ann.points[i].y - cropArea.y);
                }
                ctx.stroke();
            } else if (ann.type === "arrow" && ann.x2 !== undefined && ann.y2 !== undefined) {
                ctx.lineWidth = ann.strokeWidth || 2;
                const endX = ann.x2 - cropArea.x;
                const endY = ann.y2 - cropArea.y;
                ctx.beginPath();
                ctx.moveTo(annX, annY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
                // Arrowhead - proportional to stroke width
                const strokeW = ann.strokeWidth || 2;
                const headLen = Math.max(15, strokeW * 4);
                const headLineW = Math.max(2, strokeW * 0.6);
                const savedLineWidth = ctx.lineWidth;
                ctx.lineWidth = headLineW;
                const angle = Math.atan2(endY - annY, endX - annX);
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(endX - headLen * Math.cos(angle - Math.PI / 6), endY - headLen * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(endX, endY);
                ctx.lineTo(endX - headLen * Math.cos(angle + Math.PI / 6), endY - headLen * Math.sin(angle + Math.PI / 6));
                ctx.stroke();
                ctx.lineWidth = savedLineWidth;
            }
        });

        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to create blob"))), "image/png");
        });

        const baseName = imageName.replace(/\.[^.]+$/, "");
        const filename = `${baseName}_cropped.png`;

        setSaving(true);
        setStatus("Saving cropped image...");
        try {
            await onSave(blob, filename);
            setStatus("Cropped image saved!");
            setCropArea(null);
            setTool("select");
        } catch (err) {
            setStatus(`Save failed: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
            setSaving(false);
            setTimeout(() => setStatus(null), 3000);
        }
    }, [cropArea, annotations, imageName, onSave]);

    // Save with annotations
    const handleSave = useCallback(async () => {
        const img = imageRef.current;
        if (!img) {
            console.error("No image loaded to save");
            setStatus("No image loaded");
            return;
        }

        console.log("Starting save with", annotations.length, "annotations");

        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            console.error("Could not get canvas context");
            return;
        }

        ctx.drawImage(img, 0, 0);

        // Draw annotations
        annotations.forEach((ann) => {
            ctx.strokeStyle = ann.color;
            ctx.fillStyle = ann.color;
            ctx.lineWidth = ann.strokeWidth || 2;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            if (ann.type === "rect" && ann.w !== undefined && ann.h !== undefined) {
                ctx.lineWidth = ann.strokeWidth || 2;
                ctx.strokeRect(ann.x, ann.y, ann.w, ann.h);
            } else if (ann.type === "circle" && ann.r !== undefined) {
                ctx.lineWidth = ann.strokeWidth || 2;
                ctx.beginPath();
                ctx.arc(ann.x, ann.y, ann.r, 0, Math.PI * 2);
                ctx.stroke();
            } else if (ann.type === "text" && ann.text) {
                ctx.font = `${ann.fontSize || 24}px sans-serif`;
                ctx.fillText(ann.text, ann.x, ann.y);
            } else if (ann.type === "brush" && ann.points && ann.points.length > 1) {
                ctx.lineWidth = ann.strokeWidth || 8;
                ctx.beginPath();
                ctx.moveTo(ann.points[0].x, ann.points[0].y);
                for (let i = 1; i < ann.points.length; i++) {
                    ctx.lineTo(ann.points[i].x, ann.points[i].y);
                }
                ctx.stroke();
            } else if (ann.type === "arrow" && ann.x2 !== undefined && ann.y2 !== undefined) {
                ctx.lineWidth = ann.strokeWidth || 2;
                ctx.beginPath();
                ctx.moveTo(ann.x, ann.y);
                ctx.lineTo(ann.x2, ann.y2);
                ctx.stroke();
                // Arrowhead - proportional to stroke width
                const strokeW = ann.strokeWidth || 2;
                const headLen = Math.max(15, strokeW * 4);
                const headLineW = Math.max(2, strokeW * 0.6);
                const savedLineWidth = ctx.lineWidth;
                ctx.lineWidth = headLineW;
                const angle = Math.atan2(ann.y2 - ann.y, ann.x2 - ann.x);
                ctx.beginPath();
                ctx.moveTo(ann.x2, ann.y2);
                ctx.lineTo(ann.x2 - headLen * Math.cos(angle - Math.PI / 6), ann.y2 - headLen * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(ann.x2, ann.y2);
                ctx.lineTo(ann.x2 - headLen * Math.cos(angle + Math.PI / 6), ann.y2 - headLen * Math.sin(angle + Math.PI / 6));
                ctx.stroke();
                ctx.lineWidth = savedLineWidth;
            }
        });

        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to create blob"))), "image/png");
        });

        const baseName = imageName.replace(/\.[^.]+$/, "");
        const filename = `${baseName}_annotated.png`;
        console.log("Saving as:", filename, "blob size:", blob.size);

        setSaving(true);
        setStatus("Saving annotated image...");
        try {
            await onSave(blob, filename);
            console.log("Save successful");
            setStatus("Image saved!");
        } catch (err) {
            console.error("Save failed:", err);
            setStatus(`Save failed: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
            setSaving(false);
            setTimeout(() => setStatus(null), 3000);
        }
    }, [annotations, imageName, onSave]);

    // Open in Photopea
    const handleOpenPhotopea = useCallback(async () => {
        setStatus("Uploading image for Photopea...");
        try {
            // Fetch the local image and upload to FAL for a public URL
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const file = new File([blob], imageName, { type: blob.type || "image/png" });
            const publicUrl = await uploadToFal(file);

            // Photopea URL format: https://www.photopea.com/#{"files":["url"]}
            const photopeaConfig = JSON.stringify({ files: [publicUrl] });
            const photopeaUrl = `https://www.photopea.com/#${photopeaConfig}`;
            window.open(photopeaUrl, "_blank");
            setStatus(null);
        } catch (err) {
            setStatus(`Failed to open in Photopea: ${err instanceof Error ? err.message : "Unknown error"}`);
            setTimeout(() => setStatus(null), 3000);
        }
    }, [imageUrl, imageName]);

    // Reset zoom to fit
    const handleResetZoom = useCallback(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        const containerW = container.clientWidth;
        const containerH = container.clientHeight - 60;
        const scaleX = containerW / imageDimensions.width;
        const scaleY = containerH / imageDimensions.height;
        const fitZoom = Math.min(scaleX, scaleY, 1) * 0.9;
        setZoom(fitZoom);
        setPanOffset({ x: 0, y: 0 });
    }, [imageDimensions]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (textInput.visible) return;

            if (e.key === "Escape") {
                if (tool === "crop" && cropArea) {
                    setCropArea(null);
                } else {
                    onClose();
                }
            } else if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleUndo();
            } else if (e.key === "0" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleResetZoom();
            } else if (e.key === "ArrowUp" && onPrevious) {
                e.preventDefault();
                onPrevious();
            } else if (e.key === "ArrowDown" && onNext) {
                e.preventDefault();
                onNext();
            } else if (e.key === "ArrowLeft" && onPrevious) {
                e.preventDefault();
                onPrevious();
            } else if (e.key === "ArrowRight" && onNext) {
                e.preventDefault();
                onNext();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [textInput.visible, tool, cropArea, onClose, handleUndo, handleResetZoom, onPrevious, onNext]);

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-50 flex flex-col bg-slate-950"
        >
            {/* Canvas area */}
            <div className="flex-1 relative overflow-hidden">
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 cursor-crosshair"
                    style={{
                        cursor:
                            tool === "select"
                                ? isPanning
                                    ? "grabbing"
                                    : "grab"
                                : "crosshair",
                    }}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                />

                {/* Text input overlay */}
                {textInput.visible && (
                    <div
                        className="absolute z-50 pointer-events-auto"
                        style={{
                            left: textInput.x,
                            top: textInput.y,
                            transform: 'translate(-4px, -4px)'
                        }}
                    >
                        <input
                            ref={textInputRef}
                            type="text"
                            value={textValue}
                            onChange={(e) => setTextValue(e.target.value)}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === "Enter") handleTextSubmit();
                                if (e.key === "Escape") setTextInput((prev) => ({ ...prev, visible: false }));
                            }}
                            onBlur={handleTextSubmit}
                            className="min-w-[200px] rounded-lg border-2 border-sky-500 bg-slate-900 px-3 py-2 text-white text-base outline-none shadow-lg shadow-black/50"
                            placeholder="Type text and press Enter..."
                        />
                    </div>
                )}

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

                {/* Loading */}
                {!imageLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
                        <div className="text-white">Loading image...</div>
                    </div>
                )}
            </div>

            {/* Toolbar */}
            <EditorToolbar
                tool={tool}
                setTool={setTool}
                color={color}
                setColor={setColor}
                brushSize={brushSize}
                setBrushSize={setBrushSize}
                cropAspect={cropAspect}
                setCropAspect={setCropAspect}
                cropArea={cropArea}
                onApplyCrop={handleApplyCrop}
                onUndo={handleUndo}
                onClear={handleClear}
                onSave={handleSave}
                onOpenPhotopea={handleOpenPhotopea}
                onClose={onClose}
                saving={saving}
                hasAnnotations={annotations.length > 0}
            />
        </div>
    );
}
