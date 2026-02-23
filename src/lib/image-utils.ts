export async function compressImage(
    file: File,
    maxDimension = 2572,
    quality = 1.0
): Promise<File> {
    // If not an image, return original
    if (!file.type.startsWith("image/")) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            let { width, height } = img;
            let needsResize = false;

            // Calculate new dimensions
            if (width > maxDimension || height > maxDimension) {
                needsResize = true;
                if (width > height) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject(new Error("Failed to get canvas context"));
                return;
            }

            if (needsResize) {
                // Use Lanczos-3 for high quality downscaling
                try {
                    const destData = ctx.createImageData(width, height);
                    lanczosResize(img, destData);
                    ctx.putImageData(destData, 0, 0);
                } catch (e) {
                    console.warn("Lanczos resize failed, falling back to standard canvas resize", e);
                    ctx.drawImage(img, 0, 0, width, height);
                }
            } else {
                // No resize needed, just draw
                ctx.drawImage(img, 0, 0, width, height);
            }

            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error("Canvas toBlob failed"));
                        return;
                    }
                    const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                        type: "image/webp",
                        lastModified: Date.now(),
                    });
                    resolve(newFile);
                },
                "image/webp",
                quality
            );
        };

        img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
        };

        img.src = url;
    });
}

function lanczosResize(img: HTMLImageElement, destData: ImageData) {
    const srcCanvas = document.createElement("canvas");
    srcCanvas.width = img.width;
    srcCanvas.height = img.height;
    const srcCtx = srcCanvas.getContext("2d");
    if (!srcCtx) throw new Error("Failed to get source context");
    srcCtx.drawImage(img, 0, 0);
    const srcData = srcCtx.getImageData(0, 0, img.width, img.height);

    const src = srcData.data;
    const dest = destData.data;
    const srcW = srcData.width;
    const srcH = srcData.height;
    const destW = destData.width;
    const destH = destData.height;

    // Lanczos-3 kernel
    const lobes = 3;
    const lanczos = (x: number) => {
        if (x === 0) return 1;
        if (Math.abs(x) >= lobes) return 0;
        return (
            (Math.sin(Math.PI * x) / (Math.PI * x)) *
            (Math.sin((Math.PI * x) / lobes) / ((Math.PI * x) / lobes))
        );
    };

    // Temporary buffer for horizontal resize
    const tmp = new Float32Array(destW * srcH * 4);

    // 1. Horizontal Pass (Source -> Tmp)
    const ratioW = srcW / destW;
    const rangeW = Math.ceil(ratioW * lobes);
    const cacheW: Float32Array[] = [];

    for (let x = 0; x < destW; x++) {
        const center = (x + 0.5) * ratioW;
        const iStart = Math.floor(center - rangeW);
        const iEnd = Math.ceil(center + rangeW);
        const weights = new Float32Array(iEnd - iStart);
        let totalWeight = 0;
        for (let i = iStart; i < iEnd; i++) {
            const w = lanczos(i - center + 0.5);
            weights[i - iStart] = w;
            totalWeight += w;
        }
        // Normalize
        for (let i = 0; i < weights.length; i++) weights[i] /= totalWeight;
        cacheW[x] = weights;
    }

    for (let y = 0; y < srcH; y++) {
        for (let x = 0; x < destW; x++) {
            let r = 0,
                g = 0,
                b = 0,
                a = 0;
            const center = (x + 0.5) * ratioW;
            const iStart = Math.floor(center - rangeW);
            const weights = cacheW[x];

            for (let i = 0; i < weights.length; i++) {
                const srcX = Math.min(Math.max(iStart + i, 0), srcW - 1);
                const idx = (y * srcW + srcX) * 4;
                const w = weights[i];
                r += src[idx] * w;
                g += src[idx + 1] * w;
                b += src[idx + 2] * w;
                a += src[idx + 3] * w;
            }
            const idx = (y * destW + x) * 4;
            tmp[idx] = r;
            tmp[idx + 1] = g;
            tmp[idx + 2] = b;
            tmp[idx + 3] = a;
        }
    }

    // 2. Vertical Pass (Tmp -> Dest)
    const ratioH = srcH / destH;
    const rangeH = Math.ceil(ratioH * lobes);
    const cacheH: Float32Array[] = [];

    for (let y = 0; y < destH; y++) {
        const center = (y + 0.5) * ratioH;
        const iStart = Math.floor(center - rangeH);
        const iEnd = Math.ceil(center + rangeH);
        const weights = new Float32Array(iEnd - iStart);
        let totalWeight = 0;
        for (let i = iStart; i < iEnd; i++) {
            const w = lanczos(i - center + 0.5);
            weights[i - iStart] = w;
            totalWeight += w;
        }
        for (let i = 0; i < weights.length; i++) weights[i] /= totalWeight;
        cacheH[y] = weights;
    }

    for (let x = 0; x < destW; x++) {
        for (let y = 0; y < destH; y++) {
            let r = 0,
                g = 0,
                b = 0,
                a = 0;
            const center = (y + 0.5) * ratioH;
            const iStart = Math.floor(center - rangeH);
            const weights = cacheH[y];

            for (let i = 0; i < weights.length; i++) {
                const srcY = Math.min(Math.max(iStart + i, 0), srcH - 1);
                const idx = (srcY * destW + x) * 4;
                const w = weights[i];
                r += tmp[idx] * w;
                g += tmp[idx + 1] * w;
                b += tmp[idx + 2] * w;
                a += tmp[idx + 3] * w;
            }
            const idx = (y * destW + x) * 4;
            dest[idx] = Math.max(0, Math.min(255, Math.round(r)));
            dest[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
            dest[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
            dest[idx + 3] = Math.max(0, Math.min(255, Math.round(a)));
        }
    }
}

/**
 * Downscale an image to 1080p max (1920x1080) for Magnific upscaling.
 * If the image is already smaller, returns the original.
 * Uses high-quality PNG output to preserve details for upscaling.
 */
export async function downscaleForMagnific(file: File): Promise<File> {
    if (!file.type.startsWith("image/")) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            const maxWidth = 1920;
            const maxHeight = 1080;
            const { width, height } = img;

            // Check if downscaling is needed
            const needsResize = width > maxWidth || height > maxHeight;
            if (!needsResize) {
                // Return original as PNG for consistency
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    reject(new Error("Failed to get canvas context"));
                    return;
                }
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error("Canvas toBlob failed"));
                            return;
                        }
                        const newFile = new File(
                            [blob],
                            file.name.replace(/\.[^/.]+$/, "") + ".png",
                            { type: "image/png", lastModified: Date.now() }
                        );
                        resolve(newFile);
                    },
                    "image/png"
                );
                return;
            }

            // Calculate new dimensions maintaining aspect ratio
            const widthRatio = maxWidth / width;
            const heightRatio = maxHeight / height;
            const ratio = Math.min(widthRatio, heightRatio);

            const newWidth = Math.round(width * ratio);
            const newHeight = Math.round(height * ratio);

            const canvas = document.createElement("canvas");
            canvas.width = newWidth;
            canvas.height = newHeight;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject(new Error("Failed to get canvas context"));
                return;
            }

            // Use high quality settings
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, newWidth, newHeight);

            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error("Canvas toBlob failed"));
                        return;
                    }
                    const newFile = new File(
                        [blob],
                        file.name.replace(/\.[^/.]+$/, "") + ".png",
                        { type: "image/png", lastModified: Date.now() }
                    );
                    resolve(newFile);
                },
                "image/png"
            );
        };

        img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
        };

        img.src = url;
    });
}
