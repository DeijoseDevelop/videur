import type { Database } from "bun:sqlite";
import {
  StartAgentSchema,
  type AgentRun,
  type AgentStartResult,
  type Message,
  type StartAgentInput,
  type ToolCall,
} from "@videur/contracts";
import type { VideurConfig } from "../config";
import { AppError, CancelledError, ProviderError, toErrorMessage } from "../errors";
import type { EventBus } from "../events/bus";
import type { Logger } from "../logger";
import { getProject } from "../repositories/projects";
import {
  createMessage,
  clearMessages,
  listMessages,
} from "../repositories/messages";
import {
  createAgentRun,
  getAgentRun,
  updateAgentRun,
} from "../repositories/agent-runs";
import { newId } from "../utils/id";
import { nowIso } from "../utils/time";
import type { WorkspaceService } from "../services/workspace";
import type { RenderService } from "../services/renders";
import type { MediaService } from "../services/media";
import type { ProviderService } from "../services/providers";
import type { SettingsService } from "../services/settings";
import { buildSystemPrompt } from "./prompts";
import { AGENT_TOOL_DEFINITIONS, AgentToolbox } from "./tools";
import { createChatProvider } from "./providers";
import type { ProviderMessage } from "./types";

export interface AgentServiceDeps {
  db: Database;
  config: VideurConfig;
  settings: SettingsService;
  workspace: WorkspaceService;
  renders: RenderService;
  media: MediaService;
  providers: ProviderService;
  bus: EventBus;
  logger: Logger;
}

export class AgentService {
  private readonly controllers = new Map<string, AbortController>();

  constructor(private readonly deps: AgentServiceDeps) {}

  start(projectId: string, input: StartAgentInput): AgentStartResult {
    const project = getProject(this.deps.db, projectId);
    if (!project) throw new AppError("NOT_FOUND", `Proyecto no encontrado: ${projectId}`, 404);

    const data = StartAgentSchema.parse(input);
    const selection = this.deps.providers.resolveSelection(data.providerId, data.model);
    if (!selection.runtime.supportsTools) {
      throw new ProviderError(
        `El proveedor ${selection.providerLabel} está marcado sin soporte de tool calling. Actívalo en Ajustes o usa otro proveedor.`,
        400,
      );
    }

    const settings = this.deps.settings.agentOptions();
    const maxIterations = Math.min(30, Math.max(1, data.maxIterations ?? settings.maxIterations));
    const runId = newId("run");
    createAgentRun(this.deps.db, {
      id: runId,
      projectId,
      providerId: selection.providerId,
      model: selection.model,
      prompt: data.prompt,
    });

    const controller = new AbortController();
    this.controllers.set(runId, controller);
    const timer = setTimeout(() => controller.abort(new Error("El agente excedió el timeout")), this.deps.config.agent.timeoutMs);

    this.deps.bus.emit({
      type: "agent.started",
      projectId,
      runId,
      provider: selection.providerLabel,
      model: selection.model,
    });

    void this.runLoop({
      runId,
      projectId,
      prompt: data.prompt,
      maxIterations,
      visionReview: data.visionReview ?? settings.visionReview,
      selection,
      controller,
    }).finally(() => {
      clearTimeout(timer);
      this.controllers.delete(runId);
    });

    return {
      runId,
      status: "running",
      provider: selection.providerLabel,
      model: selection.model,
    };
  }

  cancel(runId: string): boolean {
    const controller = this.controllers.get(runId);
    if (!controller) return false;
    controller.abort(new CancelledError("Cancelado por el usuario"));
    return true;
  }

  get(runId: string): AgentRun {
    const run = getAgentRun(this.deps.db, runId);
    if (!run) throw new AppError("NOT_FOUND", `Run no encontrado: ${runId}`, 404);
    return run;
  }

  messages(projectId: string, limit = 200): Message[] {
    return listMessages(this.deps.db, projectId, limit);
  }

  clear(projectId: string): number {
    return clearMessages(this.deps.db, projectId);
  }

  private async runLoop(options: {
    runId: string;
    projectId: string;
    prompt: string;
    maxIterations: number;
    visionReview: boolean;
    selection: ReturnType<ProviderService["resolveSelection"]>;
    controller: AbortController;
  }): Promise<void> {
    const { runId, projectId, prompt, maxIterations, selection, controller } = options;
    const signal = controller.signal;
    let inputTokens = 0;
    let outputTokens = 0;
    let iterations = 0;
    let nudges = 0;

    const updateUsage = (): void => {
      updateAgentRun(this.deps.db, runId, {
        iterations,
        inputTokens,
        outputTokens,
      });
    };

    const persist = (role: "user" | "assistant" | "tool", content: string, toolCalls?: ToolCall[], toolResults?: Message["toolResults"]): Message => {
      const message = createMessage(this.deps.db, {
        projectId,
        runId,
        role,
        content,
        toolCalls: toolCalls ?? null,
        toolResults: toolResults ?? null,
      });
      this.deps.bus.emit({ type: "agent.message", projectId, runId, message });
      return message;
    };

    try {
      const project = getProject(this.deps.db, projectId);
      if (!project) throw new AppError("NOT_FOUND", "El proyecto ya no existe", 404);
      const files = this.deps.workspace.list(projectId);
      const provider = createChatProvider(selection.runtime);
      const system = buildSystemPrompt(project, files, selection.runtime);

      const history = this.messages(projectId, 100)
        .filter((message) => (message.role === "user" || message.role === "assistant") && message.content.trim())
        .slice(-8)
        .map<ProviderMessage>((message) => ({
          role: message.role as "user" | "assistant",
          content: message.content,
        }));

      persist("user", prompt);

      const messages: ProviderMessage[] = [
        { role: "system", content: system },
        ...history,
        { role: "user", content: prompt },
      ];

      const toolbox = new AgentToolbox({
        config: this.deps.config,
        projectId,
        runId,
        workspace: this.deps.workspace,
        renders: this.deps.renders,
        media: this.deps.media,
        settings: this.deps.settings,
        provider: selection.runtime,
        signal,
      });

      for (iterations = 1; iterations <= maxIterations; iterations++) {
        if (signal.aborted) throw new CancelledError(toErrorMessage(signal.reason));
        updateUsage();

        const response = await provider.chat({
          model: selection.model,
          messages,
          tools: AGENT_TOOL_DEFINITIONS,
          temperature: 0.4,
          maxTokens: this.deps.config.agent.maxTokens,
          signal,
        });

        inputTokens += response.usage.inputTokens;
        outputTokens += response.usage.outputTokens;
        updateUsage();
        this.deps.bus.emit({
          type: "agent.usage",
          projectId,
          runId,
          inputTokens,
          outputTokens,
        });

        const assistant = persist("assistant", response.content, response.toolCalls);
        messages.push({ role: "assistant", content: response.content, toolCalls: response.toolCalls });

        if (response.toolCalls.length === 0) {
          if (toolbox.finalized) break;
          const latest = this.deps.renders.list(projectId, { limit: 1 }).items[0];
          if (latest?.status === "succeeded") break;
          if (nudges === 0 && !signal.aborted) {
            nudges++;
            const nudge =
              "Aún no has producido un render exitoso. Escribe los archivos necesarios y usa run_render. " +
              "Cuando termine, revisa la hoja de contactos y llama finalize.";
            persist("user", nudge);
            messages.push({ role: "user", content: nudge });
            continue;
          }
          throw new AppError(
            "AGENT_NO_OUTPUT",
            "El agente terminó sin un render exitoso",
            422,
            { assistantMessageId: assistant.id },
          );
        }

        for (const call of response.toolCalls) {
          if (signal.aborted) throw new CancelledError(toErrorMessage(signal.reason));
          this.deps.bus.emit({
            type: "agent.tool",
            projectId,
            runId,
            tool: call.name,
            status: "started",
            args: call.arguments,
          });
          const result = await toolbox.execute(call);
          this.deps.bus.emit({
            type: "agent.tool",
            projectId,
            runId,
            tool: call.name,
            status: "finished",
            result,
            durationMs: result.durationMs,
          });
          persist("tool", result.content, undefined, [result]);
          messages.push({
            role: "tool",
            content: result.content,
            toolCallId: call.id,
            name: call.name,
          });
          if (call.name === "finalize" && result.ok) break;
        }

        if (toolbox.finalized) break;
      }

      if (signal.aborted) throw new CancelledError(toErrorMessage(signal.reason));
      if (iterations > maxIterations) {
        throw new AppError("AGENT_MAX_ITERATIONS", `El agente alcanzó ${maxIterations} iteraciones`, 422);
      }

      const latest = this.deps.renders.list(projectId, { limit: 1 }).items[0];
      if (!toolbox.finalized && latest?.status !== "succeeded") {
        throw new AppError("AGENT_NO_OUTPUT", "El agente no completó un render exitoso", 422);
      }

      const summary = toolbox.finalized?.summary ?? "Render completado y verificado";
      updateAgentRun(this.deps.db, runId, {
        status: "succeeded",
        iterations,
        inputTokens,
        outputTokens,
        finishedAt: nowIso(),
        error: null,
      });
      this.deps.bus.emit({
        type: "agent.completed",
        projectId,
        runId,
        status: "succeeded",
        summary,
      });
    } catch (error) {
      const cancelled = signal.aborted || error instanceof CancelledError;
      const message = cancelled ? "Agente cancelado" : toErrorMessage(error);
      const status = cancelled ? "cancelled" : "failed";
      try {
        persist("assistant", `⚠️ ${message}`);
      } catch {
        // Si la DB falla, no ocultar el error original.
      }
      updateAgentRun(this.deps.db, runId, {
        status,
        iterations,
        inputTokens,
        outputTokens,
        error: cancelled ? null : message,
        finishedAt: nowIso(),
      });
      this.deps.bus.emit({
        type: "agent.error",
        projectId,
        runId,
        error: message,
      });
      this.deps.bus.emit({
        type: "agent.completed",
        projectId,
        runId,
        status,
        error: cancelled ? undefined : message,
      });
      if (!cancelled) this.deps.logger.error(`Agente falló: ${message}`);
    }
  }
}
