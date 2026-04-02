/**
 * Element type definitions for the Elements Manager.
 * Elements are reusable characters/objects that can be referenced during generation.
 */

export type ElementCategory = "character" | "environment" | "prop" | "shot";

export interface Element {
    /** Unique identifier (UUID) */
    id: string;
    /** User-friendly name */
    name: string;
    /** Category */
    category: ElementCategory;
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
    /** Is the element pinned? */
    isPinned?: boolean;
}

export interface ElementInput {
    name: string;
    category: ElementCategory;
    frontalImage: File;
    referenceImages: File[];
    characterSheet?: File;
}

/** Selected element for generation */
export interface SelectedElement {
    element: Element;
}
