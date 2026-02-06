/**
 * Element type definitions for the Elements Manager.
 * Elements are reusable characters/objects that can be referenced during generation.
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
    /** Optional character sheet URL for image-reference workflows */
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
    characterSheet?: File;
}

/** Selected element for generation */
export interface SelectedElement {
    element: Element;
}
