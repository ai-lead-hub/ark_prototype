import type { TaskPollingConfig } from "./providers";

export type ParamType = "string" | "enum" | "number" | "boolean" | "array";

export type ParamDefinition = {
    type: ParamType;
    required?: boolean;
    values?: Array<string | number>;
    default?: string | number | boolean;
    hidden?: boolean;
};

export type SpecialModelSpec = {
    id: string;
    label: string;
    endpoint: string;
    provider: "kie" | "fal-client";
    pricing?: string;
    inputType: "video" | "image" | "both" | "references" | "kling-v3"; // "video" for V2V, "image" for T2V/I2V, "both" for image+video, "references" for multi-ref+elements, "kling-v3" for Kling V3 (start/end frames + elements only)
    videoInputConfig?: { min?: number; max: number }; // For video input models
    imageInputConfig?: { startFrame?: boolean; endFrame?: boolean }; // For image input models
    referencesConfig?: { maxImages: number; supportsElements: boolean }; // For reference models
    params: Record<string, ParamDefinition | undefined>;
    taskConfig?: TaskPollingConfig;
};

// Standard KIE task config for Jobs API
const kieTaskConfig: TaskPollingConfig = {
    statusEndpoint: "/api/v1/jobs/recordInfo",
    statePath: "data.state",
    successStates: ["success"],
    failureStates: ["fail"],
    responseDataPath: "data",
    pollIntervalMs: 4000,
};

export const SPECIAL_MODELS: SpecialModelSpec[] = [
    {
        id: "sora-2",
        label: "Sora 2",
        endpoint: "/api/v1/jobs/createTask",
        provider: "kie",
        pricing: "$0.15",
        inputType: "image",
        imageInputConfig: { startFrame: true, endFrame: false },
        taskConfig: kieTaskConfig,
        params: {
            prompt: {
                type: "string",
                required: true,
            },
            aspect_ratio: {
                type: "enum",
                required: false,
                values: ["portrait", "landscape"],
                default: "landscape",
            },
            duration: {
                type: "enum",
                required: false,
                values: ["10", "15"],
                default: "10",
            },
            remove_watermark: {
                type: "boolean",
                default: true,
                hidden: true,
            },
            character_id_list: {
                type: "array",
                required: false,
            },
        },
    },
    {
        id: "wan-2.6-v2v",
        label: "Wan 2.6 V2V",
        endpoint: "/api/v1/jobs/createTask",
        provider: "kie",
        pricing: "$0.53",
        inputType: "video",
        videoInputConfig: { min: 1, max: 3 },
        taskConfig: kieTaskConfig,
        params: {
            prompt: {
                type: "string",
                required: true,
            },
            duration: {
                type: "enum",
                required: true,
                values: ["5", "10"],
                default: "5",
            },
            resolution: {
                type: "enum",
                values: ["720p", "1080p"],
                default: "1080p",
            },
        },
    },
    {
        id: "kling-motion-control",
        label: "Kling Motion Control",
        endpoint: "/api/v1/jobs/createTask",
        provider: "kie",
        pricing: "$0.045",
        inputType: "both",
        videoInputConfig: { min: 1, max: 1 },
        imageInputConfig: { startFrame: true, endFrame: false },
        taskConfig: kieTaskConfig,
        params: {
            prompt: {
                type: "string",
                required: false,
            },
            character_orientation: {
                type: "enum",
                required: true,
                values: ["image", "video"],
                default: "video",
            },
            mode: {
                type: "enum",
                required: true,
                values: ["720p", "1080p"],
                default: "1080p",
            },
        },
    },
    {
        id: "kling-v3-pro",
        label: "Kling V3 Pro",
        endpoint: "fal-ai/kling-video/v3/pro/image-to-video",
        provider: "fal-client",
        pricing: "$0.224/sec (no audio) / $0.336/sec (with audio)",
        inputType: "kling-v3",  // Special input type - only start/end frames + elements
        imageInputConfig: { startFrame: true, endFrame: true },
        params: {
            prompt: {
                type: "string",
                required: true,
            },
            duration: {
                type: "enum",
                required: false,
                values: ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
                default: "5",
            },
            aspect_ratio: {
                type: "enum",
                required: false,
                values: ["16:9", "9:16", "1:1"],
                default: "16:9",
            },
            generate_audio: {
                type: "boolean",
                default: true,
            },
            cfg_scale: {
                type: "number",
                default: 0.5,
            },
            negative_prompt: {
                type: "string",
                default: "blur, distort, and low quality",
                hidden: true,
            },
        },
    },
];

export const SPECIAL_MODEL_MAP: Record<string, SpecialModelSpec> = Object.fromEntries(
    SPECIAL_MODELS.map((spec) => [spec.id, spec])
);

// Helper function to extract video URL from KIE response (same as models.ts)
function extractKieVideoUrl(data: unknown): string | undefined {
    const json = (data as { resultJson?: string } | undefined)?.resultJson;
    if (typeof json !== "string") return undefined;
    try {
        const parsed = JSON.parse(json) as { resultUrls?: string[] };
        return (parsed.resultUrls ?? []).find(
            (url) => typeof url === "string" && url.startsWith("http")
        );
    } catch {
        return undefined;
    }
}

export type SpecialUnifiedPayload = {
    modelId: string;
    prompt: string;
    // Video input (V2V models)
    video_urls?: string[];
    // Image input (T2V/I2V models like Sora 2)
    start_frame_url?: string;
    end_frame_url?: string;
    // Common params
    duration?: string;
    resolution?: string;
    aspect_ratio?: string;
    character_id_list?: string[];
    // Motion Control params
    character_orientation?: string;
    mode?: string;
    // Reference model params (Kling O1 Reference, Kling V3 Pro)
    image_urls?: string[]; // Reference images for style
    elements?: Array<{
        frontal_image_url?: string;
        reference_image_urls?: string[];
        video_url?: string;  // For video-based elements
    }>;
    // Kling V3 Pro specific
    generate_audio?: boolean;
    cfg_scale?: number;
    negative_prompt?: string;
    // Multishot prompts (uses multi_prompt field)
    multi_prompt?: Array<{
        prompt: string;
        duration: string;
    }>;
};

type InputValue = string | number | boolean | string[] | undefined;

export function buildSpecialModelInput(
    model: SpecialModelSpec,
    payload: SpecialUnifiedPayload
): { model: string; input: Record<string, InputValue> } {
    const input: Record<string, InputValue> = {};

    // Map parameters from payload
    for (const [paramKey, definition] of Object.entries(model.params)) {
        if (!definition) continue;

        const value = (payload as Record<string, unknown>)[paramKey];

        if (value !== undefined) {
            input[paramKey] = value as InputValue;
        } else if (definition.default !== undefined) {
            input[paramKey] = definition.default;
        }
    }

    // Determine KIE model endpoint and handle model-specific logic
    let kieModelName: string;

    if (model.id === "sora-2") {
        // Sora 2: T2V or I2V based on whether start frame is provided
        const hasImage = !!payload.start_frame_url;
        kieModelName = hasImage ? "sora-2-image-to-video" : "sora-2-text-to-video";

        // Map duration to n_frames for Sora 2 API
        if (input.duration !== undefined) {
            input.n_frames = input.duration;
            delete input.duration;
        }

        // Format image_urls as array for I2V
        if (hasImage) {
            input.image_urls = [payload.start_frame_url!];
        }
    } else if (model.id === "wan-2.6-v2v") {
        // Wan V2V
        kieModelName = "wan/2-6-video-to-video";
        // Add video URLs
        if (payload.video_urls) {
            input.video_urls = payload.video_urls;
        }
    } else if (model.id === "kling-motion-control") {
        // Kling Motion Control: requires both image and video
        kieModelName = "kling-2.6/motion-control";

        // Add image as input_urls array
        if (payload.start_frame_url) {
            input.input_urls = [payload.start_frame_url];
        }

        // Add video as video_urls array
        if (payload.video_urls) {
            input.video_urls = payload.video_urls;
        }
    } else if (model.id === "kling-v3-pro") {
        // Kling V3 Pro: FAL model with elements, multi-shot, audio
        const falInput: Record<string, unknown> = {
            aspect_ratio: payload.aspect_ratio ?? "16:9",
            generate_audio: payload.generate_audio ?? true,
            cfg_scale: payload.cfg_scale ?? 0.5,
            negative_prompt: payload.negative_prompt ?? "blur, distort, and low quality",
        };

        // Handle multishot prompts (uses multi_prompt field)
        if (payload.multi_prompt && payload.multi_prompt.length > 0) {
            falInput.multi_prompt = payload.multi_prompt.map((shot: { prompt: string; duration: string }) => ({
                prompt: shot.prompt,
                // Enforce minimum 3 seconds per shot as per API requirements
                duration: String(Math.max(3, parseInt(shot.duration) || 3)),
            }));
            // Calculate total duration from shots (respecting min 3s per shot)
            const totalDuration = (falInput.multi_prompt as Array<{ duration: string }>).reduce(
                (sum: number, shot: { duration: string }) => sum + parseInt(shot.duration),
                0
            );
            falInput.duration = String(totalDuration);
        } else {
            // Use normal prompt
            falInput.prompt = payload.prompt;
            // Also enforce minimum 3s for single video
            falInput.duration = String(Math.max(3, parseInt(payload.duration ?? "5") || 5));
        }

        // Add start frame if provided
        if (payload.start_frame_url) {
            falInput.start_image_url = payload.start_frame_url;
        }

        // Add end frame if provided
        if (payload.end_frame_url) {
            falInput.end_image_url = payload.end_frame_url;
        }

        // Add elements if provided (convert to FAL format)
        if (payload.elements && payload.elements.length > 0) {
            falInput.elements = payload.elements.map(el => {
                if (el.video_url) {
                    // Video-based element
                    return { video_url: el.video_url };
                } else {
                    // Image-based element
                    return {
                        frontal_image_url: el.frontal_image_url,
                        reference_image_urls: el.reference_image_urls ?? [],
                    };
                }
            });
        }

        return {
            model: model.endpoint,
            input: falInput as unknown as Record<string, InputValue>,
        };
    } else {
        // Fallback for unknown models
        kieModelName = model.id;
    }

    return {
        model: kieModelName,
        input,
    };
}

export function extractSpecialVideoUrl(data: unknown): string | undefined {
    return extractKieVideoUrl(data);
}

