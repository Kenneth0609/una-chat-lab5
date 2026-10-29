## Why

Today the chat emits any message typed by a visitor, including one that is empty or made only of
spaces/tabs. An empty entry in the transcript carries no information and clutters the conversation for
every connected client. REQ-010 stops that before the message ever leaves the browser.

## What Changes

- Add a new send rule (`public/validators/`) that rejects the Send action when the message field is
  empty or contains only whitespace.
- On rejection: the message is not emitted, the message field is cleared, and an alert tells the visitor
  to write something.

## Capabilities

### New Capabilities
- `empty-message-validation`: a send rule that blocks Send when the message field is empty or
  whitespace-only (REQ-010).

### Modified Capabilities
(none — `chat-messages` already declares that send rules are pluggable and block emission on failure;
this change only adds a new rule under `public/validators/`, it does not change that existing requirement)

## Impact

- New file: `public/validators/<nombre>.js` (one send-rule module, per `harness/contracts/send-validator.md`).
- No change to `public/chat.js`, `server.js`, `libs/unalib.js`, or `index.html`.
