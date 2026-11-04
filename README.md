# UNA Chat — Laboratorios 5 y 8 (Paradigmas de Programación, UNA 2026)

## Laboratorio 8 y autenticación social

El chat requiere una sesión de Auth0. El inicio de sesión se realiza con Google en una **Regular Web Application**; la sesión se conserva en una cookie cifrada y HttpOnly. El servidor protege la página, `/api/me`, las reglas de envío y las conexiones Socket.IO. El autor de un mensaje proviene de la sesión, aunque el cliente intente enviar otro nombre. Las sesiones duran como máximo una hora. Al cerrar sesión, Redis propaga la revocación a todas las instancias de Vercel. En local, Redis es opcional y la revocación se aplica en el proceso actual.

### Preparar Auth0

1. Crear una cuenta personal y un tenant en Auth0.
2. Crear **UNA Chat**, de tipo **Regular Web Application**.
3. En **Connections**, habilitar al menos **google-oauth2**. La aplicación usa Universal Login y solicita únicamente `openid profile email`.
4. En **Settings**, guardar estas URLs para el entorno local:

| Campo | Valor local |
| --- | --- |
| Allowed Callback URLs | `http://localhost:3000/auth/callback` |
| Allowed Logout URLs | `http://localhost:3000` |
| Allowed Web Origins | `http://localhost:3000` |

### Variables y ejecución local

Requiere Node.js 24. Copiar `.env.example` a `.env` y completar las variables en la computadora, sin subir ese archivo ni sus valores a Git:

| Variable | Uso |
| --- | --- |
| `AUTH0_DOMAIN` | Dominio del tenant, sin `https://` ni rutas |
| `AUTH0_CLIENT_ID` | Identificador de la aplicación UNA Chat |
| `AUTH0_CLIENT_SECRET` | Secreto de esa aplicación, solo en el servidor |
| `AUTH0_SESSION_SECRET` | Al menos 32 bytes aleatorios expresados como 64 caracteres hexadecimales; mantener estable entre reinicios |
| `AUTH0_CONNECTION` | `google-oauth2` por defecto |
| `APP_BASE_URL` | Origen exacto de la aplicación, por ejemplo `http://localhost:3000` |
| `PORT` | Puerto local, 3000 por defecto |
| `REDIS_URL` | Conexión Redis TCP. Es opcional en local y obligatoria en Vercel. Usar TLS (`rediss://`) para el servicio alojado |

Para generar el secreto de sesión se puede usar `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` y copiar el resultado únicamente al archivo privado. No usar valores de ejemplo como secretos reales.

```sh
npm ci
npm start
```

Abrir `http://localhost:3000`, elegir **Continuar con Google** y completar la autenticación. El chat muestra la identidad autenticada y **Cerrar sesión**. Si se cancela el login, se muestra un aviso con la opción de reintentarlo. Si faltan variables, el servidor muestra una página de configuración con estado 503 y mantiene bloqueado el chat.

El código de pruebas en `tests/support/auth-fixture.js` implementa un proveedor OIDC local y temporal con tokens firmados, canje de código y validación PKCE. Solo se inicia mediante los comandos de prueba; `npm start` siempre usa Auth0 real y no tiene un modo público para desactivar la autenticación.

### Verificación

```sh
npm run test:unit
npm run test:integration
npm run test:auth
npm run test:bdd
npm run test:e2e
```

`npm run test:verify` ejecuta esas cinco suites sin invocar el flujo del harness. Playwright y Cucumber necesitan Chromium: `npx playwright install chromium`. Las pruebas de navegador levantan su propio servidor y proveedor OIDC. Si el puerto 3000 ya está ocupado, usar otro puerto en `PORT`; el proveedor de pruebas usa el puerto siguiente. En PowerShell: `$env:PORT='3210'` antes de ejecutar las suites. No ejecutar simultáneamente BDD y E2E sobre los mismos puertos.

El ciclo real Google → UNA Chat → mensaje autenticado → cierre de sesión se verificó en el puerto 3210. Los resultados se describen en la [validación local](evidencias/lab8/validacion-local.md).

### Preparar el despliegue de Vercel

La versión del laboratorio está en [UNA Chat en Vercel](https://una-chat-lab8.vercel.app/). Las pruebas de la versión publicada se describen en la [validación en Vercel](evidencias/lab8/validacion-vercel.md).

1. Vincular este repositorio al proyecto Vercel con `vercel link` y conectar una base Upstash for Redis al entorno Production. La integración configura `REDIS_URL`.
2. Configurar las variables de Auth0 de la tabla anterior en Production y usar un secreto de sesión propio del despliegue. `APP_BASE_URL` debe coincidir con el origen HTTPS exacto de la aplicación. Vercel asigna el puerto.
3. Añadir en Auth0 `https://DOMINIO/auth/callback` a callbacks y `https://DOMINIO` a logout y orígenes permitidos. Sustituir DOMINIO por el dominio real y conservar las URLs locales. Las claves de desarrollo de Google de Auth0 son para pruebas; usa credenciales de Google propias si se requiere un entorno de producción fuera del laboratorio.
4. Ejecutar `vercel build --prod` y `vercel deploy --prebuilt --prod`. El punto de entrada `api/chat.js` exporta el servidor HTTP y `vercel.json` dirige las rutas de autenticación y WebSocket a esa función.
5. Comprobar el inicio de sesión, el envío de mensajes y el cierre de sesión en la URL pública. Para probar Redis antes de desplegar, iniciar una base Redis local y ejecutar `npm run test:auth` con `LAB8_TEST_REDIS_URL` configurada. La prueba abre dos servidores y verifica mensajes y revocación entre ellos.

Referencias oficiales: [SDK de Auth0 para Express](https://github.com/auth0/auth0-express/tree/main/packages/auth0-express), [WebSockets y Socket.IO en Vercel](https://vercel.com/docs/functions/websockets).

La sección 3 de Lab8 sobre rsc-harness está omitida por indicación del usuario. El harness existente de Lab5 se conserva sin ejecutarlo para esta integración.

## Antecedentes del Laboratorio 5

Chat con Express + Socket.IO. El laboratorio consiste en encontrar y corregir una vulnerabilidad de
inyección de scripts, permitir imágenes y videos por URL de forma segura y cubrir todo con tres
suites de pruebas (unitarias, integración y end-to-end).

## Ejecución

```bash
npm install
npm start            # http://localhost:3000  (frontend + backend en el mismo proceso)
```

## Pruebas

| Suite | Herramienta | Carpeta | Comando |
|-------|-------------|---------|---------|
| Unitarias | Mocha | `test/` | `npm test` |
| Integración (backend + una-lib) | Jest + Supertest + socket.io-client | `tests/integration/` | `npx jest tests/integration --runInBand --env=node` |
| End-to-end | Playwright (Chromium) | `tests/e2e/` | `npx playwright test --project=chromium --headed` |

- `npm run test:all` ejecuta las tres en orden.
- La primera vez hay que instalar el navegador de Playwright: `npx playwright install chromium`.
- Desde Lab8, Playwright inicia su propio chat y proveedor OIDC de pruebas (`playwright.config.js`, `webServer`), sin reutilizar un servidor existente.
  Reporte: `npx playwright show-report`.
- Jest ignora `tests/e2e` (`testPathIgnorePatterns` en `package.json`), así que los archivos de Playwright
  solo se ejecutan con su propio comando.

## Qué se hizo

1. **Reproducir la vulnerabilidad** (evidencia 1): en el proyecto original (`antes/`), enviar
   `<script>alert('Inyección de script');</script>` ejecutaba el `alert`, porque el servidor reenviaba el texto
   sin validar y el cliente lo insertaba con `$().html()`.
2. **Pruebas de seguridad primero (TDD)**: `test/seguridad.test.js` se escribió antes de corregir (67 pruebas en rojo).
3. **`libs/unalib.js` (`validateMessage`, alias `validarMensaje`)**:
   - El texto del usuario nunca se devuelve como HTML: se eliminan etiquetas (y el contenido de `<script>`/`<style>`)
     y se escapan `& < > " '`. Si todo el mensaje era código, se reemplaza por `[Mensaje bloqueado: contenido no permitido]`.
   - Solo se aceptan URLs `http(s)` limpias (sin espacios, comillas, `<`, `>`, credenciales) que terminen en
     `jpg/jpeg/png/gif/bmp/webp` (se muestran con `<img>`), en `mp4/webm/ogg/ogv/m4v` (se muestran con `<video controls>`)
     o que sean de YouTube (iframe de `youtube.com/embed/<ID de 11 caracteres>`).
   - `nombre` se sanea y `color` solo puede ser `#RRGGBB` (se usa dentro de un atributo `style`).
   - Se corrigieron los bugs del código original: `is_valid_url_image` y `is_valid_yt_video` usaban una variable
     inexistente (`phone`), por lo que siempre devolvían `false` y 3 de las 5 pruebas existentes fallaban.
4. **Servidor** (`server.js`): sigue llamando a `validateMessage` en cada mensaje; en Lab8 exporta `createChatServer`
   para construir instancias aisladas en las pruebas (solo abre el puerto con `npm start`) y envía `Content-Security-Policy` y `X-Content-Type-Options`.
5. **Frontend** (`index.html`, `public/chat.js`, `public/chat.css`): sin jQuery 1.11.1 (vulnerable) ni CDNs,
   sin scripts en línea, usa el cliente de Socket.IO que entrega el propio servidor.
6. **Escaneo de dependencias** (paso 11): ver `SEGURIDAD-DEPENDENCIAS.md`.

## Estructura

```
libs/unalib.js            validación y saneamiento
server.js                 Express + Socket.IO
index.html, public/       frontend
test/                     unitarias (Mocha)
tests/integration/        integración (Jest, Supertest, socket.io-client)
tests/e2e/                end-to-end (Playwright)
playwright.config.js
evidencias/               capturas JPG de las pruebas (evidencias 1 a 4)
```
