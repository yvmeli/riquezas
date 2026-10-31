# Invitaciones y acceso por código

Solo `owner` puede gestionar usuarios e invitaciones. `admin_roles` es la fuente de autorización, no los metadatos editables de Auth. La identidad del titular existente recibió `owner` por SQL privilegiado y con un evento `admin_role_granted`, a petición expresa. No existe un endpoint público de promoción.

La migración `202610310001` añade `user_invitations` y `user_access`. Antes de aplicarla se ejecutaron pruebas de aislamiento. Añade una política restrictiva de usuario activo que compone con las políticas previas de propiedad y roles; las funciones `admin_has` y `trial_active` también comprueban ese estado. El propio administrador no puede desactivar su acceso. No se eliminan perfiles ni registros financieros.

## Flujo

1. El propietario introduce correo y rol en **Usuarios e invitaciones**. OWL crea una invitación pendiente de 7 días y solicita su entrega a Supabase Auth.
2. Supabase genera el enlace/OTP de uso único y lo envía mediante el SMTP configurado. No se utiliza service-role para este flujo. La prueba de correo nunca se guarda en OWL.
3. El enlace lleva al formulario de invitación. La prueba está en el fragmento del URL; el navegador lo elimina antes de llamar al backend. No se envía en el URL HTTP ni se guarda en informes.
4. El backend verifica la prueba con Auth. PostgreSQL exige que el correo confirmado de la sesión coincida con el destinatario, incluso si el visitante ya tenía sesión.
5. La aceptación explícita de términos consume la invitación atómicamente, inicializa perfil/trial solo si faltan y asigna el rol persistido. No reinicia trials existentes. Una invitación de cliente no elimina un rol administrativo previo.
6. El usuario se dirige al portal de cliente o al origen administrativo configurado. No se toma una URL arbitraria del navegador.

Se pueden consultar estados pendiente/aceptada/vencida/revocada, reenviar y revocar. El reenvío tiene espera de 60 segundos y registra auditoría; los errores de entrega quedan visibles como `failed`. Las invitaciones administrativas y de clientes tienen roles separados. El registro público de clientes permanece disponible.

## OTP de acceso

El login ofrece contraseña y **Entrar con código por correo**. La solicitud pública usa `create_user=false`: no registra silenciosamente una cuenta. Solo el envío de una invitación autorizada puede pedir a Auth crear la identidad invitada. Caducidad de 600 segundos, límites por correo/ruta y verificación de 6–10 dígitos (el proveedor actual emite 8).

El logout normal utiliza `scope=local`, para conservar otras sesiones. El cambio de contraseña sigue revocando sesiones globalmente. Los errores de sesión inválida se normalizan para que la interfaz renueve o vuelva al login.

MFA todavía no está implementado ni exigido. Antes de producción debe evaluarse TOTP y una sesión AAL2 para asignación de roles, invitaciones administrativas y otras acciones privilegiadas, manteniendo el OTP solicitado como método de entrada.

## Evidencia y límites

Comprobados realmente: rol principal auditado, API administrativa y panel con Supabase, listado de usuarios, migración con RLS, login por OTP por HTTPS/ngrok, cookies Secure/HttpOnly, navegación móvil de siete secciones, recarga y logout. Las pruebas PostgreSQL verifican receptor incorrecto, elevación directa denegada, aceptación única, vencimiento, revocación y desactivación. Las pruebas de UI de aceptación usan fixtures sintéticos.

La entrega/aceptación de una invitación real a una identidad nueva sigue pendiente de un segundo correo autorizado. El intento desde una sesión invalidada fue rechazado antes de crear la invitación. No se cuenta como un envío exitoso.

Referencia técnica: [plantillas de Supabase](https://supabase.com/docs/guides/auth/auth-email-templates), [OTP sin creación automática](https://supabase.com/docs/reference/javascript/auth-signinwithotp).
