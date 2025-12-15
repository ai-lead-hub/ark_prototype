# AI Asset Studio

> 🎨 A React + Fastify setup for generating images and videos using FAL and KIE AI models, backed by a lightweight file API server.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ What is this?

AI Asset Studio is a powerful yet simple tool for AI-powered image and video generation. A small file API server handles storage so the browser can stay focused on generation and preview. Run one command to start both the frontend and the file server, connect to a workspace, and start creating.

**Perfect for:**
- 🎬 Video creators and editors
- 🎨 Digital artists and designers  
- 📸 Content creators
- 🚀 Anyone who wants to explore AI generation

## 🚀 Quick Start

### 1. Install & Run

```bash
npm install
npm run dev:all
```

Requires Node.js 22+.

- **Frontend**: `http://localhost:5173`  
- **File API**: `http://localhost:8787` (writes to `./data` by default)

### 2. Configure Environment

Create `.env.local` for the frontend:
```env
VITE_FAL_KEY=your_fal_api_key
VITE_KIE_KEY=your_kie_api_key
VITE_FILE_API_BASE=http://localhost:8787
VITE_FILE_API_TOKEN=devtoken
```

Create `.env.server` for the backend:
```env
FILE_API_PORT=8787
FILE_STORAGE_ROOT=./data
FILE_API_TOKEN=devtoken
FILE_API_CORS_ORIGIN=http://localhost:5173
FILE_MAX_SIZE_MB=1024
```

### 3. Connect to a Workspace

1. Click the **⚙️ Settings** button in the header
2. Enter your **API Base URL** (default: `http://localhost:8787`)
3. Enter a **Workspace ID** (default: `default`)
4. Enter your **API Token** (matching `FILE_API_TOKEN`)
5. Click **Connect**

That's it! You're ready to create. 🎉

## 📖 Interface Overview

The app has a compact header with:
- **🟢 Status** - Connection indicator and workspace name
- **Credits** - KIE credit balance
- **Queue** - Active job queue
- **⚙️ Settings** - Workspace connection and preferences
- **?** - Help & documentation

**Three main panels:**
- **Left**: Model selection, prompts, reference uploads, generation controls
- **Center**: File browser with search, filters, and drag-and-drop upload
- **Right**: Preview pane with full-screen, comparison, and frame extraction

## 🎯 Key Features

- ✅ **One Command Dev** - `npm run dev:all` starts everything
- ✅ **20+ AI Models** - Video, image, and upscaling
- ✅ **Smart Controls** - UI adapts to each model's parameters
- ✅ **Prompt Expansion** - Integrated LLM prompt enhancer
- ✅ **Built-in Browser** - Browse, preview, and manage files
- ✅ **Persistent** - Workspace settings remembered between sessions

## 🎬 Available Models

### Video Generation
- **Kling 2.5 Pro** - High-quality video generation
- **Veo 3.1 Fast** - Google's video model (Text & I2V)
- **Wan 2.5** - Alibaba's advanced video model
- **Seedance V1 Pro** - ByteDance's video generation

### Image Generation
- **Nano Banana (Edit/Pro)** - Creative artistic images
- **Seedream V4** - ByteDance image editing
- **Qwen Image Edit Plus** - Advanced image editing

### Video Upscaling
- **Topaz Video Upscaler** - Industry standard
- **FlashVSR** - High-quality upscaling
- **ByteDance Upscaler** - Professional enhancement

## 💡 Tips

### Writing Good Prompts
- ✅ Be specific: "A red sports car driving through a neon-lit city at night"
- ✅ Include style: "cinematic", "photorealistic", "oil painting"
- ✅ Describe lighting, camera angles, and mood
- ❌ Avoid vague prompts: "make it cool"

### Video Best Practices
- Use high-quality start frames (1024x1024+)
- Keep prompts focused on one main action
- Use end frames for smooth transitions

### File Organization
Files are automatically organized:
```
workspace-root/
├── images/YYYY-MM-DD/
└── videos/YYYY-MM-DD/
```

## 🛟 Troubleshooting

**Can't connect?**
- Ensure `npm run dev:all` is running
- Check that tokens match in `.env.local` and `.env.server`
- Click ⚙️ Settings to verify your connection settings

**Generation failing?**
- Check browser console (F12) for errors
- Verify API keys have credits
- Try a different model or simpler prompt

## 🏗️ Project Structure

```
server/                # Fastify file API
src/
├── app/               # Main app shell
├── components/        # UI components
├── lib/               # Core logic, models, API clients
└── state/             # React context (catalog, queue)
```

## 🚢 Deployment

```bash
npm run build
```

Deploy `dist/` alongside the file API server. Configure CORS and CSP to allow `https://fal.run` and `https://api.kie.ai`.

## 📚 Documentation

- **[User Guide](docs/USER_GUIDE.md)** - Step-by-step instructions
- **[Agent Guide](docs/AGENT_GUIDE.md)** - Developer and automation reference

## 📄 License

MIT License - feel free to use for your own projects!

---

**Built with ❤️ for creators**
