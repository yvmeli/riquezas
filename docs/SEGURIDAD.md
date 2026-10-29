# Seguridad y privacidad

## Controles implementados

- RLS en todas las tablas públicas de aplicación; grants explícitos y funciones de escritura con mínimo privilegio.
- FK compuestas vinculan cuentas, movimientos, metas y aportaciones al mismo usuario. Los administradores no obtienen una política de lectura de finanzas ajenas.
- Auth validado en servidor con Supabase `/auth/v1/user`. Tokens en cookies HttpOnly, SameSite Lax, Secure configurable. En HTTPS debe ser `COOKIE_SECURE=true`.
- Cambios requieren Origin autorizado en proxy y backend. El proxy no acepta rutas arbitrarias ni reenvía encabezados de autorización externos.
- Validación Pydantic sin devolver contraseñas ni entradas originales en errores; errores de proveedor sanitizados; contraseñas conservan espacios intencionales.
- Límites por email para OTP, reenvío, login y recuperación, y por ruta/IP en desarrollo. Citas tienen cuota persistente por email en SQL con bloqueo transaccional.
- Sin escrituras directas a movimientos; transferencias atómicas, idempotencia y auditoría de cambios manuales, trials, citas y configuración.
- CSP, bloqueo de frames, nosniff, política de referrer, sin analítica ni dependencias de fuentes remotas.
- Respuestas API `no-store`; PWA con allowlist de recursos públicos, sin caché de datos financieros, tokens, páginas privadas o RSC.
- Exportación y eliminación de datos financieros propias, incluidas tras vencimiento de trial. No hay credenciales bancarias.

## Tratamiento y retención

Solo se guardan datos del perfil, solicitudes y registros necesarios para las funciones solicitadas. La eliminación financiera mantiene identidad/trial/auditoría mínima; no equivale a eliminar la identidad Auth. No se guardan correos ni documentos bancarios en este corte. Cualquier pipeline futuro debe implementar revocación y eliminación de tokens antes de habilitarlo.

El responsable debe aprobar política legal, canal de atención, jurisdicción y plazo de conservación de citas/auditoría/backups antes de abrir al público. No se garantiza eliminación inmediata de respaldos del proveedor.

## Antes de producción

Configurar HTTPS/cookies Secure, RLS y SMTP reales; rate limiter compartido y protección antiabuso de citas; límites de cuerpo en el gateway de FastAPI; observabilidad sin PII; auditoría independiente; backups y prueba de restauración. Las sesiones JWT ya emitidas pueden seguir siendo válidas hasta su expiración tras logout según comportamiento de Supabase; validar la política deseada antes de producción.

No se han modificado permisos de nube ni roles de un proyecto remoto. La migración concede permisos al aplicarse: debe revisarse contra un entorno de desarrollo antes de cualquier cambio remoto.

Los módulos preparatorios de ingestión no tienen endpoints públicos. Rechazan PDF cifrados, grandes, con demasiadas páginas o contenido activo, y limitan MIME. Estas validaciones no sustituyen aislamiento y límites del proceso: antes de habilitar cargas se requiere worker dedicado. No se confía en Authentication-Results de archivos subidos ni se borran coincidencias ambiguas de transacciones automáticamente.
