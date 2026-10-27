import type { VideurEvent } from "@videur/contracts";
import type { Database } from "bun:sqlite";
import { createEvent } from "../repositories/events";

export type EventListener = (event: VideurEvent) => void;

export class EventBus {
  private readonly listeners = new Set<EventListener>();

  constructor(private readonly db?: Database) {}

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: VideurEvent): void {
    const highFrequency =
      event.type === "render.log" ||
      event.type === "render.progress" ||
      event.type === "ping" ||
      event.type === "hello";
    if (this.db && !highFrequency) {
      try {
        createEvent(this.db, event);
      } catch {
        // La auditoría no debe bloquear el flujo principal.
      }
    }
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Un listener roto no afecta a los demás.
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
