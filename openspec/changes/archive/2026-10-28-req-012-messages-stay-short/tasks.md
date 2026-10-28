## 1. Send rule

- [ ] 1.1 Create `public/validators/message-length.js` following `harness/contracts/send-validator.md` and
      the "Testable interface" section of `design.md` (exact `texto`, `campo: 'mensaje'`, `limpiar: false`,
      threshold `ctx.mensaje.length > 280`).
- [ ] 1.2 Confirm the file is served by `GET /validators.js` without any change to `server.js`,
      `index.html` or `public/chat.js`.

## 2. Manual check

- [ ] 2.1 Run the app and confirm: a message of 281+ characters is not published, the message field keeps
      the typed text, and the alert area shows the too-long notice.
- [ ] 2.2 Confirm a message of exactly 280 characters sends normally (no notice from this rule).
