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
