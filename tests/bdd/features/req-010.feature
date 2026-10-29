Feature: Empty messages are not published
  # @req: REQ-010  WHEN a visitor activates Send with an empty or whitespace-only message THEN the
  # system SHALL NOT add a message to the transcript, SHALL keep the message field empty, and SHALL
  # tell the visitor to write something.

  Scenario: REQ-010 - Message field is completely empty
    Given the chat is open
    And the username field contains "Ana"
    When the visitor types the message ""
    And the visitor activates Send
    Then the transcript has 0 messages
    And the message field is empty
    And the visitor sees a notice that says "Escribe un mensaje antes de enviarlo."

  Scenario: REQ-010 - Message field contains only spaces
    Given the chat is open
    And the username field contains "Ana"
    When the visitor types the message "   "
    And the visitor activates Send
    Then the transcript has 0 messages
    And the message field is empty
    And the visitor sees a notice that says "Escribe un mensaje antes de enviarlo."

  Scenario: REQ-010 - Message field contains only tabs or a mix of spaces and tabs
    Given the chat is open
    And the username field contains "Ana"
    When the visitor types a message containing only tabs and spaces
    And the visitor activates Send
    Then the transcript has 0 messages
    And the message field is empty
    And the visitor sees a notice that says "Escribe un mensaje antes de enviarlo."

  Scenario: REQ-010 - Message field has at least one non-whitespace character
    Given the chat is open
    And the username field contains "Ana"
    When the visitor types the message "  hola  "
    And the visitor activates Send
    Then the transcript contains the message "hola"
    And the transcript has 1 message
