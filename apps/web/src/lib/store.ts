import { computed, createStore } from "@elurjs/core";
import type { StoreSignals } from "@elurjs/core";
import type {
  AgentRun,
  AppSettings,
  CreateProjectInput,
  DoctorReport,
  EngineId,
  EngineInfo,
  FileNode,
  HealthReport,
  Message,
  ProjectWithLastRender,
  Provider,
  ProviderInput,
  ProviderPresetInfo,
  Render,
  Stats,
  TemplateInfo,
  UpdateSettingsInput,
  VideurEvent,
} from "@videur/contracts";
import { api, ApiError } from "./api";

export type ToastKind = "info" | "success" | "warning" | "error";

export type ThemeId = "midnight" | "aurora" | "ember" | "mono";
export type AccentId = "cyan" | "violet" | "emerald" | "rose" | "amber";

const THEME_KEY = "videur.theme";
const ACCENT_KEY = "videur.accent";

function storedTheme(): ThemeId {
  if (typeof localStorage === "undefined") return "midnight";
  const value = localStorage.getItem(THEME_KEY);
  return value === "aurora" || value === "ember" || value === "mono" ? value : "midnight";
}

function storedAccent(): AccentId {
  if (typeof localStorage === "undefined") return "cyan";
  const value = localStorage.getItem(ACCENT_KEY);
  return value === "violet" || value === "emerald" || value === "rose" || value === "amber"
    ? value
    : "cyan";
}

export function applyAppearance(theme: ThemeId, accent: AccentId, persist = true): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = accent;
  if (persist && typeof localStorage !== "undefined") {
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(ACCENT_KEY, accent);
  }
}

export interface Toast {
  id: string;
  message: string;
  kind: ToastKind;
  at: number;
}

export interface OpenFile {
  path: string;
  content: string;
  draft: string;
  binary: boolean;
  size: number;
  dirty: boolean;
}

export interface ToolActivity {
  id: string;
  runId: string;
  tool: string;
  status: "started" | "finished";
  args?: Record<string, unknown>;
  result?: string;
  ok?: boolean;
  startedAt: number;
  durationMs?: number;
}

export interface LogLine {
  stream: "stdout" | "stderr" | "system";
  line: string;
  at: number;
}

export type WorkspaceTab = "agent" | "code" | "preview" | "qa";

export interface AppState {
  booted: boolean;
  loading: boolean;
  projects: ProjectWithLastRender[];
  stats: Stats | null;
  engines: EngineInfo[];
  providers: Provider[];
  presets: ProviderPresetInfo[];
  settings: AppSettings | null;
  templates: TemplateInfo[];
  doctor: DoctorReport | null;
  health: HealthReport | null;
  currentProject: ProjectWithLastRender | null;
  files: FileNode[];
  openFile: OpenFile | null;
  renders: Render[];
  selectedRenderId: string | null;
  messages: Message[];
  toolActivity: ToolActivity[];
  logs: LogLine[];
  activeRun: AgentRun | null;
  agentRunning: boolean;
  sseConnected: boolean;
  toasts: Toast[];
  workspaceTab: WorkspaceTab;
  theme: ThemeId;
  accent: AccentId;
}

const initialState: AppState = {
  booted: false,
  loading: false,
  projects: [],
  stats: null,
  engines: [],
  providers: [],
  presets: [],
  settings: null,
  templates: [],
  doctor: null,
  health: null,
  currentProject: null,
  files: [],
  openFile: null,
  renders: [],
  selectedRenderId: null,
  messages: [],
  toolActivity: [],
  logs: [],
  activeRun: null,
  agentRunning: false,
  sseConnected: false,
  toasts: [],
  workspaceTab: "agent",
  theme: storedTheme(),
  accent: storedAccent(),
};

function id(prefix = "id"): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${random}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

function upsertProject(list: ProjectWithLastRender[], project: ProjectWithLastRender): ProjectWithLastRender[] {
  const index = list.findIndex((item) => item.id === project.id);
  if (index < 0) return [project, ...list];
  const next = [...list];
  next[index] = project;
  return next;
}

function upsertRender(list: Render[], render: Render): Render[] {
  const index = list.findIndex((item) => item.id === render.id);
  if (index < 0) return [render, ...list];
  const next = [...list];
  next[index] = render;
  return next;
}

async function refreshProjectsState(s: StoreSignals<AppState>): Promise<void> {
  const result = await api.projects.list({ limit: 100 });
  s.projects.value = result.items;
}

async function refreshStatsState(s: StoreSignals<AppState>): Promise<void> {
  s.stats.value = await api.stats();
}

async function refreshFilesState(s: StoreSignals<AppState>, projectId: string): Promise<void> {
  const result = await api.projects.files(projectId);
  s.files.value = result.files;
}

async function refreshRendersState(s: StoreSignals<AppState>, projectId: string): Promise<void> {
  const result = await api.renders.list(projectId, { limit: 100 });
  s.renders.value = result.items;
  if (!s.selectedRenderId.value || !result.items.some((item) => item.id === s.selectedRenderId.value)) {
    s.selectedRenderId.value =
      result.items.find((item) => item.status === "succeeded")?.id ?? result.items[0]?.id ?? null;
  }
  const selected = s.selectedRenderId.value;
  if (selected) await loadLogsHelper(s, selected);
}

async function refreshMessagesState(s: StoreSignals<AppState>, projectId: string): Promise<void> {
  const result = await api.agent.messages(projectId);
  s.messages.value = result.items;
}

async function refreshCurrentState(s: StoreSignals<AppState>): Promise<void> {
  const project = s.currentProject.value;
  if (!project) return;
  const [current, files, renders] = await Promise.all([
    api.projects.get(project.id),
    api.projects.files(project.id),
    api.renders.list(project.id, { limit: 100 }),
  ]);
  s.currentProject.value = current;
  s.files.value = files.files;
  s.renders.value = renders.items;
  s.projects.value = upsertProject(s.projects.value, current);
}

async function openFileHelper(s: StoreSignals<AppState>, path: string): Promise<void> {
  const project = s.currentProject.value;
  if (!project) return;
  const file = await api.projects.readFile(project.id, path);
  s.openFile.value = {
    path: file.path,
    content: file.content,
    draft: file.content,
    binary: file.binary,
    size: file.size,
    dirty: false,
  };
}

async function loadLogsHelper(s: StoreSignals<AppState>, renderId: string): Promise<void> {
  try {
    const text = await api.renders.logs(renderId);
    const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
    s.logs.value = lines.slice(-800).map((line) => ({ stream: "system", line, at: Date.now() }));
  } catch {
    s.logs.value = [];
  }
}

export const appStore = createStore(
  initialState,
  {
    name: "videur",
    actions: (s) => {
      const toast = (message: string, kind: ToastKind = "info"): void => {
        const item: Toast = { id: id("toast"), message, kind, at: Date.now() };
        s.toasts.value = [...s.toasts.value.slice(-4), item];
        setTimeout(() => {
          s.toasts.value = s.toasts.value.filter((toastItem) => toastItem.id !== item.id);
        }, 5200);
      };

      const dismissToast = (toastId: string): void => {
        s.toasts.value = s.toasts.value.filter((item) => item.id !== toastId);
      };

      const setSseConnected = (value: boolean): void => {
        s.sseConnected.value = value;
      };

      const setWorkspaceTab = (tab: WorkspaceTab): void => {
        s.workspaceTab.value = tab;
      };

      const setTheme = (theme: ThemeId): void => {
        s.theme.value = theme;
        applyAppearance(theme, s.accent.value);
      };

      const setAccent = (accent: AccentId): void => {
        s.accent.value = accent;
        applyAppearance(s.theme.value, accent);
      };

      const resetAppearance = (): void => {
        s.theme.value = "midnight";
        s.accent.value = "cyan";
        applyAppearance("midnight", "cyan");
      };

      const bootstrap = async (): Promise<void> => {
        if (s.booted.value) return;
        applyAppearance(s.theme.value, s.accent.value, false);
        s.loading.value = true;
        const results = await Promise.allSettled([
          api.stats(),
          api.projects.list({ limit: 100 }),
          api.engines(),
          api.providers.list(),
          api.settings.get(),
          api.templates.list(),
          api.providers.presets(),
          api.health(),
        ]);
        const [stats, projects, engines, providers, settings, templates, presets, health] = results;
        if (stats.status === "fulfilled") s.stats.value = stats.value;
        if (projects.status === "fulfilled") s.projects.value = projects.value.items;
        if (engines.status === "fulfilled") s.engines.value = engines.value.items;
        if (providers.status === "fulfilled") s.providers.value = providers.value.items;
        if (settings.status === "fulfilled") s.settings.value = settings.value;
        if (templates.status === "fulfilled") s.templates.value = templates.value.items;
        if (presets.status === "fulfilled") s.presets.value = presets.value.items;
        if (health.status === "fulfilled") s.health.value = health.value;
        const failed = results.filter((result) => result.status === "rejected");
        if (failed.length > 0) {
          toast("No se pudo cargar todo el estado del estudio. Revisa el servidor.", "error");
        }
        s.booted.value = true;
        s.loading.value = false;
      };

      const refreshProjects = async (): Promise<void> => {
        try {
          await refreshProjectsState(s);
        } catch (error) {
          toast(errorMessage(error), "error");
        }
      };

      const refreshStats = async (): Promise<void> => {
        try {
          await refreshStatsState(s);
        } catch {
          // Silencioso: no bloquea la UI.
        }
      };

      const refreshEngines = async (): Promise<void> => {
        try {
          const result = await api.engines();
          s.engines.value = result.items;
        } catch (error) {
          toast(errorMessage(error), "error");
        }
      };

      const refreshProviders = async (): Promise<void> => {
        try {
          const result = await api.providers.list();
          s.providers.value = result.items;
        } catch (error) {
          toast(errorMessage(error), "error");
        }
      };

      const refreshSettings = async (): Promise<void> => {
        try {
          s.settings.value = await api.settings.get();
        } catch (error) {
          toast(errorMessage(error), "error");
        }
      };

      const refreshTemplates = async (): Promise<void> => {
        try {
          const result = await api.templates.list();
          s.templates.value = result.items;
        } catch (error) {
          toast(errorMessage(error), "error");
        }
      };

      const refreshDoctor = async (): Promise<void> => {
        try {
          s.doctor.value = await api.doctor();
        } catch (error) {
          toast(errorMessage(error), "error");
        }
      };

      const loadProject = async (projectId: string): Promise<void> => {
        s.loading.value = true;
        const changed = s.currentProject.value?.id !== projectId;
        if (changed) {
          s.openFile.value = null;
          s.logs.value = [];
          s.toolActivity.value = [];
          s.messages.value = [];
        }
        try {
          const [project, files, renders, messages] = await Promise.all([
            api.projects.get(projectId),
            api.projects.files(projectId),
            api.renders.list(projectId, { limit: 100 }),
            api.agent.messages(projectId),
          ]);
          s.currentProject.value = project;
          s.files.value = files.files;
          s.renders.value = renders.items;
          s.messages.value = messages.items;
          const selectedRenderId =
            renders.items.find((item) => item.status === "succeeded")?.id ?? renders.items[0]?.id ?? null;
          s.selectedRenderId.value = selectedRenderId;
          if (selectedRenderId) await loadLogsHelper(s, selectedRenderId);
          s.projects.value = upsertProject(s.projects.value, project);
          if (!s.openFile.value) {
            const preferred =
              files.files.find((file) => file.path === "render.json") ??
              files.files.find((file) => file.path === "render.py") ??
              files.files.find((file) => file.path === "scene.py") ??
              files.files.find((file) => file.type === "file" && file.path.endsWith(".md"));
            if (preferred) await openFileHelper(s, preferred.path);
          }
        } catch (error) {
          toast(errorMessage(error), "error");
          s.currentProject.value = null;
        } finally {
          s.loading.value = false;
        }
      };

      const openFileByPath = async (path: string): Promise<void> => {
        try {
          await openFileHelper(s, path);
        } catch (error) {
          toast(errorMessage(error), "error");
        }
      };

      const setDraft = (draft: string): void => {
        const file = s.openFile.value;
        if (!file) return;
        s.openFile.value = { ...file, draft, dirty: draft !== file.content };
      };

      const saveFile = async (): Promise<void> => {
        const file = s.openFile.value;
        const project = s.currentProject.value;
        if (!file || !project || file.binary) return;
        try {
          await api.projects.writeFile(project.id, file.path, file.draft);
          s.openFile.value = { ...file, content: file.draft, dirty: false };
          await refreshFilesState(s, project.id);
          await refreshCurrentState(s);
          await refreshProjectsState(s);
          toast("Archivo guardado", "success");
        } catch (error) {
          toast(errorMessage(error), "error");
        }
      };

      const loadRenders = async (projectId: string): Promise<void> => {
        try {
          await refreshRendersState(s, projectId);
        } catch (error) {
          toast(errorMessage(error), "error");
        }
      };

      const selectRender = async (renderId: string): Promise<void> => {
        s.selectedRenderId.value = renderId;
        try {
          const render = await api.renders.get(renderId);
          s.renders.value = upsertRender(s.renders.value, render);
          await loadLogsHelper(s, renderId);
        } catch (error) {
          toast(errorMessage(error), "error");
        }
      };

      const loadLogs = async (renderId: string): Promise<void> => {
        await loadLogsHelper(s, renderId);
      };

      const renderCurrent = async (engine?: EngineId): Promise<void> => {
        const project = s.currentProject.value;
        if (!project) return;
        try {
          const result = await api.renders.start(project.id, engine);
          s.selectedRenderId.value = result.renderId;
          await refreshRendersState(s, project.id);
          await loadLogsHelper(s, result.renderId);
          await refreshCurrentState(s);
          toast("Render encolado", "info");
        } catch (error) {
          toast(errorMessage(error), "error");
        }
      };

      const cancelRender = async (renderId: string): Promise<void> => {
        try {
          const result = await api.renders.cancel(renderId);
          s.renders.value = upsertRender(s.renders.value, result.render);
          toast("Render cancelado", "warning");
        } catch (error) {
          toast(errorMessage(error), "error");
        }
      };

      const retryRender = async (renderId: string): Promise<void> => {
        try {
          const result = await api.renders.retry(renderId);
          s.selectedRenderId.value = result.renderId;
          if (s.currentProject.value) await refreshRendersState(s, s.currentProject.value.id);
          toast("Reintentando render", "info");
        } catch (error) {
          toast(errorMessage(error), "error");
        }
      };

      const sendPrompt = async (prompt: string, providerId?: string, model?: string): Promise<boolean> => {
        const project = s.currentProject.value;
        if (!project) return false;
        if (s.agentRunning.value) {
          toast("El agente ya está trabajando", "warning");
          return false;
        }
        s.agentRunning.value = true;
        s.toolActivity.value = [];
        try {
          const result = await api.agent.start(project.id, {
            prompt,
            ...(providerId ? { providerId } : {}),
            ...(model ? { model } : {}),
          });
          s.activeRun.value = await api.agent.run(result.runId);
          await refreshMessagesState(s, project.id);
          toast(`Agente iniciado con ${result.provider}`, "info");
          return true;
        } catch (error) {
          s.agentRunning.value = false;
          toast(errorMessage(error), "error");
          return false;
        }
      };

      const cancelAgent = async (): Promise<void> => {
        const run = s.activeRun.value;
        if (!run) return;
        try {
          await api.agent.cancel(run.id);
          s.agentRunning.value = false;
          toast("Agente cancelado", "warning");
        } catch (error) {
          toast(errorMessage(error), "error");
        }
      };

      const clearMessages = async (): Promise<void> => {
        const project = s.currentProject.value;
        if (!project) return;
        try {
          await api.agent.clear(project.id);
          s.messages.value = [];
          s.toolActivity.value = [];
          toast("Historial borrado", "info");
        } catch (error) {
          toast(errorMessage(error), "error");
        }
      };

      const createProject = async (input: CreateProjectInput): Promise<ProjectWithLastRender | null> => {
        try {
          const project = await api.projects.create(input);
          s.projects.value = upsertProject(s.projects.value, project);
          void refreshStatsState(s);
          toast(`Proyecto “${project.name}” creado`, "success");
          return project;
        } catch (error) {
          toast(errorMessage(error), "error");
          return null;
        }
      };

      const deleteProject = async (projectId: string): Promise<boolean> => {
        try {
          await api.projects.remove(projectId);
          s.projects.value = s.projects.value.filter((project) => project.id !== projectId);
          if (s.currentProject.value?.id === projectId) {
            s.currentProject.value = null;
            s.files.value = [];
            s.openFile.value = null;
            s.renders.value = [];
            s.messages.value = [];
          }
          toast("Proyecto eliminado", "info");
          return true;
        } catch (error) {
          toast(errorMessage(error), "error");
          return false;
        }
      };

      const saveSettings = async (patch: UpdateSettingsInput): Promise<boolean> => {
        try {
          s.settings.value = await api.settings.update(patch);
          toast("Ajustes guardados", "success");
          return true;
        } catch (error) {
          toast(errorMessage(error), "error");
          return false;
        }
      };

      const saveProvider = async (input: ProviderInput, providerId?: string): Promise<boolean> => {
        try {
          const provider = providerId
            ? await api.providers.update(providerId, input)
            : await api.providers.create(input);
          s.providers.value = providerId
            ? s.providers.value.map((item) => (item.id === provider.id ? provider : item))
            : [...s.providers.value, provider];
          toast(providerId ? "Proveedor actualizado" : "Proveedor añadido", "success");
          return true;
        } catch (error) {
          toast(errorMessage(error), "error");
          return false;
        }
      };

      const deleteProvider = async (providerId: string): Promise<boolean> => {
        try {
          await api.providers.remove(providerId);
          s.providers.value = s.providers.value.filter((provider) => provider.id !== providerId);
          toast("Proveedor eliminado", "info");
          return true;
        } catch (error) {
          toast(errorMessage(error), "error");
          return false;
        }
      };

      const testProvider = async (providerId: string) => {
        try {
          const result = await api.providers.test(providerId);
          if (result.ok) toast(`Conexión OK · ${result.latencyMs} ms`, "success");
          else toast(result.error ?? "La conexión falló", "error");
          return result;
        } catch (error) {
          toast(errorMessage(error), "error");
          return null;
        }
      };

      const applyTemplate = async (templateId: string, projectId: string, overwrite = false): Promise<boolean> => {
        try {
          await api.templates.apply(templateId, projectId, overwrite);
          await refreshFilesState(s, projectId);
          toast("Plantilla aplicada", "success");
          return true;
        } catch (error) {
          toast(errorMessage(error), "error");
          return false;
        }
      };

      const handleEvent = (event: VideurEvent): void => {
        switch (event.type) {
          case "hello":
          case "ping":
            return;
          case "project.updated":
            s.projects.value = upsertProject(s.projects.value, event.project);
            if (s.currentProject.value?.id === event.projectId) {
              s.currentProject.value = event.project;
            }
            return;
          case "render.queued":
            if (s.currentProject.value?.id === event.projectId) {
              void refreshRendersState(s, event.projectId).catch(() => undefined);
            }
            return;
          case "render.progress": {
            if (s.currentProject.value?.id !== event.projectId) return;
            const index = s.renders.value.findIndex((render) => render.id === event.renderId);
            if (index < 0) {
              void refreshRendersState(s, event.projectId).catch(() => undefined);
              return;
            }
            const next = [...s.renders.value];
            next[index] = {
              ...next[index]!,
              status: event.status,
              stage: event.stage,
              progress: event.progress,
            };
            s.renders.value = next;
            if (s.currentProject.value?.id === event.projectId) {
              s.currentProject.value = { ...s.currentProject.value, status: "rendering" };
            }
            return;
          }
          case "render.log":
            if (s.currentProject.value?.id !== event.projectId) return;
            s.logs.value = [
              ...s.logs.value.slice(-799),
              { stream: event.stream, line: event.line, at: Date.now() },
            ];
            return;
          case "render.completed": {
            s.renders.value = upsertRender(s.renders.value, event.render);
            if (s.selectedRenderId.value === event.renderId) {
              void loadLogsHelper(s, event.renderId);
            }
            if (s.currentProject.value?.id === event.projectId) {
              void refreshCurrentState(s).catch(() => undefined);
              void refreshStatsState(s).catch(() => undefined);
            }
            if (event.status === "succeeded") toast("Render completado", "success");
            if (event.status === "failed") toast(`Render fallido: ${event.render.error ?? ""}`, "error");
            if (event.status === "cancelled") toast("Render cancelado", "warning");
            return;
          }
          case "agent.started":
            s.agentRunning.value = true;
            return;
          case "agent.message": {
            if (s.currentProject.value?.id !== event.projectId) return;
            if (s.messages.value.some((message) => message.id === event.message.id)) return;
            s.messages.value = [...s.messages.value, event.message];
            return;
          }
          case "agent.tool": {
            const running = s.toolActivity.value;
            if (event.status === "started") {
              s.toolActivity.value = [
                ...running.slice(-20),
                {
                  id: id("tool"),
                  runId: event.runId,
                  tool: event.tool,
                  status: "started",
                  args: event.args,
                  startedAt: Date.now(),
                },
              ];
            } else {
              const index = [...running].reverse().findIndex(
                (item) => item.tool === event.tool && item.status === "started",
              );
              if (index >= 0) {
                const realIndex = running.length - 1 - index;
                const next = [...running];
                const item = next[realIndex]!;
                next[realIndex] = {
                  ...item,
                  status: "finished",
                  ok: event.result?.ok,
                  result: event.result?.content,
                  durationMs: event.durationMs,
                };
                s.toolActivity.value = next;
              }
            }
            return;
          }
          case "agent.usage":
            if (s.activeRun.value?.id === event.runId) {
              s.activeRun.value = {
                ...s.activeRun.value,
                inputTokens: event.inputTokens,
                outputTokens: event.outputTokens,
              };
            }
            return;
          case "agent.completed": {
            s.agentRunning.value = false;
            if (s.activeRun.value?.id === event.runId) {
              void api.agent.run(event.runId).then((run) => {
                s.activeRun.value = run;
              }).catch(() => undefined);
            }
            if (s.currentProject.value?.id === event.projectId) {
              void refreshCurrentState(s).catch(() => undefined);
              void refreshMessagesState(s, event.projectId).catch(() => undefined);
              void refreshStatsState(s).catch(() => undefined);
            }
            if (event.status === "succeeded") toast(event.summary ?? "Agente completado", "success");
            if (event.status === "failed") toast(event.error ?? "El agente falló", "error");
            return;
          }
          case "agent.error":
            toast(event.error, "error");
            return;
          case "engine.changed":
            void refreshEngines();
            return;
        }
      };

      return {
        bootstrap,
        refreshProjects,
        refreshStats,
        refreshEngines,
        refreshProviders,
        refreshSettings,
        refreshTemplates,
        refreshDoctor,
        loadProject,
        openFileByPath,
        setDraft,
        saveFile,
        loadRenders,
        selectRender,
        loadLogs,
        renderCurrent,
        cancelRender,
        retryRender,
        sendPrompt,
        cancelAgent,
        clearMessages,
        createProject,
        deleteProject,
        saveSettings,
        saveProvider,
        deleteProvider,
        testProvider,
        applyTemplate,
        toast,
        dismissToast,
        setSseConnected,
        setWorkspaceTab,
        setTheme,
        setAccent,
        resetAppearance,
        handleEvent,
      };
    },
    getters: (s) => ({
      projectCount: computed(() => s.projects.value.length),
      successRate: computed(() => s.stats.value?.successRate ?? 0),
      enginesOnline: computed(() => s.engines.value.filter((engine) => engine.available).length),
      hasProvider: computed(() => s.providers.value.some((provider) => provider.enabled)),
      activeRenders: computed(() =>
        s.renders.value.filter((render) =>
          ["queued", "preparing", "running", "inspecting"].includes(render.status),
        ),
      ),
      latestRender: computed(
        () =>
          s.renders.value.find((render) => render.status === "succeeded" && render.outputPath) ??
          s.renders.value[0] ??
          null,
      ),
      selectedRender: computed(
        () =>
          s.renders.value.find((render) => render.id === s.selectedRenderId.value) ??
          s.renders.value.find((render) => render.status === "succeeded") ??
          s.renders.value[0] ??
          null,
      ),
    }),
  },
);
