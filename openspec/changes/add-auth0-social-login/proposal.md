## Why

UNA Chat currently admits anonymous visitors and accepts a caller-supplied identity. Laboratory 8 US-01 requires a personal Auth0 social login, protected chat access, safe configuration, and the same authentication flow locally and on Vercel.

## What Changes

- Add server-side Auth0 authorization-code login, encrypted cookie sessions, logout and a minimal authenticated profile endpoint.
- **BREAKING**: require authentication for chat pages, Socket.IO connections and message publication; derive message identity from the verified session.
- Add Spanish sign-in, session identity, logout, cancellation and retry states without inline scripts.
- Supply environment examples, Auth0 setup instructions, a Vercel HTTP-server entry point and deployment checks.
- Preserve the existing Lab5 harness without installing or adapting rsc-harness; Laboratory 8 section 3 is excluded by the user.

## Capabilities

### New Capabilities

- `social-authentication`: social login, protected chat, trusted identity, safe failure handling and configuration for local and deployed environments.

### Modified Capabilities

None. Existing message sanitization and media behavior remain the contract for authenticated visitors.

## Impact

Express/Socket.IO server initialization, frontend entry and session controls, auth-focused tests and existing authenticated chat fixtures, package dependencies, README, environment examples and Vercel configuration. Auth0 account/application creation, social-provider activation, secrets and actual deployments require Kenneth's participation and the approvals specified by the workspace. Production multi-instance message distribution needs shared pub/sub configuration; the deployment design must account for this rather than assuming all sockets share one function instance.
