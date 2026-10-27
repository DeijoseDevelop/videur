import { defineComponent, elurRouter, html } from "@elurjs/core";
import { button } from "../components/ui";

export const NotFoundPage = defineComponent((_props) => {
  const router = elurRouter();
  return html`
    <div class="page page--center">
      <div class="not-found">
        <span class="not-found__code">404</span>
        <h1>Esta ruta no existe</h1>
        <p>Puede que el proyecto se haya eliminado o que el enlace esté mal.</p>
        ${button("Volver al dashboard", {
          variant: "primary",
          icon: "arrow-left",
          onClick: () => router.navigate("/"),
        })}
      </div>
    </div>
  `;
});
