// Real local UI -> FastAPI -> Supabase. Opt-in email; no mocks or Auth bypass.
import { chromium } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const email = process.argv[process.argv.indexOf("--email") + 1];
if (!process.argv.includes("--email") || !email?.includes("@")) {
  console.error(
    "Uso: node scripts/live_appointment.mjs --email <correo autorizado>",
  );
  process.exit(2);
}
const root = fileURLToPath(new URL("../", import.meta.url));
const identifier = randomUUID();
const name = `Solicitud sintética OWL ${identifier.slice(0, 8)}`;
const directory = path.join(root, ".local", `appointment-${identifier}`);
await mkdir(directory, { recursive: true });
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "America/Santo_Domingo",
  });
  const page = await context.newPage();
  const health = await context.request.get("http://localhost:3000/api/health");
  if (!health.ok() || !(await health.json()).supabase_configured)
    throw new Error("provider_not_configured");
  await page.goto("http://localhost:3000/comenzar");
  await page.getByRole("button", { name: /Con una orientación/ }).click();
  await page.getByLabel("Nombre", { exact: true }).fill(name);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Teléfono").fill("0000000000");
  await page.getByLabel("Modalidad").selectOption("video");
  const preferred = await page.evaluate(() => {
    const d = new Date(Date.now() + 2 * 86400000);
    d.setHours(10, 0, 0, 0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T10:00`;
  });
  await page.getByLabel("Fecha y hora preferidas (hora local)").fill(preferred);
  await page.getByRole("checkbox").check();
  const waiting = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/appointments") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Enviar solicitud" }).click();
  const response = await waiting;
  const body = await response.json();
  if (response.status() !== 201 || body.status !== "requested")
    throw new Error("request_not_accepted");
  await page
    .getByRole("status")
    .filter({ hasText: "Solicitud recibida" })
    .waitFor({ state: "visible" });
  const report = {
    provider: "real_supabase",
    appointment_id: body.id,
    name,
    status: body.status,
    ui_success: true,
    database_readback: "pending",
  };
  await writeFile(
    path.join(directory, "report.json"),
    JSON.stringify(report, null, 2),
  );
  await page.screenshot({
    path: path.join(directory, "success.png"),
    fullPage: true,
  });
  console.log(
    JSON.stringify({ ...report, artifacts: path.relative(root, directory) }),
  );
} catch {
  console.error(
    "La prueba real de cita no se completó. Revisar API y Supabase; no se simularon registros.",
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
}
