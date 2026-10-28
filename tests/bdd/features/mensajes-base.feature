Feature: Sending messages in the UNA chat (baseline behavior)
  # @req: BASE  Comportamiento existente del chat (laboratorio 5, parte 1)

  Scenario: A visitor sends a text message
    Given the chat is open
    And the username field contains "Ana"
    When the visitor types the message "Hola desde Cucumber"
    And the visitor activates Send
    Then the transcript contains the message "Hola desde Cucumber"
    And the message field is empty

  Scenario: A script typed in the chat is blocked
    Given the chat is open
    And the username field contains "Atacante"
    When the visitor types the message "<script>alert(1)</script>"
    And the visitor activates Send
    Then the transcript contains the message "[Mensaje bloqueado: contenido no permitido]"
