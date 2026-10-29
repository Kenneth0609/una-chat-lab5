# UNA Chat — Laboratorio 5 (Paradigmas de Programación, UNA 2026)

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

- `npm run test:all` ejecuta unitarias, integración, BDD y E2E en orden.
- La primera vez hay que instalar el navegador de Playwright: `npx playwright install chromium`.
- Playwright inicia el chat con `npm start` si no hay uno activo (`playwright.config.js`, `webServer`).
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
4. **Servidor** (`server.js`): sigue llamando a `validateMessage` en cada mensaje; ahora exporta `app/http/io` para
   las pruebas (solo abre el puerto con `npm start`) y envía `Content-Security-Policy` y `X-Content-Type-Options`.
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

## Parte 2 y demostración preparada

El harness OpenSpec + FoFo está explicado en [`harness/README.md`](harness/README.md).
Los tres PR independientes ya creados son [REQ-010 #2](https://github.com/Kenneth0609/una-chat-lab5/pull/2),
[REQ-011 #3](https://github.com/Kenneth0609/una-chat-lab5/pull/3) y [REQ-012 #1](https://github.com/Kenneth0609/una-chat-lab5/pull/1).
La integración local incluye las tres reglas y sus cuatro capas de pruebas.

```bash
npm ci
npx playwright install chromium
npm run test:harness
npm run test:all
npm run demo              # verifica los tres casos y guarda JPG reales del navegador
npm run demo -- --headed  # misma demostración con Chromium visible
```

Guion breve: [`DEMO-CLASE.md`](DEMO-CLASE.md). Resultado y alcance de la verificación conjunta:
[`evidencias/integracion/informe.md`](evidencias/integracion/informe.md).
La revisión interrumpida de REQ-011 se conserva como evidencia histórica; su revisión independiente posterior
se registra por separado. Los PR existentes todavía describen las ejecuciones anteriores a esta integración.
