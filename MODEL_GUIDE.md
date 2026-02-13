# Model Guide

Quick reference for adding and managing image/video generation models.

## Model Overview

### Image Models (`src/lib/image-models.ts`)

| Model | Provider | Pricing | Capabilities |
|-------|----------|---------|--------------|
| Nano Banana Pro | KIE | $0.09/image | T2I, I2I, 8 refs |
| Nano Banana Edit | KIE | $0.02/image | Edit, 10 refs |
| Flux 2 Pro | KIE | $0.025-$0.035 | T2I, I2I, 8 refs |
| GPT Image 1.5 | KIE | $0.04-$0.11 | T2I, I2I |
| Seedream 4.5 | KIE | $0.032/image | T2I, Edit |
| Qwen Image Edit Plus | FAL | $0.03/image | Edit, 3 refs |
| Kling O1 | FAL | $0.027/image | Edit, 10 refs |

### Video Models (`src/lib/models.ts` + `models.json`)

| Model | Provider | Pricing | Capabilities |
|-------|----------|---------|--------------|
| Sora 2 | KIE | $0.15-$0.23 | T2V, I2V |
| Kling 2.5 Turbo Pro | KIE | $0.21 | I2V |
| Kling 2.6 Pro | KIE | $0.28-$0.55 | T2V, I2V, Audio |
| Kling 3.0 | KIE | $0.10-$0.20/sec | T2V, I2V, Audio, Std/Pro |
| Hailuo 2.3 Pro | KIE | $0.39 | I2V |
| Hailuo 02 Pro | KIE | $0.29 | T2V, I2V |
| Wan 2.5 (I2V) | KIE | $0.50 | I2V |
| Wan 2.6 | KIE | $0.35-$0.53 | T2V, I2V |
| Seedance V1 Pro | KIE | $0.35 | T2V, I2V |
| Seedance 1.5 Pro | KIE | $0.14-$0.28 | T2V, I2V, Audio |
| Grok Imagine | KIE | $0.10-$0.15 | I2V |
| Grok Imagine (FAL) | FAL | Varies | I2V |
| Veo 3.1 Fast | KIE | $0.30 | T2V, I2V |
| LTX-2 | FAL | ~$0.30 | T2V, I2V, Audio |


---

## Adding a New Image Model

### Step 1: Add to `image-models.ts`

```typescript
import { parseKieResultUrls, KIE_TASK_CONFIG, validateAspectRatio } from "./model-helpers";

// Add to IMAGE_MODELS array:
{
  id: "your-model-id",           // Unique identifier
  label: "Your Model Name",       // Display name in UI
  endpoint: "/api/v1/jobs/createTask",  // KIE endpoint
  provider: "kie",                // "kie" | "fal" | "fal-client"
  pricing: "$0.05/image",         // Pricing info for UI
  taskConfig: KIE_TASK_CONFIG,    // Use shared config
  mode: "edit",                   // "edit" | "hybrid" | "text"
  maxRefs: 1,                     // Max reference images
  
  ui: {
    aspectRatios: [
      { value: "1:1", label: "Square (1:1)" },
      { value: "16:9", label: "Landscape (16:9)" },
    ],
    resolutions: [
      { value: "1K", label: "1K" },
      { value: "2K", label: "2K" },
    ],
    defaultResolution: "1K",
  },
  
  mapInput: ({ prompt, imageUrls, aspectRatio, imageResolution }) => {
    const hasRefs = imageUrls.length > 0;
    return {
      model: hasRefs ? "your-model/i2i" : "your-model/t2i",
      input: {
        prompt,
        ...(hasRefs ? { input_urls: imageUrls } : {}),
        aspect_ratio: validateAspectRatio(aspectRatio, ["1:1", "16:9"], "1:1"),
        resolution: imageResolution ?? "1K",
      },
    };
  },
  
  getUrls: parseKieResultUrls,  // Use shared parser
}
```

### Step 2: Add API Documentation

Add to `api_reference_documentation.md`:

```markdown
### Your Model Name
**Provider**: KIE
**Endpoint**: `/api/v1/jobs/createTask`
**Pricing**: $0.05/image

#### Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `model` | string | Yes | Model ID |
| `input.prompt` | string | Yes | Text description |
...
```

---

## Adding a New Video Model

### Step 1: Add to `models.json`

```json
{
  "id": "your-video-model",
  "endpoint": "/api/v1/jobs/createTask",
  "provider": "kie",
  "label": "Your Video Model",
  "pricing": "$0.10 (5s)",
  "supports": {
    "startFrame": true,
    "endFrame": false,
    "audio": true,
    "resolution": true,
    "aspectRatio": true
  },
  "params": {
    "prompt": { "type": "string", "required": true, "uiKey": "prompt" },
    "duration": { "type": "enum", "values": ["5", "10"], "default": "5" },
    "resolution": { "type": "enum", "values": ["720p", "1080p"], "default": "1080p" }
  },
  "output": { "videoPath": "resultUrls[0]" }
}
```

### Step 2: Add Adapter (if needed)

In `models.ts`, add to the model loading logic if the model needs special handling:

```typescript
if (model.id === "your-video-model") {
  model.adapter = {
    mapInput: (unified) => ({
      prompt: unified.prompt,
      duration: unified.duration,
      // ... map other fields
    }),
    getVideoUrl: parseKieVideoUrl,  // Use shared helper
  };
}
```

### Step 3: Add T2V/I2V Switching (if needed)

Add to `kieModelMap` in `models.ts`:

```typescript
"your-video-model": {
  i2v: "your-video-model-i2v",
  t2v: "your-video-model-t2v",
},
```

---

## Common Patterns

### KIE Response Parsing
```typescript
import { parseKieResultUrls, parseKieVideoUrl } from "./model-helpers";

// For images:
getUrls: parseKieResultUrls

// For videos:
getVideoUrl: parseKieVideoUrl
```

### FAL Response Parsing
```typescript
import { parseFalImageUrls, parseFalVideoUrl } from "./model-helpers";

// For images:
getUrls: parseFalImageUrls

// For videos:
getVideoUrl: parseFalVideoUrl
```

### Aspect Ratio Validation
```typescript
import { validateAspectRatio } from "./model-helpers";

const validRatios = ["1:1", "16:9", "9:16"];
const ratio = validateAspectRatio(userInput, validRatios, "1:1");
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "aspect_ratio not in range" | Validate with `validateAspectRatio()` |
| Model not appearing in UI | Check `id` is unique, verify provider |
| Response URLs empty | Check `getUrls` function matches API response format |
| Task stuck polling | Verify `taskConfig` matches API polling format |
