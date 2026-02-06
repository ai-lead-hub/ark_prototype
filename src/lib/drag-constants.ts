export const FILE_ENTRY_MIME = "application/x-freepik-entry";
export const ELEMENT_CHARACTER_SHEET_MIME = "application/x-freepik-element-character-sheet";

export interface ElementCharacterSheetDragPayload {
  elementId: string;
  elementName: string;
  characterSheetUrl: string;
}
