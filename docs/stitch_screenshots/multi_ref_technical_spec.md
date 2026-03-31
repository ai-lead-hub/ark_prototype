# Multi-Reference Mode: Technical Specification (Backend/Frontend)

## 1. Input Handling
When the multi-reference toggle is active (uncollapsed), the reference row accepts a diverse range of input types:
- **Images**: Static visual references.
- **Video**: Motion or temporal references.
- **Audio**: Sonic or rhythmic guides.
- **Elements**: Specific groups of character or prop references.

## 2. Technical Tagging System (Data Anchors)
Every reference input is automatically assigned a unique type tag upon upload/selection:
- **Standard Types**: `@img[n]`, `@vid[n]`, `@aud[n]`, `@elem[n]`.
- **Named Elements**: Specific character or prop names (e.g., `@ashley`, `@hero_car`).

## 3. Prompt Integration
These tags function as dynamic data anchors within the generation engine:
- **Autocomplete**: Tags are available via `@` trigger in the prompt box.
- **Direct Calling**: Users can reference specific assets directly in their creative prompt (e.g., "A cinematic wide shot of @ashley standing in the rain, lighting matching @img2").
- **Resolution**: The backend resolver maps these tags to the corresponding asset IDs and metadata during the pre-processing stage.

## 4. UI/UX Persistence
- **State Tracking**: The specific tag assigned to each reference slot must be persisted in the job's lineage metadata.
- **Visual Feedback**: Tags should be clearly displayed in the UI (e.g., top-right of the reference panel) to ensure the user knows exactly which anchor they are calling.