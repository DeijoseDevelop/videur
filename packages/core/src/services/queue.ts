import type { Logger } from "../logger";
import { toErrorMessage } from "../errors";

export type RenderExecutor = (renderId: string, signal: AbortSignal) => Promise<void>;

export class RenderQueue {
  private readonly pending: string[] = [];
  private readonly active = new Map<string, AbortController>();
  private readonly completions = new Map<string, { promise: Promise<void>; resolve: () => void }>();
  private stopped = false;

  constructor(
    private concurrency: number,
    private readonly executor: RenderExecutor,
    private readonly logger: Logger,
  ) {}

  get activeCount(): number {
    return this.active.size;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  setConcurrency(value: number): void {
    this.concurrency = Math.max(1, value);
    void this.pump();
  }

  add(renderId: string): void {
    if (this.active.has(renderId) || this.pending.includes(renderId)) return;
    this.pending.push(renderId);
    this.completionFor(renderId);
    void this.pump();
  }

  async cancel(renderId: string): Promise<boolean> {
    const index = this.pending.indexOf(renderId);
    if (index >= 0) {
      this.pending.splice(index, 1);
      this.resolveCompletion(renderId);
      return true;
    }
    const controller = this.active.get(renderId);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }

  async waitFor(renderId: string, timeoutMs = 900_000): Promise<void> {
    const completion = this.completionFor(renderId);
    if (timeoutMs <= 0) return completion.promise;
    await Promise.race([
      completion.promise,
      new Promise<void>((_, reject) => {
        const timer = setTimeout(() => {
          clearTimeout(timer);
          reject(new Error(`Timeout esperando el render ${renderId}`));
        }, timeoutMs);
        completion.promise.finally(() => clearTimeout(timer)).catch(() => undefined);
      }),
    ]);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.pending.length = 0;
    for (const controller of this.active.values()) controller.abort();
    await Promise.allSettled([...this.completions.values()].map((item) => item.promise));
  }

  private completionFor(renderId: string): { promise: Promise<void>; resolve: () => void } {
    const existing = this.completions.get(renderId);
    if (existing) return existing;
    let resolve!: () => void;
    const promise = new Promise<void>((res) => {
      resolve = res;
    });
    const entry = { promise, resolve };
    this.completions.set(renderId, entry);
    return entry;
  }

  private resolveCompletion(renderId: string): void {
    const entry = this.completions.get(renderId);
    if (!entry) return;
    entry.resolve();
    this.completions.delete(renderId);
  }

  private async pump(): Promise<void> {
    if (this.stopped) return;
    while (this.active.size < this.concurrency && this.pending.length > 0) {
      const renderId = this.pending.shift()!;
      const controller = new AbortController();
      this.active.set(renderId, controller);
      void this.executor(renderId, controller.signal)
        .catch((error) => {
          this.logger.error(`Render ${renderId} falló en la cola`, toErrorMessage(error));
        })
        .finally(() => {
          this.active.delete(renderId);
          this.resolveCompletion(renderId);
          void this.pump();
        });
    }
  }
}
