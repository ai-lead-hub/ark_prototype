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
    id: "seedvr2-image-upscale",
    label: "SeedVR2 Image Upscaler (WaveSpeed)",
    endpoint: "wavespeed-ai/seedvr2/image",
    provider: "wavespeed",
    pricing: "Varies",
    kind: "image",
    mapInput: ({ sourceUrl, targetResolution }) => ({
      image: sourceUrl,
      target_resolution: targetResolution ?? "4k",
      output_format: "jpeg",
      enable_base64_output: false,
      enable_sync_mode: false,
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
  {
    id: "magnific-v2",
    label: "Magnific V2 (Freepik)",
    endpoint: "image-upscaler-precision-v2",
    provider: "freepik",
    pricing: "API Credits",
    kind: "image",
    mapInput: ({ sourceUrl, upscaleFactor }) => ({
      image: sourceUrl,
      scale_factor: Number(upscaleFactor || "2"),
      sharpen: 7,
      smart_grain: 7,
      ultra_detail: 30,
      flavor: "photo",
    }),
  },
];
