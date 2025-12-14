# AI Asset Studio - User Guide

Welcome to your AI Asset Studio! This tool helps you generate AI-powered images and videos right from your browser.

## 🚀 Quick Start (5 Minutes)

### Step 1: Start the Application

Run the following command to start both the frontend and the file server:

```bash
npm run dev:all
```

Requires Node.js 22+.

- **Frontend**: `http://localhost:5173`
- **File Server**: `http://localhost:8787`

### Step 2: Connect to a Workspace

1.  Open `http://localhost:5173` in your browser.
2.  In the top bar, you'll see connection settings.
3.  **API URL**: Ensure it points to your server (default: `http://localhost:8787`).
4.  **Workspace ID**: Enter a name for your project (e.g., `my-first-project`).
5.  **Token**: Enter the token defined in your `.env.server` (default: `devtoken`).
6.  Click **Connect**.

### Step 3: Generate Your First Asset!

1.  **Select a Model** - Choose from the dropdown (start with "kling-2.5-pro" for videos or "flux-2-pro" for images).
2.  **Upload a Start Frame** (for videos) - Drag and drop an image or click "Browse".
3.  **Write a Prompt** - Describe what you want to create (e.g., "a cat playing piano in a jazz club").
4.  **Click Generate** - Wait for the magic to happen! ✨

Your file will appear in the middle column when it's done.

## 📖 Detailed Guide

### Understanding the Interface

The app has three main sections:

#### Left Panel: Controls
-   **Model Selector:** Choose which AI model to use
-   **Upload Zones:** Drag and drop your reference images/videos
-   **Prompt Box:** Describe what you want to create
-   **Advanced Settings:** Fine-tune generation parameters
-   **Generate Button:** Start the creation process

#### Middle Panel: File Browser
-   **Workspace View:** Shows files stored on your local server
-   **Search & Filter:** Find files by name or type (Image/Video)
-   **Drag & Drop:** Drag files out to your desktop to download
-   **Video Preview:** Hover over thumbnails to play a quick preview
-   **Delete:** Instantly remove files with the trash icon

#### Right Panel: Preview
-   **Preview Mode:** View full-size images or play videos
-   **Compare Mode:** Side-by-side slider comparison for two images
-   **Full Screen:** Immersive viewing experience

### Generating Videos

Videos need at least one reference image to start from:

1.  **Choose a video model** (e.g., "kling-2.5-pro" or "veo-3.1-fast")
2.  **Upload a start frame** - This is the first image of your video
3.  **Optional: Upload an end frame** - For some models, this creates smooth transitions
4.  **Optional: Add reference images** - Some models let you provide style references
5.  **Write your prompt** - Describe the motion and action you want
6.  **Adjust settings** - FPS, resolution, duration, etc.
7.  **Click Generate** ⚡

**Example prompts:**
-   "The camera slowly zooms in on the subject"
-   "A bird taking flight from a tree branch"
-   "Waves crashing on a beach at sunset"

### Generating Images

Images are simpler - just describe what you want!

1.  **Choose an image model** (e.g., "flux-2-pro" or "nano-banana-edit")
2.  **Write your prompt** - Be specific! More details = better results
3.  **Select size preset** - Square, portrait, or landscape
4.  **Optional: Upload reference images** - For style transfer or editing
5.  **Click Generate** 🎨

**Example prompts:**
-   "A photorealistic portrait of a warrior in golden armor, cinematic lighting"
-   "A minimalist logo for a tech startup, modern and clean"
-   "An oil painting of a Victorian mansion in autumn"

### Upscaling Images

Make your images higher quality:

1.  **Select the upscale model** ("seedvr-image-upscale")
2.  **Upload your image** - Drag and drop the file you want to enhance
3.  **Choose settings:**
    -   Upscale factor (2x, 4x)
4.  **Click Generate** ⬆️

### Upscaling Videos
1.  **Select a video** in the file browser
2.  **Click Upscale** in the preview pane controls
3.  The video will be upscaled (2x default) and saved to the same folder

## 💡 Tips & Tricks

### Writing Better Prompts

**DO:**
-   ✅ Be specific and detailed
-   ✅ Include style keywords ("cinematic", "photorealistic", "oil painting")
-   ✅ Describe lighting, camera angles, and mood
-   ✅ Use commas to separate concepts

**DON'T:**
-   ❌ Be too vague ("make it cool")
-   ❌ Use negative descriptions (most models don't understand "no blue")
-   ❌ Make prompts too long (keep under 200 words)

### Model Selection Guide

**For Videos:**
-   **kling-2.5-pro** - Best quality, slower
-   **veo-3.1-fast** - Quick generations from text only
-   **kling-2.1-pro** - More cost-effective option

**For Images:**
-   **flux-2-pro** - Professional quality, detailed
-   **nano-banana-edit** - Creative and artistic
-   **kling-o1** - High-quality image generation

### Organizing Your Files

All generated files are automatically saved in your server's storage folder (default `./data`):
-   **Images** → `images/YYYY-MM-DD/`
-   **Videos** → `videos/YYYY-MM-DD/`

Files are named with: `modelName_promptSlug_seed_uniqueId.ext`

## ❓ Troubleshooting

### Can't connect to workspace?
-   Ensure `npm run dev:all` is running.
-   Check that the **API URL** matches your server (default `http://localhost:8787`).
-   Verify the **Token** matches `FILE_API_TOKEN` in `.env.server`.

### "Missing VITE_FAL_KEY" error
-   Check that your `.env.local` file exists in the project root.
-   Make sure the file starts with `VITE_` (case-sensitive!).
-   Restart the dev server after adding keys.

### Generation is taking forever
-   Some models take 30-60 seconds or longer.
-   Check your browser's console (F12) for error messages.
-   If it fails, try a different model or simpler prompt.

### "Upload failed" error
-   Check your internet connection.
-   Make sure image/video files aren't too large (check `FILE_MAX_SIZE_MB` in `.env.server`).
-   Verify your API key is valid and has credits.

## 🎓 Learning Resources

-   **Video Tutorials:** Check `agents.md` for advanced automation
-   **Model Documentation:** See README.md for full model catalog
-   **API Docs:** Visit [fal.ai/docs](https://fal.ai/docs) and [kie.ai/docs](https://kie.ai)

## 🆘 Need More Help?

-   Check the browser console (Press F12) for detailed error messages
-   Make sure your API keys have enough credits
-   Try a simpler prompt or different model
-   Restart the app (`npm run dev:all` in terminal)

---

**Remember:** AI generation is creative and sometimes unpredictable! Don't be afraid to experiment with different models, prompts, and settings. Have fun creating! 🎉
