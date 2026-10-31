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

## Estado recuperado y comprobado — 31 de octubre de 2026

Se reanudó tras la pausa explícita del usuario, conservando el cambio local de `.gitignore` que excluye `.playwright-mcp/` y todos los archivos privados de configuración. La rama sigue siendo `mvp`.

El último diagnóstico documentado anteriormente quedó superado antes de la pausa: Playwright MCP sí accedió al proyecto autorizado, la clave pública se guardó en el archivo local ignorado y las dos migraciones se aplicaron en transacción. En esta reanudación se comprobó de nuevo el historial real (`202610280001`, `202610290001`), las 17 tablas públicas y RLS habilitado en todas. No se volvieron a ejecutar las migraciones.

Los servidores estaban sin responder y se iniciaron en loopback (3000, 8000, 3001). Se conservó la configuración existente. No se creó una nueva instancia ni un recurso pago.

### Prueba real completada: solicitud de orientación

Se ejecutó la interfaz móvil contra el backend y Supabase reales, sin mocks. La API devolvió 201 y el identificador se cotejó por SQL con la fila persistida. Estado `requested`, modalidad `video` y `scheduled_at` vacío: no hubo reserva automática. Auth continuó con cero usuarios, por lo que la cita no creó una identidad financiera. Evidencia y captura privadas en `.local`; ningún dato de contacto se copió a Git.

### Auth configurado y requisito de SMTP

Se verificaron email habilitado y confirmación obligatoria. Se guardaron contraseña mínima de 12 caracteres y OTP con caducidad de 600 segundos. Se preservaron los 8 dígitos del proveedor. El Site URL es localhost:3000 y se añadieron por separado los redirects exactos localhost:3000/auth y localhost:3001/auth. Una entrada concatenada producida al rellenar el formulario se retiró y se verificó la lista final de dos URLs correctas.

La consola Free bloquea la edición de la plantilla hasta configurar SMTP propio o contratar Pro. La plantilla predeterminada contiene un enlace, no el OTP requerido por OWL. No se cambió de plan, no se desactivó la verificación y todavía no se envió ningún código. El usuario indicó el correo de prueba, que se conserva fuera de los archivos públicos. Se solicitó únicamente SMTP de envío y se preparó `.local/smtp.env` sin credenciales.

El runner real se reforzó para detenerse antes del registro si SMTP/plantilla no están comprobados; la comprobación produjo `smtp_setup_required`, sin crear credenciales locales ni usuarios remotos. Continúan pendientes registro/OTP, trial remoto, movimientos, dashboard, recuperación, segundo usuario y administrador verificado. Esto no se presenta como un flujo completo aprobado.

Se añadió `scripts/live_appointment.mjs`, ejecutado realmente, y se mantuvieron en curso los servidores. Google Cloud y los extractores siguen con las limitaciones ya documentadas.

### Regresión y acceso anónimo

La regresión terminó sin fallos: 74 pruebas Python, 19 PostgreSQL embebido, 4 de importes y 24 Playwright aprobadas; una prueba Playwright se omite deliberadamente porque exige Supabase sin configurar y ahora está conectado. Las pruebas con fixtures no certifican OTP real ni autorización entre dos usuarios remotos.

Se amplió y ejecutó `scripts/check_supabase.py` contra el proveedor real: las 16 tablas privadas rechazaron SELECT anónimo con HTTP 401; el catálogo público de instituciones respondió 200. Se consultó con `limit=0` y sin bearer de usuario ni clave privilegiada, sin obtener datos privados ni alterar registros. La primera consulta del catálogo utilizó una columna inexistente; se corrigió a `code`, según la migración, y la comprobación completa posterior fue satisfactoria. El diagnóstico devuelve error ante permisos/esquema inesperados y no imprime cuerpos de respuesta.

## Primer flujo financiero real y acceso manual — 31 de octubre de 2026

El titular configuró SMTP personalizado. Se comprobó habilitado y se sustituyó el enlace de confirmación por la plantilla OTP del repositorio. El titular confirmó la recepción y Supabase verificó el código real, sin desactivar confirmaciones ni modificar RLS. La plantilla de recuperación también quedó guardada con código y comprobada tras recargar la consola; su entrega y recorrido completos todavía no se certifican.

El ejecutor original esperaba un archivo de código. Ante la instrucción de no escribir OTP/credenciales, se reanudó con stdin sin eco y verificación real por Auth API. Esa sesión verificada permitió rotar la contraseña sintética del ensayo para continuar sin recuperar la contraseña anterior de memoria. No se usó service-role ni se creó una identidad verificada artificialmente. El runner queda actualizado para mantener siempre OTP y contraseña en memoria; informes/capturas locales no contienen esos secretos.

La ejecución real terminó con 15 comprobaciones aprobadas: OTP, cambio autenticado de contraseña sintética, login normal por UI, perfil confirmado, trial exacto de 14 días, onboarding de presupuesto, cuenta, ingreso/gasto, totales, logout, nuevo login, persistencia, rechazo de la cuenta cliente en administración (403) y otra cita pendiente. Ingresos RD$3,000.10, gastos RD$200.05, neto RD$2,800.05 y balance registrado RD$3,800.05 incluido el saldo inicial. Se consultó el backend autenticado después del nuevo login; no se usaron mocks. El readback SQL adicional no llegó a ejecutarse por un bloqueo de interacción del editor y no se cuenta como evidencia adicional.

Para la evaluación personal se verificaron por HTTP landing/auth/portal y servidor administrativo/backend. La ruta real de cliente sin sesión redirige a `/auth`; API privada devuelve 401 y `/admin` en el origen cliente devuelve 404. Se documentaron URLs y recuperación privada en `PRUEBA_MANUAL.md`. No se reinició ni reemplazó ninguno de los tres servidores durante esta evaluación. La cuenta de cliente no recibió ningún rol administrativo.

Pruebas de este corte: 78 Python y 5 de entrada OTP; 24 Playwright existentes aprobadas (una omisión esperada por Supabase configurado), más 3 nuevas aprobadas para navegación de los siete módulos a 390/1440 px y redirección real sin sesión. Los ensayos responsive de los siete anchos usan fixtures, distintos del flujo financiero real. Las 19 pruebas PostgreSQL embebido y 4 monetarias del corte previo no requirieron repetición: sus archivos no cambiaron.

Pendientes: recuperación completa y evaluación manual en Brave, administrador explícitamente autorizado, aislamiento entre dos usuarios autenticados, Gmail y PDF bancario verificados. No se habilitaron servicios públicos/pagos ni se modificaron políticas de seguridad. Se prioriza la evaluación del cliente antes de otras integraciones.
