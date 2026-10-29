Feature: Messages need a name
  # @req: REQ-011  Un mensaje real exige un nombre de usuario no vacio.

  Scenario: REQ-011 - Empty username with a real message
    Given the chat is open
    And the username field contains ""
    When the visitor types the message "Hola a todos"
    And the visitor activates Send
    Then the transcript has 0 messages
    And the username field has been cleared
    And the visitor is told to write a name

  Scenario: REQ-011 - Whitespace-only username with a real message
    Given the chat is open
    And the username field contains "   "
    When the visitor types the message "Hola a todos"
    And the visitor activates Send
    Then the transcript has 0 messages
    And the username field has been cleared
    And the visitor is told to write a name

  Scenario: REQ-011 - Username made only of tabs and newlines with a real message
    Given the chat is open
    And the username field contains only tab and newline characters
    When the visitor types the message "Hola a todos"
    And the visitor activates Send
    Then the transcript has 0 messages
    And the username field has been cleared
    And the visitor is told to write a name

  Scenario: REQ-011 - Username with leading or trailing whitespace around real text is accepted
    Given the chat is open
    And the username field contains "  Ana  "
    When the visitor types the message "Hola a todos"
    And the visitor activates Send
    Then the transcript contains the message "Hola a todos"
    And the visitor is not told to write a name

  Scenario: REQ-011 - Blank username together with a blank message is outside this rule's scope
    Given the chat is open
    And the username field contains ""
    When the visitor types the message "   "
    And the visitor activates Send
    Then the visitor is not told to write a name
