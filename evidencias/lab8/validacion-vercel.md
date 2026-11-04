# Validación de UNA Chat en Vercel

Fecha de verificación: 2026-11-04, America/Costa_Rica.

- [Aplicación desplegada](https://una-chat-lab8.vercel.app/)
- [Despliegue de producción](https://vercel.com/kenneth-28eb/una-chat-lab8/DYmLKNYry4t9jfXCm4VkSfVHzZDW)

## Resultados

- El navegador carga la pantalla de acceso. El inicio de sesión con una cuenta real de Google vuelve a UNA Chat y muestra la identidad autenticada.
- Sin sesión, `/api/me` devuelve 401 y el servidor rechaza el WebSocket. Una solicitud al callback publicado con `error=access_denied` devolvió 400 y mostró el aviso de cancelación con la opción de reintentar.
- Tras establecer la conexión autenticada, Kenneth envió «prueba». El mensaje apareció en el chat con el nombre de su sesión.
- Se cerró la sesión desde UNA Chat y se confirmó la salida en Auth0. El navegador volvió a la pantalla de acceso y el perfil respondió `authentication_required`.
- Pasaron 150 pruebas y escenarios locales. La prueba con dos instancias y Redis verificó la recepción de mensajes y la revocación de la sesión al cerrar sesión.

Las capturas con datos de la cuenta se guardan localmente en la carpeta de evidencias. El .env local y los secretos de producción quedan fuera de Git.
