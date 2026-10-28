import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";

export type AssetStatus = "loading" | "ready" | "failed" | "none";

export interface DelayedAsset<T> {
  status: AssetStatus;
  value: T | null;
  error: string | null;
}

const ASSET_TIMEOUT_MS = 120_000;

/**
 * Carga un asset fuera del canvas R3F bloqueando la captura con delayRender().
 *
 * Durante el render, <ThreeCanvas> usa frameloop="never": solo dibuja al
 * montarse y al cambiar de frame. Si un asset llega después, el canvas no se
 * redibuja y la captura sale sin él. Por eso quien usa este hook debe montar
 * el canvas solo cuando status !== "loading"; delayRender se libera tras el
 * commit de ese estado.
 */
export function useDelayedAsset<T>(
  url: string | undefined,
  label: string,
  load: (url: string, signal: { cancelled: boolean }) => Promise<T>,
): DelayedAsset<T> {
  const [state, setState] = useState<DelayedAsset<T>>(() => ({
    status: url ? "loading" : "none",
    value: null,
    error: null,
  }));
  const [handle] = useState(() =>
    url ? delayRender(`${label} ${url}`, { timeoutInMilliseconds: ASSET_TIMEOUT_MS }) : null,
  );

  useEffect(() => {
    if (!url) return;
    const signal = { cancelled: false };
    load(url, signal).then(
      (value) => {
        if (!signal.cancelled) setState({ status: "ready", value, error: null });
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[videur:${label}] ${url}: ${message}`);
        if (!signal.cancelled) setState({ status: "failed", value: null, error: message });
      },
    );
    return () => {
      signal.cancelled = true;
    };
  }, [url, label, load]);

  useEffect(() => {
    if (handle !== null && state.status !== "loading") continueRender(handle);
  }, [handle, state.status]);

  return state;
}
