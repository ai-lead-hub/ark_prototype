# Nano Banana Image Edit Prompt Generation

This skill generates edit prompts that modify an existing selected image — either changing the camera angle/view (TYPE 1) or making a targeted partial edit (TYPE 2). The edit prompt is stored in the `Edit Prompt` field and executed via `tools/image_edit.py`. Results appear in `Edited Image`. If approved, check `Use Edited Image` to use it as the video start frame.

## Two Edit Types

### TYPE 1: Camera Angle / View Change
Use when the user wants to re-frame or re-angle the existing image while keeping all content identical.

**When to use:** "Make it a low angle", "Show it from the side", "Try a top-down view", "Add a reverse OTS shot".

**Before generating, mentally visualize:**
- What does the current image look like?
- After the camera angle change, where would the subject and key anchor props reposition?
- How would the subject's orientation to the new camera change?
- What becomes visible/hidden from the new angle?

**Structure:**
```
Create a new image. Change the camera angle to [NEW ANGLE]. [SUBJECT A] viewed from [ORIENTATION], in the [DISTANCE] on the [POSITION]. [SUBJECT B if present] viewed from [ORIENTATION], in the [DISTANCE] on the [POSITION]. [1-2 anchor props with recalculated distance and position].
```

**Spatial terms:**
- Orientation: from the front, from the side, from the back, from a 3/4 angle, from directly above, from below and front
- Distance: immediate foreground, close foreground, midground, far midground, background, distant background
- Position: on the left, on the right, in the center

**TYPE 1 Examples:**

*Low angle (person standing outdoors):*
```
Create a new image. Change the camera angle to a low angle view. Person in white viewed from below and front, in the close foreground in the center. Sky in the distant background. Rooftop in the far background on the left.
```

*Reverse OTS (person on sofa with laptop):*
```
Create a new image. Change the camera angle to a reverse Over-The-Shoulder shot. Man in grey viewed from the back, in the immediate foreground on the left. Laptop screen in the close foreground in the center. Television in the distant background in the center. Coffee table in the midground in the center.
```

*Top-down (person at desk):*
```
Create a new image. Change the camera angle to a top-down view. Person in white viewed from directly above, in the midground in the center. Desk surface in the immediate foreground. Floor visible at the edges.
```

---

### TYPE 2: Partial Edit
Use when the user wants to change a specific element without altering the composition, angle, or anything else.

**When to use:** "Change the wall color to blue", "Add rain", "Make it night", "Remove the background logo", "Make the product label red".

**Structure:**
```
[Change specifically what was requested]. Keep [all other elements] exactly as shown.
```

**TYPE 2 Examples:**

*Change wall color:*
```
Change the wall to deep ocean blue. Keep the subject, furniture, lighting direction, and composition exactly as shown.
```

*Add weather:*
```
Add heavy rain on the window behind the subject. Keep the interior scene, subject, and all furniture exactly as shown.
```

*Time of day change:*
```
Change the scene to nighttime. Replace daylight with warm interior lamp light and blue moonlight through the window. Keep all subjects, furniture, and composition exactly as shown.
```

---

## Workflow

When invoked interactively:
1. Ask the user which shot and which image option they want to edit.
2. Ask what they want to change.
3. Determine TYPE 1 (angle/view) or TYPE 2 (partial edit).
4. For TYPE 1: mentally re-calculate all subject and prop positions for the new camera angle.
5. Generate the edit prompt and present it clearly in a codeblock.

In pipeline context (edit request already specified), generate directly.

## Output Format

Here is your Nano Banana Edit Prompt:

```
[edit prompt here]
```

Then run:
```
python tools/airtable_utils.py set-field --table "<Campaign>" --shots <N> --field "Edit Prompt" --value "..."
python tools/image_edit.py --table "<Campaign>" --shots <N>
```

After reviewing the Edited Image in Airtable:
```
# If approved, mark it as the video start frame:
python tools/airtable_utils.py set-field --table "<Campaign>" --shots <N> --field "Use Edited Image" --value true
```

## Rules
1. Output ONLY the prompt in the codeblock. No explanations inside.
2. Keep subject descriptions SIMPLE: "man in blue", "woman with glasses", "product in silver can".
3. TYPE 1: ALWAYS include subject orientation + distance + position. ALWAYS include 1–2 recalculated anchor props.
4. TYPE 2: ALWAYS specify what to keep unchanged explicitly.
5. NO technical jargon (no f-stops, ISO, camera models, lens names).
