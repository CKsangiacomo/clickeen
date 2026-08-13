# GTM Agent

Status: PLANNED - NOT BUILT

This file is a placeholder for a future GTM Agent. It is not a runtime contract,
not a schema contract, and not authority for product behavior.

The future agent should be defined only when Clickeen has a concrete GTM use
case to execute. Until then, no file shape, storage path, worker shape, queue,
or orchestration model is implied by this document.

## Product Direction

The GTM Agent will help Clickeen turn structured product truth and approved
content into go-to-market work.

Likely responsibilities:

- recommend positioning and copy improvements for human-generated content;
- create AI-generated GTM drafts from approved product direction;
- use integration-sourced data without rewriting source truth;
- produce reviewable artifacts before customer-facing changes go live.

## Architecture Law

When this agent is built:

- it must operate Clickeen's structured artifacts through named authorities;
- model calls go through San Francisco;
- product truth stays with the owning surface;
- integration source truth is not rewritten unless an explicit integration write
  path authorizes it;
- no bespoke subsystem is created before the use case requires it.

## Execution Requirement

A future PRD must define the first real GTM operation, the exact artifact it
reads or writes, the product authority that owns that artifact, and the user or
business outcome being served.
