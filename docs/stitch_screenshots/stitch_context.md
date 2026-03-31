# Google Stitch Context — AI Filmmaking Tool UI Prototypes

## Project Overview

**Product**: AI filmmaking studio (codename: AiScope / freepikv5)
**Purpose**: Professional AI-powered image/video/audio generation tool for filmmakers
**Prototype selected**: Bitcoin DeFi (07b-bitcoin-defi.html)
**Current state**: Static HTML prototype → moving to Google Stitch for further iteration

---

## Chosen Design System: Bitcoin DeFi

### Design Philosophy

The Bitcoin DeFi aesthetic is a fusion of precision engineering, cryptographic trust, and digital gold. Light emanates from interactive elements themselves — orange glows, golden highlights, and data points pulse with life against a true void background. Shadows are colored (orange/gold tints), never black. The vibe is **Secure, Technical, and Valuable** — digital gold that feels premium, cutting-edge, and engineered to perfection.

### Design Tokens

**Colors**:
- Background: `#030304` (true void — the deepest space)
- Surface: `#0F1115` (dark matter — elevated surfaces, cards, sidebar)
- Foreground: `#FFFFFF` (pure white — maximum contrast)
- Muted text: `#94A3B8` (stardust — secondary text, descriptions)
- Border: `#1E293B` (dim boundary — subtle at rest)
- Border alpha: `rgba(255,255,255,0.1)` (barely visible structure)
- Border hover: `rgba(247,147,26,0.5)` (orange accent on hover)
- Primary accent: `#F7931A` (Bitcoin orange — CTAs, links, active states)
- Secondary accent: `#EA580C` (burnt orange — deeper warmth for gradients)
- Tertiary accent: `#FFD600` (digital gold — value highlights, success)
- Primary gradient: `linear-gradient(to right, #EA580C, #F7931A)`
- Glass: `rgba(15,17,21,0.8)` with `backdrop-filter: blur`
- Glass border: `rgba(255,255,255,0.08)`

**Typography**:
- Headings: `Space Grotesk` (400, 500, 600, 700) — geometric grotesque with quirky technical character
- Body / UI: `Inter` (300, 400, 500, 600) — highly legible sans-serif
- Data / Labels / Mono: `JetBrains Mono` (300, 400, 500, 600) — precision monospace for stats, badges, nav links

**Border Radius** (soft curves for approachability):
- Cards/Containers: `16px` (rounded-2xl)
- Buttons: `9999px` (rounded-full — pill shape)
- Inputs: `12px` (rounded-lg)
- Small elements (badges, icons): `8px` or `9999px`

**Shadows** (colored luminescence — NEVER pure black shadows):
- Orange glow: `0 0 20px -5px rgba(234,88,12,0.5)`
- Orange glow intense: `0 0 30px -5px rgba(234,88,12,0.7)`
- Gold glow: `0 0 20px rgba(255,214,0,0.3)`
- Subtle card elevation: `0 0 50px -10px rgba(247,147,26,0.1)`
- Generate button: `0 0 20px -5px rgba(234,88,12,0.5)` → hover: `0 0 30px -5px rgba(247,147,26,0.6)`

**Motion**:
- Duration: `300ms` for standard interactions
- Easing: smooth default
- Hover scale: `scale(1.05)` on generate button
- Card lift: `translateY(-1px)` + border orange + glow intensification
- Pulsing dots: `animate-ping` for live activity indicators

### Design Personality
- **Feel**: Crypto trading terminal meets premium dark UI — precise, secure, valuable
- **Glass morphism**: `backdrop-blur-lg` + `bg-black/40` or `bg-white/5` for floating panels
- **Grid pattern background**: 50px grid lines at 2% white opacity, fading radially from center
- **Radial orange blur**: Large soft blob behind controls pane at 7% opacity, blur 120px
- **Gradient text**: `bg-gradient-to-r from-[#EA580C] to-[#F7931A] bg-clip-text text-transparent` on key headlines
- **Orange gradient border on logo**: `background-image: linear-gradient(surface, surface), gradient-primary` with `background-clip: padding-box, border-box`
- **Pulsing orange dots**: Status indicators with ping animation
- **Pill-shaped buttons**: All buttons use `rounded-full`
- **Corner border accents**: Decorative corner borders on special cards (border-t border-l top-left, border-r border-b bottom-right) in Bitcoin orange

---

## Full Style Prompt (for Stitch)

Use this as the style directive when prompting in Google Stitch:

```
Design system: "Bitcoin DeFi" — dark mode precision UI

Colors:
- bg: #030304 (true void), surface: #0F1115 (dark matter)
- text: #FFFFFF, muted: #94A3B8, border: #1E293B
- primary: #F7931A (Bitcoin orange), secondary: #EA580C (burnt orange), tertiary: #FFD600 (digital gold)
- gradient: linear-gradient(to right, #EA580C, #F7931A)
- glass: rgba(15,17,21,0.8) + backdrop-blur

Fonts: Space Grotesk (headings), Inter (body), JetBrains Mono (data/labels)

Radius: 16px cards, 12px inputs, 9999px buttons (pills)

Shadows: ONLY colored shadows — orange glow (0 0 20px -5px rgba(234,88,12,0.5)), gold glow (0 0 20px rgba(255,214,0,0.3)). Never use black drop shadows.

Key effects:
- Glass morphism on cards (backdrop-blur + semi-transparent)
- Grid pattern bg (50px, 2% white, radial fade)
- Radial orange blur blob behind controls (7% opacity)
- Pulsing orange dots for status
- Pill-shaped buttons with gradient fill
- Gradient text on headlines (EA580C → F7931A)
- Hover: card lift -1px + border turns orange + glow intensifies
- Generate: orange gradient pill, scale-105 on hover with intensified glow

Vibe: Crypto trading terminal meets premium dark UI. Secure, technical, valuable. Think Bitcoin mining rigs glowing with orange heat in darkness.
```

---

## Layout Architecture

### 3-Column Layout

```
┌──────┬──────────────────┬────────────────────────────────┐
│ Rail │  Controls Pane   │        Content Area            │
│ 48px │     380px        │        flex: 1                 │
│      │                  │                                │
│ Logo │  Header (title)  │  Breadcrumb / Sort / View      │
│      │  Model Selector  │                                │
│ ──── │  References      │  ┌────┐ ┌────┐ ┌────┐         │
│ Img  │  Prompt Box      │  │File│ │File│ │File│         │
│ Vid  │  Cinematographer  │  │Card│ │Card│ │Card│         │
│ Aud  │  Parameters      │  └────┘ └────┘ └────┘         │
│ Tool │  Advanced        │  ┌────┐ ┌────┐ ┌────┐         │
│ ──── │  ───────────     │  │File│ │File│ │File│         │
│ Hist │  [Generate]       │  │Card│ │Card│ │Card│         │
│ Set  │  cost · time     │  └────┘ └────┘ └────┘         │
│      │                  │                                │
│      │                  │  Queue Strip                    │
└──────┴──────────────────┴────────────────────────────────┘
```

### 1. Mode Rail (48px, `#0F1115`)
- Logo "AS" with orange gradient border (gradient clipped to border)
- 4 mode buttons (36x36, `rounded-lg`):
  - **Image** (active — orange text, subtle orange bg, orange left bar with glow)
  - **Video**
  - **Audio**
  - **Tools**
- Divider line
- History + Settings buttons at bottom

### 2. Controls Pane (380px, `#0F1115`)
Top to bottom:
1. **Header**: "IMAGE" in Space Grotesk 600 + pulsing orange dot + Fast/Quality toggle pills (rounded-full, active fills orange with dark text)
2. **Model selector**: Glass card (rounded-2xl), icon in orange-tinted container, "Flux 1.1 Pro Ultra", "FAL · $0.06 · T2I" muted, AUTO pill badge (orange gradient border), caret arrow. Hover: border goes orange.
3. **References**: Label + "+ Add" in orange text. 46x46 rounded-lg thumbnails (filled + empty with "+"). Close X on hover.
4. **Prompt**: Glass-effect textarea (rounded-lg), orange border on focus with glow, ">" prefix in orange, auto-expand chip with pulsing orange dot
5. **Cinematographer button**: Rounded-full pill, dashed border, "CINEMATOGRAPHER" + camera icon. Opens center modal.
6. **Cinema summary**: Current settings in muted text with orange highlights on key values
7. **Parameters**: 2x2 grid of rounded-lg glass boxes (Aspect Ratio, Resolution, Guidance, Seed)
8. **Advanced**: Collapsible section
9. **Generate button** (sticky footer): Full-width pill, orange gradient bg, white text, hover: scale-105 + intensified glow. Active: scale-95.

### 3. Content Area (flex:1, `#030304`)
- Grid pattern background (50px, 2% opacity, radial fade)
- Radial orange blur blob top-right (7% opacity)
- Breadcrumb + file count + sort dropdown (rounded) + view toggles (rounded)
- **File grid**: 3-column, rounded-2xl cards, white/10 border:
  - Thumbnail (aspect 4/3) with gradient, "IMG" badge (rounded-lg, orange-tinted bg)
  - 3-dot menu (rounded, appears on hover)
  - Hover overlay: 3 action buttons (Retry ↻, Reuse 📋, Download ⬇) — rounded-full, white/10 bg, orange on hover with glow
  - File name + metadata
- Queue strip: pulsing orange dot + "1 processing · 0 pending" + credits in orange

---

## Cinematographer Modal (Interactive Popup)

**Trigger**: Click "Cinematographer" pill button below prompt
**Container**: 680px wide, rounded-2xl, surface bg (#0F1115), border white/10, orange glow shadow

### Structure:
```
┌─────────────────────────────────────┐
│ CINEMATOGRAPHER (gradient text)   ✕ │
├──────────┬───────────┬──────────────┤
│ Camera   │ Lighting  │ Style        │ ← pill tabs, orange/gold/orange active
├──────────┴───────────┴──────────────┤
│                                     │
│ Camera tab: 4 scrollable columns    │
│ ┌────────┬────────┬────────┬──────┐ │
│ │Body    │Lens    │Focal   │f-Stop│ │
│ │        │        │        │      │ │
│ │ARRI 65 │Cooke   │14mm    │f/1.2 │ │
│ │*active*│*S7/i*  │24mm    │*f1.4*│ │ ← orange border+glow = active
│ │RED     │Zeiss   │*35mm*  │f/2   │ │
│ │Sony    │Primo   │50mm    │f/2.8 │ │
│ │Panav   │ARRI Sig│85mm    │f/4   │ │
│ └────────┴────────┴────────┴──────┘ │
│                                     │
│ Lighting tab: 3x3 grid, golden     │
│   border+glow when active           │
│ Style tab: 3x3 grid, orange        │
│   border when active                │
│                                     │
├─────────────────────────────────────┤
│ Summary with orange highlights      │
│              [Reset] [Apply ▸]      │ ← Apply = orange gradient pill
└─────────────────────────────────────┘
```

- Camera tab: 4 columns (Body, Lens, Focal Length, f-Stop) with subtle vertical dividers. 340px height. Orange border+glow on active items.
  - Bodies: ARRI Alexa 65, RED Raptor 8K, Sony Venice 2, Panavision DXL2, Blackmagic URSA 12K, Canon C500 MkII, IMAX MSMD
  - Lenses: Cooke S7/i, Zeiss SP, Primo 70, ARRI Sig, Atlas 1.5x, Leica M
  - Focal: 14mm, 24mm, 35mm, 50mm, 85mm, 100mm, 135mm, 200mm
  - f-Stop: f/1.2, f/1.4, f/2, f/2.8, f/4, f/5.6, f/8, f/11
- Lighting tab: 9 visual cards (Golden Hour, Moonlight, Neon, Rembrandt, Overcast, Blue Hour, Practical, High Key, Low Key). Active: golden border + glow.
- Style tab: 9 visual cards (Photorealistic, Film Stock, Cyberpunk, Vintage, Desaturated, Bleach Bypass, B&W, Cross-Process, Anime). Active: orange border.
- Apply updates main summary, Reset restores defaults, Escape/overlay click closes

---

## Universal Model Adapter Architecture (Backend Context)

The UI is driven by a **port-based model definition system**. Key concepts:

### Port Types
`text | number | boolean | enum | image | video | audio | mask | json | image[] | video[] | audio[] | asset-slots`

### Port Schema (simplified)
```
Port {
  key: string           // "start_frame"
  type: PortType         // determines UI component
  label: string          // "Starting Frame"
  tier: primary | standard | advanced | hidden
  group: string          // logical grouping
  showWhen: Condition    // conditional visibility
  disableWhen: Condition // grayed-out when true
  constraints: { min, max, step, options, maxCount }
}
```

### Tier-Based Layout
- **Primary**: Always visible (prompt, main image input)
- **Standard**: Collapsed section, shown on expand
- **Advanced**: Collapsed, requires deliberate user action
- **Hidden**: Never shown in UI (internal params)

### Key Concepts
- **Job**: Immutable execution record (inputs → outputs → lineage)
- **Asset**: File artifact with provenance tracking
- **Conditions**: Declarative `showWhen`, `disableWhen`, `clearWhen` rules
- **Provider mapping**: `mapTo` + `transform` handle API differences
- **Multi-shot prompting**: Per-shot params with duration validation
- **Reference-based prompting**: `@tag` autocomplete, `asset-slots` port type
- **Auto model selection**: Capability filtering → quality scoring → best match

---

## Existing Prototype Inventory

All in `/prototypes/` folder. The master UI (07b) is the hub; other features route from it:

| File | Feature |
|------|---------|
| 01-magic-layers.html | Photoshop-style layer compositing with AI actions |
| 02-harmonize-fusion.html | Fusion LoRA controls, split view before/after |
| 03-inpainting.html | Canvas with mask overlays, per-region prompts |
| 04-one-click-video.html | Right-click context menu "Animate to Video" |
| 05-prompt-auto-expansion.html | Auto-expansion with 3 variants + confidence |
| 06-model-auto-selection.html | Evaluation funnel with elimination reasons |
| **07b-bitcoin-defi.html** | **MASTER UI — selected design** |
| 08-rl-feedback.html | A/B comparison, preference learning |
| 09-history-storage.html | Timeline view, usage charts, cost breakdown |
| 10-vlm-finetuning.html | Training config, progress metrics |
| 11-fast-quality-mode.html | Mode cards, comparison table, upgrade flow |

---

## Tech Stack (Actual App)

- **Frontend**: React 19 + Vite 7 + TypeScript 5 + Tailwind CSS
- **Backend**: Fastify + SQLite
- **Providers**: FAL, KIE, OpenRouter (multi-provider)
- **Prototypes**: Static HTML files (not integrated into app yet)

---

## Design Principles

1. **Bitcoin orange (#F7931A) is the primary accent**, with burnt orange (#EA580C) for gradients and digital gold (#FFD600) for value highlights
2. **Glass morphism** on all cards and panels (backdrop-blur + semi-transparent)
3. **Colored shadows only** — orange/gold tinted glows, never black drop shadows
4. **Pill-shaped buttons** (rounded-full) with gradient fills
5. **Grid pattern background** with radial fade (50px, 2% opacity)
6. **Radial orange blur blobs** for atmospheric depth (7% opacity, blur 120px)
7. **Gradient text** on key headlines (EA580C → F7931A)
8. **Smooth 300ms transitions** on all interactions
9. **Space Grotesk headings**, **Inter body**, **JetBrains Mono labels**
10. **Port-driven controls** — UI renders dynamically from model definitions

---

## Next Steps for Stitch

1. Refine the master UI layout (07b) with more polish and real visual thumbnails
2. Design the cinematographer modal with actual photographic reference images for lighting/style
3. Design video mode controls (different params from image)
4. Design the Image Lab workspace (opens from double-click/3-dot on image asset — Photoshop-style layer panel with AI tools)
5. Design remaining feature UIs in the Bitcoin DeFi style
6. Eventually translate prototypes to React components in the actual app
