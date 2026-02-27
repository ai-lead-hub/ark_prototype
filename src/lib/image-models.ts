import type {
  ModelProvider,
  TaskPollingConfig,
} from "./providers";
import {
  parseKieResultUrls,
} from "./model-helpers";

export type ImageSizePreset =
  | "square_hd"
  | "square"
  | "portrait_4_3"
  | "portrait_3_2"
  | "portrait_16_9"
  | "landscape_4_3"
  | "landscape_3_2"
  | "landscape_16_9"
  | "landscape_21_9";

export type UiOption = { value: string; label: string };

export type ImageJob = {
  prompt: string;
  imageUrls: string[]; // Order matters for some models (e.g. Flux uses the first image as primary reference)
  elements?: Array<{
    frontal_image_url: string;
    reference_image_urls?: string[];
  }>;
  size?: ImageSizePreset | { width: number; height: number };
  seed?: number;
  temporal?: boolean;
  steps?: number;
  imageResolution?: string;
  maxImages?: number;
  outputFormat?: string;
  aspectRatio?: string;
  enableTranslation?: boolean;
  model?: string;
  promptUpsampling?: boolean;
  safetyTolerance?: number;
  watermark?: string;
  numImages?: number;
};

export type ImageModelSpec = {
  id: string;
  label: string;
  endpoint: string;
  provider?: ModelProvider;
  pricing?: string;
  mode: "edit" | "hybrid" | "text";
  maxRefs: number;
  supportsElements?: boolean;
  taskConfig?: TaskPollingConfig;
  mapInput: (job: ImageJob) => Record<string, unknown>;
  getUrls: (out: unknown) => string[];
  requireReference?: boolean;
  ui?: {
    aspectRatios?: UiOption[];
    resolutions?: UiOption[];
    defaultResolution?: string;
    outputFormats?: UiOption[];
    maxImages?: { min: number; max: number; default: number };
    supportsSyncMode?: boolean;
  };
};

function resolveAspectRatio(
  size: ImageJob["size"]
): string | undefined {
  if (!size) return undefined;
  if (typeof size === "string") {
    switch (size) {
      case "square_hd":
      case "square":
        return "1:1";
      case "portrait_4_3":
        return "3:4";
      case "portrait_3_2":
        return "2:3";
      case "portrait_16_9":
        return "9:16";
      case "landscape_4_3":
        return "4:3";
      case "landscape_3_2":
        return "3:2";
      case "landscape_16_9":
        return "16:9";
      case "landscape_21_9":
        return "21:9";
      default:
        return undefined;
    }
  }
  const { width, height } = size;
  if (!width || !height) return undefined;
  const gcd = (a: number, b: number): number =>
    b === 0 ? a : gcd(b, a % b);
  const factor = gcd(Math.round(width), Math.round(height));
  const w = Math.round(width / factor);
  const h = Math.round(height / factor);
  return `${w}:${h}`;
}

export const IMAGE_MODELS: ImageModelSpec[] = [
  {
    id: "nano-banana-pro-edit",
    label: "Nano Banana Pro",
    endpoint: "/api/v1/jobs/createTask",
    provider: "kie",
    pricing: "$0.09/image",
    taskConfig: {
      statusEndpoint: "/api/v1/jobs/recordInfo",
      statePath: "data.state",
      successStates: ["success"],
      failureStates: ["fail"],
      responseDataPath: "data",
      pollIntervalMs: 4000,
    },
    mode: "edit",
    maxRefs: 5,
    ui: {
      aspectRatios: [
        { value: "1:1", label: "1:1" },
        { value: "2:3", label: "2:3" },
        { value: "3:2", label: "3:2" },
        { value: "3:4", label: "3:4" },
        { value: "4:3", label: "4:3" },
        { value: "4:5", label: "4:5" },
        { value: "5:4", label: "5:4" },
        { value: "9:16", label: "9:16" },
        { value: "16:9", label: "16:9" },
        { value: "21:9", label: "21:9" },
        { value: "auto", label: "Auto" },
      ],
      resolutions: [
        { value: "2K", label: "2K" },
        { value: "1K", label: "1K" },
        { value: "4K", label: "4K" },
      ],
      outputFormats: [
        { value: "png", label: "PNG" },
        { value: "jpg", label: "JPG" },
      ],
    },
    mapInput: ({
      prompt,
      imageUrls,
      size,
      imageResolution,
      aspectRatio,
      outputFormat,
    }) => {
      const resolvedAspect = aspectRatio ?? resolveAspectRatio(size);
      return {
        model: "nano-banana-pro",
        input: {
          prompt,
          ...(imageUrls.length
            ? { image_input: imageUrls.slice(0, 5) }
            : {}),
          ...(resolvedAspect ? { aspect_ratio: resolvedAspect } : {}),
          ...(imageResolution ? { resolution: imageResolution } : {}),
          output_format: outputFormat ?? "png",
        },
      };
    },
    getUrls: parseKieResultUrls,
  },
  {
    id: "nano-banana-2",
    label: "Nano Banana 2",
    endpoint: "/api/v1/jobs/createTask",
    provider: "kie",
    pricing: "$0.06/image",
    mode: "edit",
    maxRefs: 14,
    ui: {
      aspectRatios: [
        { value: "1:1", label: "1:1" },
        { value: "1:4", label: "1:4" },
        { value: "1:8", label: "1:8" },
        { value: "2:3", label: "2:3" },
        { value: "3:2", label: "3:2" },
        { value: "3:4", label: "3:4" },
        { value: "4:1", label: "4:1" },
        { value: "4:3", label: "4:3" },
        { value: "4:5", label: "4:5" },
        { value: "5:4", label: "5:4" },
        { value: "8:1", label: "8:1" },
        { value: "9:16", label: "9:16" },
        { value: "16:9", label: "16:9" },
        { value: "21:9", label: "21:9" },
        { value: "auto", label: "Auto" },
      ],
      resolutions: [
        { value: "1K", label: "1K" },
        { value: "2K", label: "2K" },
        { value: "4K", label: "4K" },
      ],
      outputFormats: [
        { value: "jpg", label: "JPG" },
        { value: "png", label: "PNG" },
      ],
    },
    mapInput: ({
      prompt,
      imageUrls,
      aspectRatio,
      imageResolution,
      outputFormat,
      size,
    }) => {
      const resolvedAspect = aspectRatio ?? resolveAspectRatio(size);
      return {
        model: "nano-banana-2",
        input: {
          prompt,
          ...(imageUrls.length
            ? { image_input: imageUrls.slice(0, 14) }
            : {}),
          ...(resolvedAspect ? { aspect_ratio: resolvedAspect } : {}),
          ...(imageResolution ? { resolution: imageResolution } : {}),
          output_format: outputFormat ?? "jpg",
        },
      };
    },
    taskConfig: {
      statusEndpoint: "/api/v1/jobs/recordInfo",
      statePath: "data.state",
      successStates: ["success"],
      failureStates: ["fail"],
      responseDataPath: "data",
      pollIntervalMs: 4000,
    },
    getUrls: parseKieResultUrls,
  },
  {
    id: "flux-2-pro",
    label: "Flux 2 Pro",
    endpoint: "/api/v1/jobs/createTask",
    provider: "kie",
    pricing: "$0.035/image",
    taskConfig: {
      statusEndpoint: "/api/v1/jobs/recordInfo",
      statePath: "data.state",
      successStates: ["success"],
      failureStates: ["fail"],
      responseDataPath: "data",
      pollIntervalMs: 4000,
    },
    mode: "edit",
    maxRefs: 5,
    ui: {
      aspectRatios: [
        { value: "auto", label: "Auto (Match Input)" },
        { value: "1:1", label: "Square (1:1)" },
        { value: "4:3", label: "Landscape (4:3)" },
        { value: "3:4", label: "Portrait (3:4)" },
        { value: "16:9", label: "Widescreen (16:9)" },
        { value: "9:16", label: "Vertical (9:16)" },
        { value: "3:2", label: "Classic (3:2)" },
        { value: "2:3", label: "Classic Portrait (2:3)" },
      ],
      resolutions: [
        { value: "1K", label: "1K" },
        { value: "2K", label: "2K" },
      ],
      defaultResolution: "2K",
    },
    mapInput: ({ prompt, imageUrls, aspectRatio, imageResolution }) => {
      const hasRefs = imageUrls.length > 0;
      // For text-to-image, 'auto' aspect ratio is not valid, default to 1:1
      const effectiveAspectRatio = (!hasRefs && aspectRatio === "auto") ? "1:1" : (aspectRatio ?? "auto");

      return {
        model: hasRefs ? "flux-2/pro-image-to-image" : "flux-2/pro-text-to-image",
        input: {
          prompt,
          ...(hasRefs ? { input_urls: imageUrls.slice(0, 5) } : {}),
          aspect_ratio: effectiveAspectRatio,
          resolution: imageResolution ?? "2K",
        },
      };
    },
    getUrls: parseKieResultUrls,
  },
  {
    id: "gpt-image-1-5",
    label: "GPT Image 1.5",
    endpoint: "/api/v1/jobs/createTask",
    provider: "kie",
    pricing: "$0.04/image",
    taskConfig: {
      statusEndpoint: "/api/v1/jobs/recordInfo",
      statePath: "data.state",
      successStates: ["success"],
      failureStates: ["fail"],
      responseDataPath: "data",
      pollIntervalMs: 4000,
    },
    mode: "edit",
    maxRefs: 5,
    ui: {
      aspectRatios: [
        { value: "1:1", label: "Square (1:1)" },
        { value: "2:3", label: "Portrait (2:3)" },
        { value: "3:2", label: "Landscape (3:2)" },
      ],
      resolutions: [
        { value: "medium", label: "Medium (Balanced)" },
        { value: "high", label: "High (Detailed)" },
      ],
      defaultResolution: "medium",
    },
    mapInput: ({ prompt, imageUrls, aspectRatio, imageResolution }) => {
      const hasRefs = imageUrls.length > 0;
      // GPT Image 1.5 only accepts 1:1, 2:3, 3:2 for aspect ratio
      const validAspectRatios = ["1:1", "2:3", "3:2"];
      let effectiveAspectRatio = aspectRatio;
      if (!validAspectRatios.includes(aspectRatio ?? "")) {
        console.warn(
          `[GPT Image 1.5] Aspect ratio "${aspectRatio}" is not supported. Using "1:1" instead. Supported: ${validAspectRatios.join(", ")}`
        );
        effectiveAspectRatio = "1:1";
      }

      return {
        model: hasRefs ? "gpt-image/1.5-image-to-image" : "gpt-image/1.5-text-to-image",
        input: {
          prompt,
          ...(hasRefs ? { input_urls: imageUrls.slice(0, 5) } : {}),
          aspect_ratio: effectiveAspectRatio,
          quality: imageResolution ?? "medium",
        },
      };
    },
    getUrls: parseKieResultUrls,
  },
  {
    id: "seedream-v4-5",
    label: "Seedream 4.5",
    endpoint: "/api/v1/jobs/createTask",
    provider: "kie",
    pricing: "$0.032/image",
    taskConfig: {
      statusEndpoint: "/api/v1/jobs/recordInfo",
      statePath: "data.state",
      successStates: ["success"],
      failureStates: ["fail"],
      responseDataPath: "data",
      pollIntervalMs: 4000,
    },
    mode: "edit",
    maxRefs: 5,
    ui: {
      aspectRatios: [
        { value: "1:1", label: "Square (1:1)" },
        { value: "4:3", label: "Landscape (4:3)" },
        { value: "3:4", label: "Portrait (3:4)" },
        { value: "16:9", label: "Landscape (16:9)" },
        { value: "9:16", label: "Portrait (9:16)" },
        { value: "2:3", label: "Portrait (2:3)" },
        { value: "3:2", label: "Landscape (3:2)" },
        { value: "21:9", label: "Landscape (21:9)" },
      ],
      resolutions: [
        { value: "basic", label: "Basic (2K)" },
        { value: "high", label: "High (4K)" },
      ],
      defaultResolution: "basic",
    },
    mapInput: ({ prompt, imageUrls, aspectRatio, imageResolution }) => {
      const isEdit = imageUrls.length > 0;
      return {
        model: isEdit ? "seedream/4.5-edit" : "seedream/4.5-text-to-image",
        input: {
          prompt,
          ...(isEdit ? { image_urls: imageUrls.slice(0, 5) } : {}),
          aspect_ratio: aspectRatio ?? "1:1",
          quality: imageResolution ?? "basic",
        },
      };
    },
    getUrls: parseKieResultUrls,
  },
  {
    id: "seedream-5-lite",
    label: "Seedream 5 Lite",
    endpoint: "/api/v1/jobs/createTask",
    provider: "kie",
    pricing: "$0.0275/image",
    taskConfig: {
      statusEndpoint: "/api/v1/jobs/recordInfo",
      statePath: "data.state",
      successStates: ["success"],
      failureStates: ["fail"],
      responseDataPath: "data",
      pollIntervalMs: 4000,
    },
    mode: "edit",
    maxRefs: 5,
    ui: {
      aspectRatios: [
        { value: "1:1", label: "1:1" },
        { value: "4:3", label: "4:3" },
        { value: "3:4", label: "3:4" },
        { value: "16:9", label: "16:9" },
        { value: "9:16", label: "9:16" },
        { value: "2:3", label: "2:3" },
        { value: "3:2", label: "3:2" },
        { value: "21:9", label: "21:9" },
      ],
      resolutions: [
        { value: "basic", label: "Basic (2K)" },
        { value: "high", label: "High (3K)" },
      ],
      defaultResolution: "basic",
    },
    mapInput: ({ prompt, imageUrls, aspectRatio, imageResolution }) => {
      const isEdit = imageUrls.length > 0;
      return {
        model: isEdit
          ? "seedream/5-lite-image-to-image"
          : "seedream/5-lite-text-to-image",
        input: {
          prompt,
          ...(isEdit ? { image_urls: imageUrls.slice(0, 5) } : {}),
          aspect_ratio: aspectRatio ?? "1:1",
          quality: imageResolution ?? "basic",
        },
      };
    },
    getUrls: parseKieResultUrls,
  },
];
