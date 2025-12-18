# API Reference

This document provides a comprehensive reference for all video generation and image editing models available in the application.

## Video Generation Models

### Kling 2.5 Turbo Pro
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: $0.21 (5s), $0.42 (10s)

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID | `"kling/v2-5-turbo-image-to-video-pro"` |
| `input.prompt` | string | Yes | Text description for video generation. Max 2500 chars. | `"Astronaut instantly teleports..."` |
| `input.image_url` | string | Yes | URL of the start frame image. Max 10MB. | `"https://..."` |
| `input.tail_image_url` | string | No | URL of the end frame image. Max 10MB. | `"https://..."` |
| `input.duration` | string | No | Video duration. Options: `"5"`, `"10"`. Default: `"5"`. | `"5"` |
| `input.negative_prompt` | string | No | Elements to avoid. Max 2496 chars. | `"blur, distort"` |
| `input.cfg_scale` | number | No | Guidance scale (0.0 - 1.0). Default: `0.5`. | `0.5` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example
```json
{
  "model": "kling/v2-5-turbo-image-to-video-pro",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "Astronaut instantly teleports...",
    "image_url": "https://file.aiquickdraw.com/...",
    "tail_image_url": "",
    "duration": "5",
    "negative_prompt": "blur, distort",
    "cfg_scale": 0.5
  }
}
```

---

### Kling V2.6 Pro (I2V)
**Provider**: FAL
**Endpoint**: `fal-ai/kling-video/v2.6/pro/image-to-video`
**Pricing**: $0.07/sec (audio off), $0.14/sec (audio on)

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `prompt` | string | Yes | Text description for video generation. | `"A king walks slowly..."` |
| `image_url` | string | Yes | URL of the start frame image. | `"https://..."` |
| `duration` | string | No | Video duration. Options: `"5"`, `"10"`. Default: `"5"`. | `"5"` |
| `generate_audio` | boolean | No | Generate native audio. Default: `false`. | `true` |
| `negative_prompt` | string | No | Elements to avoid. | `"blur, distort"` |

#### Request Example
```json
{
  "prompt": "A king walks slowly and says \"My people, here I am!\"",
  "image_url": "https://v3b.fal.media/files/...",
  "duration": "5",
  "generate_audio": true,
  "negative_prompt": "blur, distort, and low quality"
}
```

---

### Hailuo 2.3 Pro
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: $0.22 (6s 768P), $0.45 (10s 768P), $0.39 (6s 1080P)

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID | `"hailuo/2-3-image-to-video-pro"` |
| `input.prompt` | string | Yes | Text prompt. Max 5000 chars. | `"A graceful geisha..."` |
| `input.image_url` | string | Yes | Input image URL. Max 10MB. | `"https://..."` |
| `input.duration` | string | No | Duration. Options: `"6"`, `"10"`. Default: `"6"`. | `"6"` |
| `input.resolution` | string | No | Resolution. Options: `"768P"`, `"1080P"`. Default: `"1080P"`. | `"1080P"` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example
```json
{
  "model": "hailuo/2-3-image-to-video-pro",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "A graceful geisha...",
    "image_url": "https://file.aiquickdraw.com/...",
    "duration": "6",
    "resolution": "768P"
  }
}
```

---

### Wan 2.5 (I2V)
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: $0.06/sec (720p), $0.10/sec (1080p)

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID | `"wan/2-5-image-to-video"` |
| `input.prompt` | string | Yes | Text prompt. Max 800 chars. | `"The same woman..."` |
| `input.image_url` | string | Yes | Input image URL. Max 10MB. | `"https://..."` |
| `input.duration` | string | No | Duration. Options: `"5"`, `"10"`. Default: `"5"`. | `"5"` |
| `input.resolution` | string | No | Resolution. Options: `"720p"`, `"1080p"`. Default: `"1080p"`. | `"1080p"` |
| `input.enable_prompt_expansion` | boolean | No | Enable LLM prompt expansion. Default: `true`. | `true` |
| `input.seed` | number | No | Random seed. | `12345` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example
```json
{
  "model": "wan/2-5-image-to-video",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "The same woman...",
    "image_url": "https://file.aiquickdraw.com/...",
    "duration": "5",
    "resolution": "1080p",
    "enable_prompt_expansion": true
  }
}
```

---

### Wan 2.6 (I2V/T2V)
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: $0.35-$0.53 (720p) / $0.53-$1.58 (1080p) depending on duration

Supports both Text-to-Video (T2V) and Image-to-Video (I2V). When `image_urls` is empty or omitted, operates in T2V mode.

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID | `"wan/2-6-image-to-video"` |
| `input.prompt` | string | Yes | Text prompt. Min 2, max 5000 chars. | `"A beautiful sunset..."` |
| `input.image_urls` | array | No | Input image URLs. Empty for T2V. Max 10MB per image. | `["https://..."]` |
| `input.duration` | string | No | Duration. Options: `"5"`, `"10"`, `"15"`. Default: `"5"`. | `"5"` |
| `input.resolution` | string | No | Resolution. Options: `"720p"`, `"1080p"`. Default: `"1080p"`. | `"1080p"` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example (I2V)
```json
{
  "model": "wan/2-6-image-to-video",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "A beautiful sunset over the ocean...",
    "image_urls": ["https://file.aiquickdraw.com/..."],
    "duration": "10",
    "resolution": "1080p"
  }
}
```

#### Request Example (T2V)
```json
{
  "model": "wan/2-6-image-to-video",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "A cinematic shot of a rocket launching...",
    "image_urls": [],
    "duration": "5",
    "resolution": "720p"
  }
}
```

---

### Wan 2.6 V2V (Video-to-Video)
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: $0.35-$0.53 (720p) / $0.53-$1.05 (1080p) depending on duration

Transforms existing videos based on a text prompt. Supports up to 3 reference videos.

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID | `"wan/2-6-video-to-video"` |
| `input.prompt` | string | Yes | Text prompt. Min 2, max 5000 chars. | `"Transform into anime style..."` |
| `input.video_urls` | array | Yes | Input video URLs (1-3). Max 10MB per video. Supported: mp4, mov, mkv. | `["https://..."]` |
| `input.duration` | string | No | Duration. Options: `"5"`, `"10"`. Default: `"5"`. | `"5"` |
| `input.resolution` | string | No | Resolution. Options: `"720p"`, `"1080p"`. Default: `"1080p"`. | `"1080p"` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example
```json
{
  "model": "wan/2-6-video-to-video",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "Transform this video into a cyberpunk anime style with neon lights",
    "video_urls": ["https://file.aiquickdraw.com/video1.mp4"],
    "duration": "10",
    "resolution": "1080p"
  }
}
```

---

### Kling 2.1 Pro
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: $0.25 (5s), $0.50 (10s)

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID | `"kling/v2-1-pro"` |
| `input.prompt` | string | Yes | Text prompt. Max 5000 chars. | `"POV shot..."` |
| `input.image_url` | string | Yes | Input image URL. Max 10MB. | `"https://..."` |
| `input.tail_image_url` | string | No | End frame image URL. Max 10MB. | `"https://..."` |
| `input.duration` | string | No | Duration. Options: `"5"`, `"10"`. Default: `"5"`. | `"5"` |
| `input.negative_prompt` | string | No | Negative prompt. Max 500 chars. | `"blur, distort"` |
| `input.cfg_scale` | number | No | Guidance scale. Default: `0.5`. | `0.5` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example
```json
{
  "model": "kling/v2-1-pro",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "POV shot...",
    "image_url": "https://file.aiquickdraw.com/...",
    "duration": "5",
    "negative_prompt": "blur, distort",
    "cfg_scale": 0.5
  }
}
```

---

### Seedance V1 Pro
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: $0.014/sec (480p), $0.030/sec (720p), $0.070/sec (1080p)

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID | `"bytedance/v1-pro-image-to-video"` |
| `input.prompt` | string | Yes | Text prompt. Max 10000 chars. | `"A golden retriever..."` |
| `input.image_url` | string | Yes | Input image URL. Max 10MB. | `"https://..."` |
| `input.resolution` | string | No | Resolution. Options: `"480p"`, `"720p"`, `"1080p"`. Default: `"1080p"`. | `"1080p"` |
| `input.duration` | string | No | Duration. Options: `"5"`, `"10"`. Default: `"5"`. | `"5"` |
| `input.camera_fixed` | boolean | No | Fix camera position. Default: `false`. | `false` |
| `input.seed` | number | No | Random seed (-1 for random). | `-1` |
| `input.enable_safety_checker` | boolean | No | Enable safety checker. Default: `true`. | `true` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example
```json
{
  "model": "bytedance/v1-pro-image-to-video",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "A golden retriever...",
    "image_url": "https://file.aiquickdraw.com/...",
    "resolution": "720p",
    "duration": "5",
    "camera_fixed": false,
    "seed": -1,
    "enable_safety_checker": true
  }
}
```

---

### Veo 3.1 Fast
**Provider**: KIE
**Endpoint**: `/api/v1/veo/generate`
**Pricing**: $0.30 per video

#### Parameters
*Note: Veo uses a flat JSON body, not nested in `input`.*

| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID. Options: `"veo3"`, `"veo3_fast"`. | `"veo3_fast"` |
| `prompt` | string | Yes | Text prompt. | `"A dog playing..."` |
| `imageUrls` | array | No | List of 1 or 2 image URLs for I2V. | `["http://..."]` |
| `generationType` | string | No | Mode: `"TEXT_2_VIDEO"`, `"FIRST_AND_LAST_FRAMES_2_VIDEO"`, `"REFERENCE_2_VIDEO"`. | `"TEXT_2_VIDEO"` |
| `aspectRatio` | string | No | Aspect ratio: `"16:9"`, `"9:16"`, `"Auto"`. Default: `"16:9"`. | `"16:9"` |
| `seeds` | number | No | Random seed (10000-99999). | `12345` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example
```json
{
  "prompt": "A dog playing in a park",
  "imageUrls": [ "http://example.com/image1.jpg", "http://example.com/image2.jpg" ],
  "model": "veo3_fast",
  "callBackUrl": "http://your-callback-url.com/complete",
  "aspectRatio": "16:9",
  "seeds": 12345,
  "generationType": "FIRST_AND_LAST_FRAMES_2_VIDEO"
}
```

---

## Image Editing Models

### Nano Banana — Edit
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: $0.02/image

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID | `"google/nano-banana-edit"` |
| `input.prompt` | string | Yes | Edit prompt. | `"turn this photo..."` |
| `input.image_urls` | array | Yes | List of input image URLs (max 10). | `["https://..."]` |
| `input.output_format` | string | No | Output format: `"png"`, `"jpeg"`. Default: `"png"`. | `"png"` |
| `input.image_size` | string | No | Aspect ratio (e.g., `"1:1"`, `"16:9"`). | `"1:1"` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example
```json
{
  "model": "google/nano-banana-edit",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "turn this photo...",
    "image_urls": ["https://file.aiquickdraw.com/..."],
    "output_format": "png",
    "image_size": "1:1"
  }
}
```

---

### Nano Banana Pro
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: $0.09/image

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID | `"nano-banana-pro"` |
| `input.prompt` | string | Yes | Text description of the image. Max 5000 chars. | `"Comic poster..."` |
| `input.image_input` | array | No | Input images for reference/edit (max 8). | `["https://..."]` |
| `input.aspect_ratio` | string | No | Aspect ratio. Options: `"1:1"`, `"2:3"`, `"3:2"`, `"3:4"`, `"4:3"`, `"4:5"`, `"5:4"`, `"9:16"`, `"16:9"`, `"21:9"`. | `"1:1"` |
| `input.resolution` | string | No | Resolution. Options: `"1K"`, `"2K"`, `"4K"`. | `"1K"` |
| `input.output_format` | string | No | Output format: `"png"`, `"jpg"`. | `"png"` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example
```json
{
  "model": "nano-banana-pro",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "Comic poster: cool banana hero in shades leaps from sci-fi pad...",
    "image_input": [],
    "aspect_ratio": "1:1",
    "resolution": "1K",
    "output_format": "png"
  }
}
```

---

### Flux 2 Pro — Image to Image
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: $0.025/image (1K), $0.035/image (2K)

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID | `"flux-2/pro-image-to-image"` |
| `input.prompt` | string | Yes | Text prompt. Max 5000 chars. | `"The jar in image 1..."` |
| `input.input_urls` | array | Yes | Input reference images (1-8). | `["https://..."]` |
| `input.aspect_ratio` | string | Yes | Aspect ratio. Options: `"1:1"`, `"4:3"`, `"3:4"`, `"16:9"`, `"9:16"`, `"3:2"`, `"2:3"`, `"auto"`. | `"1:1"` |
| `input.resolution` | string | Yes | Resolution. Options: `"1K"`, `"2K"`. | `"1K"` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example
```json
{
  "model": "flux-2/pro-image-to-image",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "input_urls": [
      "https://static.aiquickdraw.com/tools/example/1764235041265_kjJ2sTMR.png"
    ],
    "prompt": "The jar in image 1 is filled with capsules...",
    "aspect_ratio": "1:1",
    "resolution": "1K"
  }
}
```

---

### Flux 2 Pro — Text to Image
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: $0.025/image (1K), $0.035/image (2K)

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID | `"flux-2/pro-text-to-image"` |
| `input.prompt` | string | Yes | Text prompt. Max 5000 chars. | `"Hyperrealistic supermarket..."` |
| `input.aspect_ratio` | string | Yes | Aspect ratio. Options: `"1:1"`, `"4:3"`, `"3:4"`, `"16:9"`, `"9:16"`, `"3:2"`, `"2:3"`. | `"1:1"` |
| `input.resolution` | string | Yes | Resolution. Options: `"1K"`, `"2K"`. | `"1K"` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example
```json
{
  "model": "flux-2/pro-text-to-image",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "Hyperrealistic supermarket blister pack...",
    "aspect_ratio": "1:1",
    "resolution": "1K"
  }
}
```

---

### Seedream 4.5
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: $0.032/image

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID | `"seedream/4.5-text-to-image"` |
| `input.prompt` | string | Yes | Text description. Max 1000 chars. | `"A full-process cafe..."` |
| `input.aspect_ratio` | string | Yes | Aspect ratio. Options: `"1:1"`, `"4:3"`, `"3:4"`, `"16:9"`, `"9:16"`, `"2:3"`, `"3:2"`, `"21:9"`. | `"1:1"` |
| `input.quality` | string | Yes | Quality. Options: `"basic"` (2K), `"high"` (4K). | `"basic"` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example
```json
{
  "model": "seedream/4.5-text-to-image",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "A full-process cafe design tool...",
    "aspect_ratio": "1:1",
    "quality": "basic"
  }
}
```

---

### Seedream 4.5 — Edit
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: $0.032/image

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID | `"seedream/4.5-edit"` |
| `input.prompt` | string | Yes | Edit prompt. Max 1000 chars. | `"Change material to glass..."` |
| `input.image_urls` | array | Yes | Input image URL. | `["https://..."]` |
| `input.aspect_ratio` | string | Yes | Aspect ratio. | `"1:1"` |
| `input.quality` | string | Yes | Quality. Options: `"basic"`, `"high"`. | `"basic"` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example
```json
{
  "model": "seedream/4.5-edit",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "Change material to glass...",
    "image_urls": ["https://file.aiquickdraw.com/..."],
    "aspect_ratio": "1:1",
    "quality": "basic"
  }
}
```

---

### Qwen Image Edit Plus
**Provider**: FAL
**Endpoint**: `fal-ai/qwen-image-edit-plus`
**Pricing**: $0.03/image

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `prompt` | string | Yes | Edit prompt. | `"make it snowy"` |
| `image_urls` | array | Yes | List of input image URLs. | `["https://..."]` |
| `image_size` | string | No | Size preset (e.g., `"square_hd"`). | `"square_hd"` |
| `output_format` | string | No | Output format: `"png"`, `"jpeg"`. | `"png"` |
| `seed` | number | No | Random seed. | `12345` |
| `enable_safety_checker` | boolean | No | Enable safety checker. | `true` |
| `num_images` | number | No | Number of images. | `1` |

#### Request Example
```json
{
  "prompt": "make it snowy",
  "image_urls": ["https://file.aiquickdraw.com/..."],
  "image_size": "square_hd",
  "output_format": "png",
  "enable_safety_checker": true,
  "num_images": 1
}
```

---

### Kling O1
**Provider**: FAL
**Endpoint**: `fal-ai/kling-image/o1`
**Pricing**: $0.027/image

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `prompt` | string | Yes | Text prompt. Reference images using `@Image1`, `@Image2`, etc. | `"Put @Image1 to the back seat..."` |
| `image_urls` | array | Yes | List of reference images (max 10). | `["https://..."]` |
| `resolution` | string | No | Resolution. Options: `"1K"`, `"2K"`. Default: `"1K"`. | `"1K"` |
| `num_images` | number | No | Number of images (1-9). Default: `1`. | `1` |
| `aspect_ratio` | string | No | Aspect ratio. Options: `"auto"`, `"16:9"`, `"9:16"`, `"1:1"`, `"4:3"`, `"3:4"`, `"3:2"`, `"2:3"`, `"21:9"`. Default: `"auto"`. | `"auto"` |
| `output_format` | string | No | Output format: `"png"`, `"jpeg"`, `"webp"`. Default: `"png"`. | `"png"` |

#### Request Example
```json
{
  "prompt": "Put @Image1 to the back seat of the car in @Image2",
  "image_urls": [
    "https://storage.googleapis.com/falserverless/example_inputs/nano-banana-edit-input.png",
    "https://storage.googleapis.com/falserverless/example_inputs/nano-banana-edit-input-2.png"
  ],
  "resolution": "1K",
  "num_images": 1,
  "aspect_ratio": "auto",
  "output_format": "png"
}
```

---

### Topaz Video Upscale
**Provider**: FAL
**Endpoint**: `fal-ai/topaz/upscale/video`
**Pricing**: Varies (FAL)

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `video_url` | string | Yes | Input video URL. | `"https://..."` |
| `upscale_factor` | number | No | Upscale factor (e.g., `2`). Default: `2`. | `2` |
| `target_fps` | number | No | Target FPS (e.g., `60`). | `60` |
| `output_format` | string | No | Output format: `"mp4"`, `"mov"`. Default: `"mp4"`. | `"mp4"` |

#### Request Example
```json
{
  "video_url": "https://storage.googleapis.com/falserverless/example_inputs/video.mp4",
  "upscale_factor": 2,
  "target_fps": 60,
  "output_format": "mp4"
}
```

---


### Fal VLM (Prompt Expansion)
**Provider**: FAL
**Endpoint**: `openrouter/router/vision`
**Pricing**: Varies by model (via OpenRouter)

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID (e.g., `google/gemini-2.5-flash`). | `"google/gemini-2.5-flash"` |
| `prompt` | string | Yes | Text prompt. | `"Describe this image..."` |
| `image_urls` | array | No | List of image URLs. | `["https://..."]` |
| `system_prompt` | string | No | System instructions. | `"Be concise."` |
| `temperature` | number | No | Creativity (0-1). Default: `1`. | `1` |
| `max_tokens` | number | No | Max output tokens. | `1024` |

#### Request Example
```json
{
  "model": "google/gemini-2.5-flash",
  "prompt": "Describe this image...",
  "image_urls": ["https://fal.media/files/..."],
  "system_prompt": "Be concise.",
  "temperature": 1
}
```

---

### Fal LLM (Text-Only Prompt Expansion)
**Provider**: FAL
**Endpoint**: `openrouter/router`
**Pricing**: Varies by model (via OpenRouter)

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID (e.g., `google/gemini-2.5-flash`). | `"google/gemini-2.5-flash"` |
| `prompt` | string | Yes | Text prompt. | `"Write a story..."` |
| `system_prompt` | string | No | System instructions. | `"Be concise."` |
| `temperature` | number | No | Creativity (0-1). Default: `1`. | `1` |
| `max_tokens` | number | No | Max output tokens. | `1024` |

#### Request Example
```json
{
  "model": "google/gemini-2.5-flash",
  "prompt": "Write a story...",
  "system_prompt": "Be concise.",
  "temperature": 1
}
```

---

## KIE API Reference

### Create Task
**Endpoint**: `POST /api/v1/jobs/createTask`

Create a new generation task.

#### Request Body Structure
```json
{
  "model": "string",
  "callBackUrl": "string (optional)",
  "input": {
    // Input parameters based on model configuration
  }
}
```

#### Root Level Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | The model name to use for generation | `"kling-2.6/image-to-video"`, `"kling-2.6/text-to-video"` |
| `callBackUrl` | string | No | Callback URL for task completion notifications | `"https://your-domain.com/api/callback"` |

#### Request Example (Kling 2.6 I2V)
```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "kling-2.6/image-to-video",
    "callBackUrl": "https://your-domain.com/api/callback",
    "input": {
      "prompt": "In a bright rehearsal room, sunlight streams through the window...",
      "image_urls": ["https://static.aiquickdraw.com/tools/example/1764851002741_i0lEiI8I.png"],
      "sound": false,
      "duration": "5"
    }
}'
```

#### Response Example
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "taskId": "task_12345678"
  }
}
```

---

### Callback Notifications

When `callBackUrl` is provided, the system sends POST requests to the specified URL upon task completion.

#### Success Callback
```json
{
  "code": 200,
  "data": {
    "completeTime": 1755599644000,
    "consumeCredits": 100,
    "costTime": 8,
    "createTime": 1755599634000,
    "model": "kling-2.6/image-to-video",
    "param": "{...}",
    "remainedCredits": 2510330,
    "resultJson": "{\"resultUrls\":[\"https://example.com/generated-video.mp4\"]}",
    "state": "success",
    "taskId": "e989621f54392584b05867f87b160672",
    "updateTime": 1755599644000
  },
  "msg": "Playground task completed successfully."
}
```

#### Failure Callback
```json
{
  "code": 501,
  "data": {
    "completeTime": 1755597081000,
    "consumeCredits": 0,
    "failCode": "500",
    "failMsg": "Internal server error",
    "model": "kling-2.6/image-to-video",
    "state": "fail",
    "taskId": "bd3a37c523149e4adf45a3ddb5faf1a8"
  },
  "msg": "Playground task failed."
}
```

#### Response Fields
| Field | Description |
| :--- | :--- |
| `code` | Status code, 200 for success, others for failure |
| `message` / `msg` | Response message, error description when failed |
| `data.taskId` | Task ID for querying task status |
| `data.state` | Task state: `"success"`, `"fail"`, `"pending"`, `"running"` |
| `data.resultJson` | JSON string containing result URLs |
| `data.consumeCredits` | Credits consumed for this task |
| `data.remainedCredits` | Remaining credit balance |

---

### T2V / I2V Unified Models

The following models support both Text-to-Video (T2V) and Image-to-Video (I2V) modes:

| Model | T2V Endpoint | I2V Endpoint |
| :--- | :--- | :--- |
| Kling 2.6 | `kling-2.6/text-to-video` | `kling-2.6/image-to-video` |
| Wan 2.5 | `wan/2-5-text-to-video` | `wan/2-5-image-to-video` |
| Wan 2.6 | `wan/2-6-image-to-video` | `wan/2-6-image-to-video` |
| Seedance Pro | `bytedance/v1-pro-text-to-video` | `bytedance/v1-pro-image-to-video` |
| Hailuo 2.3 Pro | `hailuo/2-3-text-to-video-pro` | `hailuo/2-3-image-to-video-pro` |

When using these models:
- **With image**: Provide `image_url` or `image_urls` → uses I2V endpoint
- **Without image**: Omit image parameters → automatically uses T2V endpoint