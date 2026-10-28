## Purpose

Defines the REQ-012 send rule that keeps chat messages short: it blocks Send for a message longer than
280 characters, keeps the typed text in the field, and warns the visitor instead of publishing it.

## ADDED Requirements

### Requirement: Send is blocked for messages longer than 280 characters
Per REQ-012, WHEN a visitor activates Send with a message whose length is greater than 280 characters, the
system SHALL NOT add that message to the transcript (it SHALL NOT be emitted to the server or to any
visitor).

#### Scenario: A message longer than 280 characters is not published
- **WHEN** a visitor activates Send with a message of 281 characters
- **THEN** the message SHALL NOT appear in the transcript of any connected client

#### Scenario: A message of exactly 280 characters is accepted
- **WHEN** a visitor activates Send with a message of exactly 280 characters
- **THEN** this rule SHALL NOT block the send (the message may be emitted, subject to other rules)

#### Scenario: A long message made only of whitespace is still too long
- **WHEN** a visitor activates Send with a message of 281 space characters
- **THEN** the message SHALL NOT appear in the transcript of any connected client

### Requirement: The message field keeps the typed text after a too-long rejection
Per REQ-012, WHEN this rule blocks Send for a too-long message, the system SHALL keep the message text the
visitor typed in the message field (the field SHALL NOT be cleared).

#### Scenario: The message field is not cleared after rejection
- **WHEN** a visitor activates Send with a message of 281 characters
- **THEN** the message field SHALL still contain the text the visitor typed

### Requirement: The visitor is told the message is too long
Per REQ-012, WHEN this rule blocks Send for a too-long message, the system SHALL tell the visitor, in the
alert area, that the message is too long.

#### Scenario: A too-long notice is shown
- **WHEN** a visitor activates Send with a message of 281 characters
- **THEN** the element with role `alert` SHALL show a notice telling the visitor the message is too long
