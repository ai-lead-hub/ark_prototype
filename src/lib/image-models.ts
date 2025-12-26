import type {
  ModelProvider,
  TaskPollingConfig,
} from "./providers";

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
    maxRefs: 8,
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
            ? { image_input: imageUrls.slice(0, 8) }
            : {}),
          ...(resolvedAspect ? { aspect_ratio: resolvedAspect } : {}),
          ...(imageResolution ? { resolution: imageResolution } : {}),
          output_format: outputFormat ?? "png",
        },
      };
    },
    getUrls: (output) => {
      const resultJson = (output as { resultJson?: string } | undefined)?.resultJson;
      if (typeof resultJson === "string") {
        try {
          const parsed = JSON.parse(resultJson) as { resultUrls?: string[] };
          return (parsed.resultUrls ?? []).filter(Boolean) as string[];
        } catch {
          // fall through
        }
      }
      return [];
    },
  },
  {
    id: "nano-banana-edit",
    label: "Nano Banana — Edit",
    endpoint: "/api/v1/jobs/createTask",
    provider: "kie",
    pricing: "$0.02/image",
    mode: "edit",
    maxRefs: 10,
    ui: {
      aspectRatios: [
        { value: "1:1", label: "Square (1:1)" },
        { value: "3:4", label: "Portrait (3:4)" },
        { value: "2:3", label: "Portrait (2:3)" },
        { value: "9:16", label: "Portrait (9:16)" },
        { value: "4:3", label: "Landscape (4:3)" },
        { value: "3:2", label: "Landscape (3:2)" },
        { value: "16:9", label: "Landscape (16:9)" },
        { value: "21:9", label: "Landscape (21:9)" },
      ],
    },
    mapInput: ({ prompt, imageUrls, aspectRatio, outputFormat, size }) => {
      // If references are provided, use edit mode; otherwise fall back to text-to-image.
      const resolvedAspect = aspectRatio ?? resolveAspectRatio(size);
      const hasRefs = imageUrls.length > 0;
      return {
        model: hasRefs ? "google/nano-banana-edit" : "google/nano-banana",
        input: {
          prompt,
          ...(hasRefs
            ? { image_urls: imageUrls.slice(0, 10) }
            : resolvedAspect
              ? { image_size: resolvedAspect }
              : {}),
          output_format: outputFormat ?? "png",
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
    getUrls: (output) => {
      const data = (output as { resultJson?: string } | undefined)?.resultJson;
      if (typeof data !== "string") return [];
      try {
        const parsed = JSON.parse(data) as { resultUrls?: string[] };
        return (parsed.resultUrls ?? []).filter(Boolean);
      } catch {
        return [];
      }
    },
  },
  {
    id: "flux-2-pro",
    label: "Flux 2 Pro",
    endpoint: "/api/v1/jobs/createTask",
    provider: "kie",
    pricing: "$0.025/image (1K), $0.035/image (2K)",
    taskConfig: {
      statusEndpoint: "/api/v1/jobs/recordInfo",
      statePath: "data.state",
      successStates: ["success"],
      failureStates: ["fail"],
      responseDataPath: "data",
      pollIntervalMs: 4000,
    },
    mode: "edit",
    maxRefs: 8,
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
          ...(hasRefs ? { input_urls: imageUrls.slice(0, 8) } : {}),
          aspect_ratio: effectiveAspectRatio,
          resolution: imageResolution ?? "2K",
        },
      };
    },
    getUrls: (output) => {
      const resultJson = (output as { resultJson?: string } | undefined)?.resultJson;
      if (typeof resultJson === "string") {
        try {
          const parsed = JSON.parse(resultJson) as { resultUrls?: string[] };
          return (parsed.resultUrls ?? []).filter(Boolean) as string[];
        } catch {
          // fall through
        }
      }
      return [];
    },
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
    maxRefs: 1,
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
          ...(isEdit ? { image_urls: imageUrls } : {}),
          aspect_ratio: aspectRatio ?? "1:1",
          quality: imageResolution ?? "basic",
        },
      };
    },
    getUrls: (output) => {
      const resultJson = (output as { resultJson?: string } | undefined)?.resultJson;
      if (typeof resultJson === "string") {
        try {
          const parsed = JSON.parse(resultJson) as { resultUrls?: string[] };
          return (parsed.resultUrls ?? []).filter(Boolean) as string[];
        } catch {
          // fall through
        }
      }
      return [];
    },
  },
  {
    id: "qwen-image-edit-plus",
    label: "Qwen Image Edit Plus",
    endpoint: "fal-ai/qwen-image-edit-plus",
    provider: "fal-client",
    pricing: "$0.03/image",
    mode: "edit",
    maxRefs: 3,
    ui: {
      aspectRatios: [
        { value: "landscape_16_9", label: "Landscape (16:9)" },
        { value: "square_hd", label: "Square HD" },
        { value: "square", label: "Square" },
        { value: "portrait_4_3", label: "Portrait (3:4)" },
        { value: "portrait_16_9", label: "Portrait (9:16)" },
        { value: "landscape_4_3", label: "Landscape (4:3)" },
      ],
      outputFormats: [
        { value: "png", label: "PNG" },
        { value: "jpeg", label: "JPEG" },
      ],
    },
    mapInput: ({ prompt, imageUrls, aspectRatio, outputFormat, seed }) => {
      // Map standard aspect ratios to Qwen's expected format
      const aspectRatioMap: Record<string, string> = {
        "16:9": "landscape_16_9",
        "9:16": "portrait_16_9",
        "4:3": "landscape_4_3",
        "3:4": "portrait_4_3",
        "1:1": "square",
      };
      const mappedAspectRatio = aspectRatioMap[aspectRatio ?? ""] ?? aspectRatio ?? "square_hd";

      return {
        prompt,
        image_urls: imageUrls,
        image_size: mappedAspectRatio,
        output_format: outputFormat ?? "png",
        seed: seed ?? 1569,
        enable_safety_checker: true,
        num_images: 1,
      };
    },
    getUrls: (output) => {
      const images = (output as { images?: Array<{ url: string }> })?.images;
      return (images ?? []).map((img) => img.url).filter(Boolean);
    },
  },
  {
    id: "kling-o1",
    label: "Kling O1",
    endpoint: "fal-ai/kling-image/o1",
    provider: "fal-client",
    pricing: "$0.027/image",
    mode: "edit",
    maxRefs: 10,
    ui: {
      aspectRatios: [
        { value: "auto", label: "Auto" },
        { value: "16:9", label: "Landscape (16:9)" },
        { value: "9:16", label: "Portrait (9:16)" },
        { value: "1:1", label: "Square (1:1)" },
        { value: "4:3", label: "Landscape (4:3)" },
        { value: "3:4", label: "Portrait (3:4)" },
        { value: "3:2", label: "Landscape (3:2)" },
        { value: "2:3", label: "Portrait (2:3)" },
        { value: "21:9", label: "Ultrawide (21:9)" },
      ],
      resolutions: [
        { value: "2K", label: "2K" },
        { value: "1K", label: "1K" },
      ],
      defaultResolution: "2K",
      maxImages: { min: 1, max: 9, default: 1 },
    },
    mapInput: ({ prompt, imageUrls, aspectRatio, imageResolution, outputFormat, maxImages }) => {
      return {
        prompt,
        image_urls: imageUrls.slice(0, 10),
        resolution: imageResolution ?? "2K",
        num_images: maxImages ?? 1,
        aspect_ratio: aspectRatio ?? "auto",
        output_format: outputFormat ?? "png",
      };
    },
    getUrls: (output) => {
      const images = (output as { images?: Array<{ url: string }> })?.images;
      return (images ?? []).map((img) => img.url).filter(Boolean);
    },
  },
];
