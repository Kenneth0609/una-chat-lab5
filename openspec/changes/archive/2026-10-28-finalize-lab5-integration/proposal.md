## Why

The three requirement branches pass independently, but their combined E2E suite fails for 281 spaces.
The harness also treated an interrupted Claude review as approval and archived REQ-011 without a completed review.

## What Changes

- Support optional numeric send-rule priorities while preserving alphabetical loading and stable ties.
- Run length validation before empty-message and username rules. The user explicitly chose this behavior for overlapping failures.
- Require a successful reviewer process, a valid structured verdict and explicit approval before completing review.
- Preserve historical evidence, verify the combined suites and provide a prepared classroom demonstration.

## Capabilities

### New Capabilities
- `send-rule-precedence`: consistent handling of overlapping Send failures.
- `review-completion`: incomplete reviews stop the pipeline before archive.

## Impact

`public/chat.js`, the length validator, harness review phase, regression tests, documentation and local delivery evidence.
No dependency additions are needed for these behavior changes. Git publication requires separate user approval.
