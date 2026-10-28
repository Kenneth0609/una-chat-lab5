## 1. Send rule

- [ ] 1.1 Create `public/validators/mensaje-vacio.js` following the UMD module shape in
      `harness/contracts/send-validator.md`.
- [ ] 1.2 Implement `validate(ctx)`: when `ctx.mensaje.trim() === ''`, return
      `{ campo: 'mensaje', texto: 'Escribe un mensaje antes de enviarlo.', limpiar: true }`; otherwise return `null`.
- [ ] 1.3 Confirm no other file needs changes: `public/chat.js` already runs every registered validator and
      `server.js` already serves `GET /validators.js` from `public/validators/*.js`.

## 2. Verification

- [ ] 2.1 Run the existing harness suites (`node harness/scripts/run-suites.js`) to confirm the new file does
      not break any other requirement's rule.
