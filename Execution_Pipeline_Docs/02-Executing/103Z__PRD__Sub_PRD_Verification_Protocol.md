# PRD 103Z - Sub-PRD Verification Protocol

Status: Draft
Owner: Product + Architecture
Date: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild

## Purpose

Define the review protocol every PRD 103 sub-PRD must pass.

This exists to prevent PRD 103 from turning into local cleanups that look organized but leave the product broken.

This is a gate, not an implementation workstream. It must not create meetings, artifacts, or meta-work beyond the pass/block evidence needed for each slice.

## Universal Requirements

Every PRD 103 sub-PRD must prove:

1. **Executable Without Drift**
   - The slice names its surviving authority.
   - The slice names what it deletes, derives, or demotes.
   - The slice has concrete acceptance tests or fixtures.
   - The slice cannot be satisfied by moving files, renaming routes, or adding adapters while preserving duplicate truth.

2. **World-Class Simple Architecture**
   - New systems are allowed only when they simplify the product path or merge disjoint/unnecessary systems.
   - New systems must have one product job and one authority.
   - Compatibility bridges are temporary, internal, and explicitly below the surviving boundary.

3. **Holistic End-To-End Accuracy**
   - Each relevant slice traces the user path:

```text
Bob edits FAQ
Save persists FAQ
Clickeen translates changed text
Bob shows current language values
Publish serves generated language files
```

4. **Shared Language**
   - Use product language:

```text
saved instance
authored content JSON and widget package projections
Bob Copilot Agent
Instance Translation Agent
translate saved instance
current language values
publish language files
manual translation override
```

   - Banned as product-boundary language:

```text
Babel text producer
text-values
selected overlay pointer
translation inventory
generation lane
content-looking controls
text-ish controls
```

5. **Blast Radius Coverage**
   - Every sub-PRD states whether it touches Bob, Roma, San Francisco, Tokyo-worker/Tokyo storage, DevStudio, `ck-policy`, `ck-contracts`, FAQ widget files, public publish/static serving, tests, and documentation.

## Batch Review Rule

PRD 103 executes in batches of at most three sub-PRDs.

The batch review is lightweight and evidence-based. A short checked list with links to tests, fixtures, scans, or product screenshots is enough.

After each batch:

- TPM verifies the product story still works end to end.
- Dev Manager verifies one code authority remains.
- The next batch is blocked if duplicate truth, policy bypass, preview-only UX, legacy product-boundary names, or untested blast radius remain.

## Signoff Template

Each sub-PRD must end with:

```text
TPM signoff: the slice preserves the user product story.
Dev Manager signoff: the slice has one surviving code authority and no compatibility bridge pretending to be product architecture.
```

## Failure Question

Reviewers must answer:

```text
Would this slice still allow the "one week later nothing works" scenario?
```

If yes, the slice is blocked.

## No Process Theatre

Do not add review artifacts unless they directly prove one of the gates above.

The preferred evidence is:

- passing focused tests
- a teardown map
- a code scan
- a product screenshot
- a short trace from Save to Bob review or Publish
