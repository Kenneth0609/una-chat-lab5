## Purpose

Defines the send rule that stops a visitor from publishing an empty or whitespace-only message (REQ-010),
so the transcript never receives content-free entries.

## ADDED Requirements

### Requirement: Empty or whitespace-only messages are not published
Per REQ-010, WHEN a visitor activates Send with a message field that is empty or contains only whitespace
(spaces, tabs, or a combination of these), the system SHALL NOT add a message to the transcript, SHALL keep
the message field empty, and SHALL tell the visitor to write something.

#### Scenario: Message field is completely empty
- **WHEN** a visitor activates Send with the message field empty (`""`)
- **THEN** the message SHALL NOT be added to the transcript
- **AND** the message field SHALL remain empty
- **AND** the element with role `alert` SHALL tell the visitor to write something

#### Scenario: Message field contains only spaces
- **WHEN** a visitor activates Send with the message field containing only spaces (for example `"   "`)
- **THEN** the message SHALL NOT be added to the transcript
- **AND** the message field SHALL be cleared
- **AND** the element with role `alert` SHALL tell the visitor to write something

#### Scenario: Message field contains only tabs or a mix of spaces and tabs
- **WHEN** a visitor activates Send with the message field containing only tabs or a mix of spaces and tabs
  (for example `"\t \t"`)
- **THEN** the message SHALL NOT be added to the transcript
- **AND** the message field SHALL be cleared
- **AND** the element with role `alert` SHALL tell the visitor to write something

#### Scenario: Message field has at least one non-whitespace character
- **WHEN** a visitor activates Send with a message field that has leading or trailing whitespace but also at
  least one non-whitespace character (for example `"  hola  "`)
- **THEN** this rule SHALL NOT reject the send
