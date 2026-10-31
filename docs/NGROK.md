# Desarrollo móvil con ngrok

El túnel existente apunta solo al frontend cliente en `http://localhost:3000`. El teléfono usa `/api/...` relativo al origen HTTPS; el proxy Next comunica con FastAPI por loopback. No hay que tunelizar 8000 ni 3001. El frontend no envía al teléfono a un backend `localhost`.

El error original era doble: el proxy comparaba Origin con un único `PUBLIC_ORIGIN` local y FastAPI solo admitía los dos orígenes locales. No era necesario añadir CORS abierto. Se añadieron listas explícitas de orígenes HTTPS exactos; no se aceptan comodines de dominio, rutas ni credenciales en el URL. El portal administrativo no hereda los orígenes extra del cliente.

## Cuando cambie el túnel

```powershell
.\.venv\Scripts\python.exe scripts/configure_tunnel.py --origin https://DOMINIO-AUTORIZADO.ngrok-free.app
```

El script conserva la configuración privada, elimina los orígenes temporales anteriores de ngrok y escribe `EXTRA_TRUSTED_ORIGINS`, `PUBLIC_CLIENT_ORIGIN` y `ADDITIONAL_PUBLIC_ORIGINS` en los archivos locales ignorados. Reiniciar los servidores para cargarla; no se modifican recursos remotos automáticamente.

En Supabase Auth agregar el origen exacto con `/auth` y una regla limitada a `/invitacion**` para sus identificadores dinámicos. El dominio de esa regla es literal; solo la ruta admite el sufijo. Retirar los redirects del túnel anterior. Conservar los redirects locales de cliente/administración.

En Google OAuth, cuando el cliente esté habilitado, registrar el origen HTTPS exacto y el callback exacto usado por la aplicación. Los URI de Google no admiten comodines; actualizar `GOOGLE_REDIRECT_URI` de forma coherente. No modificar la cuenta Google ni conceder acceso Gmail automáticamente.

El proxy añade `Secure` a cookies emitidas mediante un Origin HTTPS autorizado. Se mantienen HttpOnly, SameSite Lax y CSRF. Los cookies de localhost y del dominio ngrok son sesiones de navegador distintas. El administrador no se expone por el túnel del cliente. FastAPI `/docs` tampoco se publica a través del proxy.

## Comprobado realmente

HTTPS: landing y health 200; petición válida pero vacía 422 (superó correctamente la comprobación de origen); origen ajeno 403; ruta administrativa 404. Se completó un login con OTP real en navegador aislado a 390 px: sesión Secure/HttpOnly, redirect al dashboard, navegación de siete módulos, recarga y logout. El ensayo no usó mocks, no escribió códigos ni cambió la contraseña. La evaluación física en iOS/Android sigue correspondiendo al titular.

ngrok puede mostrar su aviso inicial en navegadores nuevos; el usuario debe continuar al sitio. Las pruebas automatizadas usan el encabezado de desarrollo `ngrok-skip-browser-warning`, sin desactivar protecciones de OWL.
