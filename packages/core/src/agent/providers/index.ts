import type { ProviderTestResult } from "@videur/contracts";
import type { ChatProvider, ProviderRuntimeConfig } from "../types";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { OpenAICompatibleProvider } from "./openai";

export function createChatProvider(config: ProviderRuntimeConfig): ChatProvider {
  switch (config.kind) {
    case "anthropic":
      return new AnthropicProvider(config);
    case "gemini":
      return new GeminiProvider(config);
    case "openai-compatible":
    default:
      return new OpenAICompatibleProvider(config);
  }
}

export async function testProvider(config: ProviderRuntimeConfig): Promise<ProviderTestResult> {
  return createChatProvider(config).test();
}

export async function listProviderModels(config: ProviderRuntimeConfig): Promise<string[]> {
  return createChatProvider(config).listModels();
}
