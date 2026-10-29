Feature: REQ-012 Messages stay short
  # @req: REQ-012  El chat bloquea el envio de un mensaje mas largo que 280 caracteres.

  Scenario: REQ-012 - A message longer than 280 characters is not published
    Given the chat is open
    And the username field contains "Ana"
    When the visitor types a message of 281 characters
    And the visitor activates Send
    Then the transcript has 0 messages

  Scenario: REQ-012 - A message of exactly 280 characters is accepted
    Given the chat is open
    And the username field contains "Ana"
    When the visitor types a message of 280 characters
    And the visitor activates Send
    Then the transcript has 1 message

  Scenario: REQ-012 - A long message made only of whitespace is still too long
    Given the chat is open
    And the username field contains "Ana"
    When the visitor types a message of 281 space characters
    And the visitor activates Send
    Then the transcript has 0 messages

  Scenario: REQ-012 - The message field keeps the typed text after a too-long rejection
    Given the chat is open
    And the username field contains "Ana"
    When the visitor types a message of 281 characters
    And the visitor activates Send
    Then the message field still contains 281 characters

  Scenario: REQ-012 - A too-long notice is shown
    Given the chat is open
    And the username field contains "Ana"
    When the visitor types a message of 281 characters
    And the visitor activates Send
    Then the visitor sees a notice that the message is too long
