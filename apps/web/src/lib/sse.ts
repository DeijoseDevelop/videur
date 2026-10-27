import type { VideurEvent } from "@videur/contracts";
import { appStore } from "./store";

const EVENT_TYPES = [
  "hello",
  "ping",
  "project.updated",
  "render.queued",
  "render.progress",
  "render.log",
  "render.completed",
  "agent.started",
  "agent.message",
  "agent.tool",
  "agent.usage",
  "agent.completed",
  "agent.error",
  "engine.changed",
] as const;

export function connectEvents(): () => void {
  const source = new EventSource("/api/events");

  source.onopen = () => {
    appStore.setSseConnected(true);
  };

  source.onerror = () => {
    appStore.setSseConnected(false);
  };

  for (const type of EVENT_TYPES) {
    source.addEventListener(type, (raw) => {
      try {
        const event = JSON.parse((raw as MessageEvent<string>).data) as VideurEvent;
        appStore.handleEvent(event);
      } catch {
        // Un evento malformado no debe romper la UI.
      }
    });
  }

  return () => source.close();
}
