# Contrato del chat (lo unico que el Juez sabe del frontend y del backend)

El Juez escribe pruebas **a partir de la especificacion y de este contrato**, sin leer el codigo de
`public/`, `libs/`, `server.js` ni `index.html`.

## Pagina (`GET /`)

- Titulo: `Chat Socket.IO UNA`.
- Campo de usuario: `getByRole('textbox', { name: 'Username' })`  (id `nombre`).
- Campo de mensaje: `getByRole('textbox', { name: 'Escriba un mensaje' })`  (id `m`).
- Boton: `getByRole('button', { name: 'Send' })`.
- Conversacion (transcript): lista `ul#messages`; cada mensaje publicado es un `li` con el texto `"<nombre>: <contenido>"`.
  Un mensaje publicado llega a **todos** los clientes conectados (Socket.IO, `io.emit`).
- Aviso al visitante: `<div id="aviso" role="alert">`. Esta vacio (y oculto) mientras no hay aviso;
  las reglas de envio escriben ahi su texto (`getByRole('alert')`).
- El texto de los avisos es **espanol**. Los textos exactos de cada requerimiento los fija el `design.md` del cambio de OpenSpec.

## Reglas de envio (extension del chat)

Ver `harness/contracts/send-validator.md`. Cada regla vive en `public/validators/<regla>.js`, se entrega junto
con las demas en `GET /validators.js` y se ejecuta al pulsar **Send**, antes de emitir el mensaje.

## Comportamiento ya existente (no lo cambia ningun requerimiento)

- El mensaje se envia por Socket.IO con el evento `Evento-Mensaje-Server` y el payload (string JSON)
  `{ "nombre": "...", "mensaje": "...", "color": "#RRGGBB" }`; el servidor responde con el mismo evento para todos:
  `{ nombre, mensaje, color, tipo }` donde `tipo` es `texto | imagen | video | bloqueado`.
- Texto normal: se muestra tal cual (escapado). URL de imagen: `<img>`. URL de video: `<video controls>` o YouTube.
- Codigo (`<script>`, etiquetas): se reemplaza por `[Mensaje bloqueado: contenido no permitido]`.
- Si el campo de usuario esta vacio, hoy se publica como `Anonimo` (los requerimientos pueden cambiarlo).

## Como se ejecutan las pruebas (cuatro capas)

| Capa | Herramienta | Donde viven las pruebas del requerimiento `REQ-NNN` | Comando |
|------|-------------|------------------------------------------------------|---------|
| Unitarias | Mocha + `assert` | `test/req-nnn.unit.test.js` | `node harness/scripts/run-suites.js --only unit` |
| Integracion | Jest + Supertest + socket.io-client | `tests/integration/req-nnn.test.js` | `... --only integration` |
| BDD | Cucumber (Gherkin) + Playwright | `tests/bdd/features/req-nnn.feature` + `tests/bdd/steps/req-nnn.steps.js` | `... --only bdd` |
| End-to-end | Playwright (Chromium) | `tests/e2e/req-nnn.spec.js` | `... --only e2e` |

- Variable `PORT`: puerto donde se levanta el chat para BDD y E2E (cada sesion usa el suyo). Playwright y Cucumber
  inician el servidor solos.
- Ejemplos a imitar: `tests/e2e/chat.spec.js`, `tests/integration/chat.test.js`, `test/seguridad.test.js`,
  `tests/bdd/features/mensajes-base.feature` y `tests/bdd/support/common.steps.js` (pasos comunes ya definidos).
- Cada prueba debe llevar el id del requerimiento (`REQ-NNN`) en su nombre o titulo de escenario.
