## Context

Send rules are pluggable: `public/chat.js` collects every `validate(ctx)` function registered from
`public/validators/*.js` (served concatenated by `GET /validators.js`, alphabetical by file name) and runs
them before emitting a message. The contract is `harness/contracts/send-validator.md`. This change adds one
new rule file; no other file needs to change. See proposal.md for the "why".

## Goals / Non-Goals

**Goals:**
- Add one self-contained send rule that blocks Send when the message field is empty or whitespace-only.

**Non-Goals:**
- Server-side validation of the message content. The existing send-rule mechanism only runs in the browser
  before `socket.emit`; REQ-010's acceptance criteria are phrased in terms of the visitor's Send action and
  the transcript/field/alert, which are all client-side concerns already covered by this mechanism. Adding a
  server-side check as well would duplicate the rule without changing any observable behavior the requirement
  asks for, so it is left out of scope.
- Validating the Username field. REQ-010 only mentions "message".
- Trimming the message before emitting a non-empty message (e.g. turning `"  hola  "` into `"hola"`). The
  requirement only concerns empty/whitespace-only input; any other message is left untouched by this rule.

## Decisions

- **Whitespace definition**: use JavaScript's `String.prototype.trim()` (removes spaces, tabs, newlines and
  other Unicode whitespace) to decide "empty or whitespace-only": `ctx.mensaje.trim() === ''`. This matches
  the acceptance text ("empty or whitespace-only") without hand-rolling a character class, and is consistent
  with how a single-line text input's value behaves.
- **`limpiar: true`**: the requirement says the field must stay/become empty. Since the rejected input was
  already empty or only whitespace, clearing it has no visible loss for the visitor and satisfies "SHALL keep
  the message field empty" even when the input had stray spaces/tabs.
- **File name**: `public/validators/mensaje-vacio.js`, not already used by any other rule, sorts
  independently of other requirements' rule files (alphabetical order only matters when two rules could both
  reject the same submission; an empty message has no other content for a different rule to object to).

## Testable interface

- New file: `public/validators/mensaje-vacio.js`, implementing the `harness/contracts/send-validator.md`
  module contract (UMD wrapper exporting `{ validate }`, registered via `UNAChat.registerSendValidator` in
  the browser, `module.exports` in Node for unit tests).
- `validate(ctx)` contract:
  - Input: `ctx = { nombre: <string>, mensaje: <string> }` (raw field values, not yet trimmed by the caller).
  - WHEN `ctx.mensaje.trim() === ''` (empty string, or only spaces/tabs/newlines in any combination):
    returns exactly:
    ```js
    { campo: 'mensaje', texto: 'Escribe un mensaje antes de enviarlo.', limpiar: true }
    ```
  - OTHERWISE (the trimmed message has at least one non-whitespace character): returns `null`.
- Exact visitor-facing text (Spanish), shown in `<div id="aviso" role="alert">`:
  > Escribe un mensaje antes de enviarlo.
- `campo`: `'mensaje'` (always — this rule never flags `'nombre'`).
- `limpiar`: `true` (always, when it fails).
- Out of scope (see Non-Goals): server-side re-validation in `server.js` / `libs/unalib.js`, Username
  validation, and trimming/altering a message that has real content.

## Risks / Trade-offs

- [A message that is only whitespace but visually looks non-empty to the visitor (e.g. several spaces) gets
  silently cleared] → Mitigated by the alert text telling the visitor to write something, matching the
  acceptance criterion; no data loss occurs since whitespace-only input carries no content.
