const PROMPT_STORAGE_KEY = "controls_prompt";
const ACTIONS_STORAGE_KEY = "controls_actions_v1";
const CONTROLS_EVENT = "controls-store-changed";

function safeSetItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors.
  }
}

function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function dispatchChange() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(CONTROLS_EVENT));
  } catch {
    // Ignore dispatch errors.
  }
}

export type ControlsFileRef = {
  workspaceId: string;
  relPath: string;
  name: string;
  mime: string;
};

export type ControlsAction =
  | { type: "useStartFrame"; file: ControlsFileRef }
  | { type: "useEndFrame"; file: ControlsFileRef }
  | { type: "addReferenceImage"; file: ControlsFileRef }
  | { type: "recreateFromOutput"; workspaceId: string; relPath: string };

export function setControlsPrompt(prompt: string): void {
  safeSetItem(PROMPT_STORAGE_KEY, JSON.stringify(prompt));
  dispatchChange();
}

export function getControlsPrompt(): string {
  const raw = safeGetItem(PROMPT_STORAGE_KEY);
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "string" ? parsed : "";
  } catch {
    return "";
  }
}

export function onControlsStoreChange(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CONTROLS_EVENT, handler);
  return () => window.removeEventListener(CONTROLS_EVENT, handler);
}

function loadActions(): ControlsAction[] {
  const raw = safeGetItem(ACTIONS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as ControlsAction[];
  } catch {
    return [];
  }
}

function saveActions(actions: ControlsAction[]): void {
  safeSetItem(ACTIONS_STORAGE_KEY, JSON.stringify(actions));
}

export function enqueueControlsAction(action: ControlsAction): void {
  const actions = loadActions();
  actions.push(action);
  // Prevent unbounded growth in case something goes wrong.
  const trimmed = actions.slice(-50);
  saveActions(trimmed);
  dispatchChange();
}

export function consumeControlsActions(): ControlsAction[] {
  const actions = loadActions();
  if (actions.length === 0) return [];
  // Clear queue first to avoid re-processing if handler throws.
  safeSetItem(ACTIONS_STORAGE_KEY, JSON.stringify([]));
  return actions;
}
