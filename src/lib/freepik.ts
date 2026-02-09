/**
 * Freepik Magnific API Provider
 * Implements the Image Upscaler Precision V2 (Magnific) API
 * https://docs.freepik.com/api-reference/image-upscaler-precision-v2/post-image-upscaler-precision-v2
 */

import {
    delay,
    downloadBlob,
    fetchWithTimeout,
    readErrorDetails,
    withRetry,
} from "./providers/shared";
import type { ProviderCallResult } from "./providers/types";

// Always use local proxy path:
// - In development, Vite forwards /api/freepik/* to api.freepik.com.
// - In production, the Fastify server proxies /api/freepik/*.
const FREEPIK_BASE_URL = "/api/freepik/v1/ai";

export type MagnificFlavor = "sublime" | "photo" | "photo_denoiser";

export type MagnificUpscaleOptions = {
    /** Source image URL or base64 string */
    image: string;
    /** Scale factor (2-16), default: 2 */
    scaleFactor?: number;
    /** Sharpness intensity (0-100), default: 7 */
    sharpen?: number;
    /** Smart grain/texture (0-100), default: 7 */
    smartGrain?: number;
    /** Ultra detail enhancement (0-100), default: 30 */
    ultraDetail?: number;
    /** Processing flavor, default: "photo" */
    flavor?: MagnificFlavor;
    /** Optional webhook URL for async notifications */
    webhookUrl?: string;
};

export function getFreepikKey(): string {
    return (import.meta.env.VITE_FREEPIK_KEY ?? "").trim();
}

type FreepikTaskResponse = {
    data: {
        task_id: string;
        status: "CREATED" | "IN_PROGRESS" | "PROCESSING" | "COMPLETED" | "FAILED";
        generated: string[];
    };
};

/**
 * Start a Magnific upscale task
 */
async function startUpscaleTask(
    key: string,
    options: MagnificUpscaleOptions
): Promise<string> {
    const endpoint = `${FREEPIK_BASE_URL}/image-upscaler-precision-v2`;

    const payload = {
        image: options.image,
        scale_factor: options.scaleFactor ?? 2,
        sharpen: options.sharpen ?? 7,
        smart_grain: options.smartGrain ?? 7,
        ultra_detail: options.ultraDetail ?? 30,
        flavor: options.flavor ?? "photo",
        ...(options.webhookUrl && { webhook_url: options.webhookUrl }),
    };

    const response = await withRetry(() =>
        fetchWithTimeout(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(key ? { "x-freepik-api-key": key } : {}),
            },
            body: JSON.stringify(payload),
            timeoutMs: 60000,
        })
    );

    if (!response.ok) {
        const errorDetails = await readErrorDetails(response);
        throw new Error(
            `Freepik upscale request failed (${response.status}): ${errorDetails}`
        );
    }

    const data = (await response.json()) as FreepikTaskResponse;
    const taskId = data.data?.task_id;

    if (!taskId) {
        throw new Error("Freepik response did not include a task_id");
    }

    return taskId;
}

/**
 * Poll for task completion
 */
async function pollTaskStatus(
    key: string,
    taskId: string,
    log?: (message: string) => void
): Promise<string[]> {
    const endpoint = `${FREEPIK_BASE_URL}/image-upscaler-precision-v2/${taskId}`;
    const maxAttempts = 120;
    const pollIntervalMs = 5000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const response = await fetchWithTimeout(endpoint, {
            method: "GET",
            headers: {
                ...(key ? { "x-freepik-api-key": key } : {}),
            },
            timeoutMs: 30000,
        });

        if (!response.ok) {
            const errorDetails = await readErrorDetails(response);
            throw new Error(
                `Freepik status check failed (${response.status}): ${errorDetails}`
            );
        }

        const data = (await response.json()) as FreepikTaskResponse;
        const status = data.data?.status;

        log?.(`[Magnific] Task ${taskId}: ${status} (attempt ${attempt + 1})`);

        if (status === "COMPLETED") {
            const generated = data.data?.generated;
            if (!generated || generated.length === 0) {
                throw new Error("Freepik task completed but no images were generated");
            }
            return generated;
        }

        if (status === "FAILED") {
            throw new Error(`Freepik upscale task failed: ${taskId}`);
        }

        await delay(pollIntervalMs);
    }

    throw new Error(`Freepik upscale task timed out after ${maxAttempts} attempts`);
}

/**
 * Upscale an image using Freepik Magnific API
 */
export async function callMagnificUpscale(
    options: MagnificUpscaleOptions,
    log?: (message: string) => void
): Promise<ProviderCallResult> {
    const key = getFreepikKey();
    if (!key && import.meta.env.DEV) {
        throw new Error("Missing VITE_FREEPIK_KEY environment variable");
    }

    log?.("[Magnific] Starting upscale task...");
    const taskId = await startUpscaleTask(key, options);
    log?.(`[Magnific] Task created: ${taskId}`);

    const urls = await pollTaskStatus(key, taskId, log);
    const url = urls[0];

    log?.(`[Magnific] Upscale complete: ${url}`);

    return {
        url,
        blob: await downloadBlob(url),
    };
}

/**
 * Convert a local file or File object to base64
 */
export async function imageToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Remove the data URL prefix if present
            const base64 = result.includes(",") ? result.split(",")[1] : result;
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
