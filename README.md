# OWL · Our Wealth Latam

MVP de finanzas personales para República Dominicana. Desarrollo exclusivo en `mvp`.

La aplicación tiene backend y esquema persistente Supabase; **no trae datos simulados en el producto**. El flujo manual está implementado y probado por capas. Supabase debe configurarse para operar con cuentas reales. Gmail y PDF bancario todavía no están habilitados. El MVP integral sigue en desarrollo: [progreso](docs/PROGRESO.md).

## Requisitos

Node.js 22+ y Python 3.12+. Supabase local (CLI + Docker) o proyecto de desarrollo autorizado, con las migraciones aplicadas y email OTP habilitado. Las pruebas unitarias/PostgreSQL embebido no requieren nube.

## Instalar (PowerShell)

```powershell
npm.cmd ci
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e 'apps/api[test]'
Copy-Item .env.example apps/api/.env
```

Editar `apps/api/.env` localmente: `SUPABASE_URL`, `SUPABASE_ANON_KEY`; mantener `FRONTEND_ORIGIN=http://localhost:3000` y `ADMIN_ORIGIN=http://localhost:3001`. No pegar credenciales en el chat ni confirmarlas en Git.

Para Supabase local, desde la raíz:

```powershell
supabase start
supabase migration up --local
```

Usar las claves de esa instancia. Buzón OTP local: `http://localhost:54324`. Para proyectos hosted, revisar [integraciones](docs/INTEGRACIONES.md), configurar plantillas de OTP y aplicar migración exclusivamente en el proyecto de desarrollo aprobado.

## Ejecutar

Terminal API (la configuración `.env` se carga desde su directorio):

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
