# Prueba manual local

URLs verificadas en el equipo de desarrollo:

| Superficie | URL |
| --- | --- |
| Landing | http://localhost:3000/ |
| Autenticación cliente | http://localhost:3000/auth |
| Portal cliente | http://localhost:3000/portal |
| Autenticación administrativa | http://localhost:3001/auth?admin=1 |
| Portal administrativo | http://localhost:3001/admin |
| Salud del backend | http://127.0.0.1:8000/health |

Usar `localhost` de forma consistente en el navegador; las cookies y los orígenes autorizados dependen del host. Estas direcciones son del mismo equipo donde se ejecutan los servidores. No se habilitó acceso desde otros dispositivos de la red.

## Entrar con la cuenta de prueba

La cuenta del ensayo ya está verificada y conserva trial, onboarding y movimientos sintéticos en Supabase real. La contraseña temporal automatizada no se guardó. Para elegir una contraseña propia:

1. Abrir la autenticación del cliente en Brave y pulsar **Olvidé mi contraseña**.
2. Introducir el correo autorizado y solicitar el código.
3. Introducir el código directamente en OWL. No compartirlo por chat ni guardarlo en archivos.
4. Elegir una contraseña de al menos 12 caracteres e iniciar sesión normalmente.
5. Se abre `/portal`; al cerrar sesión y entrar otra vez los datos deben conservarse.

No solicitar nuevos códigos repetidamente: el último invalida al anterior y existen límites de envío. Una sesión de navegador incógnito es independiente de la sesión normal.

## Recorrido disponible

Usar la navegación del portal para abrir Resumen, Cuentas, Movimientos, Presupuestos, Metas, Configuración y Conexiones. Las secciones comparten `/portal`. Las cuentas, ingresos/gastos, presupuestos y objetivos trabajan con el backend real. Gmail y PDF muestran sus limitaciones y siguen pendientes de habilitación.

La cuenta sintética comienza con RD$1,000.00; el ensayo añadió RD$3,000.10 de ingresos y RD$200.05 de gastos. Antes de añadir nuevos datos, el neto es RD$2,800.05 y el balance registrado RD$3,800.05. Los filtros de fecha y moneda afectan a los resultados.

El portal administrativo exige un rol explícito del servidor. La cuenta de cliente no tiene ese rol y recibe acceso denegado. No se ha creado ni promovido automáticamente un administrador; la validación administrativa completa sigue pendiente.

Los servidores se mantienen ejecutándose durante la evaluación. La navegación se comprobó con emulación de escritorio/móvil; queda pendiente la evaluación personal en Brave y dispositivos físicos.
