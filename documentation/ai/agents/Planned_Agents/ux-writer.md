# UX Writer Agent

Status: PLANNED - NOT BUILT

This file is a placeholder for a future UX Writer Agent. It is not a runtime
contract, not a schema contract, and not authority for product behavior.

The future agent should be defined only when Clickeen has a concrete UX writing
operation to execute. Until then, no storage path, worker shape, queue, review
store, or orchestration model is implied by this document.

## Product Direction

The UX Writer Agent will help improve product copy across Clickeen's structured
surfaces.

Likely responsibilities:

- recommend improvements to human-generated product copy;
- create AI-generated copy drafts from approved product direction;
- preserve source-truth ownership for integration-sourced content;
- help keep product language consistent across widgets, pages, and system UI.

## Architecture Law

When this agent is built:

- it must operate Clickeen's structured artifacts through named authorities;
- model calls go through San Francisco;
- Bob, Roma, Tokyo, and other surfaces keep their existing ownership boundaries;
- proposed copy changes are applied only through the product authority that owns
  the surface;
- no bespoke subsystem is created before the use case requires it.

## Execution Requirement

A future PRD must name the first real copy operation, the exact artifact it reads
or writes, the product authority that owns that artifact, and the approval path
for changes to human-generated content.
