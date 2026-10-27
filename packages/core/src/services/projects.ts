import { rmSync } from "node:fs";
import type { Database } from "bun:sqlite";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  dimensionsForAspect,
  type CreateProjectInput,
  type Project,
  type ProjectWithLastRender,
  type Render,
  type RenderSummary,
  type UpdateProjectInput,
} from "@videur/contracts";
import type { VideurConfig } from "../config";
import { NotFoundError } from "../errors";
import type { EventBus } from "../events/bus";
import { newId } from "../utils/id";
import {
  countProjects,
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
  type ListProjectsOptions,
} from "../repositories/projects";
import { countRenders, getLastRender } from "../repositories/renders";
import { ensureWorkspace, listWorkspaceFiles, writeProjectSnapshot } from "../storage/workspace";
import { toDataRelative } from "../storage/paths";
import type { TemplateService } from "../storage/templates";

function renderSummary(render: Render | null): RenderSummary | null {
  if (!render) return null;
  return {
    id: render.id,
    projectId: render.projectId,
    engine: render.engine,
    status: render.status,
    progress: render.progress,
    createdAt: render.createdAt,
    finishedAt: render.finishedAt,
    durationMs: render.durationMs,
    ...(render.status === "succeeded"
      ? {
          videoUrl: `/media/${render.id}/video`,
          contactSheetUrl: `/media/${render.id}/contact-sheet`,
        }
      : {}),
  };
}

export class ProjectService {
  constructor(
    private readonly db: Database,
    private readonly config: VideurConfig,
    private readonly templates: TemplateService,
    private readonly bus: EventBus,
  ) {}

  create(input: CreateProjectInput): ProjectWithLastRender {
    const data = CreateProjectSchema.parse(input);

    // Validar la plantilla antes de crear el proyecto.
    if (data.templateId) this.templates.get(data.templateId);

    const id = newId("prj");
    const project = createProject(this.db, { id, data });
    ensureWorkspace(this.config, id);

    if (data.templateId) {
      this.templates.apply(id, data.templateId, false);
    }

    const updated = updateProject(this.db, id, { status: "ready" }) ?? project;
    this.writeSnapshot(updated, data.templateId);
    this.bus.emit({ type: "project.updated", projectId: id, project: this.enrich(updated) });
    return this.enrich(updated);
  }

  list(options: ListProjectsOptions = {}): { items: ProjectWithLastRender[]; total: number } {
    const items = listProjects(this.db, options).map((project) => this.enrich(project));
    return { items, total: countProjects(this.db, options) };
  }

  get(id: string): ProjectWithLastRender {
    const project = getProject(this.db, id);
    if (!project) throw new NotFoundError(`Proyecto no encontrado: ${id}`);
    return this.enrich(project);
  }

  update(id: string, patch: UpdateProjectInput): ProjectWithLastRender {
    const parsed = UpdateProjectSchema.parse(patch);
    const current = getProject(this.db, id);
    if (!current) throw new NotFoundError(`Proyecto no encontrado: ${id}`);

    let nextPatch: UpdateProjectInput = parsed;
    if (parsed.aspectRatio && parsed.width === undefined && parsed.height === undefined) {
      const dims = dimensionsForAspect(parsed.aspectRatio);
      nextPatch = { ...parsed, width: dims.width, height: dims.height };
    }

    const updated = updateProject(this.db, id, nextPatch);
    if (!updated) throw new NotFoundError(`Proyecto no encontrado: ${id}`);
    this.writeSnapshot(updated, updated.templateId);
    this.bus.emit({ type: "project.updated", projectId: id, project: this.enrich(updated) });
    return this.enrich(updated);
  }

  delete(id: string, keepFiles = false): boolean {
    const project = getProject(this.db, id);
    if (!project) throw new NotFoundError(`Proyecto no encontrado: ${id}`);
    const deleted = deleteProject(this.db, id);
    if (deleted && !keepFiles) {
      const dir = this.config.paths.workspaces + `/${id}`;
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // El proyecto ya no existe en DB; un fallo de limpieza no debe romper la API.
      }
    }
    return deleted;
  }

  refreshStatus(id: string): void {
    const project = getProject(this.db, id);
    if (!project) return;
    this.bus.emit({ type: "project.updated", projectId: id, project: this.enrich(project) });
  }

  private enrich(project: Project): ProjectWithLastRender {
    const lastRender = getLastRender(this.db, project.id);
    let filesCount = 0;
    try {
      filesCount = listWorkspaceFiles(this.config, project.id).length;
    } catch {
      filesCount = 0;
    }
    return {
      ...project,
      lastRender: renderSummary(lastRender),
      filesCount,
      rendersCount: countRenders(this.db, project.id),
      workspacePath: toDataRelative(this.config, `${this.config.paths.workspaces}/${project.id}`),
    };
  }

  private writeSnapshot(project: Project, templateId: string | null): void {
    try {
      writeProjectSnapshot(this.config, project.id, {
        ...project,
        templateId,
        workspace: toDataRelative(this.config, `${this.config.paths.workspaces}/${project.id}`),
      });
    } catch {
      // El snapshot es informativo; no bloquea el proyecto.
    }
  }
}
