import { useState, useRef, useCallback, useEffect } from "react";
import { useElements } from "../state/elements";
import { FILE_ENTRY_MIME } from "../lib/drag-constants";
import { useCatalog } from "../state/useCatalog";
import { fetchFileBlob } from "../lib/api/files";

interface DropZoneState {
    frontal: boolean;
    refs: boolean;
    video: boolean;
    sheet: boolean;
}

export default function ElementForm() {
    const { addElement, closeForm } = useElements();
    const { state } = useCatalog();
    const connection = state.connection;
    const [name, setName] = useState("");
    const [frontalImage, setFrontalImage] = useState<File | null>(null);
    const [frontalPreview, setFrontalPreview] = useState<string | null>(null);
    const [referenceImages, setReferenceImages] = useState<File[]>([]);
    const [referencePreviews, setReferencePreviews] = useState<string[]>([]);
    const [videoReference, setVideoReference] = useState<File | null>(null);
    const [characterSheet, setCharacterSheet] = useState<File | null>(null);
    const [sheetPreview, setSheetPreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState<DropZoneState>({
        frontal: false,
        refs: false,
        video: false,
        sheet: false,
    });

    const frontalInputRef = useRef<HTMLInputElement>(null);
    const refInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const sheetInputRef = useRef<HTMLInputElement>(null);

    // Fetch file from workspace URL and convert to File object
    const fetchFileFromWorkspace = useCallback(
        async (path: string, name: string, mime: string): Promise<File> => {
            if (!connection) throw new Error("No workspace connection");
            const blob = await fetchFileBlob(connection, path);
            return new File([blob], name, { type: mime });
        },
        [connection]
    );

    // Generic drop handler that parses FILE_ENTRY_MIME data
    const handleDrop = useCallback(
        async (
            e: React.DragEvent,
            zone: keyof DropZoneState,
            onFile: (file: File) => void
        ) => {
            e.preventDefault();
            setDragOver((prev) => ({ ...prev, [zone]: false }));

            const payloadRaw = e.dataTransfer.getData(FILE_ENTRY_MIME);
            if (payloadRaw) {
                try {
                    const payload = JSON.parse(payloadRaw);
                    const file = await fetchFileFromWorkspace(
                        payload.path,
                        payload.name,
                        payload.mime
                    );
                    onFile(file);
                } catch (err) {
                    console.error("Drop error:", err);
                    setError("Failed to load dropped file");
                }
            } else if (e.dataTransfer.files.length > 0) {
                // Handle native file drops
                onFile(e.dataTransfer.files[0]);
            }
        },
        [fetchFileFromWorkspace]
    );

    const handleDragOver = (e: React.DragEvent, zone: keyof DropZoneState) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDragOver((prev) => ({ ...prev, [zone]: true }));
    };

    const handleDragLeave = (e: React.DragEvent, zone: keyof DropZoneState) => {
        e.preventDefault();
        setDragOver((prev) => ({ ...prev, [zone]: false }));
    };

    const handleFrontalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Revoke previous URL to prevent memory leak
            if (frontalPreview) URL.revokeObjectURL(frontalPreview);
            setFrontalImage(file);
            setFrontalPreview(URL.createObjectURL(file));
        }
    };

    const handleRefImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Revoke previous URLs to prevent memory leak
        referencePreviews.forEach((url) => URL.revokeObjectURL(url));
        const files = Array.from(e.target.files ?? []).slice(0, 3);
        setReferenceImages(files);
        setReferencePreviews(files.map((f) => URL.createObjectURL(f)));
    };

    const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        setVideoReference(file || null);
    };

    const handleSheetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Revoke previous URL to prevent memory leak
            if (sheetPreview) URL.revokeObjectURL(sheetPreview);
            setCharacterSheet(file);
            setSheetPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError("Name is required");
            return;
        }
        if (!frontalImage) {
            setError("Frontal image is required");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await addElement({
                name: name.trim(),
                frontalImage,
                referenceImages,
                videoReference: videoReference || undefined,
                characterSheet: characterSheet || undefined,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create element");
            setIsSubmitting(false);
        }
    };

    // Cleanup object URLs on unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            if (frontalPreview) URL.revokeObjectURL(frontalPreview);
            referencePreviews.forEach((url) => URL.revokeObjectURL(url));
            if (sheetPreview) URL.revokeObjectURL(sheetPreview);
        };
    }, []);

    const dropZoneClass = (zone: keyof DropZoneState, baseClass: string) =>
        `${baseClass} ${dragOver[zone] ? "border-sky-400 bg-sky-500/10 scale-[1.02]" : ""}`;

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-white">Create New Element</h4>
                <button
                    type="button"
                    onClick={closeForm}
                    className="text-slate-400 hover:text-white transition text-xs"
                >
                    Cancel
                </button>
            </div>

            {/* Name */}
            <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                    Name *
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Hero Character, Magic Sword"
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-400 transition"
                />
            </div>

            {/* Frontal Image */}
            <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                    Frontal Image * <span className="text-slate-500">(clear front view)</span>
                </label>
                <div
                    onClick={() => frontalInputRef.current?.click()}
                    onDragOver={(e) => handleDragOver(e, "frontal")}
                    onDragLeave={(e) => handleDragLeave(e, "frontal")}
                    onDrop={(e) =>
                        handleDrop(e, "frontal", (file) => {
                            // Revoke previous URL to prevent memory leak
                            if (frontalPreview) URL.revokeObjectURL(frontalPreview);
                            setFrontalImage(file);
                            setFrontalPreview(URL.createObjectURL(file));
                        })
                    }
                    className={dropZoneClass(
                        "frontal",
                        "flex items-center justify-center border border-dashed border-white/20 rounded-lg h-32 cursor-pointer hover:border-sky-400 transition overflow-hidden"
                    )}
                >
                    {frontalPreview ? (
                        <img src={frontalPreview} alt="Frontal" className="h-full object-contain" />
                    ) : (
                        <span className="text-slate-500 text-sm">Drop image or click</span>
                    )}
                </div>
                <input
                    ref={frontalInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFrontalChange}
                    className="hidden"
                />
            </div>

            {/* Reference Images */}
            <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                    Reference Images <span className="text-slate-500">(2-3 additional angles)</span>
                </label>
                <div
                    onClick={() => refInputRef.current?.click()}
                    onDragOver={(e) => handleDragOver(e, "refs")}
                    onDragLeave={(e) => handleDragLeave(e, "refs")}
                    onDrop={(e) =>
                        handleDrop(e, "refs", (file) => {
                            setReferenceImages((prev) => [...prev.slice(0, 2), file]);
                            setReferencePreviews((prev) => {
                                // Revoke the URL being dropped (if over limit)
                                if (prev.length >= 3 && prev[2]) {
                                    URL.revokeObjectURL(prev[2]);
                                }
                                return [
                                    ...prev.slice(0, 2),
                                    URL.createObjectURL(file),
                                ];
                            });
                        })
                    }
                    className={dropZoneClass(
                        "refs",
                        "flex items-center gap-2 border border-dashed border-white/20 rounded-lg p-3 cursor-pointer hover:border-sky-400 transition min-h-[80px]"
                    )}
                >
                    {referencePreviews.length > 0 ? (
                        referencePreviews.map((preview, i) => (
                            <img
                                key={i}
                                src={preview}
                                alt={`Ref ${i + 1}`}
                                className="h-16 w-16 object-cover rounded"
                            />
                        ))
                    ) : (
                        <span className="text-slate-500 text-sm">Drop images or click (max 3)</span>
                    )}
                </div>
                <input
                    ref={refInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleRefImagesChange}
                    className="hidden"
                />
            </div>

            {/* Video Reference */}
            <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                    Video Reference <span className="text-slate-500">(optional, for motion)</span>
                </label>
                <div
                    onClick={() => videoInputRef.current?.click()}
                    onDragOver={(e) => handleDragOver(e, "video")}
                    onDragLeave={(e) => handleDragLeave(e, "video")}
                    onDrop={(e) =>
                        handleDrop(e, "video", (file) => {
                            setVideoReference(file);
                        })
                    }
                    className={dropZoneClass(
                        "video",
                        "flex items-center justify-center border border-dashed border-white/20 rounded-lg h-12 cursor-pointer hover:border-emerald-400 transition"
                    )}
                >
                    {videoReference ? (
                        <span className="text-emerald-400 text-sm">🎬 {videoReference.name}</span>
                    ) : (
                        <span className="text-slate-500 text-sm">Drop video or click</span>
                    )}
                </div>
                <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleVideoChange}
                    className="hidden"
                />
            </div>

            {/* Character Sheet */}
            <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                    Character Sheet <span className="text-slate-500">(optional, for reference)</span>
                </label>
                <div
                    onClick={() => sheetInputRef.current?.click()}
                    onDragOver={(e) => handleDragOver(e, "sheet")}
                    onDragLeave={(e) => handleDragLeave(e, "sheet")}
                    onDrop={(e) =>
                        handleDrop(e, "sheet", (file) => {
                            // Revoke previous URL to prevent memory leak
                            if (sheetPreview) URL.revokeObjectURL(sheetPreview);
                            setCharacterSheet(file);
                            setSheetPreview(URL.createObjectURL(file));
                        })
                    }
                    className={dropZoneClass(
                        "sheet",
                        "flex items-center justify-center border border-dashed border-white/20 rounded-lg h-20 cursor-pointer hover:border-amber-400 transition overflow-hidden"
                    )}
                >
                    {sheetPreview ? (
                        <img src={sheetPreview} alt="Sheet" className="h-full object-contain" />
                    ) : (
                        <span className="text-slate-500 text-sm">Drop image or click</span>
                    )}
                </div>
                <input
                    ref={sheetInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleSheetChange}
                    className="hidden"
                />
            </div>

            {/* Error */}
            {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">
                    {error}
                </div>
            )}

            {/* Submit */}
            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? "Creating..." : "Create Element"}
                </button>
            </div>
        </form>
    );
}
