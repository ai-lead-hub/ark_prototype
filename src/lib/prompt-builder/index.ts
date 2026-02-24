// Prompt Builder data loader and exports

import presetsData from './presets.json';
import stylesData from './styles.json';
import lightingData from './lighting.json';
import moodData from './mood.json';
import compositionData from './composition.json';

export * from './types';

export const presets = presetsData as Record<string, import('./types').ScenePreset>;
export const styles = stylesData as Record<string, import('./types').StylePreset[]>;
export const lighting = lightingData as Record<string, import('./types').LightingPreset[]>;
export const mood = moodData as Record<string, import('./types').MoodPreset[]>;
export const composition = compositionData as Record<string, import('./types').CompositionPreset[]>;

// Helper to flatten grouped data into select options
export function flattenToOptions(
    grouped: Record<string, { name: string; prompt: string }[]>,
    includeEmpty = true
): { value: string; label: string; disabled?: boolean }[] {
    const options: { value: string; label: string; disabled?: boolean }[] = [];

    if (includeEmpty) {
        options.push({ value: "", label: "— select —" });
    }

    Object.entries(grouped || {}).forEach(([category, items]) => {
        if (!Array.isArray(items)) return;
        options.push({ value: "", label: `── ${category} ──`, disabled: true });
        items.forEach((item) => {
            options.push({ value: item.prompt || "", label: item.name || item.prompt || "" });
        });
    });

    return options;
}

// Get preset options for dropdown
export function getPresetOptions(): { value: string; label: string }[] {
    const options = [{ value: "custom", label: "— Select a preset —" }];

    Object.keys(presets).forEach((key) => {
        const preset = presets[key];
        // Capitalize first letter for display
        const displayName = key.charAt(0).toUpperCase() + key.slice(1);
        options.push({ value: key, label: preset.name || displayName });
    });

    return options;
}
