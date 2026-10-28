## Context

See proposal.md - Why. The chat already runs every file in `public/validators/` as an independent send
rule before emitting a message (`harness/contracts/send-validator.md`); this change adds one more rule
file. No existing rule checks message length.

## Goals / Non-Goals

**Goals:**
- Block Send client-side when the message is longer than 280 characters, per REQ-012.
- Reuse the existing send-rule extension point so `index.html`, `public/chat.js` and `server.js` stay
  untouched.

**Non-Goals:**
- Server-side length validation: `server.js` / `libs/unalib.js` are not changed. REQ-012's acceptance is
  stated entirely in terms of Send-time behavior (transcript, field, notice), which the existing
  `public/validators/*.js` mechanism already covers end to end (a rejected message is never emitted, so it
  can never reach the server). Adding a redundant server-side check is out of scope for this requirement.
- Counting characters any way other than raw string length (e.g. grapheme clusters, bytes). `message.length`
  is the simplest rule consistent with the acceptance text ("longer than 280 characters") and matches how
  the other requirements in this codebase measure text.
- Trimming or altering the message before counting it: the rule reads the field's raw value, consistent
  with `ctx.mensaje` being described as the "raw value" in `harness/contracts/send-validator.md`.

## Decisions

- **New validator file, not a change to an existing one**: `public/validators/` is one-rule-per-file by
  contract, so REQ-012 gets its own file and cannot conflict with other requirements' rules.
- **Length check is `mensaje.length > 280`**: matches the acceptance clause "longer than 280 characters"
  exactly; 280 characters is accepted, 281 is not.

## Testable interface

New file: `public/validators/message-length.js`, following `harness/contracts/send-validator.md`:

```js
// public/validators/message-length.js
(function (root, factory) {
  var regla = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = regla;
  } else if (root.UNAChat) {
    root.UNAChat.registerSendValidator(regla.validate);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  var LIMITE = 280;
  return {
    // ctx = { nombre: <raw Username value>, mensaje: <raw message value> }
    validate: function (ctx) {
      if (ctx.mensaje.length > LIMITE) {
        return {
          campo: 'mensaje',
          texto: 'El mensaje es demasiado largo (máximo 280 caracteres).',
          limpiar: false
        };
      }
      return null;
    }
  };
});
```

Contract fixed by this design (exact values, per `harness/contracts/send-validator.md`):
- `campo`: `'mensaje'`.
- `texto` (exact Spanish wording shown in the `alert` element): `El mensaje es demasiado largo (máximo 280 caracteres).`
- `limpiar`: `false` — the field keeps the text the visitor typed, per REQ-012 ("SHALL keep the message text
  in the field").
- Trigger condition: `ctx.mensaje.length > 280` (strictly greater than; exactly 280 passes).
- Valid send (`ctx.mensaje.length <= 280`): `validate` returns `null`.

## Risks / Trade-offs

- [Risk] A future requirement could also want to limit `nombre` length; this rule only checks `mensaje`.
  → Mitigation: not needed for REQ-012; a separate rule file would handle a future username-length
  requirement without touching this one.
