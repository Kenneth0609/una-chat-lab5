# Validación automatizada local de Lab8

Fecha: 2026-10-28, America/Costa_Rica. Rama: feat/lab8-auth0.

## Resultados

| Comando | Resultado |
| --- | --- |
| npm test | 97 pruebas unitarias aprobadas |
| npm run test:integration | 28 pruebas de integración aprobadas |
| npm run test:auth | 7 pruebas de autenticación aprobadas |
| npm run test:bdd con PORT=3212 | 2 escenarios y 15 pasos aprobados |
| npm run test:e2e con PORT=3210 | 15 pruebas Chromium aprobadas |
| openspec validate add-auth0-social-login --strict | Cambio válido |
| git diff --check | Sin errores de espacios |

Total: 149 pruebas o escenarios aprobados. Los pasos BDD son parte de sus escenarios y no se cuentan otra vez.

## Cobertura y límites

Las pruebas de autenticación usan el SDK oficial @auth0/auth0-express y un proveedor OIDC de loopback definido en tests/support/auth-fixture.js: tokens firmados de prueba, canje de código, PKCE y validación de claims. El middleware real del servidor cifra las cookies de sesión. El fixture traduce únicamente el dominio ficticio del proveedor hacia su proceso local; el punto de entrada npm start no usa ese adaptador.

Se verificaron acceso anónimo denegado, autor derivado de la sesión, origen de conexión rechazado, cookie alterada, expiración que desconecta el socket, revocación tras logout, privacidad de /api/me, errores recuperables, identidad readonly, cierre en dos pestañas y layout móvil sin desbordamiento. Las pruebas originales de saneamiento y medios siguen aprobadas.

Las capturas automatizadas se generan en test-results/ con los nombres sign-in.png, sign-in-mobile.png y authenticated-chat.png. Fueron revisadas visualmente; muestran el proveedor de pruebas y no se presentan como evidencia de Google real.

El entorno privado .env se configuró con autorización de Kenneth y está excluido de Git. Se añadieron en Auth0 las URLs del puerto 3210 conservando las 3000. El servidor real funciona en localhost:3210 y rechaza /api/me sin sesión con 401. El entorno alojado se documenta por separado en la [validación en Vercel](validacion-vercel.md).

## Evidencia real con Google y Auth0

Comprobada el 2026-10-28 a las 19:30, America/Costa_Rica, en http://localhost:3210/.

1. Kenneth completó personalmente la selección y autorización de su cuenta Google.
2. UNA Chat mostró su identidad autenticada y habilitó el envío.
3. Se publicó el mensaje de prueba «Prueba local de Auth0: sesión verificada.» y se recibió con el autor de la sesión.
4. Se eligió Cerrar sesión y se confirmó la salida en Auth0. La aplicación regresó al acceso con Google.
5. Se abrió /api/me desde esa misma pestaña y respondió authentication_required; el perfil quedó bloqueado.

Las capturas del flujo real se conservan en la carpeta local de evidencias para la entrega del laboratorio. La tarea OpenSpec 2.3 se completó después de verificar el ciclo entero.
