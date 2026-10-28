# chat-messages Specification

## Purpose
Describe how the UNA chat accepts, sanitizes and displays messages (Lab 5, part 1). This is the baseline that later
requirements extend; each new requirement adds its own capability under `openspec/specs/`.

## Requirements

### Requirement: Message text is never interpreted as HTML
The system SHALL display the text typed by a visitor as plain text: HTML tags are removed and special characters are escaped.

#### Scenario: A script typed in the chat is blocked
- **WHEN** a visitor sends the message `<script>alert('x')</script>`
- **THEN** the transcript SHALL show `[Mensaje bloqueado: contenido no permitido]`
- **AND** no script SHALL run in any visitor's browser

#### Scenario: Plain text is shown as written
- **WHEN** a visitor sends the message `Hola desde Cucumber`
- **THEN** the transcript SHALL contain that message next to the visitor's name

### Requirement: Image URLs are shown as images
The system SHALL replace a message that is only an http(s) URL of a jpg, jpeg, png, gif, bmp or webp image by the image itself.

#### Scenario: Image URL
- **WHEN** a visitor sends `https://example.com/photo.png`
- **THEN** the transcript SHALL show an `img` element for that URL instead of the text

### Requirement: Video URLs are shown with a player
The system SHALL replace a message that is only an http(s) URL of an mp4, webm, ogg, ogv or m4v file, or a YouTube link, by a video player.

#### Scenario: Video file URL
- **WHEN** a visitor sends `https://example.com/clip.webm`
- **THEN** the transcript SHALL show a `video` element with controls

### Requirement: Send rules are pluggable
The system SHALL run every send rule found in `public/validators/` when a visitor activates Send and before the message is emitted,
and SHALL NOT emit the message when a rule rejects it, showing the rule's notice in the alert area.

#### Scenario: A rule rejects the message
- **WHEN** a send rule returns a failure for the current field values
- **THEN** the message SHALL NOT be emitted to the server
- **AND** the rule's notice SHALL be shown in the element with role `alert`
