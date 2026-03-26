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
  min?: number;
  max?: number;
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
  model?: string;
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
      provider: spec.provider ?? "kie",
    };

    // Adapter for LTX-2.3 (WaveSpeed) — I2V / T2V endpoint switching
    if (model.id === "ltx-2.3") {
      model.adapter = {
        mapInput: (unified) => {
          const input: Record<string, FalInputValue> = {
            prompt: unified.prompt ?? "",
            duration: typeof unified.duration === "string"
              ? parseInt(unified.duration, 10)
              : (unified.duration ?? 5),
            resolution: unified.resolution ?? "720p",
            seed: unified.seed ?? -1,
          };
          if (unified.start_frame_url) {
            input.image = unified.start_frame_url;
          }
          return input;
        },
        getVideoUrl: (data) => {
          const outputs = (data as { outputs?: string[] })?.outputs;
          return outputs?.[0];
        },
        getEndpoint: (unified) => {
          return unified.start_frame_url
            ? "wavespeed-ai/ltx-2.3/image-to-video"
            : "wavespeed-ai/ltx-2.3/text-to-video";
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

            const isRefModel = model.id === "veo-3.1-ref";
            const hasImage = !!unified.start_frame_url;
            const hasReferenceImages = (unified.reference_image_urls?.length ?? 0) > 0;

            if (isRefModel && hasReferenceImages) {
              // REFERENCE_2_VIDEO mode (veo3_fast only, 16:9 & 9:16)
              input.imageUrls = unified.reference_image_urls!.slice(0, 3);
              input.generationType = "REFERENCE_2_VIDEO";
            } else if (hasImage) {
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
                if (definition.type === "number") {
                  let numVal = typeof value === "string" ? parseInt(value, 10) : Number(value);
                  if (definition.min !== undefined) numVal = Math.max(definition.min, numVal);
                  if (definition.max !== undefined) numVal = Math.min(definition.max, numVal);
                  input[paramKey] = numVal;
                } else {
                  input[paramKey] = value;
                }
              } else if (definition.default !== undefined) {
                input[paramKey] = definition.default;
              } else if (
                definition.required &&
                definition.type === "enum" &&
                definition.values &&
                definition.values.length > 0
              ) {
                // Keep payloads valid by falling back to first allowed enum value.
                input[paramKey] = definition.values[0];
              } else if (definition.required) {
                throw new Error(`Missing required param: ${String(uiKey)} → ${paramKey}`);
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

              // Handle missing values
              if (value === undefined || value === null) {
                if (definition.default !== undefined) {
                  input[paramKey] = definition.default;
                } else if (
                  definition.required &&
                  definition.type === "enum" &&
                  definition.values &&
                  definition.values.length > 0
                ) {
                  // Keep payloads valid by falling back to first allowed enum value.
                  input[paramKey] = definition.values[0];
                } else if (definition.required) {
                  throw new Error(`Missing required param: ${String(uiKey)} → ${paramKey}`);
                }
                continue;
              }

              // Handle type conversions and validation
              if (definition.type === "number" && typeof value === "string") {
                const num = Number(value);
                if (!isNaN(num)) {
                  input[paramKey] = num;
                } else if (definition.required) {
                  throw new Error(`Invalid number for ${paramKey}: ${value}`);
                }
              } else if (definition.type === "string" && typeof value === "number") {
                input[paramKey] = String(value);
              } else if (definition.type === "enum" && definition.values) {
                // Validate enum values
                const stringValues = definition.values.map(String);
                const valStr = String(value);
                if (stringValues.includes(valStr)) {
                  // Use the model's canonical enum type (string/number) from config.
                  const matchedOption = definition.values.find(
                    (option) => String(option) === valStr
                  );
                  if (matchedOption !== undefined) {
                    input[paramKey] = matchedOption;
                  }
                } else {
                  // Fallback to default if available
                  if (definition.default !== undefined) {
                    input[paramKey] = definition.default;
                  } else if (definition.values.length > 0) {
                    input[paramKey] = definition.values[0];
                  } else if (definition.required) {
                    throw new Error(`Invalid enum value for ${paramKey}: ${valStr}`);
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
              "kling-3.0": {
                i2v: "kling-3.0/video",
                t2v: "kling-3.0/video"
              },
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
              "sora-2": {
                i2v: "sora-2-image-to-video",
                t2v: "sora-2-text-to-video"
              },
              "sora-2-pro": {
                i2v: "sora-2-pro-image-to-video",
                t2v: "sora-2-pro-text-to-video"
              },
            };

            const endpoints = kieModelMap[model.id];
            if (!endpoints) {
              throw new Error(`Unknown KIE model: ${model.id}`);
            }

            // Select endpoint based on whether image is provided
            const hasImage = !!(unified.start_frame_url || input.image_url || input.image_urls || (unified.reference_image_urls?.length ?? 0) > 0);
            const kieModel = hasImage ? endpoints.i2v : (endpoints.t2v ?? endpoints.i2v);

            // If using T2V endpoint, remove image-related fields
            if (!hasImage && endpoints.t2v) {
              delete input.image_url;
              delete input.image_urls;
              delete input.tail_image_url;
              delete input.end_image_url;
              delete input.last_frame_url;
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

            // Grok Imagine I2V — build image_urls from reference images (up to 7)
            if (model.id === "grok-imagine/image-to-video") {
              const refUrls = unified.reference_image_urls ?? [];
              const allUrls: string[] = [];
              if (unified.start_frame_url) allUrls.push(unified.start_frame_url);
              allUrls.push(...refUrls);
              if (allUrls.length > 0) {
                input.image_urls = allUrls.slice(0, 7);
              }
              // aspect_ratio only applies in multi-image mode
              if (allUrls.length > 1 && unified.aspect_ratio) {
                input.aspect_ratio = unified.aspect_ratio;
              }
            }

            // Sora 2 / Sora 2 Pro: image_urls must be an array for I2V
            if ((model.id === "sora-2" || model.id === "sora-2-pro") && hasImage) {
              const imageUrl = input.image_urls ?? unified.start_frame_url;
              if (typeof imageUrl === "string") {
                input.image_urls = [imageUrl];
              }
            }

            // Kling 3.0 simple: use image_urls array and allow optional end frame as 2nd image.
            if (model.id === "kling-3.0") {
              if (unified.end_frame_url && !unified.start_frame_url) {
                throw new Error("Start frame is required when end frame is provided.");
              }
              const urls: string[] = [];
              if (unified.start_frame_url) urls.push(unified.start_frame_url);
              if (unified.end_frame_url) urls.push(unified.end_frame_url);
              if (urls.length > 0) {
                input.image_urls = urls;
              } else {
                delete input.image_urls;
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
