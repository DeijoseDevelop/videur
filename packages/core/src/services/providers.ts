import type { Database } from "bun:sqlite";
import {
  ProviderInputSchema,
  UpdateProviderSchema,
  presetInfo,
  type Provider,
  type ProviderInput,
  type ProviderTestResult,
  type UpdateProviderInput,
} from "@videur/contracts";
import type { VideurConfig } from "../config";
import { ProviderError } from "../errors";
import type { ProviderRuntimeConfig } from "../agent/types";
import { listProviderModels, testProvider } from "../agent/providers";
import {
  countProviders,
  createProvider,
  deleteProvider,
  getProvider,
  listEnabledProviders,
  listProviders,
  updateProvider,
  type ProviderRecord,
} from "../repositories/providers";
import { getAppSettings } from "../repositories/settings";
import type { SecretStore } from "../secrets/crypto";

export class ProviderService {
  constructor(
    private readonly db: Database,
    private readonly config: VideurConfig,
    private readonly secrets: SecretStore,
  ) {}

  list(): Provider[] {
    return listProviders(this.db).map((provider) => this.toPublic(provider));
  }

  get(id: string): Provider {
    const provider = getProvider(this.db, id);
    if (!provider) throw new ProviderError(`Proveedor no encontrado: ${id}`, 404);
    return this.toPublic(provider);
  }

  create(input: ProviderInput): Provider {
    const data = ProviderInputSchema.parse(input);
    const apiKey = typeof data.apiKey === "string" ? data.apiKey : null;
    const record = createProvider(this.db, {
      label: data.label,
      preset: data.preset,
      kind: data.kind,
      baseUrl: data.baseUrl,
      model: data.model,
      apiKeyEnc: apiKey ? this.secrets.encrypt(apiKey) : null,
      apiKeyHint: apiKey ? this.secrets.hint(apiKey) : null,
      headers: data.headers ?? {},
      enabled: data.enabled,
      supportsVision: data.supportsVision,
      supportsTools: data.supportsTools,
    });
    return this.toPublic(record);
  }

  update(id: string, input: UpdateProviderInput): Provider {
    const data = UpdateProviderSchema.parse(input);
    const patch: Parameters<typeof updateProvider>[2] = {};

    if (data.label !== undefined) patch.label = data.label;
    if (data.preset !== undefined) patch.preset = data.preset;
    if (data.kind !== undefined) patch.kind = data.kind;
    if (data.baseUrl !== undefined) patch.baseUrl = data.baseUrl;
    if (data.model !== undefined) patch.model = data.model;
    if (data.headers !== undefined) patch.headers = data.headers;
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    if (data.supportsVision !== undefined) patch.supportsVision = data.supportsVision;
    if (data.supportsTools !== undefined) patch.supportsTools = data.supportsTools;

    if (data.apiKey !== undefined) {
      if (data.apiKey === null) {
        patch.apiKeyEnc = null;
        patch.apiKeyHint = null;
      } else {
        patch.apiKeyEnc = this.secrets.encrypt(data.apiKey);
        patch.apiKeyHint = this.secrets.hint(data.apiKey);
      }
    }

    const updated = updateProvider(this.db, id, patch);
    if (!updated) throw new ProviderError(`Proveedor no encontrado: ${id}`, 404);
    return this.toPublic(updated);
  }

  remove(id: string): boolean {
    return deleteProvider(this.db, id);
  }

  async test(id: string): Promise<ProviderTestResult> {
    return testProvider(this.runtime(id));
  }

  async models(id: string): Promise<string[]> {
    const provider = getProvider(this.db, id);
    if (!provider) throw new ProviderError(`Proveedor no encontrado: ${id}`, 404);
    const runtime = this.toRuntime(provider);
    let models = await listProviderModels(runtime);
    if (models.length === 0 && provider.preset === "ollama") {
      models = await this.ollamaModels(provider.baseUrl);
    }
    return models;
  }

  runtime(id: string): ProviderRuntimeConfig {
    const provider = getProvider(this.db, id);
    if (!provider) throw new ProviderError(`Proveedor no encontrado: ${id}`, 404);
    return this.toRuntime(provider);
  }

  resolveSelection(providerId?: string, model?: string): {
    runtime: ProviderRuntimeConfig;
    providerId: string;
    providerLabel: string;
    model: string;
  } {
    const settings = getAppSettings(this.db);
    const providers = listEnabledProviders(this.db);
    const selected =
      (providerId ? providers.find((provider) => provider.id === providerId) : undefined) ??
      (settings.defaults.providerId
        ? providers.find((provider) => provider.id === settings.defaults.providerId)
        : undefined) ??
      providers[0];

    if (!selected) {
      throw new ProviderError("No hay proveedor de IA configurado. Añade uno en Ajustes.", 400);
    }
    const runtime = this.toRuntime(selected);
    const effectiveModel = model?.trim() || selected.model;
    return {
      runtime,
      providerId: selected.id,
      providerLabel: selected.label,
      model: effectiveModel,
    };
  }

  counts(): { configured: number; enabled: number } {
    return countProviders(this.db);
  }

  private toRuntime(provider: ProviderRecord): ProviderRuntimeConfig {
    let apiKey: string | null = null;
    if (provider.apiKeyEnc) {
      try {
        apiKey = this.secrets.decrypt(provider.apiKeyEnc);
      } catch {
        throw new ProviderError(
          `No se pudo descifrar la API key de ${provider.label}. Revisa la clave maestra o vuelve a introducirla.`,
          500,
        );
      }
    }
    const info = presetInfo(provider.preset);
    if (!apiKey && info.requiresKey) {
      throw new ProviderError(`El proveedor ${provider.label} no tiene API key configurada`, 400);
    }
    return {
      id: provider.id,
      label: provider.label,
      kind: provider.kind,
      baseUrl: provider.baseUrl,
      model: provider.model,
      apiKey,
      headers: provider.headers,
      supportsVision: provider.supportsVision,
      supportsTools: provider.supportsTools,
    };
  }

  private toPublic(record: ProviderRecord): Provider {
    return {
      id: record.id,
      label: record.label,
      preset: record.preset,
      kind: record.kind,
      baseUrl: record.baseUrl,
      model: record.model,
      hasApiKey: Boolean(record.apiKeyEnc),
      apiKeyHint: record.apiKeyHint,
      headers: record.headers,
      enabled: record.enabled,
      supportsVision: record.supportsVision,
      supportsTools: record.supportsTools,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private async ollamaModels(baseUrl: string): Promise<string[]> {
    const root = baseUrl.replace(/\/v1\/?$/, "");
    try {
      const response = await fetch(`${root}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return [];
      const data = (await response.json()) as { models?: Array<{ name?: string }> };
      return (data.models ?? []).map((model) => model.name).filter((name): name is string => Boolean(name));
    } catch {
      return [];
    }
  }
}
