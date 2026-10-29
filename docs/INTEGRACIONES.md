# Integraciones y configuración

## Supabase

Backend: `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `apps/api/.env`. No usar service-role ni contraseña PostgreSQL para ejecutar la app. Las migraciones se aplican por CLI o SQL Editor privado, tras revisión; ninguna migración se ha aplicado a un proyecto remoto en esta entrega.

Local: instalar Docker Desktop y Supabase CLI según la documentación oficial, ejecutar `supabase start` desde la raíz y `supabase migration up --local`. El correo local se consulta en `http://localhost:54324`. Usar las claves emitidas por esa instancia; no publicarlas en capturas ni commits.

Hosted: configurar confirmación de email obligatoria, OTP de seis dígitos, caducidad de 600 segundos y envío máximo cada 60 segundos. Las plantillas de confirmación y recuperación deben incluir `{{ .Token }}`; el contenido local está en `supabase/templates`. SMTP público, cuotas y URLs requieren revisión antes de pruebas con destinatarios reales.

Asignación inicial de administrador: mediante SQL privado por el titular del proyecto, insertar el UUID del usuario ya verificado en `public.admin_roles`. `support` gestiona citas y consulta trials; `operator` además extiende trials y lee auditoría; `owner` además cambia la duración inicial. No hay formulario para conceder privilegios.

## Gmail

No habilitado. No se accede a sesiones personales de Brave ni se presume acceso por estar autenticado en Google Cloud. Las herramientas disponibles incluyen Playwright, pero no una conexión Supabase/Cloud específica suficiente para obtener configuración automáticamente.

Se debe crear o seleccionar un cliente OAuth web, registrar redirect exacto, consent screen y usuarios de prueba sin habilitar facturación. `gmail.readonly` es restringido; una app pública puede requerir verificación y evaluación adicionales. Usar la menor búsqueda necesaria, tokens cifrados en servidor y revocación. No hay consentimiento simulado ni correos procesados.

## Estados bancarios

No hay muestras Qik/Popular en el contexto disponible. Un reporte OWL no sirve para validar un extractor bancario. Se requieren formatos con fechas, columnas, moneda, productos y casos ambiguos; solo fixtures sintéticos deben entrar en Git. Ningún documento privado se ha copiado al repositorio.

## Validación pendiente contra proveedor

Registro → correo OTP real → verificación → login → trigger del trial → RLS PostgREST → onboarding → cuenta → ingreso/gasto/transferencia → exportación → cierre/renovación de sesión. El código está preparado para ese flujo, pero las pruebas sintéticas no lo certifican con un proyecto Supabase.
