import { getFreepikKey } from "../freepik";
import { callKie, getKieKey } from "../kie";
import { callWavespeed, getWavespeedKey } from "../wavespeed";
import type {
  ModelProvider,
  ProviderCallOptions,
  ProviderCallResult,
  TaskPollingConfig,
} from "./types";

const ENV_MAP: Record<ModelProvider, string> = {
  kie: "VITE_KIE_KEY",
  freepik: "VITE_FREEPIK_KEY",
  wavespeed: "WAVESPEED_API_KEY",
};

export async function callModelEndpoint(
  provider: ModelProvider,
  endpoint: string,
  payload: Record<string, unknown>,
  options?: ProviderCallOptions
): Promise<ProviderCallResult> {
  if (provider === "kie") {
    return callKie(endpoint, payload, options);
  }
  if (provider === "wavespeed") {
    return callWavespeed(endpoint, payload, options);
  }
  return callKie(endpoint, payload, options);
}

export function getProviderEnvVar(provider: ModelProvider): string {
  return ENV_MAP[provider];
}

export function getProviderKey(provider: ModelProvider): string {
  if (provider === "kie") return getKieKey();
  if (provider === "freepik") return getFreepikKey();
  if (provider === "wavespeed") return getWavespeedKey();
  return getKieKey();
}

export type {
  ModelProvider,
  ProviderCallOptions,
  ProviderCallResult,
  TaskPollingConfig,
};
