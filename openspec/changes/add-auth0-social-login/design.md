## Context

See proposal.md for motivation. Express and Socket.IO share one HTTP server. The application currently trusts a visitor-entered name and all existing browser tests assume anonymous access. Auth0 UNA Chat is already a Regular Web Application with Google enabled and http://localhost:3000/auth/callback configured.

## Goals / Non-Goals

Use the official Auth0 Express SDK and encrypted HttpOnly session cookies. Keep the existing sanitization and media handling. Complete local integration before the separate hosted rollout; retain deployed verification as incomplete until real evidence exists. Do not install or adapt the excluded rsc-harness, create commits or deploy without approval.

## Decisions

- Use @auth0/auth0-express with authorization code and PKCE, mounted under /auth, with Google selected through an environment-controlled connection. Keep credentials and token exchange on the server instead of introducing a browser-side bearer-token store.
- Refactor server construction into createChatServer. A dedicated Express session middleware application is reused for HTTP and Engine.IO requests, so connection authentication uses the same SDK. A request-level guard checks the session, and per-message checks enforce absolute expiry and local logout revocation. Logout disconnects matching sockets before the SDK clears the cookie.
- Do not expose a public test-login route or an environment switch disabling auth. Integration fixtures can inject a session middleware into the factory; the browser fixture runs only from tests/support and uses a local OIDC provider with real signed tokens and PKCE validation. Production entry points always construct the real SDK.
- Keep a readonly identity field for the existing validator interface. It is filled from /api/me and the server overwrites any submitted author value. Update browser scenarios to authenticate and assert the verified identity.
- Use websocket-only transport for local and future Vercel connections. Export the HTTP server from api/index.js. Vercel instances do not share socket rooms; a shared broadcast adapter is a required deployment prerequisite, to be configured and verified during the hosted rollout. Do not claim the deployment is complete based on a local test.
- Missing credentials fail closed with a 503 sign-in page. Restrict APP_BASE_URL to an explicit HTTP loopback development origin or HTTPS hosted origin. Never derive security-sensitive redirects from arbitrary Host headers.

## Testable interface

- server.js: createChatServer({ env, sessionMiddleware }) returns { app, http, io, port }; no listening socket is opened by importing the module.
- libs/auth.js: configuration validation and request/session identity helpers. User data exposed by GET /api/me is limited to { sub, name, email }.
- GET / renders an anonymous sign-in page or the authenticated chat; GET /api/me returns 401 for anonymous requests. Socket.IO rejects missing/expired sessions and cross-origin upgrades. Auth routes are /auth/login, /auth/callback and /auth/logout.
- Anonymous copy: "Inicia sesión para entrar al chat"; action: "Continuar con Google".
- Cancellation: "Cancelaste el inicio de sesión. Puedes intentarlo de nuevo." Other errors: "No se pudo iniciar sesión. Inténtalo de nuevo."
- Configuration: "El inicio de sesión todavía no está configurado." Connection failure: "Se perdió la conexión. Estamos intentando reconectar."
- Tests cover real SDK/OIDC login, PKCE and token claim validation, encrypted cookie integrity through a local provider, denied socket upgrades, signed-in message identity, expiry/logout, callback errors, sanitization, and browser states. The SDK trusts the token response received from the configured issuer over HTTPS in the authorization-code flow; the app does not accept arbitrary ID tokens from a browser. Real Auth0 and Vercel checks remain separate tasks.

## Risks / Trade-offs

- Encrypted stateless cookies can be replayed until expiry after browser logout. Keep sessions short, revoke the affected session in the current process, disconnect sockets and use a shared revocation mechanism with the hosted broadcast adapter before production scaling.
- Third-party media may be unavailable during browser tests. Stub only those media responses in test fixtures while retaining real chat transport and markup assertions.
- Auth0 social connections using development keys may need personal provider credentials for hosted logout and production use. Verify this during deployment setup.

## Migration Plan

Implement and verify local flows with the OIDC fixture, then configure the private local environment with permission and verify Kenneth's real Google login. For hosting, choose and configure a shared realtime adapter, set Vercel environment values, add the exact deployed Auth0 URLs with approval, and collect actual login/logout evidence. Roll back by redeploying the previous version only with human authorization; do not disable authentication as a fallback.

## Sources

- https://github.com/auth0/auth0-express/tree/main/packages/auth0-express
- https://vercel.com/docs/functions/websockets
