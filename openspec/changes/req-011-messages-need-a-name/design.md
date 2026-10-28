## Context

`public/chat.js` already runs every registered send rule before emitting a message (see
`openspec/specs/chat-messages/spec.md` - "Send rules are pluggable") and applies a rule's failure the same
way regardless of which field it targets: show `texto` in `#aviso`, optionally clear `campo`, refocus
`campo`, and never emit the message. Today, when the username field (`#nombre`) is empty, `chat.js` falls
back to the literal string `"Anonimo"` instead of rejecting the send - REQ-011 changes that only for the
case where the message is real. The contract for a rule file is fixed by
`harness/contracts/send-validator.md` and is not altered by this change.

## Goals / Non-Goals

**Goals:**
- Add exactly one new rule file that implements the REQ-011 acceptance criteria through the existing
  `validate(ctx)` contract.

**Non-Goals:**
- Changing the `"Anonimo"` fallback behavior for any case not covered by REQ-011 (e.g. it still applies once
  this rule lets a send through, which only happens when the username is non-blank, so the fallback becomes
  dead code for the real-message path but is left untouched - removing it is out of scope for this change).
- Revalidating on the server (`server.js` / `libs/unalib.js`). Out of scope because: (a) REQ-011's acceptance
  is phrased entirely in terms of the visitor's Send interaction, which the client-side rule mechanism
  already guarantees (a rejected send is never emitted to the server - see the pluggable-rule requirement),
  and (b) there is no defined contract today for a server-side rejection of this kind (no error event, no UI
  to show it), so adding one would be speculative duplication rather than something the requirement asks for.

## Decisions

- **One rule file, following the existing contract.** `harness/contracts/send-validator.md` already defines
  how a rule reports failure (`{ campo, texto, limpiar }`) and how `chat.js` applies it (clear field if
  `limpiar: true`, show notice, refocus, don't emit). Reusing it means zero changes to `chat.js`, `index.html`,
  or `server.js` - the server already serves every file under `public/validators/` concatenated and
  alphabetically ordered via `GET /validators.js`.
- **"Real message" = `mensaje.trim() !== ''`.** The requirement text says "a real message", mirroring
  REQ-010's own definition of a non-empty message. Using the same definition keeps the two rules consistent
  and mutually exclusive by construction: REQ-010's rule needs the message to be blank, REQ-011's rule needs
  it to be real, so at most one of them can match the message side of any given submission - ordering between
  the two rule files does not affect correctness.
- **Only the username field is cleared on failure.** The acceptance criteria say "keep the username field
  empty" and say nothing about the message field, so the message text the visitor already typed is left in
  place (`limpiar` only applies to `campo: 'nombre'`) - the visitor should not have to retype the message
  after only fixing the name.

## Testable interface

- **File**: `public/validators/nombre-obligatorio.js` (new file; name is unique among `public/validators/*.js`).
- **Contract**: implements `harness/contracts/send-validator.md` exactly:
  ```js
  // ctx = { nombre: <raw value of #nombre>, mensaje: <raw value of #m> }
  // returns null when the send is valid, otherwise { campo, texto, limpiar }
  validate: function (ctx) {
    var nombreVacio = !ctx.nombre || ctx.nombre.trim() === '';
    var mensajeReal = !!ctx.mensaje && ctx.mensaje.trim() !== '';
    if (nombreVacio && mensajeReal) {
      return { campo: 'nombre', texto: 'Escriba un nombre para enviar el mensaje.', limpiar: true };
    }
    return null;
  }
  ```
- **`campo`**: `'nombre'` (always, for every failure this rule can produce).
- **`limpiar`**: `true` (always, for every failure this rule can produce) - leaves `#nombre` empty.
- **Visitor-facing text (Spanish, exact)**: `Escriba un nombre para enviar el mensaje.`
- **Out of scope** (and why):
  - Server-side validation of the username - see Non-Goals above; the client-side rule already prevents
    emission, and REQ-011 does not describe any server-visible behavior.
  - Changing or removing the `"Anonimo"` fallback in `chat.js` - no longer reachable for a real message once
    this rule is in place, but removing dead code is not something REQ-011 asks for.
  - Any change to how a blank *message* is handled - that is REQ-010's rule, not this one.
