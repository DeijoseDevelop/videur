import type {
  AgentRun,
  AgentStartResult,
  AppSettings,
  CreateProjectInput,
  DoctorReport,
  EngineId,
  EngineInfo,
  FileContent,
  FileNode,
  HealthReport,
  Message,
  ProjectWithLastRender,
  Provider,
  ProviderInput,
  ProviderPresetInfo,
  ProviderTestResult,
  Render,
  Stats,
  TemplateDetail,
  TemplateInfo,
  UpdateProjectInput,
  UpdateSettingsInput,
} from "@videur/contracts";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    let code = "HTTP_ERROR";
    let message = `Error ${response.status}`;
    let details: unknown;
    try {
      const body = (await response.json()) as {
        error?: { code?: string; message?: string; details?: unknown };
      };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
      details = body.error?.details;
    } catch {
      // Mantener mensaje genérico.
    }
    throw new ApiError(response.status, code, message, details);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function requestText(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) throw new ApiError(response.status, "HTTP_ERROR", `Error ${response.status}`);
  return response.text();
}

function query(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const output = search.toString();
  return output ? `?${output}` : "";
}

export const api = {
  health: () => request<HealthReport>("/api/health"),
  doctor: () => request<DoctorReport>("/api/doctor"),
  engines: () => request<{ items: EngineInfo[] }>("/api/engines"),
  stats: () => request<Stats>("/api/stats"),
  settings: {
    get: () => request<AppSettings>("/api/settings"),
    update: (patch: UpdateSettingsInput) =>
      request<AppSettings>("/api/settings", { method: "PUT", body: JSON.stringify(patch) }),
  },
  providers: {
    presets: () => request<{ items: ProviderPresetInfo[] }>("/api/provider-presets"),
    list: () => request<{ items: Provider[]; total: number }>("/api/providers"),
    create: (input: ProviderInput) =>
      request<Provider>("/api/providers", { method: "POST", body: JSON.stringify(input) }),
    update: (id: string, input: Partial<ProviderInput>) =>
      request<Provider>(`/api/providers/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    remove: (id: string) => request<{ deleted: boolean }>(`/api/providers/${id}`, { method: "DELETE" }),
    test: (id: string) => request<ProviderTestResult>(`/api/providers/${id}/test`, { method: "POST" }),
    models: (id: string) => request<{ items: string[] }>(`/api/providers/${id}/models`),
  },
  projects: {
    list: (params: { q?: string; engine?: EngineId; status?: string; limit?: number; offset?: number } = {}) =>
      request<{ items: ProjectWithLastRender[]; total: number }>(`/api/projects${query(params)}`),
    get: (id: string) => request<ProjectWithLastRender>(`/api/projects/${id}`),
    create: (input: CreateProjectInput) =>
      request<ProjectWithLastRender>("/api/projects", { method: "POST", body: JSON.stringify(input) }),
    update: (id: string, input: UpdateProjectInput) =>
      request<ProjectWithLastRender>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    remove: (id: string, keepFiles = false) =>
      request<{ deleted: boolean }>(`/api/projects/${id}${query({ keepFiles })}`, { method: "DELETE" }),
    files: (id: string) => request<{ root: string; files: FileNode[] }>(`/api/projects/${id}/files`),
    readFile: async (id: string, path: string): Promise<FileContent> => {
      const response = await fetch(`/api/projects/${id}/file?path=${encodeURIComponent(path)}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new ApiError(response.status, "FILE_ERROR", body?.error?.message ?? `Error ${response.status}`);
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const body = (await response.json()) as { binary?: boolean; size?: number; path?: string; modifiedAt?: string };
        return {
          path: body.path ?? path,
          content: "",
          size: body.size ?? 0,
          binary: Boolean(body.binary),
          modifiedAt: body.modifiedAt ?? new Date().toISOString(),
        };
      }
      const content = await response.text();
      return {
        path,
        content,
        size: new TextEncoder().encode(content).length,
        binary: false,
        modifiedAt: new Date().toISOString(),
      };
    },
    writeFile: (id: string, path: string, content: string) =>
      request<{ path: string; size: number }>(`/api/projects/${id}/file`, {
        method: "PUT",
        body: JSON.stringify({ path, content }),
      }),
    deleteFile: (id: string, path: string) =>
      request<{ deleted: boolean; path: string }>(
        `/api/projects/${id}/file?path=${encodeURIComponent(path)}`,
        { method: "DELETE" },
      ),
  },
  renders: {
    list: (projectId: string, params: { status?: string; limit?: number; offset?: number } = {}) =>
      request<{ items: Render[]; total: number }>(`/api/projects/${projectId}/renders${query(params)}`),
    start: (projectId: string, engine?: EngineId) =>
      request<{ renderId: string; status: string }>(`/api/projects/${projectId}/renders`, {
        method: "POST",
        body: JSON.stringify(engine ? { engine } : {}),
      }),
    get: (id: string) => request<Render>(`/api/renders/${id}`),
    cancel: (id: string) => request<{ cancelled: boolean; render: Render }>(`/api/renders/${id}/cancel`, { method: "POST" }),
    retry: (id: string) => request<{ renderId: string; status: string }>(`/api/renders/${id}/retry`, { method: "POST" }),
    logs: (id: string, offset = 0, limit = 200_000) =>
      requestText(`/api/renders/${id}/logs${query({ offset, limit })}`),
  },
  agent: {
    messages: (projectId: string) =>
      request<{ items: Message[]; total: number }>(`/api/projects/${projectId}/messages`),
    start: (projectId: string, input: { prompt: string; providerId?: string; model?: string; maxIterations?: number }) =>
      request<AgentStartResult>(`/api/projects/${projectId}/agent`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    run: (runId: string) => request<AgentRun>(`/api/agent/runs/${runId}`),
    cancel: (runId: string) =>
      request<{ cancelled: boolean }>(`/api/agent/runs/${runId}/cancel`, { method: "POST" }),
    clear: (projectId: string) =>
      request<{ deleted: number }>(`/api/projects/${projectId}/messages`, { method: "DELETE" }),
  },
  templates: {
    list: () => request<{ items: TemplateInfo[]; total: number }>("/api/templates"),
    get: (id: string) => request<TemplateDetail>(`/api/templates/${id}`),
    apply: (id: string, projectId: string, overwrite = false) =>
      request<{ applied: string[]; skipped: string[] }>(`/api/templates/${id}/apply`, {
        method: "POST",
        body: JSON.stringify({ projectId, overwrite }),
      }),
  },
};

export function mediaUrl(renderId: string, kind: "video" | "contact-sheet" | "metadata" | "qa" | "log"): string {
  return `/media/${renderId}/${kind}`;
}
