## ADDED Requirements

### Requirement: Review must complete before archive
The harness SHALL require a successful reviewer process and a well-formed JSON verdict with a nonempty summary and findings
array before accepting review. Only an explicit pass without high findings SHALL allow archive and ready-for-integration status.
Both the initial review and any review after corrections SHALL satisfy the same validation.

#### Scenario: Reviewer reaches the session limit
- **WHEN** the reviewer process fails or returns only a session-limit message
- **THEN** review SHALL fail and the harness SHALL NOT archive the change or report it ready
- **AND** review failure evidence SHALL be retained

#### Scenario: Reviewer returns no structured verdict
- **WHEN** a successful reviewer process returns prose without the required JSON verdict
- **THEN** the harness SHALL stop review before archive

#### Scenario: Reviewer rejects without actionable high findings
- **WHEN** a valid review says fail with no high findings
- **THEN** the harness SHALL block rather than treating the absence of high findings as approval

#### Scenario: Reviewer explicitly approves
- **WHEN** a successful reviewer returns a valid pass with no high findings
- **THEN** the review phase SHALL allow the pipeline to continue
