## 1. Rule implementation

- [ ] 1.1 Create `public/validators/nombre-obligatorio.js` following the UMD wrapper shown in
      `harness/contracts/send-validator.md`, exporting `{ validate: function (ctx) { ... } }`.
- [ ] 1.2 Implement `validate(ctx)` exactly as specified in design.md's "Testable interface": when
      `ctx.nombre` is empty or whitespace-only AND `ctx.mensaje` is a real (non-empty, non-whitespace-only)
      message, return `{ campo: 'nombre', texto: 'Escriba un nombre para enviar el mensaje.', limpiar: true }`;
      otherwise return `null`.
- [ ] 1.3 Use `String.prototype.trim()` on both fields to decide "empty or whitespace-only", covering spaces,
      tabs, and newlines.

## 2. Verification

- [ ] 2.1 Manually load the app, leave Username blank, type a real message, and confirm: the message is not
      added to the transcript, the notice reads `Escriba un nombre para enviar el mensaje.`, the username
      field stays empty, and focus returns to it.
- [ ] 2.2 Repeat with a username made only of spaces, and again with only tabs/newlines, confirming the same
      outcome.
- [ ] 2.3 Confirm a username with surrounding whitespace but real text (e.g. `"  Ana  "`) is accepted and the
      message is sent normally.
- [ ] 2.4 Confirm leaving both the username and the message blank does not trigger this rule's "write a name"
      notice (that case belongs to the empty-message rule).
