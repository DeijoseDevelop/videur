import type { Database } from "bun:sqlite";
import type { FileContent, FileNode } from "@videur/contracts";
import type { VideurConfig } from "../config";
import { NotFoundError } from "../errors";
import type { EventBus } from "../events/bus";
import { getProject, updateProject } from "../repositories/projects";
import {
  deleteWorkspaceFile,
  listWorkspaceFiles,
  readWorkspaceFile,
  writeProjectSnapshot,
  writeWorkspaceFile,
  workspaceDir,
} from "../storage/workspace";
import { relativeFrom } from "../storage/workspace";

export class WorkspaceService {
  constructor(
    private readonly db: Database,
    private readonly config: VideurConfig,
    private readonly bus: EventBus,
  ) {}

  list(projectId: string): FileNode[] {
    this.requireProject(projectId);
    return listWorkspaceFiles(this.config, projectId);
  }

  read(projectId: string, path: string): FileContent {
    this.requireProject(projectId);
    return readWorkspaceFile(this.config, projectId, path);
  }

  write(
    projectId: string,
    path: string,
    content: string,
    options: { append?: boolean } = {},
  ): { path: string; size: number } {
    this.requireProject(projectId);
    const result = writeWorkspaceFile(this.config, projectId, path, content, options);
    const project = updateProject(this.db, projectId, { status: "ready" });
    if (project) this.emitProject(projectId);
    return result;
  }

  remove(projectId: string, path: string): boolean {
    this.requireProject(projectId);
    const result = deleteWorkspaceFile(this.config, projectId, path);
    this.emitProject(projectId);
    return result;
  }

  snapshot(projectId: string, extra: Record<string, unknown> = {}): void {
    const project = this.requireProject(projectId);
    writeProjectSnapshot(this.config, projectId, {
      ...project,
      engine: project.engine,
      updatedAt: new Date().toISOString(),
      ...extra,
    });
  }

  dir(projectId: string): string {
    return workspaceDir(this.config, projectId);
  }

  relative(path: string, projectId: string): string {
    return relativeFrom(this.dir(projectId), path);
  }

  private requireProject(projectId: string): NonNullable<ReturnType<typeof getProject>> {
    const project = getProject(this.db, projectId);
    if (!project) throw new NotFoundError(`Proyecto no encontrado: ${projectId}`);
    return project;
  }

  private emitProject(projectId: string): void {
    const project = getProject(this.db, projectId);
    if (project) this.bus.emit({ type: "project.updated", projectId, project });
  }
}
