import { computed, defineComponent, elurRouter, html, repeat, signal } from "@elurjs/core";
import type { EngineId } from "@videur/contracts";
import { appStore } from "../lib/store";
import { engineLabel } from "../lib/format";
import { raw } from "@elurjs/core";
import { icon } from "../lib/icons";
import { ProjectCard } from "../components/project";
import { button, emptyState, pageHeader } from "../components/ui";

export const ProjectsPage = defineComponent((_props, ctx) => {
  const router = elurRouter();
  const search = signal("");
  const engine = signal<EngineId | "">("");
  const status = signal("");

  ctx.onMount(() => {
    void appStore.refreshProjects();
  });

  const filtered = computed(() => {
    const query = search.value.trim().toLowerCase();
    return appStore.projects.value.filter((project) => {
      if (engine.value && project.engine !== engine.value) return false;
      if (status.value && project.status !== status.value) return false;
      if (!query) return true;
      return `${project.name} ${project.description} ${project.brief}`.toLowerCase().includes(query);
    });
  });

  return html`
    <div class="page">
      ${pageHeader(
        "Proyectos",
        `${() => appStore.projects.value.length} proyectos · tu historial local`,
        button("Nuevo proyecto", {
          variant: "primary",
          icon: "plus",
          onClick: () => router.navigate("/projects/new"),
        }),
        "Estudio",
      )}

      <div class="toolbar">
        <label class="search">
          <span class="search__icon">${raw(icon("eye", 16))}</span>
          <input
            type="search"
            placeholder="Buscar por nombre o brief…"
            value=${() => search.value}
            @input=${(event: Event) => {
              search.value = (event.target as HTMLInputElement).value;
            }}
          />
        </label>
        <div class="toolbar__filters">
          <select
            class="select"
            aria-label="Filtrar por motor"
            value=${() => engine.value}
            @change=${(event: Event) => {
              engine.value = (event.target as HTMLSelectElement).value as EngineId | "";
            }}
          >
            <option value="">Todos los motores</option>
            <option value="ffmpeg">FFmpeg</option>
            <option value="pillow">Pillow</option>
            <option value="manim">Manim</option>
            <option value="remotion">Remotion</option>
          </select>
          <select
            class="select"
            aria-label="Filtrar por estado"
            value=${() => status.value}
            @change=${(event: Event) => {
              status.value = (event.target as HTMLSelectElement).value;
            }}
          >
            <option value="">Todos los estados</option>
            <option value="draft">Borrador</option>
            <option value="ready">Listo</option>
            <option value="rendering">Renderizando</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      ${() =>
        appStore.projects.value.length === 0
          ? emptyState(
              "projects",
              "No hay proyectos",
              "Crea tu primer video programático. Puedes empezar con una plantilla.",
              button("Crear proyecto", { variant: "primary", icon: "plus", onClick: () => router.navigate("/projects/new") }),
            )
          : filtered.value.length === 0
            ? emptyState("eye", "Sin resultados", "Prueba con otra búsqueda o filtro.")
            : html`
                <div class="project-grid">
                  ${repeat(
                    filtered.value,
                    (project) => project.id,
                    (project) =>
                      ProjectCard(
                        project,
                        () => router.navigate(`/projects/${project.id}`),
                        () => {
                          if (confirm(`¿Eliminar “${project.name}”?`)) void appStore.deleteProject(project.id);
                        },
                      ),
                  )}
                </div>
              `}
      <div class="list-footer muted">
        ${() => filtered.value.length} de ${() => appStore.projects.value.length} proyectos
        ${() => (engine.value ? ` · motor ${engineLabel(engine.value)}` : "")}
      </div>
    </div>
  `;
});
