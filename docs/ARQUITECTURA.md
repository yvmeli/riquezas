# Arquitectura OWL

Monorepositorio: `apps/web` (Next.js App Router, TypeScript, Tailwind 4), `apps/api` (FastAPI, Pydantic), `supabase` (PostgreSQL, Auth, migraciones), `tests` (PostgreSQL y Playwright).

El navegador llama rutas `/api` del mismo origen. El proxy Next.js valida el origen, limita cuerpos y reenvía cookies HttpOnly a FastAPI en loopback. FastAPI verifica la sesión con Supabase Auth y envía el JWT del usuario a PostgREST. PostgreSQL aplica RLS incluso si se accede directamente a su API. No se utiliza service role para las operaciones de usuario.

Las tres superficies son landing pública (`/`), cliente (`/portal`) y administración (proceso separado en `localhost:3001`). `PORTAL_MODE=admin` habilita administración; la instancia cliente responde 404 para `/admin` y sus rutas proxy. El backend comprueba RBAC independientemente de la URL.

## Dominios y modelo

- Auth: Supabase guarda credenciales, códigos, expiración y refresh tokens. OWL guarda perfil y consentimiento; el trigger de verificación crea perfil y trial una sola vez.
- Captación: `appointments` almacena solicitudes, modalidad, horario preferido, horario acordado y resultado. No crea identidades financieras.
- Finanzas: `accounts`, `transactions`, `budgets`, `goals`, `contributions`. Claves foráneas compuestas impiden relacionar objetos de otros usuarios.
- Comercial: `system_settings`, `trials`, `audit_events`; extensiones mediante función con RBAC y auditoría.
- Operaciones: `admin_roles` contiene `support`, `operator` y `owner`. Un usuario no puede asignarse roles.

## Dinero y consistencia

PostgreSQL `numeric(16,2)` y Python Decimal. El gateway conserva decimales JSON como cadenas; el frontend envía cadenas y agrega aportaciones en centavos enteros. Number solo se usa para formato y proporciones gráficas.

Una transferencia es un único registro con origen y destino; sus efectos opuestos se calculan en los balances. Solo se permiten cuentas del mismo usuario y moneda. Los pagos de tarjeta se registran como transferencias. Las compras con tarjeta son gastos; la deuda inicial se introduce negativa. No existe un campo de crédito disponible que pueda sumarse al patrimonio.

Las funciones financieras son atómicas, usan `search_path` vacío y no permiten escrituras directas a movimientos. La clave de idempotencia es única por usuario y fuente. Reutilizarla con contenido distinto se rechaza.

## Escala y límites actuales

El dashboard pagina los registros de PostgREST en bloques de 500 y agrega en Python. Antes de volúmenes grandes: agregación SQL con paginación estable, snapshots y consultas por rango. La exportación actual reúne datos en memoria. La limitación de solicitudes vive en un proceso de desarrollo; producción requiere control compartido en gateway. No hay workers bancarios activos ni servicios públicamente desplegados.

La PWA conserva solo cinco recursos públicos explícitos. HTML privado, respuestas RSC, API, tokens y registros financieros no se guardan en caché offline.
