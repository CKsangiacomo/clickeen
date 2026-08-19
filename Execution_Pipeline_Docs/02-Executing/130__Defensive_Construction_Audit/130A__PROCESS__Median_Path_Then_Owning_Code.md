# 130A — Median-Path Then Owning-Code Audit Process

Status: **PROCESS — NOT AN EXECUTION AUTHORIZATION**

Date: 2026-08-19

This document is a separate process from
`130__PRD__Codebase_And_Services_Defensive_Construction_Audit.md`.
Do not edit that PRD to satisfy this process. Do not import its findings,
pattern catalog, matrix, or remediation slices as this audit's method or
scope.

This process does not authorize code changes.

## What we are hunting

The codebase was built by AI. AI treats rare failure as equally important
as the work the user asked for. It adds guards, checks, validations,
locks, retries, compatibility, and extra failure UI. The average user
never meets those failures. They meet the side effects: a product that
feels erratic, unresponsive, or over-cautious.

Product functionality and the product vision stay intact. Fail-visible
law stays intact. Real ingress stays: authentication, authorization,
upload bytes, missing requested overlay, unpublished public URL. This
process hunts defensive weight on the median path, not honesty at the
owning boundary.

## Unit of work

The unit is a user click on a current product journey, not a service
folder and not a search for validators.

Do not start in source. Do not scan Berlin, Roma, Tokyo-worker, or tests
"for completeness." Code analysis that is not attached to a felt stall is
out of process.

## Pass 1 — Walk the product

Use deployed cloud-dev. Walk as a user, not as a reviewer of failure
trees.

Journeys:

1. Sign in and land in the current account
2. Open Widgets, open an existing instance, open New
3. Edit, Save
4. Publish, Republish, Unpublish
5. Open the public widget, base and a selected locale
6. Generate translations
7. Upload and use an asset
8. Team and account settings

For every click, record only three facts:

1. What happened immediately (or that nothing did)
2. What told me it finished
3. What locked, greyed, swallowed, or stalled me that was not the thing
   I asked for

The quality bar for the median path: click, in-place feedback, visible
completion. The average user should not wait on a check they did not
cause, sit behind a page-wide lock, or be sent through a failure path
they cannot reach.

Rank journeys by what the user felt. That ranking orders Pass 2. Unwalked
journeys stay unmarked; do not invent their pain from code.

## Pass 2 — Open only the owning code

For each felt stall, open only the code that owns that moment. Follow
the one command:

```text
user intent
-> Roma current-account route
-> owning service
-> exact result
```

Stop at the first extra check, second copy of the same truth, busy-gate,
or failure UI that is not the job.

Ask, with a concrete current flow:

- Does the average user hit this, now?
- Is this the owning ingress, or a downstream re-proof of another
  Clickeen authority?
- Does the happy path wait on it, hide behind it, or get blocked by it?
- If it were gone, would the requested operation still be correct?

Classification is only as large as that answer: the stall is observed in
the walk, reachable on a current flow, or theoretical. Theoretical weight
on the median path is a deletion candidate. A real failure belongs at
one owning boundary as one loud simple failure, not pre-managed in the
interface. Observed defenses stay only if they are the smallest possible
and do not tax the median path.

Services are not a second architecture review. They are the same command
continued until the owner has done the work. After that, another check is
the finding.

## What we write down

One row per felt stall:

```text
journey / click | what the user felt | owning file | extra weight | keep, demote, or delete
```

Rows are evidence. They do not execute.

## What we do not do

- Do not change code, data, or deploys under this process.
- Do not add scoring, pattern taxonomies, severity frameworks, or a
  second audit machine.
- Do not weaken no-silent-substitution or no-silent-healing.
- Do not keep a check because an agent can imagine a race.
- Do not treat tests, grep gates, or probes as product behavior.
- Do not rewrite a surface to "fix" defensive weight.

Later remediation, if any, is a separate owner authorization. Each
authorized change is a deletion or a demotion. Anything that would add
machinery stops and returns to the owner.
