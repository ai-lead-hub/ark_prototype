import { authHeaders, type WorkspaceConnection } from "./files";

export type GenerationMetadataInput = {
  workspaceId: string;
  outputRelPath: string;
  outputMime?: string | null;
  outputSize?: number | null;
  category: "image" | "video" | "upscale";
  modelId?: string | null;
  provider?: string | null;
  endpoint?: string | null;
  prompt?: string | null;
  seed?: string | number | null;
  payload?: unknown;
};

export type PromptHistoryInput = {
  workspaceId?: string | null;
  tab?: "image" | "video" | null;
  modelId?: string | null;
  prompt: string;
};

export type FileMetadataInput = {
  workspaceId: string;
  relPath: string;
  width?: number;
  height?: number;
  duration?: number;
};

export async function recordGeneration(
  connection: WorkspaceConnection,
  input: GenerationMetadataInput
): Promise<void> {
  const response = await fetch(new URL("/meta/generations", connection.apiBase), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(connection.token),
    },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      outputRelPath: input.outputRelPath,
      outputMime: input.outputMime ?? null,
      outputSize: input.outputSize ?? null,
      category: input.category,
      modelId: input.modelId ?? null,
      provider: input.provider ?? null,
      endpoint: input.endpoint ?? null,
      prompt: input.prompt ?? null,
      seed: input.seed ?? null,
      payload: input.payload ?? null,
    }),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Meta generation write failed: ${response.statusText}`);
  }
}

export async function recordPrompt(
  connection: WorkspaceConnection,
  input: PromptHistoryInput
): Promise<void> {
  const response = await fetch(new URL("/meta/prompts", connection.apiBase), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(connection.token),
    },
    body: JSON.stringify({
      workspaceId: input.workspaceId ?? null,
      tab: input.tab ?? null,
      modelId: input.modelId ?? null,
      prompt: input.prompt,
    }),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Meta prompt write failed: ${response.statusText}`);
  }
}

export async function recordFileMetadata(
  connection: WorkspaceConnection,
  input: FileMetadataInput
): Promise<void> {
  const response = await fetch(new URL("/meta/files", connection.apiBase), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(connection.token),
    },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      relPath: input.relPath,
      width: input.width,
      height: input.height,
      duration: input.duration,
    }),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Meta file write failed: ${response.statusText}`);
  }
}

export type GenerationListEntry = {
  id: string;
  created_at: number;
  workspace_id: string;
  output_rel_path: string;
  output_mime: string | null;
  output_size: number | null;
  category: string | null;
  model_id: string | null;
  provider: string | null;
  endpoint: string | null;
  prompt: string | null;
  seed: string | null;
};

export type GenerationDetailEntry = GenerationListEntry & {
  payload: unknown | null;
};

export async function listGenerations(
  connection: WorkspaceConnection,
  opts?: { workspaceId?: string; limit?: number }
): Promise<GenerationListEntry[]> {
  const url = new URL("/meta/generations", connection.apiBase);
  url.searchParams.set("workspace", opts?.workspaceId ?? connection.workspaceId);
  if (opts?.limit !== undefined) url.searchParams.set("limit", String(opts.limit));

  const response = await fetch(url, { headers: authHeaders(connection.token) });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Meta generations read failed: ${response.statusText}`);
  }
  const payload = (await response.json()) as { entries?: GenerationListEntry[] };
  return Array.isArray(payload.entries) ? payload.entries : [];
}

export async function getGenerationByOutput(
  connection: WorkspaceConnection,
  outputRelPath: string,
  opts?: { workspaceId?: string }
): Promise<GenerationDetailEntry | null> {
  const url = new URL("/meta/generations/by-output", connection.apiBase);
  url.searchParams.set("workspace", opts?.workspaceId ?? connection.workspaceId);
  url.searchParams.set("path", outputRelPath);

  const response = await fetch(url, { headers: authHeaders(connection.token) });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Meta generation lookup failed: ${response.statusText}`);
  }

  const payload = (await response.json()) as { entry?: GenerationDetailEntry | null };
  return payload.entry ?? null;
}

export type PromptHistoryEntry = {
  id: number;
  created_at: number;
  workspace_id: string | null;
  tab: string | null;
  model_id: string | null;
  prompt: string;
};

export async function listPrompts(
  connection: WorkspaceConnection,
  opts?: { workspaceId?: string; limit?: number }
): Promise<PromptHistoryEntry[]> {
  const url = new URL("/meta/prompts", connection.apiBase);
  url.searchParams.set("workspace", opts?.workspaceId ?? connection.workspaceId);
  if (opts?.limit !== undefined) url.searchParams.set("limit", String(opts.limit));

  const response = await fetch(url, { headers: authHeaders(connection.token) });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Meta prompts read failed: ${response.statusText}`);
  }
  const payload = (await response.json()) as { entries?: PromptHistoryEntry[] };
  return Array.isArray(payload.entries) ? payload.entries : [];
}
