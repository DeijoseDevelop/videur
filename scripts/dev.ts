/**
 * Arranca API y UI en paralelo con HMR.
 * Uso: bun run dev
 */
const server = Bun.spawn(["bun", "--hot", "apps/server/src/index.ts"], {
  cwd: process.cwd(),
  stdout: "inherit",
  stderr: "inherit",
  stdin: "inherit",
});

const web = Bun.spawn(["bunx", "--bun", "vite", "--config", "apps/web/vite.config.ts"], {
  cwd: process.cwd(),
  stdout: "inherit",
  stderr: "inherit",
  stdin: "inherit",
});

let stopping = false;
const stop = (): void => {
  if (stopping) return;
  stopping = true;
  server.kill("SIGTERM");
  web.kill("SIGTERM");
  setTimeout(() => {
    server.kill("SIGKILL");
    web.kill("SIGKILL");
    process.exit(0);
  }, 1500).unref?.();
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

const code = await Promise.race([server.exited, web.exited]);
stop();
await Promise.allSettled([server.exited, web.exited]);
process.exit(code ?? 0);
