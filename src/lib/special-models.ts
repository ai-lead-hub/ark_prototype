import type { TaskPollingConfig } from "./providers";

export type ParamType = "string" | "enum" | "number" | "boolean";

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
    inputType: "video"; // Extensible for future types: "audio", "multi-modal", etc.
    videoInputConfig: { min?: number; max: number };
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
        id: "wan-2.6-v2v",
        label: "Wan 2.6 V2V",
        endpoint: "/api/v1/jobs/createTask",
        provider: "kie",
        pricing: "$0.35 (720p) / $0.53 (1080p)",
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
    video_urls: string[];
    duration?: string;
    resolution?: string;
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

    // Add video URLs
    input.video_urls = payload.video_urls;

    // Determine KIE model endpoint
    const kieModelName = "wan/2-6-video-to-video";

    return {
        model: kieModelName,
        input,
    };
}

export function extractSpecialVideoUrl(data: unknown): string | undefined {
    return extractKieVideoUrl(data);
}
