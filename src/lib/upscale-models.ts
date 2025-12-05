import type { ModelProvider, TaskPollingConfig } from "./providers";

export type UpscaleJob = {
  sourceUrl: string;
  upscaleFactor?: string;
  targetResolution?: "1080p" | "2k" | "4k";
  targetFps?: "30fps" | "60fps";
};

export type UpscaleModelSpec = {
  id: string;
  label: string;
  endpoint: string;
  provider?: ModelProvider;
  pricing?: string;
  taskConfig?: TaskPollingConfig;
  kind: "image" | "video";
  mapInput(job: UpscaleJob): Record<string, unknown>;
};

export const UPSCALE_MODELS: UpscaleModelSpec[] = [
  {
    id: "seedvr-image-upscale",
    label: "SeedVR Image Upscaler",
    endpoint: "fal-ai/seedvr/upscale/image",
    provider: "fal",
    pricing: "Varies",
    kind: "image",
    mapInput: ({ sourceUrl, upscaleFactor }) => ({
      image_url: sourceUrl,
      upscale_mode: "factor",
      upscale_factor: Number(upscaleFactor || "2"),
      target_resolution: "1080p",
      noise_scale: 0.1,
      output_format: "png",
    }),
  },
  {
    id: "topaz-video-upscale",
    label: "Topaz Video Upscale",
    endpoint: "fal-ai/topaz/upscale/video",
    provider: "fal",
    pricing: "Varies",
    kind: "video",
    mapInput: ({ sourceUrl, upscaleFactor }) => ({
      video_url: sourceUrl,
      upscale_factor: Number(upscaleFactor || "2"),
      target_fps: 60,
      output_format: "mp4",
    }),
  },
];
