import { ElurComponent, RouterView, elurRouter, html, raw, signal } from "@elurjs/core";
import { appStore } from "./lib/store";
import { connectEvents } from "./lib/sse";
import { icon, type IconName } from "./lib/icons";
import { formatPercent } from "./lib/format";
import { toastHost } from "./components/ui";

function navItem(
  router: ReturnType<typeof elurRouter>,
  path: string,
  label: string,
  iconName: IconName,
  active: () => boolean,
  onNavigate: () => void,
) {
  return html`
    <a
      class=${() => `nav-item ${active() ? "nav-item--active" : ""}`}
      href=${path}
      @click=${(event: Event) => {
        event.preventDefault();
        router.navigate(path);
        onNavigate();
      }}
    >
      <span class="nav-item__icon">${raw(icon(iconName, 18))}</span>
      <span>${label}</span>
    </a>
  `;
}

export class App extends ElurComponent {
  private mobileOpen = signal(false);

  override onMount() {
    void appStore.bootstrap();
    const disconnect = connectEvents();
    return () => disconnect();
  }

  override render() {
    const router = elurRouter();
    const closeMobile = (): void => {
      this.mobileOpen.value = false;
    };

    return html`
      <div class="app-shell">
        <div class="sidebar-overlay" show=${() => this.mobileOpen.value} @click=${closeMobile}></div>

        <aside class=${() => `sidebar ${this.mobileOpen.value ? "sidebar--open" : ""}`}>
          <a
            class="brand"
            href="/"
            @click=${(event: Event) => {
              event.preventDefault();
              router.navigate("/");
              closeMobile();
            }}
          >
            <img class="brand__mark" src="/brand-mark-small.svg" width="38" height="38" alt="" aria-hidden="true" />
            <span class="brand__text">
              <strong>Videur</strong>
              <small>video studio</small>
            </span>
          </a>

          <nav class="nav" aria-label="Principal">
            ${navItem(router, "/", "Dashboard", "dashboard", () => router.current.value === "/", closeMobile)}
            ${navItem(router, "/projects", "Proyectos", "projects", () => router.current.value.startsWith("/projects"), closeMobile)}
            ${navItem(router, "/templates", "Plantillas", "templates", () => router.current.value.startsWith("/templates"), closeMobile)}
            ${navItem(router, "/settings", "Ajustes", "settings", () => router.current.value.startsWith("/settings"), closeMobile)}
          </nav>

          <div class="sidebar__section">
            <div class="sidebar__label">Motores</div>
            <div class="sidebar__engines">
              ${() =>
                (appStore.engines.value.length ? appStore.engines.value : [
                  { id: "ffmpeg", name: "FFmpeg", available: false },
                  { id: "pillow", name: "Pillow", available: false },
                  { id: "manim", name: "Manim", available: false },
                  { id: "remotion", name: "Remotion", available: false },
                ]).map(
                  (engine) => html`
                    <div class="sidebar-engine" title=${engine.available ? "Disponible" : "No instalado"}>
                      <span class=${engine.available ? "dot dot--success" : "dot dot--neutral"}></span>
                      <span>${engine.name}</span>
                    </div>
                  `,
                )}
            </div>
          </div>

          <div class="sidebar__spacer"></div>

          <div class="sidebar__cta">
            <span class="sidebar__cta-icon">${raw(icon("sparkles", 18))}</span>
            <div>
              <strong>¿Listo para crear?</strong>
              <span>Un brief y el agente hace el resto.</span>
            </div>
          </div>

          <div class="sidebar__footer">
            <div class="sidebar__status">
              <span class=${() => (appStore.sseConnected.value ? "dot dot--success" : "dot dot--warn")}></span>
              <span>${() => (appStore.sseConnected.value ? "Conectado" : "Reconectando…")}</span>
            </div>
            <span class="muted">v0.1.0 · local-first</span>
          </div>
        </aside>

        <div class="app-main">
          <header class="topbar">
            <div class="topbar__left">
              <button class="icon-btn icon-btn--ghost topbar__menu" type="button" aria-label="Abrir menú" @click=${() => (this.mobileOpen.value = true)}>
                ${raw(icon("menu", 20))}
              </button>
              <div class="breadcrumb">
                <span>Videur</span>
                <span class="breadcrumb__sep">/</span>
                <strong>${() => {
                  const path = router.current.value;
                  if (path === "/") return "Dashboard";
                  if (path.startsWith("/projects/new")) return "Nuevo proyecto";
                  if (path.startsWith("/projects/")) return "Proyecto";
                  if (path.startsWith("/projects")) return "Proyectos";
                  if (path.startsWith("/templates")) return "Plantillas";
                  if (path.startsWith("/settings")) return "Ajustes";
                  return "Estudio";
                }}</strong>
              </div>
            </div>
            <div class="topbar__right">
              <span class="topbar__live" title=${() => (appStore.sseConnected.value ? "SSE conectado" : "SSE desconectado")}>
                <span class=${() => (appStore.sseConnected.value ? "live-dot" : "live-dot live-dot--off")}></span>
                <span>${() => (appStore.sseConnected.value ? "live" : "offline")}</span>
              </span>
              <span class="topbar__stat" title="Tasa de éxito histórica">${() => formatPercent(appStore.successRate.value)} éxito</span>
              <a
                class="btn btn--primary btn--sm"
                href="/projects/new"
                @click=${(event: Event) => {
                  event.preventDefault();
                  router.navigate("/projects/new");
                }}
              >
                ${raw(icon("plus", 14))}
                <span>Nuevo</span>
              </a>
            </div>
          </header>

          <main class="content">
            ${new RouterView()}
          </main>
        </div>

        ${() => toastHost(appStore.toasts.value, appStore.dismissToast)}
      </div>
    `;
  }
}
