# Nano Banana Image-to-Video Prompt Generation

This skill generates video prompts when animating an **Image Start Frame** using Nano Banana video models.

## Golden Rules
- **NO technical photography jargon.** No f-stops, focal lengths, mm, or camera body names.
- **Keep it short.** 2–3 simple sentences maximum. The model should picture it immediately.
- **Name subjects explicitly.** Never say "the subject" or "the person" — describe who they are.
- **Start from the image state.** The video animates forward from the image. Describe what happens next, not what already happened.

---

## Model Selection Guide

Choose models based on what the shot demands. Assign two models per shot for comparison (Video Model + Video Model 2).

| Model | Durations | Resolution | Best For | Struggles With |
|-------|-----------|------------|----------|----------------|
| **Kling 2.6** | 5s, 10s | 1080p | Beauty shots, product reveals, camera motion, visual fidelity | Human performance, expressive dialogue |
| **Grok Imagine** | 6s, 10s | 720p | Natural human performance, authentic dialogue, emotion | Physics, object dynamics |
| **Seedance 1.5 Pro** | 4s, 8s | 1080p | Balanced allrounder — dialogue, physics, reliable motion | High visual quality / fine detail |

**Typical pairings:**
- Beauty/product shot → Kling (primary) + Seedance (secondary)
- Dialogue/performance shot → Grok (primary) + Seedance (secondary)
- Physics/action shot → Seedance (primary) + Kling (secondary)

---

## Prompt Formula

**Standard (no dialogue):**
`[ANCHOR]. [SUBJECT] [ACTION]. [BACKGROUND MOVEMENT]. [CAMERA MOVEMENT].`

**With dialogue:**
`[ANCHOR]. [SUBJECT] [ACTION], says "[line]". [OTHER SUBJECT] replies "[line]". [BACKGROUND]. [CAMERA MOVEMENT].`

Keep each component to one short clause. Do not over-describe.

---

## Workflow

When invoked interactively, guide the user through the inputs below. In pipeline context (all inputs already known from the approved start frame and shot description), skip Steps 1 and 2 and generate directly.

### Step 1: Collect Animation Details

Ask strictly for:
1. **Anchor (Scene Context):** One-line setting (e.g., "At a sun-drenched beach in the afternoon").
2. **Subject Identity:** Who/what is in the image? Be specific (e.g., "A woman in a white linen dress", "A golden retriever").
3. **Movement:** Sequential actions the subject takes, starting from the exact state shown in the image. Use strong active verbs. 2–3 actions max.
   - Continuity: if the image shows a hand reaching for a glass, start "lifts glass, brings it to lips, sets it down" — not "drinks".
4. **Dialogue (Optional):** If characters speak, capture the exact words in quotes.
5. **Background Movement (Optional):** Environmental motion (e.g., "leaves drift", "light shifts").
6. **Camera Movement (Optional):** ONE movement only (Static, Slow push in, Slow pull out, Pan left/right, Tracking shot).

### Step 2: Generate the Prompt

Assemble into the formula. Keep it lean — cut any clause that doesn't add information the model needs.

**Formatting rules:**
- Start immediately with the Anchor — no preamble.
- Subject identity goes in the second clause.
- Actions are sequential, comma-separated verbs: "lifts glass, takes a sip, sets it down".
- Dialogue uses the exact format: `says "line"` / `replies "line"`.
- Camera movement is always last, one word or short phrase.
- Strip all technical photography jargon before outputting.

---

## Output Examples

**Standard (beauty/product shot):**
```
At a sun-drenched rooftop in golden hour. A glass bottle of sparkling water sits on a marble ledge, condensation forms on the glass, a single drop rolls down the side. Warm light glows in the background. Static shot.
```

**Human performance:**
```
At a cozy café in the morning. An Indian woman in a red coat lifts her coffee cup, takes a slow sip, closes her eyes briefly. Steam rises gently from the cup. Slow push in.
```

**With dialogue:**
```
At a restaurant during dinner. An Indian couple sits at a candlelit table, the man raises his glass and says "To us", the woman smiles and clinks glasses and says "Always". Warm bokeh lights shimmer in the background. Static shot.
```

**Action/physics shot:**
```
Above a rocky coastline. A coconut falls from the top of frame, strikes the rock, cracks open and splashes juice outward. Ocean spray rises in the background. Static shot.
```
