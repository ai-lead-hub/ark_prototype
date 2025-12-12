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

