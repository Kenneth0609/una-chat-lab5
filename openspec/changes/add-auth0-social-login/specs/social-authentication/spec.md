## Purpose

Let UNA Chat visitors authenticate with an Auth0 social account and use a protected chat with a trusted identity, recoverable login failures and safe local and hosted configuration.

## ADDED Requirements

### Requirement: Social login establishes a verified session
The system SHALL use the configured personal Auth0 Regular Web Application and at least one enabled social provider to authenticate visitors, both locally and on the deployed application.

#### Scenario: Successful social login
- **WHEN** a visitor selects sign in and completes the configured provider login
- **THEN** the visitor SHALL return to UNA Chat with a verified session and their authenticated name displayed

### Requirement: Chat access and publication require authentication
The system SHALL protect the chat page, user profile and realtime connection, and SHALL derive message authors from verified server-side identity rather than a caller-supplied name.

#### Scenario: Anonymous visitor
- **WHEN** an unauthenticated visitor opens the application
- **THEN** the application SHALL request sign in without displaying an active chat

#### Scenario: Direct anonymous connection
- **WHEN** an unauthenticated client attempts to connect to the realtime endpoint
- **THEN** the server SHALL reject the connection

#### Scenario: Forged identity
- **WHEN** an authenticated client sends a message with a different author name
- **THEN** the delivered message SHALL use the authenticated identity and retain existing message sanitization

#### Scenario: Expired or ended session
- **WHEN** the session expires or the user signs out
- **THEN** the affected connection SHALL stop receiving and publishing messages, and the browser SHALL request sign in again

### Requirement: Logout ends access to the application
The system SHALL provide a visible sign-out action that clears the local session and returns to a sign-in page through Auth0 logout.

#### Scenario: Sign out
- **WHEN** an authenticated user chooses sign out
- **THEN** their chat connection SHALL close and later requests to protected resources SHALL require authentication

### Requirement: Login failures are safe and recoverable
The system SHALL show a clear Spanish message for cancelled, invalid or failed login and allow another attempt without exposing provider error details or tokens.

#### Scenario: Cancelled login
- **WHEN** the provider returns an access-denied result
- **THEN** the application SHALL show a cancellation message and a retry action

#### Scenario: Invalid callback
- **WHEN** a callback has a missing or invalid authentication transaction, authorization code or validated token claims, or supplies an unexpected state parameter
- **THEN** the application SHALL refuse to authenticate the visitor and show a generic retryable message

### Requirement: Environment configuration is private and portable
The system SHALL configure Auth0 through environment variables, supply a credential-free example, use explicit local and hosted callback/logout/origin URLs, and keep credentials out of browser responses and source control.

#### Scenario: Missing configuration
- **WHEN** required authentication configuration is absent
- **THEN** the application SHALL fail closed with a safe configuration notice instead of allowing anonymous chat

#### Scenario: Hosted login
- **WHEN** the Vercel domain and environment are configured and deployed
- **THEN** the same sign-in, identity, protected chat and sign-out flow SHALL work using that domain

#### Scenario: Browser-visible data
- **WHEN** a visitor receives the page or profile response
- **THEN** the response SHALL contain no client secret, session encryption secret, access token or ID token
