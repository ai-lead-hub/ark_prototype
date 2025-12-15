# AI Asset Studio - User Guide

Welcome to AI Asset Studio! This tool helps you generate AI-powered images and videos from your browser.

## 🚀 Quick Start (5 Minutes)

### Step 1: Start the Application

```bash
npm install
npm run dev:all
```

Requires Node.js 22+.

- **Frontend**: `http://localhost:5173`
- **File Server**: `http://localhost:8787`

### Step 2: Connect to a Workspace

1. Open `http://localhost:5173` in your browser
2. Click the **⚙️ Settings** button in the header
3. Enter your connection details:
   - **API Base URL**: `http://localhost:8787` (default)
   - **Workspace ID**: A name for your project (e.g., `my-project`)
   - **API Token**: The token from your `.env.server` file
4. Click **Connect**

### Step 3: Generate Your First Asset!

1. **Select a Model** - Choose from the dropdown
2. **Upload a Start Frame** (for videos) - Drag and drop an image
3. **Write a Prompt** - Describe what you want to create
4. **Click Generate** - Wait for the magic! ✨

Your file will appear in the center panel when done.

---

## 📖 Interface Overview

### Header Bar

The compact header contains:
- **🟢/🔴 Status** - Green = connected, Red = disconnected
- **Workspace Name** - Currently connected workspace
- **Credits** - KIE credit balance (click to refresh)
- **Queue** - Shows active generation jobs
- **⚙️ Settings** - Workspace connection + preferences
- **?** - Help & documentation link

### Settings Dropdown (⚙️)

Click the gear icon to access:
- **Workspace Connection** - API URL, Workspace ID, Token
- **Connect/Reconnect/Disconnect** buttons
- **Preferences** - Hover play videos toggle

### Left Panel: Controls
- **Model Selector**: Choose which AI model to use
- **Upload Zones**: Drag and drop reference images/videos
- **Prompt Box**: Describe what you want to create
- **Advanced Settings**: Fine-tune generation parameters
- **Generate Button**: Start the creation process

### Center Panel: File Browser
- **Search & Filter**: Find files by name or type
- **Grid/List Views**: Toggle between views
- **Drag & Drop**: Upload files by dropping them here
- **Video Preview**: Hover over thumbnails to preview

### Right Panel: Preview
- **Preview Mode**: View full-size images or play videos
- **Compare Mode**: Side-by-side slider comparison
- **Full Screen**: Immersive viewing

---

## 🎬 Generating Content

### Videos

1. Choose a video model (e.g., "kling-2.5-pro")
2. Upload a start frame (required)
3. Optional: Upload an end frame for transitions
4. Write your prompt describing the motion
5. Adjust settings (FPS, resolution, duration)
6. Click **Generate**

**Example prompts:**
- "The camera slowly zooms in on the subject"
- "A bird taking flight from a tree branch"
- "Waves crashing on a beach at sunset"

### Images

1. Choose an image model (e.g., "flux-2-pro")
2. Write a detailed prompt
3. Select size preset
4. Optional: Upload reference images
5. Click **Generate**

**Example prompts:**
- "A photorealistic portrait of a warrior in golden armor, cinematic lighting"
- "A minimalist logo for a tech startup, modern and clean"

### Upscaling

1. Select a video in the file browser
2. Click **Upscale** in the preview pane
3. The enhanced video saves to the same folder

---

## 💡 Tips & Tricks

### Better Prompts

**DO:**
- ✅ Be specific and detailed
- ✅ Include style keywords ("cinematic", "photorealistic")
- ✅ Describe lighting, camera angles, mood
- ✅ Use commas to separate concepts

**DON'T:**
- ❌ Be too vague ("make it cool")
- ❌ Use negative descriptions
- ❌ Make prompts excessively long

### Model Selection

**For Videos:**
- **kling-2.5-pro** - Best quality, slower
- **veo-3.1-fast** - Quick text-to-video
- **kling-2.1-pro** - Cost-effective

**For Images:**
- **flux-2-pro** - Professional quality
- **nano-banana-edit** - Creative/artistic

---

## ❓ Troubleshooting

### Can't connect?
- Ensure `npm run dev:all` is running
- Click ⚙️ and verify your settings match `.env.server`
- Check that API Token matches `FILE_API_TOKEN`

### "Missing API Key" error
- Check `.env.local` exists with `VITE_` prefixed keys
- Restart the dev server after changes

### Generation stuck?
- Some models take 30-60+ seconds
- Check browser console (F12) for errors
- Try a different model or simpler prompt

---

**Have fun creating! 🎉**
