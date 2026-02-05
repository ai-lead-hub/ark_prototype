import specs from "./models.json";
import type {
  ModelProvider,
  TaskPollingConfig,
} from "./providers";
import { extractUrl } from "./providers/shared";

type SupportFlag = boolean | "unstable" | "unspecified";

export type ParamType = "string" | "enum" | "number" | "boolean" | "array";

export type ParamDefinition = {
  type: ParamType;
  required?: boolean;
  values?: Array<string | number>;
  default?: string | number | boolean;
  uiKey?: keyof UnifiedPayload;
  hidden?: boolean; // Internal params that shouldn't show in UI
};

export type ModelSpec = {
  id: string;
  endpoint: string;
  provider?: ModelProvider;
  label?: string;
  pricing?: string;
  supports?: {
    startFrame?: boolean;
    endFrame?: boolean;
    audio?: boolean;
    resolution?: boolean;
    aspectRatio?: boolean;
    fps?: boolean;
  };
  params: Record<string, ParamDefinition | undefined>;
  output: {
    videoPath: string;
  };
  referenceImages?: {
    min?: number;
    max: number;
  };
  taskConfig?: TaskPollingConfig;
  adapter?: {
    mapInput(unified: UnifiedPayload): Record<string, FalInputValue>;
    getVideoUrl(data: unknown): string | undefined;
    getEndpoint?(unified: UnifiedPayload): string;
  };
};

export type UnifiedPayload = {
  modelId: string;
  prompt: string;
  start_frame_url?: string;
  end_frame_url?: string;
  duration?: string | number;
  aspect_ratio?: string;
  resolution?: string;
  fps?: number;
  generate_audio?: boolean;
  negative_prompt?: string;
  cfg_scale?: number;
  prompt_optimizer?: boolean;
  reference_image_urls?: string[];
  enable_prompt_expansion?: boolean;
  enable_translation?: boolean;
  watermark?: string;
  seed?: number;
  camera_fixed?: boolean;
  enable_safety_checker?: boolean;
  acceleration?: string;
  character_id_list?: string[];
};

// Helper function to extract video URL from KIE response
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

// Load models from JSON and add adapters for KIE models
const jsonSpecs =
  (specs.models as unknown as ModelSpec[])?.map((spec) => {
    const model: ModelSpec = {
      ...spec,
      label: spec.label ?? spec.id,
      provider: spec.provider ?? "fal",
    };

    // Adapter for FAL Kling 2.5 Turbo Pro I2V
    if (model.id === "kling-2.5-pro-fal") {
      model.adapter = {
        mapInput: (unified) => {
          if (!unified.start_frame_url) {
            throw new Error("Start frame is required for Kling 2.5 Turbo Pro (FAL).");
          }
          const duration = String(unified.duration ?? "5");
          const input: Record<string, FalInputValue> = {
            prompt: unified.prompt,
            image_url: unified.start_frame_url,
            duration,
            negative_prompt: unified.negative_prompt ?? "",
            cfg_scale:
              typeof unified.cfg_scale === "number" && Number.isFinite(unified.cfg_scale)
                ? unified.cfg_scale
                : 0.5,
          };
          if (unified.end_frame_url) {
            input.tail_image_url = unified.end_frame_url;
          }
          // FAL endpoint expects fields at the root, not nested under "input"
          return input;
        },
        getVideoUrl: (data) => extractUrl(data, 0, 5),
      };
    }

    // Adapter for FAL Kling V2.6 Pro I2V
    if (model.id === "kling-2.6-pro-fal") {
      model.adapter = {
        mapInput: (unified) => {
          if (!unified.start_frame_url) {
            throw new Error("Start frame is required for Kling V2.6 Pro (FAL).");
          }
          const duration = String(unified.duration ?? "5");
          const input: Record<string, FalInputValue> = {
            prompt: unified.prompt,
            image_url: unified.start_frame_url,
            duration,
            negative_prompt: unified.negative_prompt ?? "blur, distort, and low quality",
            generate_audio: unified.generate_audio ?? false,
          };
          if (unified.end_frame_url) {
            input.tail_image_url = unified.end_frame_url;
          }
          return input;
        },
        getVideoUrl: (data) => {
          // FAL returns { video: { url: "..." } }
          const video = (data as { video?: { url?: string } })?.video;
          return video?.url;
        },
      };
    }

    // Adapter for LTX-2 (supports both I2V and T2V)
    if (model.id === "ltx-2") {
      model.adapter = {
        mapInput: (unified) => {
          const hasImage = !!unified.start_frame_url;

          // Ensure duration is a number (API expects 6, 8, or 10 as integers)
          let duration: number = 6;
          if (unified.duration !== undefined) {
            duration = typeof unified.duration === "string"
              ? parseInt(unified.duration, 10)
              : unified.duration;
          }

          // Ensure fps is a number
          let fps: number = 25;
          if (unified.fps !== undefined) {
            fps = typeof unified.fps === "number" ? unified.fps : parseInt(String(unified.fps), 10);
          }

          const input: Record<string, FalInputValue> = {
            prompt: unified.prompt,
            duration,
            resolution: unified.resolution ?? "1080p",
            aspect_ratio: unified.aspect_ratio ?? "16:9",
            fps,
            generate_audio: unified.generate_audio ?? true,
          };

          // Only include image_url if we have an image (I2V mode)
          if (hasImage) {
            input.image_url = unified.start_frame_url;
          }

          return input;
        },
        getVideoUrl: (data) => {
          // LTX-2 returns { video: { url: "..." } }
          const video = (data as { video?: { url?: string } })?.video;
          return video?.url;
        },
        // Dynamic endpoint selection
        getEndpoint: (unified) => {
          return unified.start_frame_url
            ? "fal-ai/ltx-2/image-to-video"
            : "fal-ai/ltx-2/text-to-video";
        },
      };
    }

    // Add adapters for KIE models that need special input mapping
    if (model.provider === "kie") {
      // Check if this is a VEO model - uses Jobs API with custom response format
      if (model.id.startsWith("veo-3.1")) {
        model.adapter = {
          mapInput: (unified) => {
            const input: Record<string, FalInputValue> = {};

            // Determine if this is I2V (has image) or T2V (no image)
            const hasImage = !!unified.start_frame_url;

            if (hasImage) {
              // I2V mode
              const urls = [unified.start_frame_url!];
              if (unified.end_frame_url) {
                urls.push(unified.end_frame_url);
              }
              input.imageUrls = urls;
              input.generationType = "FIRST_AND_LAST_FRAMES_2_VIDEO";
            } else {
              // T2V mode
              input.generationType = "TEXT_2_VIDEO";
            }

            // Map other parameters
            for (const [paramKey, definition] of Object.entries(model.params)) {
              if (!definition || paramKey === "imageUrls" || paramKey === "generationType") continue;

              const uiKey = definition.uiKey ?? (paramKey as keyof UnifiedPayload);
              const value = unified[uiKey];

              if (value !== undefined) {
                input[paramKey] = value;
              } else if (definition.default !== undefined) {
                input[paramKey] = definition.default;
              }
            }

            // VEO uses direct params (not wrapped in {model, input})
            return input;
          },
          getVideoUrl: (data) => {
            // VEO returns video URL in data.response.resultUrls[0]
            const response = (data as { response?: { resultUrls?: string[] } })?.response;
            return response?.resultUrls?.[0];
          },
        };
      } else {
        // Jobs API models (Kling,  Hailuo, Wan, Seedance)
        model.adapter = {
          mapInput: (unified) => {
            const input: Record<string, FalInputValue> = {};

            // Map parameters based on model configuration
            for (const [paramKey, definition] of Object.entries(model.params)) {
              if (!definition) continue;

              const uiKey = definition.uiKey ?? (paramKey as keyof UnifiedPayload);
              const value = unified[uiKey];

              // Skip if value is undefined and not required
              if (value === undefined) {
                if (definition.default !== undefined) {
                  input[paramKey] = definition.default;
                }
                continue;
              }

              // Handle type conversions and validation
              if (definition.type === "number" && typeof value === "string") {
                const num = Number(value);
                if (!isNaN(num)) {
                  input[paramKey] = num;
                }
              } else if (definition.type === "string" && typeof value === "number") {
                input[paramKey] = String(value);
              } else if (definition.type === "enum" && definition.values) {
                // Validate enum values
                const stringValues = definition.values.map(String);
                const valStr = String(value);
                if (stringValues.includes(valStr)) {
                  input[paramKey] = value;
                } else {
                  // Fallback to default if available
                  if (definition.default !== undefined) {
                    input[paramKey] = definition.default;
                  } else if (definition.required) {
                    // If required and no default, we might want to throw or just pass it through (risky)
                    // For now, let's pass it through but log a warning if we could
                    input[paramKey] = value;
                  }
                }
              } else {
                input[paramKey] = value;
              }
            }

            // Models with both T2V and I2V endpoints - switch based on whether image is provided
            const kieModelMap: Record<string, { i2v: string; t2v?: string }> = {
              "grok-imagine/image-to-video": { i2v: "grok-imagine/image-to-video" },
              "kling-2.5-pro": { i2v: "kling/v2-5-turbo-image-to-video-pro" },
              "hailuo-2.3-pro": { i2v: "hailuo/2-3-image-to-video-pro" }, // T2V unavailable
              "hailuo-02-pro": {
                i2v: "hailuo/02-image-to-video-pro",
                t2v: "hailuo/02-text-to-video-pro"
              },
              "kling-v2-6-pro": {
                i2v: "kling-2.6/image-to-video",
                t2v: "kling-2.6/text-to-video"
              },
              "wan-2.6-i2v": {
                i2v: "wan/2-6-image-to-video",
                t2v: "wan/2-6-text-to-video"
              },
              "seedance-1.5-pro": {
                i2v: "bytedance/seedance-1.5-pro",
                t2v: "bytedance/seedance-1.5-pro"
              },
            };

            const endpoints = kieModelMap[model.id];
            if (!endpoints) {
              throw new Error(`Unknown KIE model: ${model.id}`);
            }

            // Select endpoint based on whether image is provided
            const hasImage = !!(unified.start_frame_url || input.image_url || input.image_urls);
            const kieModel = hasImage ? endpoints.i2v : (endpoints.t2v ?? endpoints.i2v);

            // If using T2V endpoint, remove image-related fields
            if (!hasImage && endpoints.t2v) {
              delete input.image_url;
              delete input.image_urls;
              delete input.tail_image_url;
            }

            // Special handling for Kling 2.6 I2V - image_urls must be an array
            if (model.id === "kling-v2-6-pro" && hasImage) {
              const imageUrl = input.image_urls ?? unified.start_frame_url;
              if (typeof imageUrl === "string") {
                input.image_urls = [imageUrl];
              }
            }

            // Special handling for Wan 2.6 I2V - image_urls must be an array
            if (model.id === "wan-2.6-i2v" && hasImage) {
              const imageUrl = input.image_urls ?? unified.start_frame_url;
              if (typeof imageUrl === "string") {
                input.image_urls = [imageUrl];
              }
            }

            // Special handling for Grok Imagine I2V - image_urls must be an array
            if (model.id === "grok-imagine/image-to-video" && hasImage) {
              const imageUrl = input.image_urls ?? unified.start_frame_url;
              if (typeof imageUrl === "string") {
                input.image_urls = [imageUrl];
              }
            }

            // Special handling for Seedance 1.5 Pro - uses input_urls array (0-2 images)
            if (model.id === "seedance-1.5-pro") {
              const urls: string[] = [];
              if (unified.start_frame_url) urls.push(unified.start_frame_url);
              if (unified.end_frame_url) urls.push(unified.end_frame_url);
              // Only add input_urls if we have images, otherwise T2V mode
              if (urls.length > 0) {
                input.input_urls = urls;
              }
              delete input.image_url; // Remove if present
            }

            return {
              model: kieModel,
              input,
            };
          },
          getVideoUrl: extractKieVideoUrl,
        };
      }
    }


    return model;
  }) ?? [];

export const MODEL_SPECS: ModelSpec[] = jsonSpecs;

export const MODEL_SPEC_MAP: Record<string, ModelSpec> = Object.fromEntries(
  MODEL_SPECS.map((spec) => [spec.id, spec])
);

export const DEFAULT_MODEL_ID = MODEL_SPECS[0]?.id ?? "";

const SAFE_END_KEYS = new Set(["tail_image_url", "last_frame_url"]);

function isSupportEnabled(flag: SupportFlag | undefined): boolean {
  return flag !== false;
}

function coerceEnumValue(
  value: unknown,
  allowed: Array<string | number>,
  fallback: string | number | undefined
): string | number | undefined {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (allowed.some((option) => option === value)) {
    return value as string | number;
  }
  return fallback;
}

type FalInputValue =
  | string
  | number
  | boolean
  | undefined
  | Record<string, unknown>
  | string[];

export function buildModelInput(
  model: ModelSpec,
  unified: UnifiedPayload
): Record<string, FalInputValue> {
  if (model.adapter) {
    return model.adapter.mapInput(unified);
  }

  const input: Record<string, FalInputValue> = {};

  for (const [paramKey, definition] of Object.entries(model.params)) {
    if (!definition) continue;
    const uiKey =
      definition.uiKey ??
      (paramKey as keyof UnifiedPayload);
    const unifiedValue = unified[uiKey];

    if (definition.type === "enum" && definition.values) {
      const coerced = coerceEnumValue(
        unifiedValue,
        definition.values,
        definition.default as string | number | undefined
      );
      if (coerced !== undefined) {
        input[paramKey] = coerced;
      } else if (definition.required) {
        throw new Error(`Missing required enum value for ${paramKey}`);
      }
      continue;
    }

    if (unifiedValue !== undefined) {
      input[paramKey] = unifiedValue;
      continue;
    }

    if (definition.default !== undefined) {
      input[paramKey] = definition.default;
      continue;
    }

    if (definition.required) {
      throw new Error(`Missing required param: ${String(uiKey)} → ${paramKey}`);
    }
  }

  if (!isSupportEnabled(model.supports?.endFrame)) {
    for (const key of SAFE_END_KEYS) {
      if (key in input) {
        delete input[key];
      }
    }
  } else if (!unified.end_frame_url) {
    for (const key of SAFE_END_KEYS) {
      if (key in input) {
        delete input[key];
      }
    }
  }

  return input;
}

function getPathSegments(path: string): string[] {
  return path.split(".").filter(Boolean);
}

export function extractVideoUrl(
  model: ModelSpec,
  data: unknown
): string | undefined {
  if (model.adapter) {
    return model.adapter.getVideoUrl(data);
  }
  const segments = getPathSegments(model.output.videoPath);
  let current: unknown = data;

  for (const segment of segments) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "string" ? current : undefined;
}
