import {
  buildProviderUrl,
  blobFromBytes,
  buildQueryString,
  delay,
  downloadBlob,
  extractUrl,
  getValueAtPath,
  isRecord,
  resolveTaskConfig,
  fetchWithTimeout,
  withRetry,
  readErrorDetails,
} from "./providers/shared";
import type {
  ProviderCallOptions,
  ProviderCallResult,
  TaskPollingConfig,
} from "./providers/types";

const KIE_BASE_URL = "https://api.kie.ai";
const KIE_UPLOAD_URL = "https://kieai.redpandaai.co/api/file-stream-upload";
const MAX_UPLOAD_SIZE_MB = 50;

export function getKieKey() {
  return (import.meta.env.VITE_KIE_KEY ?? "").trim();
}

/**
 * Upload a file to Kie's file-stream-upload service.
 * Returns the public download URL for the uploaded file.
 */
export async function uploadToKie(file: File, customName?: string): Promise<string> {
  const key = getKieKey();
  if (!key) {
    throw new Error("Missing KIE key.");
  }

  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_UPLOAD_SIZE_MB) {
    throw new Error(
      `File "${file.name}" is too large (${sizeMB.toFixed(1)}MB). Maximum upload size is ${MAX_UPLOAD_SIZE_MB}MB.`
    );
  }

  // Always append a unique suffix to avoid CDN cache collisions when the
  // same logical slot (e.g. image_1.jpg) is re-uploaded with a different file.
  const baseName = customName ?? file.name;
  const dotIdx = baseName.lastIndexOf(".");
  const stem = dotIdx > 0 ? baseName.slice(0, dotIdx) : baseName;
  const ext = dotIdx > 0 ? baseName.slice(dotIdx) : "";
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const fileName = `${stem}_${uniqueSuffix}${ext}`;

  const formData = new FormData();
  formData.append("file", file, fileName);
  formData.append("uploadPath", "uploads");
  formData.append("fileName", fileName);

  const response = await withRetry(
    async () => {
      const res = await fetchWithTimeout(KIE_UPLOAD_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
        },
        body: formData,
        timeoutMs: 120000,
      });
      if (!res.ok) {
        const errorDetails = await readErrorDetails(res);
        throw new Error(`KIE upload failed (${res.status}): ${errorDetails}`);
      }
      return res;
    },
    3,
    1000,
    2
  );

  const data = (await response.json()) as {
    success: boolean;
    code: number;
    msg: string;
    data?: { downloadUrl?: string };
  };

  if (!data.success || data.code !== 200 || !data.data?.downloadUrl) {
    throw new Error(`KIE upload failed: ${data.msg ?? "No download URL returned."}`);
  }

  return data.data.downloadUrl;
}

/**
 * Convert a KIE-generated file URL into a temporary downloadable link
 * via the /api/v1/common/download-url endpoint.
 * Returns the resolved URL, or falls back to the original if conversion fails.
 */
async function resolveKieDownloadUrl(
  key: string,
  url: string,
  logger?: (msg: string) => void
): Promise<string> {
  try {
    const target = buildProviderUrl(KIE_BASE_URL, "/api/v1/common/download-url");
    const response = await fetchWithTimeout(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
      timeoutMs: 15000,
    });

    if (!response.ok) {
      if (logger) logger(`download-url conversion failed (${response.status}), using original URL`);
      return url;
    }

    const data = (await response.json()) as { code: number; data?: string; msg?: string };
    if (data.code === 200 && typeof data.data === "string" && data.data) {
      return data.data;
    }
    return url;
  } catch (error) {
    if (logger) logger(`download-url conversion error: ${error instanceof Error ? error.message : String(error)}`);
    return url;
  }
}

export async function getKieCredits(): Promise<number> {
  const key = getKieKey();
  if (!key) return 0;

  const target = buildProviderUrl(KIE_BASE_URL, "/api/v1/chat/credit");
  try {
    const response = await withRetry(() =>
      fetchWithTimeout(target, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        timeoutMs: 10000, // Short timeout for credits check
      })
    );

    if (!response.ok) {
      console.warn(`Failed to fetch credits: ${response.status}`);
      return 0;
    }

    const data = (await response.json()) as { code: number; data: number };
    if (data.code === 200 && typeof data.data === "number") {
      return data.data;
    }
    return 0;
  } catch (error) {
    console.error("Error fetching credits:", error);
    return 0;
  }
}

export async function callKie(
  endpoint: string,
  payload: Record<string, unknown>,
  options?: ProviderCallOptions
): Promise<ProviderCallResult> {
  const key = getKieKey();
  if (!key) {
    throw new Error("Missing KIE key.");
  }

  const target = buildProviderUrl(KIE_BASE_URL, endpoint);
  const logger = options?.log;

  if (typeof logger === "function") {
    logger(`Submitting task...`);
  }

  const response = await withRetry(() =>
    fetchWithTimeout(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      timeoutMs: 600000, // 10m timeout for generation requests
    })
  );

  if (!response.ok) {
    const errorDetails = await readErrorDetails(response);
    throw new Error(`KIE request failed (${response.status}): ${errorDetails}`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  // Handle empty response body
  const responseText = await response.text();
  if (!responseText || responseText.trim() === "") {
    throw new Error(`KIE returned empty response for ${endpoint}`);
  }

  if (!contentType.includes("application/json")) {
    const arrayBuffer = new TextEncoder().encode(responseText).buffer;
    return {
      blob: new Blob([arrayBuffer], {
        type: contentType || "application/octet-stream",
      }),
    };
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    throw new Error(`KIE returned invalid JSON: ${responseText.substring(0, 200)}`);
  }

  if (typeof logger === "function") {
    logger(`Task submitted.`);
  }

  if (!data || typeof data !== "object") {
    throw new Error(`KIE returned invalid data structure: ${responseText.substring(0, 200)}`);
  }

  if (typeof data.code === "number" && data.code !== 200) {
    const message =
      (data.msg as string | undefined) ??
      (data.message as string | undefined) ??
      "KIE request failed.";
    throw new Error(`${enhanceKieErrorMessage(message)} (code ${data.code})`);
  }

  const directUrl =
    extractUrl(data) ?? extractUrl((data.data as Record<string, unknown>) ?? {});
  if (directUrl) {
    const resolvedDirectUrl = await resolveKieDownloadUrl(key, directUrl, logger);
    if (options?.preferUrlResult) {
      return { url: resolvedDirectUrl };
    }
    try {
      return {
        url: resolvedDirectUrl,
        blob: await downloadBlob(resolvedDirectUrl),
      };
    } catch (error) {
      console.warn("Failed to download blob from KIE direct URL:", error);
      return { url: resolvedDirectUrl };
    }
  }

  const bytesBlob = blobFromBytes(
    data?.bytes ?? (data?.data as { bytes?: unknown })?.bytes,
    (data?.mime as string | undefined) ??
    ((data?.data as { mime?: string })?.mime ?? "application/octet-stream")
  );
  if (bytesBlob) {
    return { blob: bytesBlob };
  }

  const taskConfig = options?.taskConfig;
  if (taskConfig) {
    const taskId = resolveTaskId(data);
    if (!taskId) {
      throw new Error("KIE response did not include a task id.");
    }
    if (typeof logger === "function") {
      logger(`Waiting for generation...`);
    }
    const finalData = await pollKieTask(key, taskId, taskConfig, logger);

    // Check resultJson FIRST — this is the canonical KIE result format.
    // extractUrl must NOT run first because the poll response contains a
    // `param` field (JSON of the original request) which includes input
    // image URLs that extractUrl would incorrectly pick up.
    const resultJsonUrl = extractUrlFromResultJson(
      isRecord(finalData) ? finalData : undefined
    );
    if (resultJsonUrl) {
      if (logger) logger(`Downloading result...`);
      const resolvedResultUrl = await resolveKieDownloadUrl(key, resultJsonUrl, logger);
      if (options?.preferUrlResult) {
        return { url: resolvedResultUrl };
      }
      try {
        const blob = await downloadBlob(resolvedResultUrl);
        if (logger) logger(`Download complete.`);
        return { url: resolvedResultUrl, blob };
      } catch (error) {
        console.warn("Failed to download blob from KIE result URL:", error);
        return { url: resolvedResultUrl };
      }
    }

    // Fallback: try generic URL extraction (for non-standard responses)
    const taskUrl =
      extractUrl(finalData) ??
      extractUrl(
        isRecord(finalData)
          ? (finalData.data as Record<string, unknown> | undefined)
          : undefined
      );

    if (taskUrl) {
      if (logger) logger(`Downloading result...`);
      const resolvedTaskUrl = await resolveKieDownloadUrl(key, taskUrl, logger);
      if (options?.preferUrlResult) {
        return { url: resolvedTaskUrl };
      }
      try {
        const blob = await downloadBlob(resolvedTaskUrl);
        if (logger) logger(`Download complete.`);
        return { url: resolvedTaskUrl, blob };
      } catch (error) {
        console.warn("Failed to download blob from KIE task URL:", error);
        return { url: resolvedTaskUrl };
      }
    }

    const taskBytes = blobFromBytes(
      isRecord(finalData) ? finalData.bytes : undefined,
      isRecord(finalData)
        ? ((finalData.mime as string | undefined) ?? "application/octet-stream")
        : "application/octet-stream"
    );
    if (taskBytes) {
      return { blob: taskBytes };
    }

    if (typeof logger === "function") {
      logger(`Task finished but no downloadable asset found.`);
    }

    throw new Error("KIE task completed without a downloadable asset.");
  }

  throw new Error("Unable to locate asset payload in KIE response.");
}

function resolveTaskId(data: Record<string, unknown>): string | undefined {
  const direct = data.taskId;
  if (typeof direct === "string" && direct) {
    return direct;
  }
  const snake = data.task_id;
  if (typeof snake === "string" && snake) {
    return snake;
  }
  const recordId = data.recordId;
  if (typeof recordId === "string" && recordId) {
    return recordId;
  }
  const nested = data.data;
  if (isRecord(nested)) {
    if (typeof nested.taskId === "string" && nested.taskId) {
      return nested.taskId;
    }
    if (typeof nested.task_id === "string" && nested.task_id) {
      return nested.task_id;
    }
    if (typeof nested.recordId === "string" && nested.recordId) {
      return nested.recordId;
    }
  }
  return undefined;
}

type LogFn = (msg: string) => void;

async function pollKieTask(
  key: string,
  taskId: string,
  config: TaskPollingConfig,
  logger?: LogFn
): Promise<unknown> {
  const defaults = resolveTaskConfig(config);
  let transientFailureCount = 0;

  const maxPollMs = defaults.pollIntervalMs * 3;

  for (let attempt = 0; attempt < defaults.maxAttempts; attempt += 1) {
    const statusPayload = await fetchTaskStatus(key, taskId, config, defaults);
    const stateValue = getValueAtPath(statusPayload, defaults.statePath);

    // Log state changes to keep the user informed
    if (logger && attempt % 5 === 0) {
      const stateLabel =
        stateValue === "queuing" ? "Queuing..." :
        stateValue === "generating" ? "Generating..." :
        stateValue === "waiting" ? "Generating..." :
        `Generating...`;
      logger(stateLabel);
    }

    // Mild backoff: base interval for first 20 attempts, then gradually increase
    const pollMs = attempt < 20
      ? defaults.pollIntervalMs
      : Math.min(maxPollMs, defaults.pollIntervalMs * Math.pow(1.1, attempt - 20));

    // Handle both string and numeric state values (Veo uses numeric: 1=success, 2/3=fail)
    const stateStr = String(stateValue);
    if (stateValue !== undefined && stateValue !== null) {
      // Check success states (compare both as string and original type)
      const isSuccess = defaults.successStates.some(
        (s: string | number) => s === stateValue || String(s) === stateStr
      );
      if (isSuccess) {
        if (logger) {
          logger(`Generation complete.`);
        }
        return (
          getValueAtPath(statusPayload, defaults.responseDataPath) ??
          statusPayload
        );
      }

      // Check failure states
      const isFailure = defaults.failureStates.some(
        (s: string | number) => s === stateValue || String(s) === stateStr
      );
      if (isFailure) {
        const errorMessage = extractTaskFailureMessage(statusPayload);
        if (
          isTransientKieTaskFailure(errorMessage) &&
          transientFailureCount < MAX_TRANSIENT_TASK_FAILURES
        ) {
          transientFailureCount += 1;
          if (logger) {
            logger(
              `Transient KIE failure (${transientFailureCount}/${MAX_TRANSIENT_TASK_FAILURES}): ${errorMessage}. Retrying status poll...`
            );
          }
          await delay(pollMs);
          continue;
        }
        throw new Error(`KIE task failed: ${errorMessage}`);
      }
      transientFailureCount = 0;
    }

    await delay(pollMs);
  }

  throw new Error("KIE task polling timed out.");
}

async function fetchTaskStatus(
  key: string,
  taskId: string,
  config: TaskPollingConfig,
  defaults: ReturnType<typeof resolveTaskConfig>
): Promise<Record<string, unknown>> {
  const method = config.method ?? "GET";
  const taskLocation = defaults.taskIdLocation;
  const paramName = defaults.taskIdParam;
  const query: Record<string, string | number | boolean | undefined> = {
    ...(config.query ?? {}),
  };
  const body: Record<string, unknown> = {
    ...(config.body ?? {}),
  };

  if (taskLocation === "query") {
    query[paramName] = taskId;
  } else if (method === "POST") {
    body[paramName] = taskId;
  } else {
    query[paramName] = taskId;
  }

  let target = buildProviderUrl(KIE_BASE_URL, config.statusEndpoint);
  const queryString = buildQueryString(query);
  if (queryString) {
    const separator = target.includes("?") ? "&" : "?";
    target = `${target}${separator}${queryString.replace(/^\?/, "")}`;
  }

  const response = await withRetry(() =>
    fetchWithTimeout(target, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      cache: "no-store" as RequestCache,
      body: method === "POST" ? JSON.stringify(body) : undefined,
      timeoutMs: 15000, // 15s timeout for status checks
    })
  );

  if (!response.ok) {
    const errorDetails = await readErrorDetails(response);
    throw new Error(`KIE task status request failed (${response.status}): ${errorDetails}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  if (typeof data.code === "number" && data.code !== 200) {
    const message =
      (data.msg as string | undefined) ??
      (data.message as string | undefined) ??
      "Task status failed.";
    throw new Error(`${message} (code ${data.code})`);
  }

  return data;
}

function extractUrlFromResultJson(input: unknown): string | undefined {
  if (!input || !isRecord(input)) return undefined;
  const candidates: string[] = [];
  const possibleKeys = ["resultJson", "resultInfoJson", "response"];
  for (const key of possibleKeys) {
    const value = input[key];
    if (typeof value === "string") {
      candidates.push(value);
    }
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const url = extractUrl(parsed);
      if (url) {
        return url;
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

const MAX_TRANSIENT_TASK_FAILURES = 3;

function isTransientKieTaskFailure(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === "success") return true;
  if (normalized === "task failed.") return true;
  if (normalized === "unknown error") return true;
  if (normalized.includes("task id is blank")) return true;
  if (normalized.includes("createtaskrep is blank")) return true;
  if (normalized.includes("generate playground failed")) return true;
  return false;
}

function extractTaskFailureMessage(statusPayload: Record<string, unknown>): string {
  const candidates = [
    getValueAtPath(statusPayload, "data.failMsg"),
    getValueAtPath(statusPayload, "data.errorMsg"),
    getValueAtPath(statusPayload, "data.failReason"),
    getValueAtPath(statusPayload, "data.reason"),
    getValueAtPath(statusPayload, "data.message"),
    statusPayload.msg,
    statusPayload.message,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    if (trimmed.toLowerCase() === "success") continue;
    return enhanceKieErrorMessage(trimmed);
  }

  return "Task failed.";
}

function enhanceKieErrorMessage(message: string): string {
  const normalized = message.trim();
  const lowered = normalized.toLowerCase();
  if (!normalized) {
    return "KIE request failed.";
  }
  if (lowered.includes("image dimensions must be at least 300")) {
    return `${normalized}. Ensure start frame and all element/reference images are at least 300x300.`;
  }
  if (lowered.includes("kling_elements must contain an element with name")) {
    return `${normalized} Use @Element1/@Element2 in prompt and matching names in kling_elements.`;
  }
  if (lowered.includes("video duration must be between 3 and 30 seconds")) {
    return `${normalized}. For motion-control, the reference video must be 3-30 seconds long.`;
  }
  return normalized;
}
