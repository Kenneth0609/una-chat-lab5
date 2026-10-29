# send-rule-precedence Specification

## Purpose
TBD - created by archiving change finalize-lab5-integration. Update Purpose after archive.

## Requirements

### Requirement: Send failures have deterministic precedence
The system SHALL evaluate Send rules by ascending optional numeric priority, defaulting to zero, with stable alphabetical
loading order for ties. Length validation SHALL precede empty-message and username validation when multiple failures apply.
This precedence SHALL take priority over the whitespace-clearing behavior of REQ-010 for messages longer than 280 characters.

#### Scenario: Long whitespace overlaps empty-message validation
- **WHEN** a visitor activates Send with 281 spaces
- **THEN** no message SHALL be published
- **AND** the message field SHALL retain all 281 spaces
- **AND** the visitor SHALL be told the message is too long

#### Scenario: A long message has no username
- **WHEN** a visitor activates Send with 281 characters and an empty username
- **THEN** the length notice SHALL appear and the text SHALL be retained
- **AND** after shortening the text, Send SHALL show the missing-name notice

#### Scenario: Both fields are empty
- **WHEN** a visitor activates Send with an empty username and a short whitespace-only message
- **THEN** the message field SHALL be cleared and the visitor SHALL be told to write a message

#### Scenario: Visitor corrects both invalid fields
- **WHEN** a visitor shortens the message, supplies a name and activates Send
- **THEN** exactly one message SHALL be published and the prior notice SHALL be cleared
