## Purpose

Require every visitor to provide a non-blank username before a real chat message can be sent, so transcripts
never attribute a real message to a blank or whitespace-only name (REQ-011).

## ADDED Requirements

### Requirement: A real message needs a non-blank username
Per REQ-011, WHEN a visitor activates Send with a username that is empty or contains only whitespace AND the
message field holds a real (non-empty, non-whitespace-only) message, the system SHALL NOT add that message to
the transcript, SHALL clear the username field so it is empty, and SHALL show the visitor a notice telling them
to write a name.

#### Scenario: Empty username with a real message
- **WHEN** a visitor activates Send with the username field empty and the message `Hola a todos`
- **THEN** the message SHALL NOT be added to the transcript
- **AND** the username field SHALL be empty
- **AND** the notice SHALL tell the visitor to write a name

#### Scenario: Whitespace-only username with a real message
- **WHEN** a visitor activates Send with the username field containing only spaces (e.g. `"   "`) and the
  message `Hola a todos`
- **THEN** the message SHALL NOT be added to the transcript
- **AND** the username field SHALL be empty
- **AND** the notice SHALL tell the visitor to write a name

#### Scenario: Username made only of tabs and newlines with a real message
- **WHEN** a visitor activates Send with the username field containing only tab and newline characters and
  the message `Hola a todos`
- **THEN** the message SHALL NOT be added to the transcript
- **AND** the username field SHALL be empty
- **AND** the notice SHALL tell the visitor to write a name

#### Scenario: Username with leading or trailing whitespace around real text is accepted
- **WHEN** a visitor activates Send with the username field containing `"  Ana  "` and the message
  `Hola a todos`
- **THEN** the message SHALL be sent and added to the transcript
- **AND** no "write a name" notice SHALL be shown

#### Scenario: Blank username together with a blank message is outside this rule's scope
- **WHEN** a visitor activates Send with the username field empty and the message field also empty or
  whitespace-only
- **THEN** this requirement SHALL NOT produce the "write a name" notice
- **AND** rejecting that send (for having no real message) is governed by a different capability
