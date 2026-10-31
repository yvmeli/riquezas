# OWL · Our Wealth Latam

MVP de finanzas personales para República Dominicana. Desarrollo exclusivo en `mvp`.

La aplicación tiene backend y esquema persistente Supabase; **no trae datos simulados en el producto**. Supabase está conectado y las dos migraciones están aplicadas. La solicitud de cita ya se comprobó con persistencia real. El registro por código OTP está pendiente de configurar SMTP y su plantilla; Gmail y PDF bancario siguen pendientes. El MVP integral sigue en desarrollo: [progreso](docs/PROGRESO.md).

## Requisitos

Node.js 22+ y Python 3.12+. Supabase local (CLI + Docker) o proyecto de desarrollo autorizado, con las migraciones aplicadas y email OTP habilitado. Las pruebas unitarias/PostgreSQL embebido no requieren nube.

## Instalar (PowerShell)

```powershell
npm.cmd ci
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r apps/api/requirements.lock
.\.venv\Scripts\python.exe -m pip install --no-deps -e apps/api
if (-not (Test-Path apps/api/.env)) { Copy-Item .env.example apps/api/.env }
```

Editar `apps/api/.env` localmente: `SUPABASE_URL`, `SUPABASE_ANON_KEY`; mantener `FRONTEND_ORIGIN=http://localhost:3000` y `ADMIN_ORIGIN=http://localhost:3001`. No pegar credenciales en el chat ni confirmarlas en Git.

Para Supabase local, desde la raíz:

```powershell
supabase start
supabase migration up --local
```

Usar las claves de esa instancia. Buzón OTP local: `http://localhost:54324`. Para proyectos hosted, revisar [integraciones](docs/INTEGRACIONES.md), configurar plantillas de OTP y aplicar migración exclusivamente en el proyecto de desarrollo aprobado.

## Ejecutar

Terminal API (la configuración se carga siempre desde `apps/api/.env`, independientemente del directorio actual):

```powershell
cd apps/api
..\..\.venv\Scripts\python.exe -m uvicorn owl.main:app --host 127.0.0.1 --port 8000
```

Terminal web, desde la raíz:

```powershell
npm.cmd run dev
```

Abrir **http://localhost:3000**. Usar `localhost` en el navegador: los orígenes permitidos son exactos. FastAPI permanece en loopback; Next.js actúa como proxy del mismo origen. Sin Supabase configurado se muestra un error explícito, no una sesión ni registros ficticios.

Producción local / prueba PWA:

```powershell
npm.cmd run build
npm.cmd run start --workspace apps/web
```

Administración, en otra terminal tras compilar:

```powershell
npm.cmd run start:admin
```

Abrir **http://localhost:3001**. Requiere una cuenta verificada y rol asignado de forma privada en `admin_roles`. La instancia cliente oculta `/admin`; las comprobaciones RBAC siguen siendo obligatorias en API y SQL. No expone automáticamente estos servicios a Internet.

## Pruebas

```powershell
.\.venv\Scripts\python.exe -m pytest apps/api -q
npm.cmd run test:db
npm.cmd run test:money
npm.cmd run typecheck
npm.cmd run build
# Con API y frontend de producción local iniciados:
npm.cmd run test:e2e
```

Si Chromium falta: `npx.cmd playwright install chromium`. Playwright usa fixtures sintéticos de proveedor para el flujo financiero y comprueba por separado la respuesta real de API sin configurar. No demuestra envío SMTP ni operación con un proyecto Supabase real. PostgreSQL embebido ejecuta las políticas y funciones reales sobre un esquema Auth sintético.

## Documentación

- [Arquitectura](docs/ARQUITECTURA.md)
- [Plan](docs/PLAN_IMPLEMENTACION.md)
- [Progreso y límites](docs/PROGRESO.md)
- [Integraciones](docs/INTEGRACIONES.md)
- [Seguridad](docs/SEGURIDAD.md)
- [Decisiones técnicas](docs/DECISIONES_TECNICAS.md)

Sin pasarelas de pago, facturación habilitada ni despliegues públicos. Documentos bancarios, contactos del contexto, secretos y archivos `.env` quedan fuera de Git.

## Integración hosted y primera prueba real

Proyecto autorizado: `lwhpwbyfyrxojpbcuyex`, URL `https://lwhpwbyfyrxojpbcuyex.supabase.co`. La aplicación usa PostgREST con el JWT del usuario; no necesita service-role ni contraseña PostgreSQL. El acceso para migraciones es independiente.

`scripts/configure_local.py` configura los valores locales conocidos y genera la clave de cifrado solo si falta, conservando credenciales existentes. `scripts/check_supabase.py` comprueba HTTPS/Auth sin mostrar claves ni datos personales y guarda un diagnóstico ignorado en `.local`.

Antes de migrar, inspeccionar `supabase/preflight.sql` y el historial real. No repetir la migración inicial si ya está aplicada o existen nombres en conflicto. La migración adicional prepara los dominios de ingestión sin habilitar parsers ni conexiones.

Con Supabase configurado, OTP real habilitado y los tres servidores iniciados:

```powershell
.\.venv\Scripts\python.exe scripts/check_supabase.py
node scripts/live_e2e.mjs --email <correo-de-prueba-autorizado>
```

El runner no usa mocks. Comprueba `.local/auth-config-check.json`, registrado tras inspeccionar SMTP y la plantilla en la consola: no inicia un registro si todavía se envía un enlace de confirmación. Una vez verificado el envío por código, guarda la contraseña generada solo en `.local/live-*/account.env` y se detiene en `waiting_real_signup_otp` hasta recibir el código en `signup-otp.txt`, sin acceder a bandejas. Comprueba trial, onboarding, registros, cálculos, logout/relogin y persistencia; la validación administrativa y con segundo usuario queda separada.

El recorrido completo con OTP **todavía no se ha ejecutado**: en el plan Free del proyecto, personalizar la plantilla requiere SMTP propio o Pro. La configuración local segura de envío está preparada en `.local/smtp.env`; sus credenciales no se comparten por chat ni se publican. No se habilitó facturación.

La prueba independiente `node scripts/live_appointment.mjs --email <correo-autorizado>` utiliza la interfaz y el proveedor reales y guarda evidencia solo en `.local`. Crea una solicitud sintética pendiente, sin reservar el horario ni crear un usuario financiero; ejecutar solo cuando se quiera crear una nueva solicitud, respetando la cuota diaria.
