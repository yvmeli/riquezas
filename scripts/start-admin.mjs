import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const processHandle = spawn(
  process.execPath,
  [
    `${root}/node_modules/next/dist/bin/next`,
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3001",
  ],
  {
    cwd: `${root}/apps/web`,
    env: {
      ...process.env,
      PORTAL_MODE: "admin",
      PUBLIC_ORIGIN: process.env.ADMIN_ORIGIN || "http://localhost:3001",
    },
    stdio: "inherit",
  },
);
processHandle.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => processHandle.kill(signal));
