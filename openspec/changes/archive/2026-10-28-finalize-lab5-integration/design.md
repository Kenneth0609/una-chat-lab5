## Context

REQ-010 clears whitespace-only input while REQ-012 preserves input longer than 280 characters.
On 2026-10-28 the user selected length validation as the first rule for overlapping failures.
The original validator load order was alphabetical; the empty-message rule therefore ran first.
An interrupted reviewer returned no JSON, which was converted to a medium finding and mistakenly accepted.

## Goals / Non-Goals

Preserve all independently generated Judge tests, retain original evidence, make combined validation deterministic,
and stop incomplete reviews. Server-side validation of these three UI rules remains outside their approved scope.

## Decisions

Optional numeric priority defaults to zero. Smaller values run first and stable sorting preserves alphabetical ties.
Length validation registers at -10; all other existing rules retain zero. Existing one-argument registrations keep working.
Review responses must come from a successful process and include verdict, nonempty summary and a well-formed findings array.
Only an explicit pass without high findings permits continuation. Invalid review output fails; a valid rejection without
actionable high findings blocks. A second review after corrections is held to the same checks.

## Testable interface

`window.UNAChat.registerSendValidator(fn, priority = 0)` in `public/chat.js` accepts existing callbacks and optional finite numbers.
`public/validators/message-length.js` preserves its Node export `validate(ctx)` and registers at -10 in the browser.
For 281 spaces, Send retains the exact text and shows `El mensaje es demasiado largo (máximo 280 caracteres).`.
`faseReview(ctx)` in `harness/lib/pipeline.js` records failed review evidence and throws before archive if review is incomplete.
`harness/test/review.test.js` executes that actual phase with only the external Claude response substituted.

## Risks

Conflicting acceptance clauses require precedence; the user's decision is recorded here and in the maintained specifications.
Existing archived FoFo results describe the independent branch runs. Combined results are recorded separately rather than
being presented as new independent Judge evidence or silently replacing the original results.
