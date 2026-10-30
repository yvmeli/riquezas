# Progreso OWL

## Reanudación — 28 de octubre de 2026

Se confirmó rama `mvp`, remoto `yvmeli/riquezas`, commit inicial `0577191` y archivos sin confirmar de la sesión interrumpida. No había documentación previa ni instalación completa. Se preservaron los modelos, configuración y migración y se continuó sobre ellos. `main` y `sketch` permanecen intactas.

## Implementado y probado en este corte

- Monorepo Next.js/TypeScript/Tailwind + FastAPI/Pydantic + esquema Supabase.
- Landing OWL con identidad del contexto, FAQ, elección de inicio y solicitud de cita pendiente de confirmación.
- Rutas y formularios de registro, OTP, reenvío, login, recuperación, cambio de contraseña, refresh y logout. Cookies HttpOnly. Validación externa real pendiente.
- Trigger PostgreSQL de perfil y trial tras verificación; configuración inicial de 14 días y extensión con rol/auditoría. Restricciones RLS al expirar.
- Onboarding de plantilla sin pérdida de registros y método manual disponible.
- Cuentas DOP/USD, tarjetas con deuda inicial negativa, ingresos/gastos/transferencias, edición/eliminación manual, reclasificación y filtros.
- Dashboard con aritmética decimal, períodos, cuentas, instituciones, categorías, evolución y estados vacíos. No hay datos precargados en el producto.
- Presupuestos por mes/categoría/moneda, metas y aportaciones; progreso calculado desde registros.
- Portal administrativo separado por modo/origen: RBAC, citas, trials, duración inicial y auditoría. No concede acceso general a finanzas privadas.
- Exportación JSON y eliminación financiera; no eliminación de identidad Auth.
- Manifest, iconos OWL, service worker con caché pública limitada, modo oscuro, conectividad e instrucciones de instalación.

## Evidencia de calidad

- Producción Next.js: compilación aprobada.
- Python: 71 pruebas aprobadas (API con proveedor simulado, gateway, modelos, cálculos exactos e ingestión preparatoria).
- PostgreSQL embebido: 14 pruebas aprobadas sobre la migración real: trigger, RLS, acceso cruzado, transferencias, idempotencia, trial, roles y eliminación.
- Formato monetario TypeScript: 4 pruebas aprobadas para centavos exactos, límites grandes, signos y sumas de aportaciones.
- Playwright: 25 escenarios aprobados; incluye 320, 375, 390, 430, 768, 1024 y 1440 px, administración en origen independiente y foco de teclado. El runner cerró correctamente en Windows al ejecutarse fuera del entorno restringido.
- Capturas locales de landing/portal inspeccionadas. Se usan datos sintéticos exclusivamente en pruebas; capturas quedan ignoradas en `.local`.

## Pendiente / no certificado

El MVP integral no está terminado. Falta configuración y smoke test de Supabase Auth/OTP/SMTP/PostgREST reales; no hay Docker/CLI Supabase en PATH ni claves de proyecto configuradas. PGlite valida PostgreSQL, no los servicios de Supabase.

Gmail OAuth, sincronización y extractores, reversos bancarios, importación PDF con preview/conciliación y administración de esos procesos siguen pendientes. El contexto no incluye estados bancarios ni correos Qik/Popular. La UI los identifica como pendientes y no simula conexiones.

Falta verificar instalación en iOS/Android físicos, accesibilidad completa por teclado, endurecimiento para producción y políticas legales antes de apertura pública. No se desplegó ningún servicio ni se crearon recursos pagos.

## Siguiente paso

Configurar Supabase localmente y ejecutar el smoke test real. La certificación de extractores específicos necesita muestras verificables privadas; conectar un proyecto real requiere configuración local segura, no credenciales por chat.

## Segundo avance — ingestión preparatoria

El primer corte se publicó como `d1694ad` en `origin/mvp`. Después se añadieron módulos internos para extracción de texto PDF con validación de tamaño/páginas/cifrado/contenido activo; lectura MIME/HTML/alternativas/mensajes anidados; evidencia de remitente sobre transporte Gmail de confianza; conciliación por clave de fuente o referencia verificada; y asociación conservadora de reversos. Se probaron con PDF generados en memoria y mensajes sintéticos, sin archivos bancarios privados.

Estos módulos **no constituyen una integración bancaria habilitada**. No existe endpoint de carga ni conexión Gmail activa; ambos adaptadores rechazan formatos no verificados. Las coincidencias sin referencia verificable quedan como posibles duplicados, para evitar borrar compras legítimas del mismo día. El parser PDF deberá ejecutarse en un worker con límites antes de exponer uploads.

Se dejó el código frontend formateado para revisión y mantenimiento. Los diálogos financieros conservan el foco por teclado y lo devuelven al botón de origen al cerrarse. El formato monetario usa BigInt y partes de Intl para conservar los centavos incluso en el límite de numeric(16,2); los tooltips conservan el importe exacto separado de la coordenada numérica de la gráfica. Las instalaciones anteriores interrumpidas terminaron y no hay un instalador pendiente.

Total del corte: 114 pruebas aprobadas, TypeScript y build de producción sin errores. Las advertencias de deprecación de librerías en las pruebas no afectan este resultado; su migración queda para mantenimiento. Antes de cada commit se revisó rama, diff y posibles secretos/documentos privados. El script `scripts/check_staged.py` permite repetir esta revisión sin imprimir valores sensibles.

## Integración real — 29 de octubre de 2026

Se retomó desde `8f17a4c`, con `mvp` limpio. `main` y `sketch` permanecen intactas.

### Comprobado realmente

- Configurados los archivos locales ignorados: URL del proyecto `lwhpwbyfyrxojpbcuyex`, orígenes cliente/admin, URL del backend y clave de cifrado generada sin imprimirla. La clave pública y las credenciales OAuth/PostgreSQL siguen pendientes de acceso autorizado.
- El endpoint Auth del proyecto respondió HTTP 401 a una consulta HTTPS sin clave: confirma conectividad, no autenticación ni tablas instaladas.
- Cliente, API y acceso administrativo respondieron HTTP 200 en localhost:3000, 8000 y 3001. Health informa correctamente `supabase_configured=false`.
- Auditoría de 168 objetos alcanzables del historial Git sin patrones de claves/tokens detectados. No sustituye una auditoría exhaustiva.
- Browser no encontró sesiones disponibles. No se reutilizó ni extrajo la sesión de Brave. Se encontró el plugin Supabase, todavía sin conexión confirmada, y se solicitó vincularlo al proyecto. Se solicitó también el correo para el OTP, sin acceso a la bandeja.

### Cambios implementados

- Configuración del backend por ruta estable `apps/api/.env`, independiente del directorio actual.
- Revisión previa de migración inicial: revocaciones limitadas a objetos OWL y trigger que no bloquea verificaciones ajenas sin consentimiento OWL.
- Migración aditiva para instituciones, categorías, conexiones, credenciales cifradas fuera del esquema expuesto, importaciones, borradores y sincronizaciones. RLS separa usuarios. Una conexión pendiente no puede activarse ni sincronizar sin OAuth validado.
- El catálogo privado recoge categorías de movimientos/presupuestos; la eliminación propia contempla nuevos dominios y exige revocar conexiones activas primero.
- Preparados diagnóstico HTTPS, auditoría histórica, preflight SQL y E2E opt-in real con pausa para OTP. El runner solo fue comprobado sintácticamente; no se atribuye una ejecución real inexistente.

### Pruebas y pendientes

74 pruebas Python, 19 PostgreSQL embebido, 4 de formato monetario y 25 Playwright con fixtures: 122 en total. Build de producción aprobado. Esta evidencia es distinta de validar Supabase hospedado. La configuración rechaza claves secret/service-role en el campo público y los errores no imprimen sus valores.

No se aplicó ninguna migración remota ni se creó un usuario real. No hay OTP enviado/verificado, trial remoto activado, persistencia remota comprobada ni administrador designado. Falta la vinculación autorizada al proyecto y el correo para la prueba. No se requiere la contraseña de la cuenta Supabase; una contraseña PostgreSQL solo se pedirá si resulta necesaria para una vía de migración directa.

Google Cloud se inspeccionará después del primer recorrido Supabase, conforme al orden solicitado. No se habilitó facturación ni se modificaron permisos externos o consentimientos Gmail. Los archivos de contexto siguen sin incluir muestras Qik/Popular: los PDF disponibles son materiales comerciales.
