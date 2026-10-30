# Integraciones y configuración

## Supabase

Backend: `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `apps/api/.env`. No usar service-role ni contraseña PostgreSQL para ejecutar la app. Las migraciones se aplican por CLI o SQL Editor privado, tras revisión; ninguna migración se ha aplicado a un proyecto remoto en esta entrega.

Actualización 29/10/2026: URL real configurada en el archivo local. El frontend tiene `apps/web/.env.local` con los nombres existentes `API_URL`, `PUBLIC_ORIGIN` y `PORTAL_MODE`. El backend usa una ruta de configuración estable. `SUPABASE_ANON_KEY` admite la clave publishable compatible y rechaza secret/service-role sin imprimirla en errores; sigue vacío mientras se obtiene acceso autorizado. `TOKEN_ENCRYPTION_KEY` se generó localmente, sin publicarlo.

El proyecto responde por HTTPS, pero devuelve 401 sin clave. No equivale a login, migración o persistencia. El plugin Supabase fue localizado y sugerido; falta confirmar su vinculación. Browser no encontró sesiones, por lo que la sesión de Brave no se presume accesible.

El Project Reference ID conocido es `lwhpwbyfyrxojpbcuyex`. La cadena PostgreSQL y el host de pooler deben obtenerse del proyecto conectado; no se inventaron ni se confundió la contraseña de la cuenta con la de la base. No son necesarios para el backend REST actual.

Antes de migrar, ejecutar la inspección de solo lectura `supabase/preflight.sql` y revisar historial/conflictos. La versión inicial limita grants/revokes a objetos OWL. Si ya se aplicó, no se repetirá ciegamente: se revisará el estado y se preparará una actualización compatible.

La migración adicional prepara conexiones e importaciones con RLS y credenciales cifradas fuera del esquema expuesto. Storage todavía no tiene bucket configurado desde esta sesión: no existe endpoint que guarde documentos y no se creará un depósito público como sustituto de una importación validada.

Local: instalar Docker Desktop y Supabase CLI según la documentación oficial, ejecutar `supabase start` desde la raíz y `supabase migration up --local`. El correo local se consulta en `http://localhost:54324`. Usar las claves emitidas por esa instancia; no publicarlas en capturas ni commits.

Hosted: configurar confirmación de email obligatoria, OTP de seis dígitos, caducidad de 600 segundos y envío máximo cada 60 segundos. Las plantillas de confirmación y recuperación deben incluir `{{ .Token }}`; el contenido local está en `supabase/templates`. SMTP público, cuotas y URLs requieren revisión antes de pruebas con destinatarios reales.

El SMTP incluido solo admite destinatarios preautorizados del equipo y tiene cuota reducida; otros correos necesitan SMTP propio. Se comprobará antes de enviar el primer OTP, sin desactivar confirmaciones. Fuente: [SMTP oficial](https://supabase.com/docs/guides/auth/auth-smtp).

Asignación inicial de administrador: mediante SQL privado por el titular del proyecto, insertar el UUID del usuario ya verificado en `public.admin_roles`. `support` gestiona citas y consulta trials; `operator` además extiende trials y lee auditoría; `owner` además cambia la duración inicial. No hay formulario para conceder privilegios.

## Gmail

No habilitado. No se accede a sesiones personales de Brave ni se presume acceso por estar autenticado en Google Cloud. Las herramientas disponibles incluyen Playwright, pero no una conexión Supabase/Cloud específica suficiente para obtener configuración automáticamente.

La consulta de pestañas del MCP Playwright no respondió dentro de su tiempo límite. Las pruebas locales usan Playwright instalado en el proyecto y Chromium; no comparten ni acreditan la sesión personal de Brave.

Se debe crear o seleccionar un cliente OAuth web, registrar redirect exacto, consent screen y usuarios de prueba sin habilitar facturación. `gmail.readonly` es restringido; una app pública puede requerir verificación y evaluación adicionales. Usar la menor búsqueda necesaria, tokens cifrados en servidor y revocación. No hay consentimiento simulado ni correos procesados.

## Estados bancarios

No hay muestras Qik/Popular en el contexto disponible. Un reporte OWL no sirve para validar un extractor bancario. Se requieren formatos con fechas, columnas, moneda, productos y casos ambiguos; solo fixtures sintéticos deben entrar en Git. Ningún documento privado se ha copiado al repositorio.

## Validación pendiente contra proveedor

Los servicios internos `owl.ingestion` ya permiten extraer texto PDF, leer MIME y evaluar conciliación/reversos con evidencia mínima. Los adaptadores Qik/Popular rechazan toda entrada hasta validar formatos. No se expone aún una carga PDF: falta worker con límites de ejecución, borrador persistente corregible y confirmación atómica. Los encabezados Authentication-Results de un EML subido no se consideran confiables; su evaluación requiere transporte Gmail real y no certifica por sí sola el contenido.

El runner `scripts/live_e2e.mjs` no utiliza mocks ni OTP ficticios. Exige diagnóstico real con clave pública y `mailer_autoconfirm=false`; guarda credenciales/resultados solo en `.local` y espera el código recibido sin acceder a la bandeja. Está preparado y comprobado sintácticamente, pendiente de ejecución real. Ningún usuario público se convierte automáticamente en administrador: ese paso requiere UUID verificado y aprobación explícita del rol.

Registro → correo OTP real → verificación → login → trigger del trial → RLS PostgREST → onboarding → cuenta → ingreso/gasto/transferencia → exportación → cierre/renovación de sesión. El código está preparado para ese flujo, pero las pruebas sintéticas no lo certifican con un proyecto Supabase.
