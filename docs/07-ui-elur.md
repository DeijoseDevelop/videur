# 07 · UI con Elur

## 1. Principios visuales

Videur se siente como un **estudio de edición y una consola de render**: oscuro, denso, rápido y silencioso.

- **Fondo:** `#070b12`.
- **Paneles:** `#0e1520` / `#121b28`.
- **Bordes:** `#1d2a3a`.
- **Texto:** `#e6edf7`; secundario `#8fa3ba`.
- **Acentos:** cian `#22d3ee`, violeta `#8b5cf6`, ámbar `#f59e0b`, verde `#34d399`, rojo `#f87171`.
- **Tipografía UI:** `Manrope`, `Inter`, `system-ui`, sans-serif.
- **Tipografía código:** `JetBrains Mono`, `Fira Code`, `monospace`.
- **Radios:** 10–16 px.
- **Sombras:** suaves, con un glow cian/violeta muy sutil en elementos activos.
- **Movimiento:** 120–180 ms; respetar `prefers-reduced-motion`.

Nada de gradientes arcoíris ni glassmorphism excesivo. El lujo está en el espaciado, la jerarquía y los detalles.

## 2. Rutas

```text
/                               Dashboard
/projects                       Proyectos
/projects/new                   Wizard de creación
/projects/:id                   Workspace del proyecto
/projects/:id/renders/:renderId Detalle de render
/templates                      Galería de plantillas
/settings                       Ajustes (general, proveedores, motores)
*                               404
```

Router de Elur:

```ts
const router = createRouter([
  { path: "/", component: () => DashboardPage() },
  { path: "/projects", component: () => ProjectsPage() },
  { path: "/projects/new", component: () => NewProjectPage() },
  { path: "/projects/:id", component: () => WorkspacePage() },
  { path: "/projects/:id/renders/:renderId", component: () => RenderDetailPage() },
  { path: "/templates", component: () => TemplatesPage() },
  { path: "/settings", component: () => SettingsPage() },
  { path: "*", component: () => NotFoundPage() },
]);
```

`params` es un signal: `${() => router.params.value.id}`.

## 3. Shell

```text
┌──────────────┬────────────────────────────────────────────────────────────┐
│  Videur      │  Topbar: breadcrumb · estado SSE · doctor · nuevo proyecto  │
│  ─────────   ├────────────────────────────────────────────────────────────┤
│  Dashboard   │                                                            │
│  Proyectos   │                     <RouterView />                         │
│  Plantillas  │                                                            │
│  Ajustes     │                                                            │
│              │                                                            │
│  ─────────   │                                                            │
│  Motores     │                                                            │
│  ● FFmpeg    │                                                            │
│  ● Python    │                                                            │
│  ○ Manim     │                                                            │
│  ○ Remotion  │                                                            │
│  ─────────   │                                                            │
│  v0.1.0      │                                                            │
└──────────────┴────────────────────────────────────────────────────────────┘
```

- Sidebar fija de 248 px; colapsable en < 1024 px.
- Topbar de 64 px con breadcrumb, estado de conexión y CTA.
- Contenido con `max-width: 1480px` y padding 24–32 px.

## 4. Pantallas

### 4.1 Dashboard

- Hero compacto: “Convierte una idea en video determinista”.
- Botones: “Nuevo proyecto”, “Ver plantillas”.
- 4 stat cards: proyectos, renders, tasa de éxito, motores disponibles.
- Grid de proyectos recientes (3 columnas).
- Panel “Estado del estudio”: motores, proveedores, doctor.
- Panel “Cómo funciona”: 4 pasos (idea → código → render → QA).

### 4.2 Proyectos

- Búsqueda por nombre/brief.
- Filtros: motor, estado.
- Toggle grid/lista.
- Cards con: nombre, descripción, badges (motor, aspecto, duración), último render, fecha, menú (abrir, duplicar, borrar).
- Empty state con CTA.

### 4.3 Nuevo proyecto (wizard)

**Paso 1 · Idea**
- Nombre.
- Brief (textarea, 10–2000 chars).
- Plantilla opcional (cards compactas).
- Estilo visual (dark-cinematic, editorial, tech, minimal).

**Paso 2 · Formato**
- Aspecto: 16:9, 9:16, 1:1, 4:5, 4:3, 21:9.
- Resolución derivada (editable).
- FPS: 24, 30, 60.
- Duración: 3–120 s.
- Motor: cards con disponibilidad y recomendación según brief.

**Paso 3 · Revisión**
- Resumen de todo.
- “Crear proyecto” → POST → navegar al workspace.
- Si el motor no está disponible, aviso con hint de instalación.

### 4.4 Workspace

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ ← Proyectos   Energía solar   [ffmpeg] [16:9] [8s]        [Renderizar]     │
├──────────────┬──────────────────────────────────────────┬──────────────────┤
│ Archivos     │  Tabs: Agente · Código · Preview · QA    │  Renders         │
│              │                                          │  ┌────────────┐  │
│ ▾ workspace  │  ┌────────────────────────────────────┐  │  │ rnd_...    │  │
│   render.json│  │                                    │  │  │ succeeded  │  │
│   README.md  │  │  Chat / Editor / Video / QA        │  │  └────────────┘  │
│              │  │                                    │  │  ┌────────────┐  │
│ + nuevo      │  └────────────────────────────────────┘  │  │ rnd_...    │  │
│              │  ┌────────────────────────────────────┐  │  └────────────┘  │
│              │  │ Prompt / Guardar / Render          │  │  Logs            │
│              │  └────────────────────────────────────┘  │                  │
└──────────────┴──────────────────────────────────────────┴──────────────────┘
```

- **Archivos:** árbol plano con indentación; iconos por extensión; click abre.
- **Agente:** historial de mensajes, tool cards, input con `Ctrl+Enter`, selector de proveedor y estado del run.
- **Código:** tabs de archivos abiertos, line numbers, textarea monoespaciada, botón guardar, indicador “sin guardar”.
- **Preview:** video del último render exitoso; toggle “Video / Hoja de contactos”; metadata.
- **QA:** checks con pass/warn/error; botón “Inspeccionar con IA” si hay proveedor con visión.
- **Renders:** lista con estado, progreso, duración; click abre detalle; botón cancelar/reintentar.
- **Logs:** panel inferior con auto-scroll y filtro stdout/stderr.

### 4.5 Detalle de render

- Header: estado, motor, fecha, duración.
- Layout 2 columnas:
  - Izquierda: video player, hoja de contactos, metadata.
  - Derecha: QA checks, artefactos, logs, acciones (descargar, reintentar, borrar).
- Si falló: error destacado + últimas 100 líneas del log.

### 4.6 Plantillas

- Grid de cards con preview (si existe), motor, descripción, tags y duración.
- “Usar plantilla” abre el wizard con la plantilla preseleccionada.
- Filtro por motor.

### 4.7 Ajustes

Tabs:

1. **General:** motor por defecto, aspecto, FPS, duración, concurrencia, timeout, tema (solo oscuro en v0.1).
2. **Proveedores:** lista, añadir, editar, probar, borrar; presets; campos base URL/model/key/visión/tools.
3. **Motores:** estado, versión, path, hint de instalación, “Re-detectar”.
4. **Acerca de:** versión, licencia, enlaces, ruta de datos.

### 4.8 404

Mensaje breve, enlace a dashboard, código de error.

## 5. Estado global

`apps/web/src/lib/store.ts` usa `createStore` de Elur:

```ts
export const appStore = createStore(
  {
    booted: false,
    loading: false,
    projects: [] as Project[],
    providers: [] as Provider[],
    settings: null as Settings | null,
    engines: [] as EngineInfo[],
    templates: [] as TemplateInfo[],
    stats: null as Stats | null,
    currentProject: null as Project | null,
    currentFiles: [] as FileNode[],
    openFile: null as OpenFile | null,
    renders: [] as Render[],
    messages: [] as Message[],
    activeRun: null as AgentRun | null,
    logs: [] as LogLine[],
    toasts: [] as Toast[],
    sseConnected: false,
    agentRunning: false,
  },
  {
    name: "videur",
    actions: (s) => ({
      async bootstrap() { /* ... */ },
      async refreshProjects() { /* ... */ },
      async loadProject(id: string) { /* ... */ },
      async saveFile(path: string, content: string) { /* ... */ },
      async renderProject() { /* ... */ },
      async sendPrompt(prompt: string) { /* ... */ },
      toast(message: string, kind: Toast["kind"] = "info") { /* ... */ },
      handleEvent(event: VideurEvent) { /* ... */ },
    }),
    getters: (s) => ({
      projectCount: computed(() => s.projects.value.length),
      successRate: computed(() => /* ... */),
      enginesOnline: computed(() => s.engines.value.filter(e => e.available).length),
    }),
  }
);
```

Reglas:

- No guardar objetos DOM en el store.
- Listas siempre inmutables (`[...prev, item]`).
- El store no conoce el router; las páginas navegan.
- Los errores de API se convierten en toasts + estado local.

## 6. Patrones Elur

### 6.1 Texto reactivo

```ts
html`<span>${() => appStore.projectCount.value} proyectos</span>`
```

Nunca `${appStore.projectCount}` (objeto Signal → `[object Object]`).

### 6.2 Listas

```ts
html`${() => repeat(
  appStore.projects.value,
  (p) => p.id,
  (p) => ProjectCard(p),
)}`
```

Para listas que conservan estado interno (inputs, máquinas), usar `repeatLive`.

### 6.3 Atributos

```ts
html`<button disabled=${() => appStore.loading.value}>Guardar</button>`
html`<div class=${() => `badge badge--${project.engine}`}>${project.engine}</div>`
```

### 6.4 Eventos

```ts
html`<button @click=${() => appStore.renderProject()}>Renderizar</button>`
html`<form @submit.prevent=${(e) => onSubmit(e)}>...</form>`
```

### 6.5 Mostrar/ocultar

```ts
html`<div show=${() => appStore.loading.value}>Cargando…</div>`
```

### 6.6 Componentes

- Páginas: funciones que devuelven `ElurTemplate`.
- Componentes con estado/lifecycle: `defineComponent` o `ElurComponent`.
- Shell: `class App extends ElurComponent` con `new RouterView()`.
- Listas: funciones puras + `repeat`.

### 6.7 Formularios

- Inputs controlados por señales locales.
- `@input` actualiza; `@submit.prevent` valida.
- Errores inline; no usar `alert`.

### 6.8 Editor

El editor es un `<textarea>` con gutter de line numbers:

```ts
const lines = computed(() => content.value.split("\n").length);
const gutter = computed(() =>
  Array.from({ length: lines.value }, (_, i) => i + 1).join("\n")
);
```

Sincronizar scroll del gutter con el textarea en `onMount`. Guardar con `Ctrl/Cmd+S`.

### 6.9 SSE

```ts
const es = new EventSource("/api/events");
es.addEventListener("render.progress", (e) => {
  const data = JSON.parse((e as MessageEvent).data);
  appStore.handleEvent({ type: "render.progress", ...data });
});
```

En desarrollo, Vite proxy `/api` → `http://127.0.0.1:8787`.

## 7. Componentes

```text
components/
  layout/Sidebar.ts, Topbar.ts, AppShell.ts
  ui/Button.ts, Badge.ts, Card.ts, Modal.ts, Input.ts, Select.ts,
     Textarea.ts, Spinner.ts, Progress.ts, EmptyState.ts, ToastHost.ts,
     Tabs.ts, Icon.ts, StatCard.ts
  project/ProjectCard.ts, ProjectGrid.ts, FileTree.ts, CodeEditor.ts,
          ProjectHeader.ts, NewProjectWizard.ts
  render/RenderList.ts, RenderCard.ts, RenderProgress.ts, LogViewer.ts,
         QaPanel.ts, MetadataTable.ts, VideoPreview.ts, ContactSheet.ts
  agent/AgentChat.ts, MessageBubble.ts, ToolCallCard.ts, AgentComposer.ts
  settings/ProviderList.ts, ProviderForm.ts, EngineStatus.ts, GeneralForm.ts
```

Cada componente recibe props explícitas y devuelve `ElurTemplate`. Evitar singletons de UI; el store es la excepción.

## 8. CSS

```text
styles/
  tokens.css      variables, reset, tipografía
  base.css        layout, utilidades
  components.css  botones, cards, inputs, badges, tabs, toasts
  pages.css       dashboard, projects, workspace, settings
```

Convención BEM ligera: `.project-card`, `.project-card__title`, `.project-card--active`.

- Sin Tailwind (para mantener el bundle pequeño y el control visual).
- Variables CSS para todo color/espaciado.
- `:focus-visible` con outline cian de 2 px.
- `prefers-reduced-motion` desactiva transiciones.

## 9. Responsive

| Breakpoint | Cambio |
| --- | --- |
| ≥ 1280 px | Sidebar fija, workspace 3 columnas |
| 1024–1279 px | Sidebar 220 px, inspector colapsable |
| 768–1023 px | Sidebar overlay, workspace 2 columnas |
| < 768 px | Sidebar drawer, una columna, tabs scrollables |

## 10. Accesibilidad

- Todo input tiene `<label>` o `aria-label`.
- Botones con icono tienen `title` y `aria-label`.
- `aria-live="polite"` en toasts y estado del agente.
- Contraste mínimo AA.
- Navegación por teclado: Tab, Enter, Esc (cerrar modal), Ctrl/Cmd+S (guardar), Ctrl/Cmd+Enter (enviar prompt).
- El video tiene subtítulos/controls nativos.
- No depender solo del color para estados (icono + texto).

## 11. Rendimiento

- Carga inicial: fetch paralelo de stats/projects/engines/providers/settings/templates.
- Lazy load de páginas pesadas (`lazy()` de Elur) si el bundle crece.
- Logs: renderizar solo las últimas 500 líneas; el resto bajo demanda.
- Evitar re-renders de listas completas: `repeat` con keys.
- Imágenes: thumbnails de hoja de contactos con `loading="lazy"`.
- SSE: throttle de progreso a 4 Hz en el servidor.

## 12. Estados de UI

| Estado | Representación |
| --- | --- |
| Cargando | Skeleton o spinner con texto |
| Vacío | Empty state con CTA |
| Error | Banner rojo + reintentar |
| Sin proveedor | Banner “Configura un proveedor para usar el agente” |
| Motor no disponible | Badge gris + hint |
| Render en curso | Barra de progreso + etapa + cancelar |
| Render fallido | Error + log + reintentar |
| Sin conexión SSE | Punto ámbar + “Reconectando…” |

## 13. Capturas objetivo

1. Dashboard con proyectos y estado de motores.
2. Workspace con chat, editor y preview.
3. Detalle de render con hoja de contactos y QA.
4. Settings de proveedores con presets chinos.
5. Galería de plantillas.

Las capturas se generarán al final de la fase UI y se guardarán en `docs/assets/` (ignoradas hasta entonces).
