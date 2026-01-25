import { fal } from "@fal-ai/client";
import {
  buildProviderUrl,
  blobFromBytes,
  downloadBlob,
  extractUrl,
  fetchWithTimeout,
  withRetry,
  readErrorDetails,
} from "./providers/shared";
import type { ProviderCallOptions, ProviderCallResult } from "./providers/types";

const FAL_BASE_URL = "https://fal.run";

export function getFalKey() {
  return (import.meta.env.VITE_FAL_KEY ?? "").trim();
}

function ensureFalClient() {
  const key = getFalKey();
  if (!key) {
    throw new Error("Missing FAL key.");
  }
  fal.config({ credentials: key });
  return fal;
}

export async function callFal(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<ProviderCallResult> {
  const key = getFalKey();
  if (!key) {
    throw new Error("Missing FAL key.");
  }

  const target = buildProviderUrl(FAL_BASE_URL, endpoint);
  const response = await withRetry(() =>
    fetchWithTimeout(target, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      timeoutMs: 600000, // 10m timeout for generation requests
    })
  );

  if (!response.ok) {
    const errorDetails = await readErrorDetails(response);
    throw new Error(`FAL request failed (${response.status}): ${errorDetails}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const arrayBuffer = await response.arrayBuffer();
    return {
      blob: new Blob([arrayBuffer], {
        type: contentType || "application/octet-stream",
      }),
    };
  }

  const data = (await response.json()) as Record<string, unknown>;
  const url =
    extractUrl(data) ??
    extractUrl(data?.data) ??
    extractUrl((data?.result as Record<string, unknown>) ?? {});

  if (url) {
    return {
      url,
      blob: await downloadBlob(url),
    };
  }

  const maybeBytes = blobFromBytes(
    data?.bytes ??
    (data?.data as { bytes?: unknown })?.bytes ??
    (data?.result as { bytes?: unknown })?.bytes,
    (data?.mime as string | undefined) ??
    ((data?.data as { mime?: string })?.mime ?? undefined) ??
    "application/octet-stream"
  );

  if (maybeBytes) {
    return { blob: maybeBytes };
  }

  throw new Error("Unable to locate asset payload in FAL response.");
}

export async function callFalSubscribe(
  endpoint: string,
  input: Record<string, unknown>,
  options?: ProviderCallOptions
): Promise<ProviderCallResult> {
  const client = ensureFalClient();
  const { log } = options ?? {};

  try {
    const result = await client.subscribe(endpoint, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS" && log) {
          update.logs.map((l) => l.message).forEach(log);
        }
      },
    });

    const data = result.data as Record<string, unknown>;

    // Handle video response (video.url) - LTX-2, etc.
    const video = data?.video as { url?: string } | undefined;
    if (video?.url) {
      return {
        url: video.url,
        blob: await downloadBlob(video.url),
      };
    }

    // Handle image response (images[].url) - Qwen, Kling O1, etc.
    const images = data?.images as Array<{ url: string }> | undefined;
    if (images && images.length > 0 && images[0].url) {
      const url = images[0].url;
      return {
        url,
        blob: await downloadBlob(url),
      };
    }

    throw new Error("No image/video URL found in response");
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "FAL subscribe request failed"
    );
  }
}

function extractUploadUrl(result: unknown): string | undefined {
  if (!result) return undefined;
  if (typeof result === "string") {
    return result.startsWith("http") ? result : undefined;
  }
  if (typeof result === "object") {
    const record = result as Record<string, unknown>;
    const direct = record.url ?? record.signedUrl ?? record.signed_url;
    if (typeof direct === "string" && direct.startsWith("http")) {
      return direct;
    }
    const dataEntry = record.data as Record<string, unknown> | undefined;
    if (dataEntry) {
      const nested = extractUploadUrl(dataEntry);
      if (nested) return nested;
    }
  }
  return undefined;
}

export async function uploadToFal(file: File, customName?: string): Promise<string> {
  const client = ensureFalClient();

  // If a custom name is provided, create a new File with that name
  // This helps models understand which reference is which (e.g., image_1.jpg, image_2.jpg)
  const fileToUpload = customName
    ? new File([file], customName, { type: file.type })
    : file;

  const result = await client.storage.upload(fileToUpload);
  const url = extractUploadUrl(result);
  if (!url) {
    throw new Error("Upload response did not include a file URL.");
  }
  return url;
}
