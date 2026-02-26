# API Reference

This document provides a comprehensive reference for all video generation and image editing models available in the application.

## Video Generation Models

### Sora 2
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: $0.15 (10s) / $0.23 (15s)

Supports both Text-to-Video (T2V) and Image-to-Video (I2V). When `image_urls` is empty or omitted, operates in T2V mode.

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID. Use `"sora-2-image-to-video"` for I2V, `"sora-2-text-to-video"` for T2V. | `"sora-2-image-to-video"` |
| `input.prompt` | string | Yes | Text prompt describing the video. Max 10000 chars. | `"A claymation conductor..."` |
| `input.image_urls` | array | No | Input image URL for I2V mode. Must be publicly accessible. Max 10MB. Accepts: jpeg, png, webp. | `["https://..."]` |
| `input.aspect_ratio` | string | No | Aspect ratio. Options: `"portrait"`, `"landscape"`. Default: `"landscape"`. | `"landscape"` |
| `input.n_frames` | string | No | Video duration. Options: `"10"` (10s), `"15"` (15s). Default: `"10"`. | `"10"` |
| `input.remove_watermark` | boolean | No | Remove watermarks from output. Default: `true`. | `true` |
| `input.character_id_list` | array | No | Character IDs for consistent characters. Max 5 IDs. | `["char_1", "char_2"]` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example (I2V)
```json
{
  "model": "sora-2-image-to-video",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "A claymation conductor passionately leads a claymation orchestra, while the entire group joyfully sings in chorus.",
    "image_urls": ["https://file.aiquickdraw.com/custom-page/akr/section-images/example.jpg"],
    "aspect_ratio": "landscape",
    "n_frames": "10",
    "remove_watermark": true
  }
}
```

#### Request Example (T2V)
```json
{
  "model": "sora-2-text-to-video",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "A professor stands at the front of a lively classroom, enthusiastically giving a lecture. On the blackboard behind him are colorful chalk diagrams.",
    "aspect_ratio": "landscape",
    "n_frames": "15",
    "remove_watermark": true
  }
}
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


### Grok Imagine
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: $0.10 (6s), $0.15 (10s)

Generates video from a reference image. Supports `480p` and `720p` output via the same KIE endpoint.

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID | `"grok-imagine/image-to-video"` |
| `input.image_urls` | array(URL) | Conditional | External image URL. Provide this OR task_id+index, not both. Max 10MB. Accepts: jpeg, png, webp. | `["https://..."]` |
| `input.task_id` | string | Conditional | Task ID of a Grok-generated image. Use with `index` below. Supports Spicy mode unlike external images. | `"task_abc123"` |
| `input.index` | number | No | Which image from the task_id generation (0-5). Only used with task_id. | `0` |
| `input.prompt` | string | No | Text prompt describing desired video motion. Max 5000 chars. | `"POV hand comes into frame..."` |
| `input.mode` | string | No | Generation mode. Options: `"normal"`, `"fun"`, `"spicy"`. Default: `"normal"`. **Note:** Spicy mode not supported with external image_urls. | `"normal"` |
| `input.duration` | string | No | Duration in seconds. Options: `"6"`, `"10"`. Default: `"6"`. | `"6"` |
| `input.resolution` | string | No | Output resolution. Options: `"480p"`, `"720p"`. Default: `"720p"`. | `"720p"` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example (External Image)
```json
{
  "model": "grok-imagine/image-to-video",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "image_urls": ["https://example.com/my-image.png"],
    "prompt": "POV hand comes into frame handing the girl a cup of take away coffee, the girl steps out of the screen looking tired, then takes it and she says happily: 'thanks! Back to work' she exits the frame and walks right to a different part of the office.",
    "mode": "normal",
    "duration": "6",
    "resolution": "720p"
  }
}
```

#### Request Example (Using Task ID)
```json
{
  "model": "grok-imagine/image-to-video",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "task_id": "e989621f54392584b05867f87b160672",
    "index": 0,
    "prompt": "The subject walks towards the camera with a confident smile",
    "mode": "spicy",
    "duration": "10",
    "resolution": "720p"
  }
}
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

#### Callback Notification Example
```json
{
  "code": 200,
  "data": {
    "completeTime": 1755599644000,
    "costTime": 8,
    "createTime": 1755599634000,
    "model": "grok-imagine/image-to-video",
    "resultJson": "{\"resultUrls\":[\"https://example.com/generated-video.mp4\"]}",
    "state": "success",
    "taskId": "e989621f54392584b05867f87b160672"
  },
  "msg": "Playground task completed successfully."
}
```

---


### Grok Imagine (FAL 720p)
**Provider**: FAL
**Endpoint**: `xai/grok-imagine-video/image-to-video`
**Pricing**: Varies by FAL account pricing

Alternative Grok Imagine I2V pipeline via FAL.

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `prompt` | string | Yes | Text prompt for motion and scene dynamics. | `"The camera slowly pushes in as the subject smiles."` |
| `image_url` | string | Yes | Start frame image URL. | `"https://example.com/start.png"` |
| `duration` | number | No | Duration. Options: `6`, `10`. Default: `6`. | `6` |
| `aspect_ratio` | string | No | Aspect ratio. Options: `"auto"`, `"16:9"`, `"4:3"`, `"3:2"`, `"1:1"`, `"2:3"`, `"3:4"`, `"9:16"`. Default: `"auto"`. | `"16:9"` |
| `resolution` | string | No | Output resolution. `"720p"` only. Default: `"720p"`. | `"720p"` |

#### Request Example
```json
{
  "prompt": "The camera slowly pushes in as the subject smiles and waves.",
  "image_url": "https://example.com/start.png",
  "duration": 6,
  "aspect_ratio": "16:9",
  "resolution": "720p"
}
```

#### Response Example
```json
{
  "video": {
    "url": "https://v3.fal.media/files/example/output.mp4"
  }
}
```

---


### Kling O1 Reference-to-Video
**Provider**: FAL
**Endpoint**: `fal-ai/kling-video/o1/reference-to-video`
**Pricing**: ~$0.04 per video

Generate video from a start frame with optional reference images for style and elements (characters/objects). References are accessed in the prompt using `@Image1`, `@Element1` syntax.

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `prompt` | string | Yes | Text prompt using @Image1, @Element1 references. | `"Take @Image1 as the start frame..."` |
| `image_urls` | array | No | Reference images for style (up to 7 total). Reference as @Image1, @Image2. | `["https://..."]` |
| `elements` | array | No | Character/object elements. Each has frontal + reference images. Reference as @Element1. | See below |
| `duration` | string | No | Duration: `"5"` or `"10"`. Default: `"5"`. | `"5"` |
| `aspect_ratio` | string | No | Aspect ratio: `"16:9"`, `"9:16"`, `"1:1"`. Default: `"16:9"`. | `"16:9"` |

**Element Structure:**
```json
{
  "frontal_image_url": "https://...",
  "reference_image_urls": ["https://..."]
}
```

#### Request Example
```json
{
  "prompt": "Take @Image1 as the start frame. The camera swoops down revealing the character from @Element1 standing in the center. Make sure to keep it as the style of @Image2.",
  "image_urls": [
    "https://example.com/start-frame.png",
    "https://example.com/style-reference.png"
  ],
  "elements": [
    {
      "frontal_image_url": "https://example.com/character-frontal.png",
      "reference_image_urls": ["https://example.com/character-side.png"]
    }
  ],
  "duration": "5",
  "aspect_ratio": "16:9"
}
```

#### Response Example
```json
{
  "video": {
    "file_size": 47359974,
    "file_name": "output.mp4",
    "content_type": "video/mp4",
    "url": "https://v3b.fal.media/files/b/panda/output.mp4"
  }
}
```

---


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

### Kling 3.0
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Model**: `"kling-3.0/video"`
**Pricing**:
- Standard: no-audio 20 credits ($0.1)/s, with audio 30 credits ($0.15)/s
- Pro: no-audio 27 credits ($0.135)/s, with audio 40 credits ($0.2)/s

Kling 3.0 flow exposed in the Video tab with optional multi-shot and element controls.

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID | `"kling-3.0/video"` |
| `input.prompt` | string | Yes | Prompt for single-shot generation (max 2500 chars). | `"A cinematic dolly-in as the dancer turns toward camera."` |
| `input.mode` | string | No | Quality mode: `"std"` or `"pro"`. Default: `"pro"`. | `"pro"` |
| `input.image_urls` | array(string) | No | Optional start/end frame URLs. Use `[start]` or `[start, end]`. | `["https://...start.png", "https://...end.png"]` |
| `input.duration` | string | Yes | Single-shot duration (3-15s) or total multi-shot duration. Default: `"5"`. | `"5"` |
| `input.sound` | boolean | No | Generate audio. Default: `true`. | `true` |
| `input.aspect_ratio` | string | No | Aspect ratio: `"16:9"`, `"9:16"`, `"1:1"`. | `"16:9"` |
| `input.kling_elements` | array(object) | No | Optional elements. `description` is optional and can be the same as `name`. | See below |
| `input.multi_shots` | boolean | No | Enable multi-shot mode. | `false` |
| `input.multi_prompt` | array(object) | Conditional | Required when `multi_shots` is `true`. Each shot has `prompt` + `duration` (1-12s). Total must be 3-15s. | See below |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

**Element Structure (optional):**
```json
{
  "name": "ElementName",
  "description": "ElementName",
  "element_input_urls": [
    "https://example.com/element-front.png",
    "https://example.com/element-ref-1.png"
  ]
}
```

**Multi Prompt Structure (when `multi_shots: true`):**
```json
[
  {
    "prompt": "Shot 1 prompt",
    "duration": 3
  },
  {
    "prompt": "Shot 2 prompt",
    "duration": 2
  }
]
```

#### Request Example
```json
{
  "model": "kling-3.0/video",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "mode": "pro",
    "image_urls": [
      "https://static.aiquickdraw.com/tools/example/start.png",
      "https://static.aiquickdraw.com/tools/example/end.png"
    ],
    "prompt": "In a bright rehearsal room, sunlight streams through the windows as the camera pushes in.",
    "duration": "5",
    "multi_shots": false,
    "kling_elements": [
      {
        "name": "Element1",
        "description": "Element1",
        "element_input_urls": [
          "https://example.com/element-front.png",
          "https://example.com/element-ref-1.png"
        ]
      }
    ],
    "sound": true,
    "aspect_ratio": "16:9"
  }
}
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

### Kling V2.6 I2V (Image-to-Video)
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: $0.28 (5s), $0.55 (10s) / with audio: 2x

Generates video from a reference image.

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID | `"kling-2.6/image-to-video"` |
| `input.prompt` | string | Yes | Text prompt. Max 1000 chars. | `"A king walks slowly..."` |
| `input.image_urls` | array(URL) | Yes | Start frame image URL array (single image). | `["https://..."]` |
| `input.duration` | string | Yes | Duration. Options: `"5"`, `"10"`. | `"5"` |
| `input.aspect_ratio` | string | No | Aspect ratio. Options: `"1:1"`, `"16:9"`, `"9:16"`. Default: `"16:9"`. | `"16:9"` |
| `input.sound` | boolean | No | Generate audio. Default: `false`. | `false` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example
```json
{
  "model": "kling-2.6/image-to-video",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "A king walks slowly and says \"My people, here I am!\"",
    "image_urls": ["https://v3b.fal.media/files/..."],
    "duration": "5",
    "aspect_ratio": "16:9",
    "sound": false
  }
}
```

---

### Kling V2.6 T2V (Text-to-Video)
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: $0.28 (5s), $0.55 (10s) / with audio: 2x

Generates video purely from text prompt, no image required.

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID | `"kling-2.6/text-to-video"` |
| `input.prompt` | string | Yes | Text prompt. Max 1000 chars. | `"A cowboy walking..."` |
| `input.duration` | string | Yes | Duration. Options: `"5"`, `"10"`. | `"5"` |
| `input.aspect_ratio` | string | Yes | Aspect ratio. Options: `"1:1"`, `"16:9"`, `"9:16"`. | `"16:9"` |
| `input.sound` | boolean | Yes | Generate audio with video. | `false` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example
```json
{
  "model": "kling-2.6/text-to-video",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "A cowboy walking through a dusty town at high noon, camera following from behind, cinematic depth, realistic lighting.",
    "duration": "5",
    "aspect_ratio": "16:9",
    "sound": false
  }
}
```

---

### LTX-2 T2V (Text-to-Video)
**Provider**: FAL
**Endpoint**: `fal-ai/ltx-2/text-to-video`
**Pricing**: ~$0.30 per video 🔊

High-quality text-to-video generation with native audio support.

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `prompt` | string | Yes | Text prompt for video generation. | `"A cowboy walking..."` |
| `duration` | enum | No | Duration in seconds. Options: `6`, `8`, `10`. Default: `6`. | `6` |
| `resolution` | enum | No | Output resolution. Options: `"1080p"`, `"1440p"`, `"2160p"`. Default: `"1080p"`. | `"1080p"` |
| `fps` | enum | No | Frames per second. Options: `25`, `50`. Default: `25`. | `25` |
| `generate_audio` | boolean | No | Generate audio. Default: `true`. | `true` |

#### Request Example
```json
{
  "prompt": "A cowboy walking through a dusty town at high noon, camera following from behind, cinematic depth, realistic lighting, western mood, 4K film grain.",
  "duration": 6,
  "resolution": "1080p",
  "fps": 25,
  "generate_audio": true
}
```

#### Response Example
```json
{
  "video": {
    "file_name": "ltxv-2-t2v-output.mp4",
    "content_type": "video/mp4",
    "url": "https://storage.googleapis.com/falserverless/example_outputs/ltxv-2-t2v-output.mp4"
  }
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

### Hailuo 02 Pro
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: $0.29

Supports both Text-to-Video (T2V) and Image-to-Video (I2V). When `image_url` is omitted, operates in T2V mode.

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID. Use `"hailuo/02-image-to-video-pro"` for I2V, `"hailuo/02-text-to-video-pro"` for T2V. | `"hailuo/02-image-to-video-pro"` |
| `input.prompt` | string | Yes | Text prompt. | `"A cinematic scene..."` |
| `input.image_url` | string | No | Input image URL for I2V mode. Max 10MB. | `"https://..."` |
| `input.end_image_url` | string | No | End frame image URL. Max 10MB. | `"https://..."` |
| `input.prompt_optimizer` | boolean | No | Enable prompt optimization. Default: `true`. | `true` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example (I2V)
```json
{
  "model": "hailuo/02-image-to-video-pro",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "A cinematic scene with the subject walking through rain...",
    "image_url": "https://file.aiquickdraw.com/...",
    "prompt_optimizer": true
  }
}
```

#### Request Example (T2V)
```json
{
  "model": "hailuo/02-text-to-video-pro",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "A golden sunset over the ocean with waves gently crashing...",
    "prompt_optimizer": true
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

### Kling 2.6 Motion Control
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: $0.045 (1080p)

Transfers motion from a reference video onto a person in an image. Requires both an image and a video input.

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID | `"kling-2.6/motion-control"` |
| `input.prompt` | string | No | Optional text description. Max 2500 chars. | `"The cartoon character is dancing."` |
| `input.input_urls` | array(URL) | Yes | Image URL with the person. Must clearly show head, shoulders, and torso. Max 10MB. Accepts: jpeg, png, webp. | `["https://..."]` |
| `input.video_urls` | array(URL) | Yes | Motion reference video URL. Duration 3-30 seconds. Min resolution 720p. Max 100MB. Accepts: mp4, mov, mkv. | `["https://..."]` |
| `input.character_orientation` | string | Yes | Character orientation source. `"image"`: match image (max 10s output). `"video"`: match video (max 30s output). | `"video"` |
| `input.mode` | string | Yes | Output resolution. Options: `"720p"`, `"1080p"`. | `"1080p"` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example
```json
{
  "model": "kling-2.6/motion-control",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "The cartoon character is dancing.",
    "input_urls": ["https://static.aiquickdraw.com/tools/example/1767694885407_pObJoMcy.png"],
    "video_urls": ["https://static.aiquickdraw.com/tools/example/1767525918769_QyvTNib2.mp4"],
    "character_orientation": "video",
    "mode": "1080p"
  }
}
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

### Kling O3 Pro Video-to-Video Edit
**Provider**: FAL
**Endpoint**: `fal-ai/kling-video/o3/pro/video-to-video/edit`
**Pricing**: ~$0.08 per video

Edits existing videos based on a text prompt. Supports reference images for style/appearance and elements (characters/objects). Reference video as `@Video1`, images as `@Image1`, `@Image2`, and elements as `@Element1`, `@Element2` in prompts.

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `prompt` | string | Yes | Text prompt for video editing. Reference video as @Video1. | `"Change the background to tropical island"` |
| `video_url` | string | Yes | Reference video URL. Only .mp4/.mov formats, 3-10s duration, 720-2160px resolution, max 200MB. | `"https://..."` |
| `image_urls` | array | No | Reference images for style/appearance. Reference in prompt as @Image1, @Image2, etc. Maximum 4 total (elements + reference images) when using video. | `["https://..."]` |
| `keep_audio` | boolean | No | Whether to keep the original audio from the reference video. Default: `true`. | `true` |
| `elements` | array | No | Elements (characters/objects) to include. Reference in prompt as @Element1, @Element2. See Element Structure below. | See below |
| `shot_type` | enum | No | The type of multi-shot video generation. Options: `"customize"`. Default: `"customize"`. | `"customize"` |

**Element Structure:**
```json
{
  "frontal_image_url": "https://...",
  "reference_image_urls": ["https://..."]
}
```

#### Request Example (Basic)
```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/kling-video/o3/pro/video-to-video/edit", {
  input: {
    prompt: "Change the background to tropical island",
    video_url: "https://v3b.fal.media/files/b/0a8d03c4/zy-MD131DqeVEi8VRMUmD_out_9sec.mp4"
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  },
});
console.log(result.data);
console.log(result.requestId);
```

#### Request Example (JSON Input)
```json
{
  "prompt": "Change the background to tropical island",
  "video_url": "https://v3b.fal.media/files/b/0a8d03c4/zy-MD131DqeVEi8VRMUmD_out_9sec.mp4",
  "image_urls": null,
  "keep_audio": true,
  "elements": null,
  "shot_type": "customize"
}
```

#### Queue Submit Example
```javascript
import { fal } from "@fal-ai/client";

const { request_id } = await fal.queue.submit("fal-ai/kling-video/o3/pro/video-to-video/edit", {
  input: {
    prompt: "Change the background to tropical island",
    video_url: "https://v3b.fal.media/files/b/0a8d03c4/zy-MD131DqeVEi8VRMUmD_out_9sec.mp4"
  },
  webhookUrl: "https://optional.webhook.url/for/results",
});
```

#### Response Example
```json
{
  "video": {
    "file_size": 25370958,
    "file_name": "output.mp4",
    "content_type": "video/mp4",
    "url": "https://v3b.fal.media/files/b/0a8d0443/gJiT7nXFsKBGBYk1skwt3_output.mp4"
  }
}
```

> [!NOTE]
> For long-running requests, use the Queue API to submit requests and rely on webhooks for results instead of blocking while waiting.

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

### Seedance 1.5 Pro
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: 720p: $0.07-0.21 (no audio), $0.14-0.42 (with audio)

Supports both T2V (text-to-video) and I2V (image-to-video). When `input_urls` is empty, operates in T2V mode.

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID | `"bytedance/seedance-1.5-pro"` |
| `input.prompt` | string | Yes | Text prompt. 3-2500 chars. | `"A person walking in the park..."` |
| `input.input_urls` | array | No | Input image URLs. Empty for T2V. Max 10MB. | `["https://..."]` |
| `input.aspect_ratio` | string | No | Aspect ratio. Options: `"1:1"`, `"16:9"`, `"9:16"`, `"4:3"`, `"3:4"`, `"21:9"`. Default: `"1:1"`. | `"16:9"` |
| `input.resolution` | string | No | Resolution. Options: `"480p"`, `"720p"`. Default: `"720p"`. | `"720p"` |
| `input.duration` | string | Yes | Duration. Options: `"4"`, `"8"`, `"12"`. | `"8"` |
| `input.fixed_lens` | boolean | No | Enable static camera. Default: `false`. | `false` |
| `input.generate_audio` | boolean | No | Generate audio (extra cost). Default: `false`. | `true` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example (I2V)
```json
{
  "model": "bytedance/seedance-1.5-pro",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "A cinematic scene of the subject walking through a forest...",
    "input_urls": ["https://file.aiquickdraw.com/..."],
    "aspect_ratio": "16:9",
    "resolution": "720p",
    "duration": "8",
    "fixed_lens": false,
    "generate_audio": true
  }
}
```

#### Request Example (T2V)
```json
{
  "model": "bytedance/seedance-1.5-pro",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "A dramatic sunset over the ocean with waves crashing...",
    "input_urls": [],
    "aspect_ratio": "16:9",
    "resolution": "720p",
    "duration": "8"
  }
}
```

---

### Veo 3.1
**Provider**: KIE
**Endpoint**: `/api/v1/veo/generate`
**Pricing**: $0.30 per video

Supports Text-to-Video (T2V) and Image-to-Video (I2V) with first/last frame control. Two quality tiers: **Quality** (`veo3`) for highest fidelity, **Fast** (`veo3_fast`) for cost-efficient generation.

#### Parameters
*Note: Veo uses a flat JSON body, not nested in `input`.*

| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model quality tier. Options: `"veo3"` (Quality), `"veo3_fast"` (Fast). Default: `"veo3_fast"`. | `"veo3_fast"` |
| `prompt` | string | Yes | Text prompt describing the desired video content. | `"A dog playing..."` |
| `imageUrls` | array | No | List of 1 or 2 image URLs for I2V. 1 image = video unfolds around it. 2 images = first/last frame transition. | `["http://..."]` |
| `generationType` | string | No | Mode: `"TEXT_2_VIDEO"`, `"FIRST_AND_LAST_FRAMES_2_VIDEO"`. Auto-detected if omitted. | `"TEXT_2_VIDEO"` |
| `aspectRatio` | string | No | Aspect ratio: `"16:9"`, `"9:16"`, `"Auto"`. Default: `"16:9"`. | `"16:9"` |
| `seeds` | number | No | Random seed (10000-99999). | `12345` |
| `enableTranslation` | boolean | No | Auto-translate prompts to English. Default: `true`. | `true` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example (T2V — Quality)
```json
{
  "prompt": "A cinematic shot of a golden retriever running through autumn leaves",
  "model": "veo3",
  "callBackUrl": "http://your-callback-url.com/complete",
  "aspectRatio": "16:9",
  "seeds": 12345,
  "generationType": "TEXT_2_VIDEO"
}
```

#### Request Example (I2V — Fast)
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

#### Response Example
```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "taskId": "veo_task_abcdef123456"
  }
}
```

---

### Veo 3.1 Reference-to-Video
**Provider**: KIE
**Endpoint**: `/api/v1/veo/generate`
**Pricing**: $0.30 per video

Generates video based on 1–3 reference/material images. Uses `REFERENCE_2_VIDEO` generation mode. **Only supports `veo3_fast` model and `16:9`/`9:16` aspect ratios.**

#### Parameters
*Note: Veo uses a flat JSON body, not nested in `input`.*

| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID. Must be `"veo3_fast"`. | `"veo3_fast"` |
| `prompt` | string | Yes | Text prompt describing the desired video content. | `"A dynamic product showcase..."` |
| `imageUrls` | array | Yes | 1–3 reference/material image URLs. | `["http://...", "http://..."]` |
| `generationType` | string | Yes | Must be `"REFERENCE_2_VIDEO"`. | `"REFERENCE_2_VIDEO"` |
| `aspectRatio` | string | No | Aspect ratio: `"16:9"`, `"9:16"`. Default: `"16:9"`. | `"16:9"` |
| `seeds` | number | No | Random seed (10000-99999). | `12345` |
| `enableTranslation` | boolean | No | Auto-translate prompts to English. Default: `true`. | `true` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example
```json
{
  "prompt": "A dynamic product showcase with smooth camera movements around the items",
  "imageUrls": [
    "http://example.com/material1.jpg",
    "http://example.com/material2.jpg"
  ],
  "model": "veo3_fast",
  "callBackUrl": "http://your-callback-url.com/complete",
  "aspectRatio": "16:9",
  "seeds": 12345,
  "generationType": "REFERENCE_2_VIDEO"
}
```

#### Response Example
```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "taskId": "veo_task_abcdef123456"
  }
}
```

---

## Image Editing Models

### GPT Image 1.5
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: $0.04/image (medium), $0.11/image (high)

Supports both Text-to-Image (T2I) and Image-to-Image (I2I). When `input_urls` is provided, operates in I2I mode; otherwise generates from text prompt.

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID. Use `"gpt-image/1.5-image-to-image"` for I2I, `"gpt-image/1.5-text-to-image"` for T2I. | `"gpt-image/1.5-text-to-image"` |
| `input.prompt` | string | Yes | Text description of the image. Max 1000 chars. | `"Create a photorealistic photo..."` |
| `input.input_urls` | array | No | Input image URL for I2I mode. Max 10MB. Accepts: jpeg, png, webp. | `["https://..."]` |
| `input.aspect_ratio` | string | Yes | Aspect ratio. Options: `"1:1"`, `"2:3"`, `"3:2"`. | `"3:2"` |
| `input.quality` | string | Yes | Quality level. Options: `"medium"` (balanced), `"high"` (slow/detailed). | `"medium"` |
| `callBackUrl` | string | No | Callback URL for notifications. | `"https://..."` |

#### Request Example (Text-to-Image)
```json
{
  "model": "gpt-image/1.5-text-to-image",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "Create a photorealistic candid photograph of an elderly sailor standing on a small fishing boat. He has weathered skin with visible wrinkles, pores, and sun texture.",
    "aspect_ratio": "3:2",
    "quality": "medium"
  }
}
```

#### Request Example (Image-to-Image)
```json
{
  "model": "gpt-image/1.5-image-to-image",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "input_urls": ["https://example.com/input.jpg"],
    "prompt": "Change her clothing to an elegant blue evening gown. Preserve her face, identity, hairstyle, pose, body shape, background, lighting, and camera angle exactly as in the original image.",
    "aspect_ratio": "3:2",
    "quality": "high"
  }
}
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

Combines text-to-image and image-to-image capabilities. When `image_input` is provided, uses reference images for transformation; otherwise generates purely from text prompt.

#### Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID | `"nano-banana-pro"` |
| `input.prompt` | string | Yes | Text description of the image. Max 10000 chars. | `"Comic poster: cool banana hero..."` |
| `input.image_input` | array(URL) | No | Input images to transform or use as reference (max 8). Each URL max 30MB. Accepts: jpeg, png, webp. | `["https://..."]` |
| `input.aspect_ratio` | string | No | Aspect ratio. Options: `"1:1"`, `"2:3"`, `"3:2"`, `"3:4"`, `"4:3"`, `"4:5"`, `"5:4"`, `"9:16"`, `"16:9"`, `"21:9"`, `"auto"`. | `"1:1"` |
| `input.resolution` | string | No | Resolution. Options: `"1K"`, `"2K"`, `"4K"`. Default: `"1K"`. | `"1K"` |
| `input.output_format` | string | No | Output format. Options: `"png"`, `"jpg"`. Default: `"png"`. | `"png"` |
| `callBackUrl` | string | No | Callback URL for task completion notifications. | `"https://..."` |

#### Request Example (Text-to-Image)
```bash
curl -X POST "https://api.kie.ai/api/v1/jobs/createTask" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "nano-banana-pro",
    "callBackUrl": "https://your-domain.com/api/callback",
    "input": {
      "prompt": "Comic poster: cool banana hero in shades leaps from sci-fi pad. Six panels: 1) 4K mountain landscape, 2) banana holds page of long multilingual text with auto translation, 3) Gemini 3 hologram for search/knowledge/reasoning, 4) camera UI sliders for angle focus color, 5) frame trio 1:1-9:16, 6) consistent banana poses. Footer shows Google icons. Tagline: Nano Banana Pro now on Kie AI.",
      "aspect_ratio": "1:1",
      "resolution": "1K",
      "output_format": "png"
    }
}'
```

#### Request Example (Image-to-Image)
```json
{
  "model": "nano-banana-pro",
  "callBackUrl": "https://your-domain.com/api/callback",
  "input": {
    "prompt": "Transform into watercolor painting style",
    "image_input": ["https://example.com/input-image.jpg"],
    "aspect_ratio": "16:9",
    "resolution": "2K",
    "output_format": "png"
  }
}
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

#### Callback Success Example
```json
{
  "code": 200,
  "data": {
    "completeTime": 1755599644000,
    "costTime": 8,
    "createTime": 1755599634000,
    "model": "nano-banana-pro",
    "param": "{\"callBackUrl\":\"https://your-domain.com/api/callback\",\"model\":\"nano-banana-pro\",\"input\":{\"prompt\":\"...\",\"image_input\":[],\"aspect_ratio\":\"1:1\",\"resolution\":\"1K\",\"output_format\":\"png\"}}",
    "resultJson": "{\"resultUrls\":[\"https://example.com/generated-image.jpg\"]}",
    "state": "success",
    "taskId": "e989621f54392584b05867f87b160672"
  },
  "msg": "Playground task completed successfully."
}
```

#### Callback Failure Example
```json
{
  "code": 501,
  "data": {
    "completeTime": 1755597081000,
    "failCode": "500",
    "failMsg": "Internal server error",
    "model": "nano-banana-pro",
    "state": "fail",
    "taskId": "bd3a37c523149e4adf45a3ddb5faf1a8"
  },
  "msg": "Playground task failed."
}
```

> [!IMPORTANT]
> The `param` field in callbacks contains the complete Create Task request parameters, not just the input section.

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
| `resolution` | string | No | Resolution. Options: `"1K"`, `"2K"`. Default: `"2K"`. | `"2K"` |
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
| Sora 2 | `sora-2-text-to-video` | `sora-2-image-to-video` |
| Kling 2.6 | `kling-2.6/text-to-video` | `kling-2.6/image-to-video` |
| Kling 3.0 | `kling-3.0/video` | `kling-3.0/video` |
| Wan 2.5 | `wan/2-5-text-to-video` | `wan/2-5-image-to-video` |
| Wan 2.6 | `wan/2-6-text-to-video` | `wan/2-6-image-to-video` |
| Seedance V1 Pro | `bytedance/v1-pro-text-to-video` | `bytedance/v1-pro-image-to-video` |
| Seedance 1.5 Pro | `bytedance/seedance-1.5-pro` | `bytedance/seedance-1.5-pro` |
| Hailuo 2.3 Pro | — | `hailuo/2-3-image-to-video-pro` |
| Hailuo 02 Pro | `hailuo/02-text-to-video-pro` | `hailuo/02-image-to-video-pro` |

When using these models:
- **With image**: Provide `image_url` or `image_urls` → uses I2V endpoint
- **Without image**: Omit image parameters → automatically uses T2V endpoint
