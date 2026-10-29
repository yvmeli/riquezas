import { test, expect, Page } from "@playwright/test";

test("financial dialogs keep keyboard focus inside and restore the trigger", async ({
  page,
}) => {
  await syntheticApi(page);
  await page.goto("/portal");
  const trigger = page.getByRole("button", {
    name: "Nuevo movimiento",
    exact: true,
  });
  await trigger.click();
  const close = page.getByRole("button", { name: "Cerrar formulario" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Registrar movimiento", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

const alice = "00000000-0000-4000-8000-000000000001";
const debit = "00000000-0000-4000-8000-000000000011";
const card = "00000000-0000-4000-8000-000000000012";
const widths = [320, 375, 390, 430, 768, 1024, 1440];

async function syntheticApi(page: Page, onboarded = true, expired = false) {
  const state = {
    profile: {
      first_name: "Persona sintética",
      template: "basic",
      methods: ["manual"],
      onboarding_completed: onboarded,
    },
    accounts: [
      {
        id: debit,
        name: "Cuenta sintética",
        institution: "qik",
        kind: "debit",
        currency: "DOP",
        opening_balance: "100.00",
      },
      {
        id: card,
        name: "Tarjeta sintética",
        institution: "popular",
        kind: "credit",
        currency: "DOP",
        opening_balance: "-10.00",
      },
    ],
    transactions: [] as Record<string, unknown>[],
    budgets: [] as unknown[],
    goals: [] as unknown[],
    contributions: [] as unknown[],
  };
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace("/api/", "");
    const body = req.method() === "GET" ? {} : req.postDataJSON() || {};
    let response: unknown = {};
    if (path === "me")
      response = {
        id: alice,
        email: "synthetic@example.com",
        profile: state.profile,
        trial: {
          started_at: new Date().toISOString(),
          expires_at: new Date(
            Date.now() + (expired ? -1 : 14) * 86400000,
          ).toISOString(),
          suspended: false,
        },
      };
    else if (path === "onboarding") {
      state.profile = { ...state.profile, ...body, onboarding_completed: true };
    } else if (path === "accounts") {
      if (req.method() === "POST")
        state.accounts.push({ ...body, id: crypto.randomUUID() });
      response = state.accounts;
    } else if (path === "transactions") {
      if (req.method() === "POST")
        state.transactions.push({
          ...body,
          id: crypto.randomUUID(),
          source: "manual",
          source_key: body.idempotency_key,
        });
      response = state.transactions;
    } else if (path === "budgets") {
      if (req.method() === "POST")
        state.budgets.push({ ...body, id: crypto.randomUUID() });
      response = state.budgets;
    } else if (path === "goals") {
      if (req.method() === "POST")
        state.goals.push({ ...body, id: crypto.randomUUID() });
      response =
        req.method() === "GET"
          ? { goals: state.goals, contributions: state.contributions }
          : state.goals;
    } else if (path === "dashboard")
      response = {
        currency: "DOP",
        income: "0",
        expense: "0",
        net: "0",
        recorded_balance: "90.00",
        balances: {},
        categories: [],
        monthly: [],
        recent: state.transactions,
      };
    else if (path === "appointments")
      response = { status: "requested", id: crypto.randomUUID() };
    else if (path.startsWith("auth/"))
      response = { message: "Respuesta sintética de prueba" };
    else if (path === "export")
      response = { accounts: state.accounts, transactions: state.transactions };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
  return state;
}

for (const width of widths) {
  test(`landing and forms fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Tu dinero",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: `.local/landing-${width}.png`,
        fullPage: true,
      });
    await page
      .getByRole("link", { name: "Encuentra tu punto de partida" })
      .click();
    await page.getByRole("button", { name: /Con una orientación/ }).click();
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
  test(`customer portal fits ${width}px with empty and populated data`, async ({
    page,
  }) => {
    await syntheticApi(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/portal");
    await expect(
      page.getByRole("heading", { name: "Tu panorama financiero." }),
    ).toBeVisible();
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: `.local/portal-${width}.png`,
        fullPage: true,
      });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Movimientos", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Nuevo movimiento", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("register, OTP, login and onboarding with synthetic provider", async ({
  page,
}) => {
  const state = await syntheticApi(page, false);
  await page.goto("/auth?mode=register");
  await page.getByLabel("Nombres", { exact: true }).fill("Persona");
  await page.getByLabel("Apellidos").fill("Sintética");
  await page.getByLabel("Correo electrónico").fill("synthetic@example.com");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("synthetic-long-password");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Verifica tu correo." }),
  ).toBeVisible();
  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(
    page.getByRole("heading", { name: "Qué bueno verte." }),
  ).toBeVisible();
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("synthetic-long-password");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Un espacio que/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Presupuesto Un plan/ }).click();
  await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu panorama financiero." }),
  ).toBeVisible();
  expect(state.profile.template).toBe("budget");
  expect(state.profile.methods).toEqual(["manual"]);
});

test("manual expense, transfer and exact amount are sent to API", async ({
  page,
}) => {
  const state = await syntheticApi(page);
  await page.goto("/portal");
  await page
    .getByRole("button", { name: "Nuevo movimiento", exact: true })
    .click();
  await page.getByLabel("Importe", { exact: true }).fill("0.10");
  await page.getByLabel("Descripción").fill("Compra sintética");
  await page
    .getByRole("button", { name: "Registrar movimiento", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(state.transactions[0].amount).toBe("0.10");
  await page
    .getByRole("button", { name: "Nuevo movimiento", exact: true })
    .click();
  await page.getByLabel("Tipo de movimiento").selectOption("transfer");
  await page.getByLabel("Cuenta destino (misma moneda)").selectOption(card);
  await page.getByLabel("Importe", { exact: true }).fill("10.00");
  await page.getByLabel("Descripción").fill("Pago sintético");
  await page
    .getByRole("button", { name: "Registrar movimiento", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(state.transactions[1].kind).toBe("transfer");
  expect(state.transactions[1].destination_account_id).toBe(card);
});

test("expired trial permits reading but hides create actions", async ({
  page,
}) => {
  await syntheticApi(page, true, true);
  await page.goto("/portal");
  await expect(page.getByText(/La prueba está vencida/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nuevo movimiento", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Exportar mis datos" }),
  ).toBeVisible();
});

test("appointments stay pending instead of claiming a confirmed booking", async ({
  page,
}) => {
  await syntheticApi(page);
  await page.goto("/comenzar");
  await page.getByRole("button", { name: /Con una orientación/ }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Persona Sintética");
  await page.getByLabel("Correo electrónico").fill("synthetic@example.com");
  await page.getByLabel("Teléfono").fill("0000000000");
  await page
    .getByLabel("Fecha y hora preferidas (hora local)")
    .fill("2030-01-01T10:00");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /Solicitud recibida/ }),
  ).toContainText("pendiente de confirmación");
});

test("real API reports unavailable Supabase without fabricated records", async ({
  page,
}) => {
  await page.goto("/auth");
  await page.getByLabel("Correo electrónico").fill("synthetic@example.com");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("synthetic-long-password");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Configura Supabase" }),
  ).toBeVisible();
});

test("customer surface does not expose administrative portal", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /admin/i })).toHaveCount(0);
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
  const admin = await page.request.get("/api/admin/overview");
  expect(admin.status()).toBe(404);
});

test("PWA manifest and cache contain only approved public install assets", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).icons).toHaveLength(3);
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const cache = await caches.open("owl-public-v1");
        return (await cache.keys()).length;
      }),
    )
    .toBe(5);
  const paths = await page.evaluate(async () => {
    const cache = await caches.open("owl-public-v1");
    return (await cache.keys()).map((req) => new URL(req.url).pathname);
  });
  expect(
    paths.some(
      (path) =>
        path.startsWith("/api") || path === "/portal" || path === "/auth",
    ),
  ).toBe(false);
});

test("dark mode and installation guidance remain accessible", async ({
  page,
}) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: /Activar modo/ });
  const label = await button.getAttribute("aria-label");
  await button.click();
  await expect(
    page.getByRole("button", {
      name:
        label === "Activar modo oscuro"
          ? "Activar modo claro"
          : "Activar modo oscuro",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Instalar OWL" }).click();
  await expect(page.getByRole("status")).toContainText("Safari");
});

test("administrative origin redirects to its own login and requires role", async ({
  page,
}) => {
  await page.goto("http://localhost:3001/");
  await expect(page).toHaveURL(/localhost:3001\/auth\?admin=1/);
  await page.route("**/api/admin/overview", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Se requiere un rol administrativo." }),
    }),
  );
  await page.goto("http://localhost:3001/admin");
  await expect(
    page.getByRole("alert").filter({ hasText: "rol administrativo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Solicitudes de orientación" }),
  ).toHaveCount(0);
});

test("administrative portal manages appointment with synthetic authorized provider", async ({
  page,
}) => {
  let update: Record<string, unknown> | null = null;
  await page.route("**/api/admin/overview", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        role: "operator",
        appointments: [
          {
            id: "00000000-0000-4000-8000-000000000099",
            name: "Persona Sintética",
            email: "synthetic@example.com",
            phone: "0000000000",
            modality: "video",
            preferred_at: "2030-01-01T10:00:00Z",
            status: "requested",
            outcome: "",
          },
        ],
        trials: [],
        settings: [],
        audit: [],
      }),
    }),
  );
  await page.route("**/api/admin/appointments/*", async (route) => {
    update = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
  await page.goto("http://localhost:3001/admin");
  await expect(
    page.getByRole("heading", { name: "Solicitudes de orientación" }),
  ).toBeVisible();
  await page
    .getByLabel("Fecha acordada (obligatoria al confirmar o reprogramar)")
    .fill("2030-01-01T12:00");
  await page.getByLabel("Resultado / nota").fill("Horario sintético acordado");
  await page.getByRole("button", { name: "Actualizar solicitud" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Solicitud actualizada" }),
  ).toBeVisible();
  expect(update).toMatchObject({
    status: "confirmed",
    outcome: "Horario sintético acordado",
  });
});
