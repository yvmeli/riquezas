# Plan de implementación

## Cortes funcionales

1. Base local y flujo manual: monorepo, esquema RLS, Auth/OTP, trial, captación, onboarding, gestión financiera, dashboard, administración limitada, PWA y pruebas. Implementado en código; proveedor Supabase real pendiente de configuración y smoke test.
2. Validación contra Supabase: ejecutar migraciones en instancia local o proyecto de desarrollo autorizado, configurar correo y probar OTP real, PostgREST, permisos y sesiones. No se detectó CLI Supabase ni Docker en PATH al retomar; no se encontraron credenciales locales del proyecto. Pendiente.
3. Gmail: OAuth con state/PKCE, tokens cifrados, revocación, transporte, cola persistente, MIME, extractores por formato verificado, errores, reintentos y worker sin solapamientos. Requiere credenciales Google y muestras verificables. Pendiente.
4. Documentos: extracción PDF aislada, validación de tamaño/páginas/cifrado, borrador corregible, confirmación atómica y conciliación con Gmail/manual. Qik y Popular requieren muestras de estados auténticos compartidas de forma privada. Pendiente.
5. Completar administración: extractores, instituciones y sincronizaciones reales; suspensión, eliminación completa de identidad y auditoría adicional. Pendiente.
6. Cierre: pruebas reales de proveedor, accesibilidad con teclado, auditoría de seguridad, retención y políticas aprobadas, instalación en dispositivos iOS/Android físicos y revisión de apertura. No desplegar sin autorización.

## Criterio de finalización

El código con mocks no acredita una integración externa operativa. El MVP integral no está terminado hasta probar el flujo de aceptación con Supabase y los documentos bancarios, y documentar la autorización de Google cuando corresponda. Los bloqueos externos no impiden desarrollar ni probar dominios independientes.
