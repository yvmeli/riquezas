"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  LayoutDashboard,
  Wallet,
  ListFilter,
  Target,
  PieChart,
  Plug,
  Settings,
  Plus,
  LogOut,
  ArrowRight,
  X,
  Download,
  RefreshCw,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { ActionForm, Field, Select } from "@/components/form";
import { api, ApiError, money, requestKey } from "@/lib/api";
import {
  Account,
  Budget,
  Contribution,
  Dashboard,
  Goal,
  Me,
  Transaction,
  sumMoney,
} from "@/lib/types";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

type Section =
  | "Resumen"
  | "Cuentas"
  | "Movimientos"
  | "Presupuestos"
  | "Metas"
  | "Conexiones"
  | "Configuración";
type Modal = "account" | "transaction" | "budget" | "goal" | null;
const navigation = [
  { name: "Resumen", Icon: LayoutDashboard },
  { name: "Cuentas", Icon: Wallet },
  { name: "Movimientos", Icon: ListFilter },
  { name: "Presupuestos", Icon: PieChart },
  { name: "Metas", Icon: Target },
  { name: "Conexiones", Icon: Plug },
  { name: "Configuración", Icon: Settings },
] as const;
const today = () => new Date().toLocaleDateString("en-CA");
const firstOfMonth = () => today().slice(0, 7) + "-01";
const categories = [
  "Sin categoría",
  "Alimentación",
  "Hogar",
  "Transporte",
  "Salud",
  "Educación",
  "Entretenimiento",
  "Servicios",
  "Nómina",
  "Otros",
];

export default function Portal() {
  const [me, setMe] = useState<Me | null>(null),
    [accounts, setAccounts] = useState<Account[]>([]),
    [transactions, setTransactions] = useState<Transaction[]>([]),
    [budgets, setBudgets] = useState<Budget[]>([]),
    [goals, setGoals] = useState<Goal[]>([]),
    [contributions, setContributions] = useState<Contribution[]>([]),
    [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [section, setSection] = useState<Section>("Resumen"),
    [modal, setModal] = useState<Modal>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true);
  const [start, setStart] = useState(firstOfMonth),
    [end, setEnd] = useState(today),
    [currency, setCurrency] = useState("DOP"),
    [account, setAccount] = useState(""),
    [institution, setInstitution] = useState(""),
    [category, setCategory] = useState("");
  const [edit, setEdit] = useState<Transaction | null>(null),
    [kind, setKind] = useState("expense");
  const reload = useCallback(async () => {
    const [m, a, t, b, g] = await Promise.all([
      api<Me>("me"),
      api<Account[]>("accounts"),
      api<Transaction[]>("transactions"),
      api<Budget[]>("budgets"),
      api<{ goals: Goal[]; contributions: Contribution[] }>("goals"),
    ]);
    setMe(m);
    setAccounts(a);
    setTransactions(t);
    setBudgets(b);
    setGoals(g.goals);
    setContributions(g.contributions);
  }, []);
  useEffect(() => {
    reload()
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401)
          window.location.assign("/auth");
        else setError(error.message);
      })
      .finally(() => setBusy(false));
  }, [reload]);
  const loadDashboard = useCallback(async () => {
    const query = new URLSearchParams({ start, end, currency });
    if (account) query.set("account_id", account);
    if (institution) query.set("institution", institution);
    if (category) query.set("category", category);
    setDashboard(await api<Dashboard>("dashboard?" + query));
  }, [start, end, currency, account, institution, category]);
  useEffect(() => {
    if (me) loadDashboard().catch((error) => setError(error.message));
  }, [me, loadDashboard]);
  useEffect(() => {
    if (!modal) return;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]',
        ) || [],
      );
    focusable()[0]?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModal(null);
        setEdit(null);
      } else if (event.key === "Tab") {
        const items = focusable();
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    addEventListener("keydown", close);
    return () => {
      removeEventListener("keydown", close);
      document.body.style.overflow = oldOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [modal]);
  const trial = me?.trial;
  const remaining = trial
    ? Math.max(
        0,
        Math.ceil(
          (new Date(trial.expires_at).getTime() - Date.now()) / 86400000,
        ),
      )
    : 0;
  const active =
    !!trial &&
    !trial.suspended &&
    new Date(trial.expires_at).getTime() > Date.now();
  const save = async () => {
    await reload();
    setModal(null);
    setEdit(null);
  };
  const filtered = transactions
    .filter((tx) => {
      const a = accounts.find((a) => a.id === tx.account_id);
      return (
        tx.occurred_on >= start &&
        tx.occurred_on <= end &&
        a?.currency === currency &&
        (!account ||
          tx.account_id === account ||
          tx.destination_account_id === account) &&
        (!institution || a.institution === institution) &&
        (!category || tx.category === category)
      );
    })
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  const openTransaction = () => {
    setEdit(null);
    setKind("expense");
    setModal("transaction");
  };
  if (busy)
    return (
      <main id="contenido" className="loading-page">
        <Brand />
        <p role="status">Preparando tu espacio…</p>
      </main>
    );
  if (!me)
    return (
      <main id="contenido" className="center-page">
        <Brand />
        <h1>Tu espacio está esperando.</h1>
        <p className="notice error" role="alert">
          {error || "Inicia sesión para continuar."}
        </p>
        <a className="button" href="/auth">
          Iniciar sesión
        </a>
      </main>
    );
  if (!me.profile?.onboarding_completed)
    return <Onboarding me={me} onDone={reload} />;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <p className="eyebrow">MI ESPACIO</p>
        <nav aria-label="Finanzas">
          {navigation.map(({ name, Icon }) => (
            <button
              key={name}
              onClick={() => setSection(name)}
              aria-current={section === name ? "page" : undefined}
            >
              <Icon size={19} />
              {name}
              {section === name && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="trial-card">
            <span className="eyebrow">TU PRUEBA OWL</span>
            <strong>
              {active
                ? `${remaining} días para explorar`
                : "Tu prueba finalizó"}
            </strong>
            <p>
              {active
                ? "Dale dirección a tus próximos pasos."
                : "Puedes consultar y exportar tus datos."}
            </p>
          </div>
          <button
            className="text-button logout"
            onClick={async () => {
              try {
                await api("auth/logout", "POST", {});
                window.location.assign("/auth");
              } catch (error) {
                setError((error as Error).message);
              }
            }}
          >
            <LogOut size={17} /> Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="app-content">
        <header className="app-header">
          <span>Tu dinero, con dirección.</span>
          <div className="user-name">
            <span className="avatar">
              {me.profile.first_name?.slice(0, 1) || "O"}
            </span>
            <span>{me.profile.first_name || "Mi cuenta"}</span>
          </div>
        </header>
        <main id="contenido" className="workspace">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {new Date().toLocaleDateString("es-DO", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <h1>
                {section === "Resumen" ? `Tu panorama financiero.` : section}
              </h1>
              <p className="muted">
                {section === "Resumen"
                  ? "Pequeñas decisiones. Un rumbo más claro."
                  : "Organiza tus finanzas a tu manera."}
              </p>
            </div>
            <div className="actions">
              <button
                className="icon-button"
                aria-label="Actualizar datos"
                onClick={() => {
                  setError("");
                  reload().catch((error) => setError(error.message));
                }}
              >
                <RefreshCw size={18} />
              </button>
              {active && (
                <button
                  className="button"
                  onClick={() => {
                    if (section === "Cuentas") setModal("account");
                    else if (section === "Presupuestos") setModal("budget");
                    else if (section === "Metas") setModal("goal");
                    else openTransaction();
                  }}
                >
                  <Plus size={17} />
                  {section === "Cuentas"
                    ? "Nueva cuenta"
                    : section === "Presupuestos"
                      ? "Nuevo presupuesto"
                      : section === "Metas"
                        ? "Nueva meta"
                        : "Nuevo movimiento"}
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="notice error" role="alert">
              {error}
              <button className="text-button" onClick={() => setError("")}>
                Cerrar
              </button>
            </div>
          )}
          {!active && (
            <p className="notice">
              La prueba está vencida o suspendida. Consulta y exporta tus
              registros existentes. Las nuevas operaciones están suspendidas.
            </p>
          )}
          {["Resumen", "Movimientos"].includes(section) && (
            <div className="filters">
              <Field
                label="Desde"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
              <Field
                label="Hasta"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
              <Select
                label="Moneda"
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  setAccount("");
                }}
              >
                <option>DOP</option>
                <option>USD</option>
              </Select>
              <Select
                label="Cuenta"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                <option value="">Todas las cuentas</option>
                {accounts
                  .filter((a) => a.currency === currency)
                  .map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.name}
                    </option>
                  ))}
              </Select>
              <Select
                label="Banco"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
              >
                <option value="">Todos los bancos</option>
                <option value="qik">Qik</option>
                <option value="popular">Popular</option>
                <option value="other">Otros</option>
              </Select>
              <Select
                label="Categoría"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Todas las categorías</option>
                {Array.from(
                  new Set([
                    ...categories,
                    ...transactions.map((t) => t.category),
                  ]),
                ).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </div>
          )}
          {section === "Resumen" && (
            <>
              <div className="metrics-grid">
                <Metric
                  title="Balance neto del período"
                  value={dashboard?.net}
                  currency={currency}
                  featured
                  icon={<ArrowLeftRight size={19} />}
                />
                <Metric
                  title="Ingresos del período"
                  value={dashboard?.income}
                  currency={currency}
                  icon={<ArrowDownLeft size={19} />}
                />
                <Metric
                  title="Gastos del período"
                  value={dashboard?.expense}
                  currency={currency}
                  icon={<ArrowUpRight size={19} />}
                />
              </div>
              <div className="dashboard-grid">
                <section className="panel evolution">
                  <div className="panel-heading">
                    <h2>Tu dinero en el tiempo</h2>
                    <span className="tag">{currency}</span>
                  </div>
                  <p className="muted micro">
                    Ingresos y gastos según tus registros
                  </p>
                  {dashboard?.monthly.length ? (
                    <div className="chart">
                      <ResponsiveContainer width="100%" height={235}>
                        <AreaChart
                          data={dashboard.monthly.map((row) => ({
                            ...row,
                            exactIncome: row.income,
                            exactExpense: row.expense,
                            income: Number(row.income),
                            expense: Number(row.expense),
                          }))}
                        >
                          <defs>
                            <linearGradient
                              id="income"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#90ac6d"
                                stopOpacity={0.35}
                              />
                              <stop
                                offset="100%"
                                stopColor="#90ac6d"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            vertical={false}
                            stroke="var(--line)"
                          />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 10 }} width={55} />
                          <Tooltip
                            formatter={(value, name, item) => [
                              money(
                                name === "income"
                                  ? item.payload.exactIncome
                                  : item.payload.exactExpense,
                                currency,
                              ),
                              name === "income" ? "Ingresos" : "Gastos",
                            ]}
                            contentStyle={{
                              background: "var(--surface)",
                              borderColor: "var(--line)",
                              color: "var(--ink)",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="income"
                            stroke="#6c9250"
                            fill="url(#income)"
                            strokeWidth={2}
                          />
                          <Area
                            type="monotone"
                            dataKey="expense"
                            stroke="#bd825d"
                            fill="transparent"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <Empty
                      title="Tu historia empieza aquí"
                      text="Registra tus primeros movimientos para ver su evolución."
                    />
                  )}
                  <div className="chart-legend">
                    <span>
                      <i /> Ingresos
                    </span>
                    <span>
                      <i /> Gastos
                    </span>
                  </div>
                </section>
                <section className="panel">
                  <h2>¿A dónde va tu dinero?</h2>
                  <p className="muted micro">Gastos por categoría</p>
                  {dashboard?.categories.length ? (
                    <div className="category-list">
                      {dashboard.categories.map((c, i) => (
                        <div key={c.name}>
                          <div>
                            <span>{c.name}</span>
                            <strong>{money(c.amount, currency)}</strong>
                          </div>
                          <progress
                            aria-label={`Gastos de ${c.name}`}
                            max={Number(dashboard.expense) || 1}
                            value={Number(c.amount)}
                            style={{
                              accentColor: [
                                "#183c35",
                                "#78955d",
                                "#adbb91",
                                "#c49a74",
                              ][i % 4],
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="Aún no hay gastos"
                      text="Las categorías aparecerán al registrar gastos en este período."
                    />
                  )}
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Los últimos pasos</h2>
                  <button
                    className="text-button"
                    onClick={() => setSection("Movimientos")}
                  >
                    Ver movimientos <ArrowRight size={15} />
                  </button>
                </div>
                <TransactionList
                  rows={dashboard?.recent || []}
                  accounts={accounts}
                />
              </section>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Un plan para este mes</h2>
                    <button
                      className="text-button"
                      onClick={() => setSection("Presupuestos")}
                    >
                      Presupuestos <ArrowRight size={15} />
                    </button>
                  </div>
                  <BudgetList
                    rows={budgets.filter((b) => b.month === firstOfMonth())}
                    transactions={transactions}
                    accounts={accounts}
                  />
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Lo que estás construyendo</h2>
                    <button
                      className="text-button"
                      onClick={() => setSection("Metas")}
                    >
                      Mis metas <ArrowRight size={15} />
                    </button>
                  </div>
                  <GoalList goals={goals} contributions={contributions} />
                </section>
              </div>
              <p className="muted micro">
                Balance registrado:{" "}
                {dashboard ? money(dashboard.recorded_balance, currency) : "…"}.
                Se calcula con saldos iniciales y movimientos hasta la fecha
                final. No es una confirmación del saldo bancario.
              </p>
            </>
          )}
          {section === "Cuentas" && (
            <>
              {accounts.length ? (
                <div className="account-grid">
                  {accounts.map((a) => (
                    <article
                      className={`account-card ${a.kind === "credit" ? "credit" : ""}`}
                      key={a.id}
                    >
                      <div className="panel-heading">
                        <span className="eyebrow">
                          {a.institution === "other"
                            ? "MI CUENTA"
                            : a.institution.toUpperCase()}
                        </span>
                        <Wallet size={22} />
                      </div>
                      <h2>{a.name}</h2>
                      <p>
                        {a.kind === "credit"
                          ? "Tarjeta de crédito"
                          : a.kind === "savings"
                            ? "Cuenta de ahorro"
                            : "Cuenta de débito"}{" "}
                        · {a.currency}
                      </p>
                      <strong>{money(a.opening_balance, a.currency)}</strong>
                      <small>
                        Saldo inicial registrado
                        {a.kind === "credit"
                          ? " · la deuda se registra negativa"
                          : ""}
                      </small>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty
                  title="Cada cuenta tiene su lugar"
                  text="Añade una cuenta de ahorro, débito o tarjeta para empezar."
                />
              )}
              <p className="muted micro">
                El crédito disponible no se suma a tu patrimonio. Los saldos
                mostrados aquí son los iniciales que registraste; el resumen
                incorpora movimientos.
              </p>
            </>
          )}
          {section === "Movimientos" && (
            <section className="panel">
              <h2>Tu historial</h2>
              <TransactionList
                rows={filtered}
                accounts={accounts}
                actions={
                  active
                    ? (tx) => (
                        <div className="row-actions">
                          <button
                            className="text-button"
                            onClick={() => {
                              setEdit(tx);
                              setKind(tx.kind);
                              setModal("transaction");
                            }}
                          >
                            {tx.source === "manual" ? "Editar" : "Categorizar"}
                          </button>
                          {tx.source === "manual" && (
                            <button
                              className="text-button danger"
                              onClick={async () => {
                                if (
                                  !confirm(
                                    "¿Eliminar este movimiento manual? Se eliminará también el efecto en ambas cuentas si es una transferencia.",
                                  )
                                )
                                  return;
                                try {
                                  await api(`transactions/${tx.id}`, "DELETE");
                                  await reload();
                                } catch (error) {
                                  setError((error as Error).message);
                                }
                              }}
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      )
                    : undefined
                }
              />
            </section>
          )}
          {section === "Presupuestos" && (
            <section className="panel">
              <h2>Presupuestos mensuales</h2>
              <p className="muted">
                Los gastos de cada categoría se comparan con el límite del mes
                en su moneda.
              </p>
              <BudgetList
                rows={budgets}
                transactions={transactions}
                accounts={accounts}
              />
            </section>
          )}
          {section === "Metas" && (
            <section className="panel">
              <h2>Un paso más cerca</h2>
              <p className="muted">
                Las aportaciones son seguimiento de ahorro: no crean ingresos ni
                transfieren dinero entre cuentas.
              </p>
              <GoalList goals={goals} contributions={contributions} />
              {active &&
                goals.map((goal) => (
                  <ActionForm
                    className="contribution-form"
                    key={goal.id}
                    submit="Registrar aportación"
                    onSubmit={async (data, form) => {
                      await api(`goals/${goal.id}/contributions`, "POST", {
                        amount: data.amount,
                        idempotency_key: requestKey(form),
                      });
                      await reload();
                      form.reset();
                      return "Aportación registrada.";
                    }}
                  >
                    <Field
                      label={`Aportar a ${goal.name} (${goal.currency})`}
                      name="amount"
                      inputMode="decimal"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                    />
                  </ActionForm>
                ))}
            </section>
          )}
          {section === "Conexiones" && (
            <section className="panel">
              <p className="eyebrow">MÉTODOS OPCIONALES</p>
              <h2>Tú eliges cómo registrar</h2>
              <div className="connection-grid">
                <article>
                  <Wallet />
                  <h3>Registro manual</h3>
                  <span className="tag">Disponible</span>
                  <p>
                    Registra tus cuentas y movimientos sin dar acceso a tu
                    correo ni subir documentos.
                  </p>
                  <button
                    className="button"
                    disabled={!active}
                    onClick={openTransaction}
                  >
                    Registrar movimiento
                  </button>
                </article>
                <article>
                  <Plug />
                  <h3>Conectar Gmail</h3>
                  <span className="tag pending">Pendiente de habilitación</span>
                  <p>
                    Requiere OAuth de Google y formatos bancarios verificados.
                    No hay una conexión activa ni se están leyendo correos.
                  </p>
                </article>
                <article>
                  <Download />
                  <h3>Importar PDF</h3>
                  <span className="tag pending">Pendiente de validación</span>
                  <p>
                    Los adaptadores de Qik y Popular necesitan muestras
                    verificables antes de interpretar estados de cuenta. Usa el
                    registro manual mientras tanto.
                  </p>
                </article>
              </div>
            </section>
          )}
          {section === "Configuración" && (
            <section className="panel settings-panel">
              <h2>Tu espacio, tus decisiones</h2>
              <ActionForm
                submit="Guardar plantilla"
                onSubmit={async (data) => {
                  await api("onboarding", "PUT", {
                    template: data.template,
                    methods: me.profile?.methods || ["manual"],
                  });
                  await reload();
                  return "Plantilla actualizada. Tus datos se conservan.";
                }}
              >
                <Select
                  label="Plantilla inicial"
                  name="template"
                  defaultValue={me.profile.template}
                >
                  <option value="basic">Básica</option>
                  <option value="budget">Presupuesto</option>
                  <option value="saving">Ahorro</option>
                </Select>
              </ActionForm>
              <hr />
              <h3>Tus datos son tuyos</h3>
              <p className="muted">
                La exportación sigue disponible cuando vence tu prueba.
              </p>
              <a className="button outline" href="/api/export" download>
                <Download size={17} /> Exportar mis datos
              </a>
              <hr />
              <h3>Eliminar datos financieros</h3>
              <p className="muted">
                Se eliminarán cuentas, movimientos, presupuestos y metas. La
                cuenta de acceso y el historial del trial se conservan.
              </p>
              <ActionForm
                submit="Eliminar datos financieros"
                onSubmit={async (data) => {
                  await api(
                    "data?" +
                      new URLSearchParams({ confirmation: data.confirmation }),
                    "DELETE",
                  );
                  await reload();
                }}
              >
                <Field
                  label="Escribe ELIMINAR MIS DATOS para confirmar"
                  name="confirmation"
                  required
                  pattern="ELIMINAR MIS DATOS"
                />
              </ActionForm>
              <p className="micro">
                <a href="/privacidad">Privacidad</a> ·{" "}
                <a href="/terminos">Términos</a>
              </p>
            </section>
          )}
        </main>
        <footer className="app-footer">
          OWL · Our Wealth Latam <span>Tu dinero, con dirección.</span>
        </footer>
      </div>
      {modal && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "account"
                ? "Nueva cuenta"
                : modal === "budget"
                  ? "Nuevo presupuesto"
                  : modal === "goal"
                    ? "Nueva meta"
                    : "Movimiento"
            }
          >
            <button
              className="modal-close icon-button"
              aria-label="Cerrar formulario"
              onClick={() => {
                setModal(null);
                setEdit(null);
              }}
            >
              <X size={21} />
            </button>
            <p className="eyebrow">UN PASO MÁS</p>
            <h2>
              {modal === "account"
                ? "Añade una cuenta."
                : modal === "budget"
                  ? "Define tu presupuesto."
                  : modal === "goal"
                    ? "Dale nombre a tu meta."
                    : edit
                      ? "Actualiza el movimiento."
                      : "Registra tu movimiento."}
            </h2>
            {modal === "account" && (
              <ActionForm
                submit="Crear cuenta"
                onSubmit={async (data) => {
                  await api("accounts", "POST", {
                    ...data,
                    opening_balance: data.opening_balance || "0",
                  });
                  await save();
                }}
              >
                <Field
                  label="Nombre de la cuenta"
                  name="name"
                  maxLength={80}
                  required
                />
                <Select label="Institución" name="institution">
                  <option value="other">Otra / efectivo</option>
                  <option value="qik">Qik</option>
                  <option value="popular">Banco Popular</option>
                </Select>
                <Select label="Tipo" name="kind">
                  <option value="debit">Débito</option>
                  <option value="savings">Ahorro</option>
                  <option value="credit">Tarjeta de crédito</option>
                </Select>
                <Currency />
                <Field
                  label="Saldo inicial (deudas con signo negativo)"
                  name="opening_balance"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  defaultValue="0"
                  required
                />
                <p className="muted micro">
                  En una tarjeta, registra la deuda como saldo negativo. No
                  introduzcas el crédito disponible.
                </p>
              </ActionForm>
            )}
            {modal === "transaction" &&
              (accounts.length ? (
                <ActionForm
                  submit={edit ? "Guardar cambios" : "Registrar movimiento"}
                  onSubmit={async (data, form) => {
                    if (edit && edit.source !== "manual") {
                      await api(`transactions/${edit.id}/category`, "PATCH", {
                        category: data.category,
                      });
                    } else {
                      const payload = {
                        ...data,
                        amount: data.amount,
                        kind,
                        account_id: edit?.account_id || data.account_id,
                        destination_account_id:
                          kind === "transfer"
                            ? edit?.destination_account_id ||
                              data.destination_account_id
                            : null,
                        idempotency_key: edit?.source_key || requestKey(form),
                      };
                      await api(
                        edit ? `transactions/${edit.id}` : "transactions",
                        edit ? "PUT" : "POST",
                        payload,
                      );
                    }
                    await save();
                  }}
                >
                  {(!edit || edit.source === "manual") && (
                    <>
                      <Select
                        label="Tipo de movimiento"
                        name="kind"
                        value={kind}
                        disabled={!!edit}
                        onChange={(e) => setKind(e.target.value)}
                      >
                        <option value="expense">Gasto</option>
                        <option value="income">Ingreso</option>
                        <option value="transfer">
                          Transferencia / pago de tarjeta
                        </option>
                      </Select>
                      <Select
                        label="Cuenta de origen"
                        name="account_id"
                        defaultValue={edit?.account_id}
                        disabled={!!edit}
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} · {a.currency}
                          </option>
                        ))}
                      </Select>
                      {kind === "transfer" && (
                        <>
                          <Select
                            label="Cuenta destino (misma moneda)"
                            name="destination_account_id"
                            defaultValue={
                              edit?.destination_account_id || undefined
                            }
                            disabled={!!edit}
                          >
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name} · {a.currency}
                              </option>
                            ))}
                          </Select>
                          <p className="muted micro">
                            Las transferencias internas y los pagos de tarjetas
                            no se cuentan como ingresos o gastos. No se
                            convierten monedas.
                          </p>
                        </>
                      )}
                      <div className="form-row">
                        <Field
                          label="Importe"
                          name="amount"
                          type="number"
                          inputMode="decimal"
                          min="0.01"
                          step="0.01"
                          defaultValue={edit?.amount}
                          required
                        />
                        <Field
                          label="Fecha"
                          name="occurred_on"
                          type="date"
                          defaultValue={edit?.occurred_on || today()}
                          required
                        />
                      </div>
                      <Field
                        label="Descripción"
                        name="description"
                        defaultValue={edit?.description}
                        maxLength={240}
                        required
                      />
                    </>
                  )}
                  <Field
                    label="Categoría"
                    name="category"
                    list="categories"
                    defaultValue={edit?.category || "Sin categoría"}
                    maxLength={60}
                    required
                  />
                  <datalist id="categories">
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </datalist>
                </ActionForm>
              ) : (
                <>
                  <p className="muted">
                    Primero necesitas una cuenta para asociar tus movimientos.
                  </p>
                  <button
                    className="button"
                    onClick={() => setModal("account")}
                  >
                    Crear mi primera cuenta
                  </button>
                </>
              ))}
            {modal === "budget" && (
              <ActionForm
                submit="Crear presupuesto"
                onSubmit={async (data) => {
                  await api("budgets", "POST", {
                    ...data,
                    month: data.month + "-01",
                  });
                  await save();
                }}
              >
                <Field
                  label="Categoría"
                  name="category"
                  maxLength={60}
                  required
                />
                <Field
                  label="Mes"
                  name="month"
                  type="month"
                  defaultValue={firstOfMonth().slice(0, 7)}
                  required
                />
                <Currency />
                <Field
                  label="Límite mensual"
                  name="amount"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  required
                />
              </ActionForm>
            )}
            {modal === "goal" && (
              <ActionForm
                submit="Crear meta"
                onSubmit={async (data) => {
                  await api("goals", "POST", data);
                  await save();
                }}
              >
                <Field
                  label="Nombre de la meta"
                  name="name"
                  maxLength={100}
                  required
                />
                <Currency />
                <Field
                  label="Importe objetivo"
                  name="target_amount"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  required
                />
                <Field
                  label="Fecha objetivo"
                  name="target_date"
                  type="date"
                  required
                />
              </ActionForm>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Currency() {
  return (
    <Select label="Moneda" name="currency">
      <option>DOP</option>
      <option>USD</option>
    </Select>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <span className="empty-mark">↗</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function Metric({
  title,
  value,
  currency,
  featured,
  icon,
}: {
  title: string;
  value?: string;
  currency: string;
  featured?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <article className={`metric ${featured ? "featured" : ""}`}>
      <div>
        <span>{title}</span>
        {icon}
      </div>
      <strong>{value === undefined ? "…" : money(value, currency)}</strong>
      <small>{currency} · Según tus registros</small>
    </article>
  );
}
function TransactionList({
  rows,
  accounts,
  actions,
}: {
  rows: Transaction[];
  accounts: Account[];
  actions?: (t: Transaction) => React.ReactNode;
}) {
  return rows.length ? (
    <div className="transaction-list">
      {rows.map((tx) => {
        const a = accounts.find((a) => a.id === tx.account_id);
        return (
          <article className="transaction-row" key={tx.id}>
            <span className={`tx-icon ${tx.kind}`}>
              {tx.kind === "income" ? (
                <ArrowDownLeft size={18} />
              ) : tx.kind === "expense" ? (
                <ArrowUpRight size={18} />
              ) : (
                <ArrowLeftRight size={18} />
              )}
            </span>
            <div className="tx-description">
              <strong>{tx.description}</strong>
              <span>
                {tx.category} · {a?.name || "Cuenta"}
                <small>
                  {tx.occurred_on} ·{" "}
                  {tx.source === "manual"
                    ? "Manual"
                    : tx.source === "gmail"
                      ? "Gmail"
                      : "PDF"}
                </small>
              </span>
            </div>
            <div className="tx-amount">
              <strong>
                {tx.kind === "expense" ? "−" : tx.kind === "income" ? "+" : ""}
                {money(tx.amount, a?.currency)}
              </strong>
              {actions?.(tx)}
            </div>
          </article>
        );
      })}
    </div>
  ) : (
    <Empty
      title="Todavía no hay movimientos"
      text="Los movimientos que registres en este período aparecerán aquí."
    />
  );
}
function BudgetList({
  rows,
  transactions,
  accounts,
}: {
  rows: Budget[];
  transactions: Transaction[];
  accounts: Account[];
}) {
  return rows.length ? (
    <div className="progress-list">
      {rows.map((b) => {
        const amount = sumMoney(
          transactions
            .filter(
              (t) =>
                t.kind === "expense" &&
                t.category === b.category &&
                t.occurred_on.slice(0, 7) === b.month.slice(0, 7) &&
                accounts.find((a) => a.id === t.account_id)?.currency ===
                  b.currency,
            )
            .map((t) => t.amount),
        );
        return (
          <article key={b.id}>
            <div>
              <strong>{b.category}</strong>
              <span>{b.month.slice(0, 7)}</span>
            </div>
            <progress
              aria-label={`Consumo de ${b.category}`}
              max={Number(b.amount)}
              value={Number(amount)}
            />
            <p>
              {money(amount, b.currency)}{" "}
              <span>de {money(b.amount, b.currency)}</span>
            </p>
            {Number(amount) > Number(b.amount) && (
              <small className="danger">Superaste el límite del mes.</small>
            )}
          </article>
        );
      })}
    </div>
  ) : (
    <Empty
      title="Tu plan empieza con un límite"
      text="Crea un presupuesto mensual para una categoría de gastos."
    />
  );
}
function GoalList({
  goals,
  contributions,
}: {
  goals: Goal[];
  contributions: Contribution[];
}) {
  return goals.length ? (
    <div className="progress-list">
      {goals.map((g) => {
        const total = sumMoney(
          contributions.filter((c) => c.goal_id === g.id).map((c) => c.amount),
        );
        return (
          <article key={g.id}>
            <div>
              <strong>{g.name}</strong>
              <span>{g.target_date}</span>
            </div>
            <progress
              aria-label={`Progreso de ${g.name}`}
              max={Number(g.target_amount)}
              value={Number(total)}
            />
            <p>
              {money(total, g.currency)}{" "}
              <span>de {money(g.target_amount, g.currency)}</span>
            </p>
          </article>
        );
      })}
    </div>
  ) : (
    <Empty
      title="¿Qué quieres construir?"
      text="Define una meta y registra tus aportaciones para seguir su progreso."
    />
  );
}
function Onboarding({ me, onDone }: { me: Me; onDone: () => Promise<void> }) {
  const [template, setTemplate] = useState("basic");
  return (
    <>
      <header className="public-header">
        <Brand />
        <button
          className="text-button"
          onClick={async () => {
            await api("auth/logout", "POST", {});
            window.location.assign("/auth");
          }}
        >
          Cerrar sesión
        </button>
      </header>
      <main id="contenido" className="center-page onboarding">
        <p className="eyebrow">
          BIENVENIDO, {me.profile?.first_name || "A OWL"} · TU PRUEBA YA COMENZÓ
        </p>
        <h1>
          Un espacio que
          <br />
          se parece a ti.
        </h1>
        <p className="muted">
          Elige tu punto de partida. Puedes cambiarlo sin perder tus datos.
        </p>
        <div className="template-grid">
          {[
            ["basic", "Básica", "Ingresos, gastos y balance."],
            ["budget", "Presupuesto", "Un plan mensual por categoría."],
            ["saving", "Ahorro", "Objetivos y aportaciones."],
          ].map(([value, title, description]) => (
            <button
              className={`choice ${template === value ? "selected" : ""}`}
              aria-pressed={template === value}
              key={value}
              onClick={() => setTemplate(value)}
            >
              <h2>{title}</h2>
              <p>{description}</p>
            </button>
          ))}
        </div>
        <section className="panel">
          <h2>¿Cómo quieres comenzar?</h2>
          <p className="muted">
            El registro manual está disponible. Gmail y PDF requieren
            configuración y validación de formatos bancarios.
          </p>
          <ActionForm
            submit="Entrar a mi espacio"
            onSubmit={async () => {
              await api("onboarding", "PUT", { template, methods: ["manual"] });
              await onDone();
            }}
          >
            <label className="checkbox">
              <input type="checkbox" checked readOnly /> Registro manual · sin
              conexiones obligatorias
            </label>
          </ActionForm>
        </section>
      </main>
    </>
  );
}
