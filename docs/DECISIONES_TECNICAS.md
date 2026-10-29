# Decisiones técnicas

Fecha: 28 de octubre de 2026. Prevalece la instrucción maestra del MVP sobre las ofertas comerciales históricas.

1. Se conserva el repositorio original, exclusivamente `mvp`. El estado inicial era limpio y solo existía un README vacío. No se ejecutaron generadores ni automatizaciones históricas del contexto.
2. Se inventariaron 163 archivos y 51 documentos Markdown únicos del contexto. La identidad existente define verde profundo, marfil, lima y búho; se reutiliza esa identidad, sin contactos ni expedientes internos. El directorio original permanece intacto.
3. Los PDF encontrados son reportes comerciales y carruseles; no son estados Qik/Popular. Tampoco hay archivos EML/MSG ni remitentes Popular verificables. No se inventan adaptadores bancarios certificados ni saldos. Gmail/PDF se muestran pendientes.
4. El trial es de 14 días configurable para nuevas verificaciones. Las escrituras financieras se consideran premium en este corte; consulta, exportación y eliminación siguen disponibles tras vencimiento. Cambiar plantilla no borra registros.
5. La autenticación usa Supabase Auth mediante backend, con cookies HttpOnly. Se requieren OTP antes del primer login, y login explícito después de verificar. La recuperación verifica un código y permite establecer nueva contraseña.
6. Sin service-role en código frontend ni backend de operaciones financieras. Los roles iniciales deben asignarse mediante SQL administrativo revisado, fuera de la aplicación.
7. Administración se ejecuta en proceso/origen independiente. Ocultar rutas es una medida adicional; la autoridad sigue en PostgreSQL y FastAPI.
8. No se suman DOP y USD ni se inventan tasas de cambio. Las transferencias entre monedas distintas requieren una operación de cambio futura y se rechazan hoy.
9. PGlite ejecuta PostgreSQL real embebido para verificar migraciones y RLS sin Docker ni nube. Su esquema `auth` es sintético; no prueba GoTrue, SMTP ni PostgREST. Los flujos Playwright con proveedor sintético están rotulados como tales.
10. No se crea otro Site, repositorio, alojamiento ni proyecto de nube. Se aplican las pautas locales de diseño/QA de Sites según la instrucción del usuario de trabajar en este checkout.
11. Las condiciones de privacidad y términos describen desarrollo local; la identidad legal y soporte deben aprobarse antes de apertura pública. Los planes históricos USD100/250 no se convierten en precios de la aplicación.

Referencias técnicas consultadas: [Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route), [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [OTP Supabase](https://supabase.com/docs/guides/auth/auth-email-passwordless), [scopes Gmail](https://developers.google.com/workspace/gmail/api/auth/scopes), [PGlite](https://pglite.dev/docs/). Se consultó [Faro](https://faro.com.do/); su contenido accesible fue mínimo y Google Play no se pudo leer mediante la herramienta web. No se afirma una inspección visual completa de esas aplicaciones.
