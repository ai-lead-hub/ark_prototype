# Nano Banana Image Prompt Generation

This skill is exclusively for generating image prompts for Nano Banana Pro. Do not use this skill to generate the images themselves, only the prompts.

## Context
Nano Banana Pro is a photorealistic AI image generator that relies heavily on **strict spatial syntax** rather than flowery prose. Subjects are placed using orientation + distance + position. All technical photography elements are appended at the end, wrapped in `$setting$` delimiters.

**Grounding Format:** `"A photorealistic film still."` or `"A cinematic composition."`

## Spatial Syntax Rules

**For subjects (people, animals, vehicles):** orientation + distance + position.
`[Subject] viewed from [Orientation], in the [Distance] on the [Position].`
- Orientation: from the front, from the side, from the back, from a 3/4 angle, from directly above, from below and front
- Distance: immediate foreground, close foreground, midground, far midground, background, distant background
- Position: on the left, on the right, in the center

**For props and environment features:** distance + position only — no orientation.
`[Prop] in the [Distance] on the [Position].`

## Generating the Prompt

When invoked interactively, guide the user step-by-step. In pipeline context (all inputs already known), skip Steps 1 and 2 and generate directly.

### Step 1: Collect Camera & Styling Settings

Ask the user to choose their desired camera and atmospheric settings. Reference the JSON file at `resources/camera-systems.json` for available camera systems, bodies, lenses, and film stocks.

- **Camera System:** (IMAX, Panavision, ARRI, RED, Sony VENICE, Canon, Blackmagic, iPhone, etc.)
- **Camera Body:** (ARRI ALEXA 65, ARRI ALEXA 35, RED V-RAPTOR, Sony VENICE 2, etc.)
- **Lens Model:** (Zeiss Supreme Prime, ARRI Signature Prime, Cooke S4/i, Panavision Primo 70, etc.)
- **Focal Length:** (14mm, 24mm, 35mm, 50mm, 85mm, 100mm, 135mm, 200mm)
- **Aperture:** (f/1.2, f/1.4, f/1.8, f/2.8, f/4, f/5.6, f/8)
- **Film Stock:** (Kodak Portra 400, CineStill 800T, Fujifilm Pro 400H, Kodak Vision3 500T, or None)
- **Camera Angle:** (Front view, 3/4 angle, Side profile, Low angle, High angle)
- **Camera Distance:** (Close-up, Medium Close-up, Wide shot)
- **Lighting:** (Golden hour, Volumetric lighting, Low key, Soft natural light, etc.)
- **Mood/Atmosphere:** (Epic, Intimate, Tense, Warm, Mysterious, etc.)

Wait for the user to respond with their choices.

### Step 2: Collect Compositional Description

Ask the user to describe the scene spatially:
1. **Main Subjects:** Who or what? Keep descriptions simple ("older jazz musician", "woman in red").
2. **Subject Orientations:** How are they facing? (Only for living subjects/focal characters, not inanimate objects.)
3. **Distances & Positions:** Where is everything? (e.g., immediate foreground on the left, midground in the center)

Wait for the user to respond.

### Step 3: Generate the Curated Prompt

Mentally visualize the scene and construct the final prompt using these strict rules:

**Formatting Rules:**

1. **Opening:** Start with a grounding command that does NOT name the subject explicitly — use `"A photorealistic film still."` or `"A cinematic composition."` The subject naming happens in the positional template.

2. **Spatial Template:** Every subject MUST follow:
   `[SUBJECT A] viewed from [ORIENTATION], in the [DISTANCE] on the [POSITION].`
   Describe 1–3 anchor props or environment features using distance + position only:
   `[PROP] in the [DISTANCE] on the [POSITION].`

3. **Start Frame Discipline — CRITICAL:** The image is the **first frame** of the video clip. It must depict the moment **just before** the action begins — never mid-action or end state.
   - "Man drinks coffee" → image shows him **holding the cup raised toward his mouth**, not drinking.
   - "Coconut falls and cracks" → image shows the **coconut suspended at the top of frame**, above the rock.
   - "Woman opens a gift" → image shows **her hands resting on the closed lid**, not the box open.
   - The action lives in the video prompt, not the image.

4. **Environment/Props:** Describe using ONLY distance + position — no orientation.

5. **Text & CTA Handling — CRITICAL:** If the shot includes any on-screen text (product name, tagline, call-to-action, price, URL, brand logo), you MUST describe it explicitly with the exact string in quotation marks. Include its position, size, and style. Never omit text elements or describe them vaguely.
   - `Large bold white sans-serif text reading "JUST DO IT" in the lower third in the center.`
   - `Small black italic tagline reading "Taste the Summer" in the lower right corner.`
   - `Glowing neon sign reading "OPEN 24/7" in the background on the right.`

6. **Additional References:** If Additional References are provided (character refs, background refs, prop refs), incorporate their visual details into the subject and environment descriptions.

7. **Lighting & Mood:** One sentence describing the light source, quality, and atmosphere.

8. **Camera Settings:** ALL technical settings from Step 1 appended at the end, each wrapped in `$setting$` delimiters. For gear from `resources/camera-systems.json`, include the descriptive blurb from the `"prompt"` field.
   `$shot on ARRI ALEXA 65 — 65mm large format, epic scope, extreme detail$, $Zeiss Supreme Prime lenses, full-frame coverage, smooth bokeh, modern cinematic$, $85mm$, $Medium Close-up$, $low angle$, $f/1.8$, $Kodak Portra 400$`

**Crucial Warnings:**
- The prompt ends immediately after the delimited camera settings.
- Do NOT bold the final output string. Provide it cleanly in a codeblock.
- Do NOT add poetic descriptions, metaphors, or flowery language — stay factual and spatial.

### Output Example

Here is your Nano Banana Image Prompt:

```
A photorealistic cinematic film still.
Older jazz musician actively playing a golden saxophone, holding it to his mouth, viewed from the front, in the close foreground in the center. Small round table with a drink in the immediate foreground on the left. Spectator in red viewed from the back, in the midground on the right. Dark brick wall in the background.
Volumetric lighting from a single overhead spotlight, low key chiaroscuro, melancholic and cozy mood.
$shot on ARRI ALEXA 65 — 65mm large format, epic scope, extreme detail$, $with Zeiss Supreme Prime lenses, full-frame coverage, smooth bokeh, modern cinematic$, $85mm$, $Medium Close-up$, $low angle$, $f/1.8$, $Kodak Portra 400$
```

### CTA / Product Text Example

```
A photorealistic commercial still.
Energy drink can viewed from the front, in the close foreground in the center. Wet ice cubes scattered in the immediate foreground. Dark gradient background.
Large bold white sans-serif text reading "UNLEASH IT" in the lower third in the center. Small product URL text reading "www.brand.com" in the bottom right corner.
Dramatic studio lighting, high contrast, electric blue rim light, product hero mood.
$shot on Hasselblad X2D 100C — 100MP medium format, ultra-fine detail, commercial clarity$, $Hasselblad XCD 65mm$, $65mm$, $f/5.6$
```
