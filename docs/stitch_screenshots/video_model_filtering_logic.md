# Video Generation: Model Filtering Logic for Complex Inputs

## Overview
To prevent race conditions, generation failures, and invalid job configurations, the model selection logic must be dynamic and reactive to the current input state of the workspace.

## 1. Input-Based Filtering
- **Multi-Reference Trigger**: If the user has more than 2 reference inputs (Start/End frames) active, the model list MUST be filtered to only include models that support `multi_reference` or `input_slots > 2`.
- **Temporal Consistency**: If a video reference (`@vid[n]`) is used, the system should prioritize models with specific temporal guidance capabilities.
- **Audio Alignment**: If an audio reference (`@aud[n]`) is present, only models with `capability: audio_reactive` or `capability: lip_sync` should be active.

## 2. Validation & Race Condition Prevention
- **Pre-Flight Check**: Before a generation job is submitted, the backend must verify that the selected model ID is still valid for the provided set of input tags.
- **Dynamic Port Mapping**: The UI should only render ports (controls) that are supported by the currently selected model to ensure users don't configure parameters that the model cannot process.
- **Constraint Resolution**: If a user switches to an incompatible model after configuring complex inputs, the UI should either:
  - Block the switch and show a reason.
  - Clear the incompatible inputs with a user confirmation prompt.

## 3. Implementation Goal
The goal is to ensure a "Correct by Construction" workflow where the user is never presented with a configuration that will lead to a predictable backend failure.