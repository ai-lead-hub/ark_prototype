export async function compressImage(
    file: File,
    maxDimension = 1920,
    quality = 0.8
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

            // Calculate new dimensions
            if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
            } else {
                // If smaller than maxDimension, just convert to JPG if needed or return original?
                // User said "compress all... to jpg". So we should convert even if small, to ensure JPG format.
                // But if it's already small and JPG, maybe skip?
                // Let's always process to ensure consistency (JPG, stripped metadata).
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject(new Error("Failed to get canvas context"));
                return;
            }

            // Fill white background for transparent images (since we convert to JPG)
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, width, height);

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error("Canvas toBlob failed"));
                        return;
                    }
                    const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                        type: "image/jpeg",
                        lastModified: Date.now(),
                    });
                    resolve(newFile);
                },
                "image/jpeg",
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
