# PRD 103B - Instance Translation Agent Contract

Status: Active agent boundary; sync behavior owned by PRD 103K
Owner: Product + Architecture
Date: 2026-05-17
Current dependencies: `103J__PRD__Generic_Widget_Translation_System.md`, `103K__PRD__Saved_Base_Content_Translation_Sync.md`

## Purpose

Define the San Francisco system agent that translates saved account-widget text.

The agent exists to perform one operation:

```text
translate saved instance fields for one target locale
```

It does not own authoring truth, sync state, locale readiness, queue UX, or translated value storage. Tokyo owns those product operations.

## Agent Identity

Canonical agent id:

```text
widget.instance.translator
```

The agent is a system agent for `account_widget_translated_values`.

## Request Contract

The request/job must include:

- account id and account public id;
- user id for policy/audit;
- instance id;
- widget type;
- base locale;
- target locale;
- target locale set;
- widget editable-fields contract hash;
- saved base content marker from PRD 103K;
- identity-bearing saved text fields from PRD 103J;
- current base text for each changed field identity;
- AI runtime policy and budget;
- request id for traceability.

The request must not be a loose list of `{ path, value, locale }` without instance identity, field identity, widget contract, and saved base content marker.

## Result Contract

The agent returns translated current language values for the requested target locale:

```text
target locale -> concrete current path/value map
```

The result must carry the same saved base content marker it translated. Tokyo uses that marker to decide whether the result still applies to current saved base content.

The result is not valid just because a random `jobId` matches or does not match. `jobId` may remain trace/debug metadata, but content-marker compatibility is the product validity check.

## Failure Contract

Deterministic failures are terminal and must be reported to Tokyo:

- unsupported provider/runtime;
- missing required provider secret;
- invalid model output;
- unknown returned path;
- missing returned path;
- widget contract mismatch;
- marker mismatch detected before completion.

Retryable upstream provider failures may retry within the worker policy. They must eventually become visible Tokyo failure state instead of leaving Bob in an endless active state.

## Acceptance

- The operation name remains `translate_saved_instance`.
- The agent receives field identity, field role, rich/plain text type, concrete path, and base text.
- The agent receives and returns the saved base content marker.
- The agent output can be passed to Tokyo completion for marker-based apply/reject.
- Product logs/errors include agent id, account id, instance id, target locale, marker, policy version, provider, and model.
- Old loose text-value route behavior is not an active product API.
