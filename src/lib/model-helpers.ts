/**
 * Model Helpers - Shared utilities for image and video models
 * 
 * This file contains reusable functions to reduce code duplication across models.
 * Use these helpers when adding new models to keep the codebase consistent.
 */

import type { ImageSizePreset } from "./image-models";

// ============================================================================
// RESPONSE PARSERS
// ============================================================================

/**
 * Parse result URLs from a KIE API response
 * Most KIE models return data in format: { resultJson: '{"resultUrls": ["url1", "url2"]}' }
 * 
 * @example
 * const urls = parseKieResultUrls(apiResponse);
 * // Returns: ["https://example.com/image1.jpg", "https://example.com/image2.jpg"]
 */
export function parseKieResultUrls(output: unknown): string[] {
    const resultJson = (output as { resultJson?: string } | undefined)?.resultJson;
    if (typeof resultJson !== "string") return [];

    try {
        const parsed = JSON.parse(resultJson) as { resultUrls?: string[] };
        return (parsed.resultUrls ?? []).filter(
            (url): url is string => typeof url === "string" && url.startsWith("http")
        );
    } catch {
        return [];
    }
}

/**
 * Extract video URL from KIE response (returns first valid URL)
 * 
 * @example
 * const videoUrl = parseKieVideoUrl(apiResponse);
 * // Returns: "https://example.com/video.mp4" or undefined
 */
export function parseKieVideoUrl(output: unknown): string | undefined {
    const urls = parseKieResultUrls(output);
    return urls[0];
}

/**
 * Parse image URLs from a FAL API response
 * FAL models return data in format: { images: [{ url: "..." }, { url: "..." }] }
 * 
 * @example
 * const urls = parseFalImageUrls(apiResponse);
 * // Returns: ["https://example.com/image1.jpg"]
 */
export function parseFalImageUrls(output: unknown): string[] {
    const images = (output as { images?: Array<{ url: string }> })?.images;
    return (images ?? []).map((img) => img.url).filter(Boolean);
}

/**
 * Extract video URL from FAL response
 * FAL video models return: { video: { url: "..." } }
 * 
 * @example
 * const videoUrl = parseFalVideoUrl(apiResponse);
 */
export function parseFalVideoUrl(output: unknown): string | undefined {
    const data = output as { video?: { url?: string } } | undefined;
    return data?.video?.url;
}

// ============================================================================
// ASPECT RATIO UTILITIES
// ============================================================================

/**
 * Convert ImageSizePreset or dimension object to aspect ratio string
 * 
 * @example
 * resolveAspectRatio("landscape_16_9") // Returns "16:9"
 * resolveAspectRatio({ width: 1920, height: 1080 }) // Returns "16:9"
 * resolveAspectRatio("square_hd") // Returns "1:1"
 */
export function resolveAspectRatio(
    size: ImageSizePreset | { width: number; height: number } | undefined
): string | undefined {
    if (!size) return undefined;

    if (typeof size === "string") {
        const presetMap: Record<ImageSizePreset, string> = {
            square_hd: "1:1",
            square: "1:1",
            portrait_4_3: "3:4",
            portrait_3_2: "2:3",
            portrait_16_9: "9:16",
            landscape_4_3: "4:3",
            landscape_3_2: "3:2",
            landscape_16_9: "16:9",
            landscape_21_9: "21:9",
        };
        return presetMap[size];
    }

    const { width, height } = size;
    if (!width || !height) return undefined;

    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const factor = gcd(Math.round(width), Math.round(height));
    return `${Math.round(width / factor)}:${Math.round(height / factor)}`;
}

/**
 * Validate and normalize aspect ratio for a specific model
 * Returns the aspect ratio if valid, or defaultValue if not
 * 
 * @example
 * validateAspectRatio("16:9", ["1:1", "16:9", "9:16"], "1:1") // Returns "16:9"
 * validateAspectRatio("4:3", ["1:1", "16:9"], "1:1") // Returns "1:1" (invalid, uses default)
 */
export function validateAspectRatio(
    aspectRatio: string | undefined,
    validOptions: string[],
    defaultValue: string
): string {
    if (!aspectRatio) return defaultValue;
    return validOptions.includes(aspectRatio) ? aspectRatio : defaultValue;
}

// ============================================================================
// KIE TASK CONFIG (Standard polling configuration)
// ============================================================================

/**
 * Standard KIE task polling configuration
 * Use this for all KIE models to ensure consistent polling behavior
 */
export const KIE_TASK_CONFIG = {
    statusEndpoint: "/api/v1/jobs/recordInfo",
    statePath: "data.state",
    successStates: ["success"],
    failureStates: ["fail"],
    responseDataPath: "data",
    pollIntervalMs: 4000,
} as const;

// ============================================================================
// MODEL CREATION HELPERS
// ============================================================================

/**
 * Common aspect ratio options used by many models
 */
export const COMMON_ASPECT_RATIOS = {
    square: { value: "1:1", label: "Square (1:1)" },
    portrait_3_4: { value: "3:4", label: "Portrait (3:4)" },
    portrait_2_3: { value: "2:3", label: "Portrait (2:3)" },
    portrait_9_16: { value: "9:16", label: "Portrait (9:16)" },
    landscape_4_3: { value: "4:3", label: "Landscape (4:3)" },
    landscape_3_2: { value: "3:2", label: "Landscape (3:2)" },
    landscape_16_9: { value: "16:9", label: "Landscape (16:9)" },
    landscape_21_9: { value: "21:9", label: "Ultrawide (21:9)" },
    auto: { value: "auto", label: "Auto (Match Input)" },
} as const;

/**
 * Common resolution options
 */
export const COMMON_RESOLUTIONS = {
    res_1K: { value: "1K", label: "1K" },
    res_2K: { value: "2K", label: "2K" },
    res_4K: { value: "4K", label: "4K" },
    res_720p: { value: "720p", label: "720p" },
    res_1080p: { value: "1080p", label: "1080p" },
} as const;

/**
 * Common quality options
 */
export const COMMON_QUALITY = {
    basic: { value: "basic", label: "Basic" },
    medium: { value: "medium", label: "Medium" },
    high: { value: "high", label: "High" },
} as const;

/**
 * Common output format options
 */
export const COMMON_OUTPUT_FORMATS = {
    png: { value: "png", label: "PNG" },
    jpg: { value: "jpg", label: "JPG" },
    jpeg: { value: "jpeg", label: "JPEG" },
    webp: { value: "webp", label: "WebP" },
} as const;

/**
 * Common duration options for video models
 */
export const COMMON_DURATIONS = {
    sec_5: { value: "5", label: "5 seconds" },
    sec_10: { value: "10", label: "10 seconds" },
    sec_15: { value: "15", label: "15 seconds" },
} as const;
