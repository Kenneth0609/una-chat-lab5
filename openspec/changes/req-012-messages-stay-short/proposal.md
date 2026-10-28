## Why

REQ-012 requires the chat to reject overly long messages at send time, so the transcript and every connected
client never receive a message longer than 280 characters. Today no send rule enforces a maximum length.

## What Changes

- Add a new send rule file `public/validators/message-length.js` that rejects, on **Send**, a message whose
  length is greater than 280 characters.
- On rejection: the message is not emitted, the message field keeps the text the visitor typed (not cleared),
  and the visitor is told (in the alert area) that the message is too long.
- Messages of exactly 280 characters are accepted (the limit is "longer than 280", not "280 or more").

## Capabilities

### New Capabilities
- `message-length-limit`: defines the REQ-012 behavior — blocking Send for messages longer than 280 characters,
  keeping the typed text, and showing a too-long notice.

### Modified Capabilities
- (none)

## Impact

- New file: `public/validators/message-length.js` (picked up automatically by `GET /validators.js`; no changes
  needed to `index.html`, `public/chat.js` or `server.js`).
- No backend/server-side length check is added by this change (see design.md, Out of scope).
