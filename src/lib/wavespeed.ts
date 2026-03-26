import { Client } from "wavespeed";
import { downloadBlob } from "./providers/shared";
import type { ProviderCallOptions, ProviderCallResult } from "./providers/types";

const WAVESPEED_API_KEY = "dfa4746ee4b02570741ea44162b43172a97c2472e06aa75da6c0f26d8c866a35";

const client = new Client(WAVESPEED_API_KEY);

export function getWavespeedKey() {
  return WAVESPEED_API_KEY;
}

export async function callWavespeed(
  endpoint: string,
  payload: Record<string, unknown>,
  options?: ProviderCallOptions
): Promise<ProviderCallResult> {
  const logger = options?.log;

  if (logger) logger("Submitting task...");

  const result = await client.run(endpoint, payload);

  const outputs = result.outputs as string[] | undefined;
  if (!outputs || outputs.length === 0) {
    throw new Error("WaveSpeed task completed but no output URL found.");
  }

  const url = outputs[0];
  if (logger) logger("Task complete.");

  if (options?.preferUrlResult) {
    return { url };
  }

  return { url, blob: await downloadBlob(url) };
}
