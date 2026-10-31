// Explicit, opt-in real-provider test. No routes are mocked and no OTP is invented.
// Credentials/OTP stay in memory; reports stay under .local. No traces or HAR.
import { chromium } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { readOtp } from "./live_otp.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const email = process.argv[process.argv.indexOf("--email") + 1];
if (!process.argv.includes("--email") || !email || !email.includes("@")) {
  console.error(
    "Uso: node scripts/live_e2e.mjs --email <correo autorizado para el OTP real>",
  );
  process.exit(2);
}
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
const directory = path.join(root, ".local", `live-${runId}`);
await mkdir(directory, { recursive: true });
const password = randomBytes(32).toString("base64url") + "aA1!";
const report = {
  run_id: runId,
  provider: "real_supabase",
  phase: "preflight",
  passed: [],
  pending: [
    "admin_appointment_readback",
    "admin_authorization",
    "second_user_rls",
    "password_recovery",
  ],
  artifacts: path.relative(root, directory),
};
const save = async (phase) => {
  report.phase = phase;
  await writeFile(
    path.join(directory, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(`OWL prueba real: ${phase}`);
};
let browser;
try {
  const readiness = JSON.parse(
    await readFile(path.join(root, ".local/supabase-readiness.json"), "utf8"),
  );
  if (
    !readiness.public_key_configured ||
    readiness.checks.email_autoconfirm !== false ||
    readiness.project_ref !== "lwhpwbyfyrxojpbcuyex"
  )
    throw new Error("preflight");
  const emailConfiguration = JSON.parse(
    await readFile(path.join(root, ".local/auth-config-check.json"), "utf8"),
  );
  if (
    emailConfiguration.project_ref !== readiness.project_ref ||
    emailConfiguration.smtp_enabled !== true ||
    emailConfiguration.signup_template_contains_token !== true ||
    emailConfiguration.confirm_email_required !== true
  )
    throw new Error("smtp_setup_required");
  const resume = process.argv.includes("--resume-signup-stdin");
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: "http://localhost:3000",
    viewport: { width: 390, height: 844 },
    timezoneId: "America/Santo_Domingo",
  });
  const page = await context.newPage();
  const wait = async (locator) =>
    locator.waitFor({ state: "visible", timeout: 25000 });
  const data = async (endpoint) => {
    const response = await context.request.get(
      `http://localhost:3000/api/${endpoint}`,
    );
    if (!response.ok()) throw new Error("provider_read");
    return response.json();
  };
  if (!(await data("health")).supabase_configured) throw new Error("preflight");
  if (resume) {
    const otpInput = readOtp(process.stdin);
    console.log("OWL prueba real: waiting_stdin_signup_otp");
    const code = await otpInput;
    const result = spawnSync(
      path.join(root, ".venv/Scripts/python.exe"),
      [path.join(root, "scripts/verify_live_signup.py")],
      {
        input: JSON.stringify({ email, code: code.trim(), password }),
        encoding: "utf8",
        windowsHide: true,
      },
    );
    if (result.status !== 0) throw new Error("real_otp_verification_failed");
    report.passed.push(
      "real_otp_verified",
      "verified_session_password_updated",
    );
    await page.goto("/auth");
    await wait(page.getByRole("heading", { name: "Qué bueno verte." }));
    await page.getByLabel("Correo electrónico").fill(email);
  } else {
    await page.goto("/");
    await wait(page.getByRole("heading", { level: 1 }));
    report.passed.push("landing");
    await page
      .getByRole("link", { name: "Encuentra tu punto de partida" })
      .click();
    await page.getByRole("link", { name: /Directamente/ }).click();
    await page.getByLabel("Nombres", { exact: true }).fill("OWL");
    await page.getByLabel("Apellidos").fill("Prueba funcional");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page.getByRole("checkbox").check();
    await save("registering");
    await page
      .getByRole("button", { name: "Crear cuenta", exact: true })
      .click();
    await wait(page.getByRole("heading", { name: "Verifica tu correo." }));
    report.passed.push("registration_accepted");
    const otpInput = readOtp(process.stdin);
    await save("waiting_real_signup_otp");
    const otp = await otpInput;
    await save("verifying_real_otp");
    await page.getByLabel("Código de verificación").fill(otp);
    await page.getByRole("button", { name: "Verificar código" }).click();
    await wait(page.getByRole("heading", { name: "Qué bueno verte." }));
    report.passed.push("real_otp_verified");
  }
  await save("logging_in");
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await wait(page.getByRole("heading", { name: /Un espacio que/ }));
  const me = await data("me");
  report.user_id = me.id;
  if (
    !me.trial ||
    me.trial.suspended ||
    Date.parse(me.trial.expires_at) - Date.parse(me.trial.started_at) !==
      14 * 86400000
  )
    throw new Error("trial");
  report.passed.push("password_login", "verified_profile", "trial_14_days");
  await save("completing_onboarding");
  await page.getByRole("button", { name: /Presupuesto Un plan/ }).click();
  await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await wait(page.getByRole("heading", { name: "Tu panorama financiero." }));
  report.passed.push("onboarding_budget");
  await save("creating_synthetic_finances");
  await page.getByRole("button", { name: "Cuentas", exact: true }).click();
  await page.getByRole("button", { name: "Nueva cuenta", exact: true }).click();
  const accountName = `Cuenta sintética E2E ${runId.slice(-8)}`;
  await page.getByLabel("Nombre de la cuenta").fill(accountName);
  await page
    .getByLabel("Saldo inicial (deudas con signo negativo)")
    .fill("1000.00");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const accounts = await data("accounts"),
    account = accounts.find((item) => item.name === accountName);
  if (!account) throw new Error("account_not_persisted");
  report.account_id = account.id;
  report.passed.push("account_persisted");
  await page.getByRole("button", { name: "Resumen", exact: true }).click();
  const today = await page.evaluate(() =>
    new Date().toLocaleDateString("en-CA"),
  );
  for (const [kind, amount, description] of [
    ["income", "3000.10", "Ingreso sintético E2E"],
    ["expense", "200.05", "Gasto sintético E2E"],
  ]) {
    await page
      .getByRole("button", { name: "Nuevo movimiento", exact: true })
      .click();
    await page.getByLabel("Tipo de movimiento").selectOption(kind);
    await page.getByLabel("Cuenta de origen").selectOption(account.id);
    await page.getByLabel("Importe", { exact: true }).fill(amount);
    await page.getByLabel("Fecha", { exact: true }).fill(today);
    await page.getByLabel("Descripción").fill(description);
    await page
      .getByRole("button", { name: "Registrar movimiento", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  }
  const query = new URLSearchParams({
    start: today.slice(0, 7) + "-01",
    end: today,
    currency: "DOP",
    account_id: account.id,
  });
  const dashboard = await data("dashboard?" + query);
  for (const [field, value] of Object.entries({
    income: "3000.10",
    expense: "200.05",
    net: "2800.05",
    recorded_balance: "3800.05",
  }))
    if (dashboard[field] !== value) throw new Error("dashboard_mismatch");
  report.passed.push(
    "income_persisted",
    "expense_persisted",
    "dashboard_exact_totals",
  );
  await wait(page.getByText("RD$2,800.05", { exact: true }).first());
  await page.screenshot({
    path: path.join(directory, "dashboard.png"),
    fullPage: true,
  });
  await save("checking_logout_and_persistence");
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await wait(page.getByRole("button", { name: "Iniciar sesión", exact: true }));
  if ((await context.request.get("/api/me")).status() !== 401)
    throw new Error("logout");
  report.passed.push("logout");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await wait(page.getByRole("heading", { name: "Tu panorama financiero." }));
  if (!(await data("accounts")).some((item) => item.id === account.id))
    throw new Error("persistence");
  const after = await data("dashboard?" + query);
  if (after.net !== "2800.05") throw new Error("persistence");
  report.passed.push("relogin", "provider_persistence");
  const unauthorized = await context.request.get(
    "http://localhost:3001/api/admin/overview",
  );
  if (unauthorized.status() !== 403) throw new Error("admin_rbac");
  report.passed.push("public_user_admin_denied");
  await save("requesting_synthetic_appointment");
  await page.goto("/comenzar");
  await page.getByRole("button", { name: /Con una orientación/ }).click();
  await page
    .getByLabel("Nombre", { exact: true })
    .fill(`Solicitud sintética E2E ${runId.slice(-8)}`);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Teléfono").fill("0000000000");
  const future = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 16);
  await page.getByLabel("Fecha y hora preferidas (hora local)").fill(future);
  await page.getByRole("checkbox").check();
  const appointmentResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/appointments") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Enviar solicitud" }).click();
  const response = await appointmentResponse;
  if (response.status() !== 201) throw new Error("appointment");
  const appointment = await response.json();
  if (appointment.status !== "requested") throw new Error("appointment");
  report.appointment_id = appointment.id;
  report.passed.push("appointment_requested_real_provider");
  const logout = await context.request.post("/api/auth/logout", {
    headers: { Origin: "http://localhost:3000" },
    data: {},
  });
  if (logout.status() !== 200) throw new Error("final_logout");
  await save("customer_flow_passed_admin_and_second_user_pending");
} catch (error) {
  report.failed_at = report.phase;
  report.error_code =
    error instanceof Error && error.message === "smtp_setup_required"
      ? "smtp_setup_required"
      : "ui_or_provider_error";
  await save("blocked_or_failed_review_local_configuration");
  process.exitCode = 1;
} finally {
  await browser?.close();
}
