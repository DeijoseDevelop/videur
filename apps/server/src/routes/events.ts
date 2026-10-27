import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { VideurEvent } from "@videur/contracts";
import { videurOf, type AppEnv } from "../http";

export const eventRoutes = new Hono<AppEnv>();

eventRoutes.get("/events", (c) => {
  const videur = videurOf(c);
  const projectId = new URL(c.req.url).searchParams.get("projectId");

  return streamSSE(c, async (stream) => {
    let closed = false;
    let cleanup = (): void => {
      closed = true;
    };

    const write = async (event: VideurEvent): Promise<void> => {
      if (closed) return;
      try {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
      } catch {
        closed = true;
      }
    };

    const unsubscribe = videur.bus.subscribe((event) => {
      if (projectId && "projectId" in event && event.projectId !== projectId) return;
      void write(event);
    });

    const ping = setInterval(() => {
      void write({ type: "ping", now: new Date().toISOString() });
    }, 15_000);

    cleanup = (): void => {
      if (closed) return;
      closed = true;
      clearInterval(ping);
      unsubscribe();
    };

    stream.onAbort(cleanup);
    c.req.raw.signal.addEventListener("abort", cleanup, { once: true });

    await write({ type: "hello", now: new Date().toISOString() });

    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (closed) {
          clearInterval(check);
          resolve();
        }
      }, 500);
    });

    cleanup();
  });
});
