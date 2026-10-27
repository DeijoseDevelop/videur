import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import type { Readable, Writable } from "node:stream";
import type { EngineId } from "@videur/contracts";
import { createVideur, toErrorMessage, type Videur } from "@videur/core";

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const PROTOCOL_VERSION = "2025-06-18";

const TOOLS: ToolDefinition[] = [
  {
    name: "videur_doctor",
    description: "Diagnóstico de FFmpeg, Python, Manim, Remotion y proveedores.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "videur_list_projects",
    description: "Lista proyectos de Videur.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "videur_create_project",
    description: "Crea un proyecto de video.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        brief: { type: "string" },
        engine: { type: "string", enum: ["ffmpeg", "pillow", "manim", "remotion"] },
        aspectRatio: { type: "string" },
        duration: { type: "number" },
        templateId: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "videur_get_project",
    description: "Obtiene un proyecto, sus archivos y su último render.",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
      additionalProperties: false,
    },
  },
  {
    name: "videur_read_file",
    description: "Lee un archivo del workspace de un proyecto.",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" }, path: { type: "string" } },
      required: ["projectId", "path"],
      additionalProperties: false,
    },
  },
  {
    name: "videur_write_file",
    description: "Escribe un archivo de texto en el workspace.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["projectId", "path", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "videur_list_renders",
    description: "Lista renders de un proyecto.",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
      additionalProperties: false,
    },
  },
  {
    name: "videur_render",
    description: "Renderiza un proyecto y espera el resultado.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        engine: { type: "string", enum: ["ffmpeg", "pillow", "manim", "remotion"] },
      },
      required: ["projectId"],
      additionalProperties: false,
    },
  },
  {
    name: "videur_get_render",
    description: "Obtiene el detalle de un render.",
    inputSchema: {
      type: "object",
      properties: { renderId: { type: "string" } },
      required: ["renderId"],
      additionalProperties: false,
    },
  },
  {
    name: "videur_cancel_render",
    description: "Cancela un render en curso.",
    inputSchema: {
      type: "object",
      properties: { renderId: { type: "string" } },
      required: ["renderId"],
      additionalProperties: false,
    },
  },
  {
    name: "videur_probe",
    description: "Ejecuta ffprobe sobre un archivo.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "videur_contact_sheet",
    description: "Genera una hoja de contactos 4x4.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" }, output: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "videur_agent",
    description: "Ejecuta el agente de IA sobre un proyecto y espera el resultado.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        prompt: { type: "string" },
        providerId: { type: "string" },
        model: { type: "string" },
      },
      required: ["projectId", "prompt"],
      additionalProperties: false,
    },
  },
];

function stringArg(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`Falta el argumento '${key}'`);
  return value;
}

function optionalString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalNumber(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function engineArg(args: Record<string, unknown>): EngineId | undefined {
  const value = args.engine;
  if (value === "ffmpeg" || value === "pillow" || value === "manim" || value === "remotion") return value;
  return undefined;
}

async function runTool(videur: Videur, name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "videur_doctor":
      return videur.doctor.run();
    case "videur_list_projects": {
      const query = optionalString(args, "query");
      const limit = optionalNumber(args, "limit");
      return videur.projects.list({ ...(query ? { q: query } : {}), ...(limit ? { limit } : {}) });
    }
    case "videur_create_project": {
      const engine = engineArg(args);
      const templateId = optionalString(args, "templateId");
      return videur.projects.create({
        name: stringArg(args, "name"),
        ...(optionalString(args, "brief") ? { brief: optionalString(args, "brief")! } : {}),
        ...(engine ? { engine } : {}),
        ...(optionalString(args, "aspectRatio") ? { aspectRatio: optionalString(args, "aspectRatio") as never } : {}),
        ...(optionalNumber(args, "duration") ? { durationTarget: optionalNumber(args, "duration")! } : {}),
        ...(templateId ? { templateId } : {}),
      });
    }
    case "videur_get_project": {
      const projectId = stringArg(args, "projectId");
      return { ...videur.projects.get(projectId), files: videur.workspace.list(projectId) };
    }
    case "videur_read_file": {
      const projectId = stringArg(args, "projectId");
      const path = stringArg(args, "path");
      const file = videur.workspace.read(projectId, path);
      return file.binary ? { binary: true, size: file.size, path } : { path, content: file.content };
    }
    case "videur_write_file": {
      const projectId = stringArg(args, "projectId");
      const path = stringArg(args, "path");
      const content = stringArg(args, "content");
      return videur.workspace.write(projectId, path, content);
    }
    case "videur_list_renders": {
      const projectId = stringArg(args, "projectId");
      return videur.renders.list(projectId);
    }
    case "videur_render": {
      const projectId = stringArg(args, "projectId");
      const engine = engineArg(args);
      const render = videur.renders.start(projectId, engine ? { engine } : {});
      const final = await videur.renders.waitFor(render.id, 900_000);
      return final;
    }
    case "videur_get_render": {
      return videur.renders.get(stringArg(args, "renderId"));
    }
    case "videur_cancel_render": {
      return videur.renders.cancel(stringArg(args, "renderId"));
    }
    case "videur_probe": {
      return videur.media.probe(stringArg(args, "path"));
    }
    case "videur_contact_sheet": {
      const path = stringArg(args, "path");
      const metadata = await videur.media.probe(path);
      const output = optionalString(args, "output") ?? join(dirname(path), "contact-sheet.png");
      return videur.media.contactSheet(path, output, metadata.duration);
    }
    case "videur_agent": {
      const projectId = stringArg(args, "projectId");
      const prompt = stringArg(args, "prompt");
      const providerId = optionalString(args, "providerId");
      const model = optionalString(args, "model");
      const start = videur.agent.start(projectId, {
        prompt,
        ...(providerId ? { providerId } : {}),
        ...(model ? { model } : {}),
      });
      await new Promise<void>((resolve) => {
        const unsubscribe = videur.bus.subscribe((event) => {
          if (event.type === "agent.completed" && event.runId === start.runId) {
            unsubscribe();
            resolve();
          }
        });
        setTimeout(() => {
          unsubscribe();
          resolve();
        }, 900_000);
      });
      return {
        run: videur.agent.get(start.runId),
        messages: videur.agent.messages(projectId).slice(-20),
      };
    }
    default:
      throw new Error(`Tool desconocida: ${name}`);
  }
}

function textContent(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function resourceList(videur: Videur): Array<{ uri: string; name: string; mimeType: string }> {
  const resources: Array<{ uri: string; name: string; mimeType: string }> = [
    { uri: "videur://projects", name: "Proyectos", mimeType: "application/json" },
    { uri: "videur://templates", name: "Plantillas", mimeType: "application/json" },
  ];
  for (const project of videur.projects.list({ limit: 100 }).items) {
    resources.push({ uri: `videur://projects/${project.id}`, name: project.name, mimeType: "application/json" });
  }
  return resources;
}

function readResource(videur: Videur, uri: string): { uri: string; mimeType: string; text: string } {
  if (uri === "videur://projects") {
    return { uri, mimeType: "application/json", text: textContent(videur.projects.list({ limit: 100 })) };
  }
  if (uri === "videur://templates") {
    return { uri, mimeType: "application/json", text: textContent(videur.templates.list()) };
  }
  const projectMatch = /^videur:\/\/projects\/([^/]+)$/.exec(uri);
  if (projectMatch) {
    const projectId = projectMatch[1]!;
    return {
      uri,
      mimeType: "application/json",
      text: textContent({ ...videur.projects.get(projectId), files: videur.workspace.list(projectId) }),
    };
  }
  const renderMatch = /^videur:\/\/renders\/([^/]+)$/.exec(uri);
  if (renderMatch) {
    return { uri, mimeType: "application/json", text: textContent(videur.renders.get(renderMatch[1]!)) };
  }
  const templateMatch = /^videur:\/\/templates\/([^/]+)$/.exec(uri);
  if (templateMatch) {
    return { uri, mimeType: "application/json", text: textContent(videur.templates.get(templateMatch[1]!)) };
  }
  throw new Error(`Resource no encontrado: ${uri}`);
}

export interface McpServerOptions {
  input?: Readable;
  output?: Writable;
}

export function startMcpServer(videur: Videur, options: McpServerOptions = {}): { close: () => void } {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const readline = createInterface({ input, crlfDelay: Infinity });

  const send = (payload: unknown): void => {
    output.write(`${JSON.stringify(payload)}\n`);
  };

  const respond = (id: string | number | null | undefined, result: unknown): void => {
    if (id === undefined) return;
    send({ jsonrpc: "2.0", id, result });
  };

  const fail = (id: string | number | null | undefined, code: number, message: string, data?: unknown): void => {
    if (id === undefined) return;
    send({ jsonrpc: "2.0", id, error: { code, message, ...(data === undefined ? {} : { data }) } });
  };

  readline.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(trimmed) as JsonRpcRequest;
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido" } });
      return;
    }

    const { id, method, params } = request;
    if (!method) {
      fail(id, -32600, "Solicitud inválida");
      return;
    }

    try {
      switch (method) {
        case "initialize":
          respond(id, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {
              tools: { listChanged: false },
              resources: { subscribe: false, listChanged: false },
            },
            serverInfo: { name: "videur", version: videur.version },
          });
          return;
        case "notifications/initialized":
        case "notifications/cancelled":
          return;
        case "ping":
          respond(id, {});
          return;
        case "tools/list":
          respond(id, { tools: TOOLS });
          return;
        case "tools/call": {
          const name = typeof params?.name === "string" ? params.name : "";
          const args = (params?.arguments ?? {}) as Record<string, unknown>;
          try {
            const result = await runTool(videur, name, args);
            respond(id, {
              content: [{ type: "text", text: textContent(result) }],
              isError: false,
            });
          } catch (error) {
            respond(id, {
              content: [{ type: "text", text: toErrorMessage(error) }],
              isError: true,
            });
          }
          return;
        }
        case "resources/list":
          respond(id, { resources: resourceList(videur) });
          return;
        case "resources/read": {
          const uri = typeof params?.uri === "string" ? params.uri : "";
          try {
            respond(id, { contents: [readResource(videur, uri)] });
          } catch (error) {
            fail(id, -32602, toErrorMessage(error));
          }
          return;
        }
        case "resources/templates/list":
          respond(id, { resourceTemplates: [] });
          return;
        default:
          fail(id, -32601, `Método no encontrado: ${method}`);
      }
    } catch (error) {
      fail(id, -32603, toErrorMessage(error));
    }
  });

  return {
    close: () => readline.close(),
  };
}

export async function runMcpFromEnv(): Promise<void> {
  // stdout está reservado para JSON-RPC; cualquier log debe ir a stderr.
  const videur = createVideur({ config: { logLevel: "error" } });
  startMcpServer(videur);
  const shutdown = async (): Promise<void> => {
    await videur.close();
  };
  process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
  process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));
  process.stdin.once("end", () => void shutdown().finally(() => process.exit(0)));
}
