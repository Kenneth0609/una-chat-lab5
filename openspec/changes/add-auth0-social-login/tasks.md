## 1. Local authentication

- [x] 1.1 Add the official Auth0 SDK, validated environment configuration and a credential-free environment example; verify missing/invalid configuration fails closed.
- [x] 1.2 Implement session-based login, callback, profile and logout with protected HTTP and realtime access; verify forged authors, expiry and logout cannot publish or receive messages.
- [x] 1.3 Implement Spanish sign-in, identity, logout and retry states while preserving message sanitization and media rendering; verify the browser flows.

## 2. Verification and setup

- [x] 2.1 Verify the SDK authorization-code flow, PKCE/token-claim checks and cookie integrity with a local OIDC provider, and run the unit, integration, BDD and E2E suites.
- [x] 2.2 Document local Auth0 configuration, variables, execution and hosted prerequisites; validate the OpenSpec change.
- [x] 2.3 Configure the private local environment with human authorization and verify Kenneth's real Google login, authenticated chat and logout; capture actual evidence.

## 3. Hosted rollout

- [ ] 3.1 Configure a shared realtime broadcast and logout-revocation mechanism for multiple Vercel instances and verify cross-instance messages.
- [ ] 3.2 Configure the exact Vercel domain and Auth0 hosted URLs with human authorization, deploy and verify successful/cancelled login, chat protection and logout on the deployed URL.
- [ ] 3.3 Record deployment URL and real local/hosted evidence in the delivery documentation.
