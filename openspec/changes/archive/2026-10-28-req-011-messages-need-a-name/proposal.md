## Why

A visitor can currently send a real message while leaving the Username field empty or filled only with
spaces; `public/chat.js` silently substitutes "Anonimo" and the message goes through. REQ-011 requires the
chat to instead refuse that send and ask the visitor for a name, matching the "Send rules are pluggable"
mechanism already used for REQ-010 (empty message).

## What Changes

- Add a new send rule file in `public/validators/` that rejects Send when the username field is empty or
  contains only whitespace while the message field holds a real (non-empty, non-whitespace-only) message.
- On rejection: the message is not emitted (guaranteed by the existing pluggable-rule mechanism), the
  username field is cleared, and a Spanish notice tells the visitor to write a name.
- No change to `index.html`, `public/chat.js`, `server.js`, or `libs/unalib.js`: the rule plugs into the
  existing `UNAChat.registerSendValidator` contract documented in `harness/contracts/send-validator.md`.

## Capabilities

### New Capabilities
- `username-required-validation`: defines the client-side rule that blocks sending a real message when the
  username field is empty or whitespace-only, per REQ-011.

### Modified Capabilities
(none)

## Impact

- New file: `public/validators/<nombre-de-la-regla>.js` (see design.md for the exact name and contract).
- No server, routing, or persistence changes. `GET /validators.js` already concatenates every file in
  `public/validators/` alphabetically, so the new rule is picked up automatically.
