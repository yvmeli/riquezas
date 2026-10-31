// Opt-in real UI/Auth test. No mocks, traces, HAR, credentials or OTP files.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { readOtp } from "./live_otp.mjs";
const option = (name) => process.argv[process.argv.indexOf(name) + 1];
const email = option("--email"),
  origin = option("--origin");
if (
  !process.argv.includes("--email") ||
  !process.argv.includes("--origin") ||
  !email?.includes("@")
)
  process.exit(2);
const url = new URL(origin);
if (
  url.origin !== origin ||
  !(
    url.protocol === "https:" ||
    (url.protocol === "http:" && url.hostname === "localhost")
  )
)
  process.exit(2);
const directory = new URL(
  `../.local/passwordless-${randomUUID()}/`,
  import.meta.url,
);
await mkdir(directory, { recursive: true });
const report = {
  provider: "real_supabase",
  origin,
  passed: [],
  phase: "opening_login",
};
const save = async (phase) => {
  report.phase = phase;
  await writeFile(
    new URL("report.json", directory),
    JSON.stringify(report, null, 2),
  );
  console.log(`OWL OTP real: ${phase}`);
};
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: origin,
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: { "ngrok-skip-browser-warning": "owl-development-test" },
  });
  const page = await context.newPage();
  await page.goto("/auth");
  await page
    .getByRole("button", { name: "Entrar con código por correo", exact: true })
    .click();
  await page.getByLabel("Correo electrónico").fill(email);
  await page
    .getByRole("button", { name: "Enviar código", exact: true })
    .click();
  await page.getByLabel("Código de verificación").waitFor();
  report.passed.push("https_login_ui", "otp_request_accepted");
  const input = readOtp(process.stdin);
  await save("waiting_real_otp_stdin");
  const code = await input;
  await page.getByLabel("Código de verificación").fill(code);
  await page
    .getByRole("button", { name: "Verificar código", exact: true })
    .click();
  await page.waitForURL(origin + "/portal");
  await page
    .getByRole("heading", { name: "Tu panorama financiero.", exact: true })
    .waitFor();
  const me = await context.request.get("/api/me");
  if (me.status() !== 200) throw new Error("session");
  const session = (await context.cookies()).filter((c) =>
    c.name.startsWith("owl_"),
  );
  if (
    session.length !== 2 ||
    !session.every((c) => c.httpOnly && (url.protocol !== "https:" || c.secure))
  )
    throw new Error("cookies");
  report.passed.push(
    "real_otp_session",
    "portal_redirect",
    "http_only_secure_cookies",
  );
  for (const section of [
    "Resumen",
    "Cuentas",
    "Movimientos",
    "Presupuestos",
    "Metas",
    "Configuración",
    "Conexiones",
  ]) {
    await page.getByRole("button", { name: section, exact: true }).click();
    if (
      (await page.getByRole("heading", { level: 1 }).innerText()) !==
      (section === "Resumen" ? "Tu panorama financiero." : section)
    )
      throw new Error("navigation");
    if (
      !(await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ))
    )
      throw new Error("mobile_overflow");
  }
  report.passed.push("all_seven_sections_mobile_real_provider");
  await page.reload();
  await page
    .getByRole("heading", { name: "Tu panorama financiero.", exact: true })
    .waitFor();
  report.passed.push("session_survives_reload");
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await page.waitForURL(origin + "/auth");
  if ((await context.request.get("/api/me")).status() !== 401)
    throw new Error("logout");
  report.passed.push("logout");
  await save("passed");
} catch {
  report.failed_at = report.phase;
  await save("failed_review_configuration_or_provider");
  process.exitCode = 1;
} finally {
  await browser?.close();
}
