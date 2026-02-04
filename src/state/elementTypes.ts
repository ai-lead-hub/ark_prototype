/**
 * Element type definitions for the Elements Manager.
 * Elements are reusable characters/objects that can be referenced in video generation.
 */

export interface Element {
    /** Unique identifier (UUID) */
    id: string;
    /** User-friendly name */
    name: string;
    /** Required frontal image URL */
    frontalImageUrl: string;
    /** 2-3 additional reference images from different angles */
    referenceImageUrls: string[];
    /** Optional video reference URL */
    videoReferenceUrl?: string;
    /** Optional character sheet URL (not sent to video models) */
    characterSheetUrl?: string;
    /** Creation timestamp */
    createdAt: number;
    /** Last updated timestamp */
    updatedAt: number;
}

export interface ElementInput {
    name: string;
    frontalImage: File;
    referenceImages: File[];
    videoReference?: File;
    characterSheet?: File;
}

/** Mode for using an element in generation */
export type ElementUseMode = "image" | "video";

/** Selected element for generation */
export interface SelectedElement {
    element: Element;
    mode: ElementUseMode;
}
