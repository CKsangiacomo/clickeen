# 121 PRD - Umbrella To 121D Completeness

Status: EXECUTING
Owner: Product + Architecture + Roma + Translation Agent + San Francisco
Priority: P0
Date: 2026-06-22
Type: Completeness PRD

Related:

- `121__PRD__Clickeen_Agentic_Framework_Umbrella.md`
- `121A__PRD__Agent_Architecture.md`
- `121B__PRD__San_Francisco_Orchestrator_And_Routing.md`
- `121C__PRD__Product_Copilot_Real_Agent.md`
- `121D__PRD__Translation_Agent.md`
- `121E__PRD__Future_Internal_Agents_Scope.md`
- `121F__PRD__SDR_Copilot_Future_Agent.md`
- `121G__PRD__Learning_And_Outcomes_Foundation.md`
- `121H__PRD__Ombra_Model_Strategy_And_Self_Hosted_Readiness.md`

---

## 1. Purpose

This PRD closes the gap between the 121 umbrella docs and current runtime truth.

It does two things:

1. Finish the real runtime work needed for 121 through 121D.
2. Delete redundant framework machinery that is not needed in Clickeen's closed
   system.

Detailed Translation Agent implementation belongs only in
`121D__PRD__Translation_Agent.md`.

## 2. Product Rules

Clickeen serves content. Completing 121 through 121D means the agent system must
respect content source authority:

- human-generated content remains under human intent;
- AI-generated content can be operated by agents under approved product rules;
- integration-sourced content is used by agents but not rewritten unless an
  explicit authorized integration write path exists.

The system around that content is agent-operated. Product Copilot operates the
Builder artifact. Translation Agent operates the locale overlay artifact. Future
agents will operate other structured artifacts such as pages, reports,
analytics, support tickets, feeds, and optimization outputs.

Clickeen is a closed system.

- The codebase stays lean.
- Product state is structured, schema-driven, and AI-legible.
- Agents operate the system through named homes, routes, folders, contracts, and
  storage shapes.
- Product code should not absorb agent work back into legacy SaaS product code.
- Roma owns account, tier, route, and save.
- Bob edits one instance in browser memory.
- Tokyo-worker stores exact account runtime files in R2.
- Each real agent has an agent home.
- San Francisco executes governed AI model calls.
- Agent homes do focused work; they do not rediscover product truth Roma already
  owns.

The 121 series is complete only when this architecture is real in runtime:
Product Copilot is a user-facing agent home, and Translation Agent is an
artifact agent home that operates the overlay folder.

Both prove the same Clickeen direction:

```text
lean structured product surface
-> agent home operates the structured artifact
-> owning runtime consumes the agent result
```

Product Copilot operates the Builder artifact. Translation Agent operates the
locale overlay artifact. Neither is a product endpoint pretending to be an
agent.

There are no silent fallbacks:

```text
exact authorized path available -> execute
exact authorized path unavailable -> fail explicitly
```

This replaces any older 121 language that allowed fallback model routing or
success-shaped substitution.

## 3. Current Runtime Truth

Already real:

- Product Copilot brain exists as a real worker.
- Translation Agent brain exists as a real worker home.
- San Francisco no longer uses the old generic `/v1/execute` route as the agent
  brain path.
- Product Copilot has real eval coverage.
- Product Copilot runtime proof through Roma, Product Copilot Worker, San
  Francisco, and Bob apply/undo is complete.
- Tokyo-worker has account instance translation value storage.
- Translation Agent runtime proof through Roma, Translation Agent Worker, San
  Francisco, Tokyo-worker, R2 overlay files, and Bob preview is complete on
  cloud-dev.
- Bob translation UI sends only the instance generation command, shows the
  running state while generation is in flight, returns direct operation result
  text with the generated active-locale count, and refreshes overlay inspection.

Remaining closure work:

- Some docs still describe future agent work as if it were current execution.
- Keep future public locale serving out of 121D closure.
- Keep account settings active-locale reconciliation inside 121D closure: saving
  active locales must reconcile saved instance overlay files through Roma,
  Translation Agent, and Tokyo-worker.

## 4. Completeness Scope

This PRD covers:

- align 121 docs with runtime truth;
- finish Product Copilot runtime result through the real product path;
- finish 121D by executing the Translation Agent PRD;
- remove redundant compatibility layers where Roma already owns truth;
- write executed notes only after the runtime path works.

This PRD does not cover:

- Translation Agent implementation detail; see 121D;
- future ranking/measurement agent implementation; see 121E;
- crawlable public locale pages/SEO serving;
- background/admin translation;
- broad product capability registries;
- separate execution systems.

## 5. Execution Process

Execute this PRD and 121D together, but do not mix ownership.

121D owns the Translation Agent build:

```text
Roma invocation
-> Translation Agent Worker
-> San Francisco exact model execution
-> Tokyo-worker overlay writes
-> Bob explicit generate result and overlay inspection
```

Runtime overlay consumption belongs to later clk.live/pages execution. Account
settings-driven overlay delete/create is part of the current 121D execution path
because active locales are the user's display intent.

This completeness PRD owns the 121-series closure:

```text
121 docs match runtime truth
-> Product Copilot product path is proven
-> Translation Agent path from 121D is proven
-> old San Francisco translation product path is removed
-> redundant framework machinery is deleted
-> service docs and executed notes match runtime
```

### Slice A - Pre-Execution Authority Confirmation

Before code work, confirm the active authority chain:

- Bob owns browser-memory editing and displays the explicit translation
  operation result plus overlay values found in Tokyo.
- Roma owns current account, tier, active locales, routes, and save.
- Product Copilot Worker owns Builder reasoning.
- Translation Agent Worker owns translation reasoning and overlay creation.
- San Francisco owns exact governed model execution.
- Tokyo-worker owns exact R2 file storage.
- Runtime consumes saved account artifacts.

If code inspection shows a different authority, update the PRD before
continuing.

### Slice B - Product Copilot Runtime Proof

Prove Product Copilot through the real product path:

```text
Bob/Roma -> Product Copilot Worker -> San Francisco /v1/model/chat -> Bob
```

Direct brain/provider evals are useful, but they do not close the 121 series.

Current evidence status:

- Product Copilot Worker typecheck is green.
- Product Copilot deterministic contract eval is green.
- Product Copilot real eval is green.
- Product Copilot cloud-dev Worker health is green.
- San Francisco `/v1/execute` returns the expected visible 410 hard cut.
- Roma rejects unauthenticated Copilot product-route calls with 401.
- Authenticated Product Copilot runtime smoke is green through
  `pnpm e2e:smoke:copilot-runtime` using `e2e/.auth/roma-dev.json`:
  Roma account `CLICKEEN` -> instance `QD1G068MX7` (`big-bang`) ->
  `/api/account/instances/:instanceId/copilot` returned HTTP 200,
  `kind: answer`, and Product Copilot request id
  `7c213b0e-2e7a-49fe-91ff-f513a0262936`.
- The same smoke proves no model fallback: unmanaged selected model
  `openai:not-a-managed-model` is rejected with HTTP 422 and
  `selectedModel is not managed for Product Copilot`.
- The same smoke proves Bob consumes the runtime result: Builder opens
  `QD1G068MX7`, Copilot returns a `draft_edit`, Bob applies it in browser
  memory, exposes `Undo`, and Undo completes without saving the instance.

### Slice C - Execute 121D

Execute `121D__PRD__Translation_Agent.md` without duplicating its details here.
Completeness depends on 121D passing its own done criteria.

### Slice D - Delete Redundant Runtime And Docs

After Product Copilot and Translation Agent paths work:

- retire product dependency on San Francisco saved-instance translation paths;
- remove old docs that describe San Francisco as translation owner;
- remove duplicate account authorization language in San Francisco docs;
- remove broad tool/router/fallback language from current execution docs;
- remove compatibility wrappers that preserve old fake-agent shapes when the
  code path has been replaced.

### Slice E - Closure Evidence

Move 121 through 121D toward executed only after evidence exists:

- focused developer commands for touched packages;
- product-route result for Product Copilot;
- product-route result for Translation Agent generation;
- overlay files written in the expected folder;
- Bob displays the returned Translation Agent operation result and refreshes
  overlay inspection;
- V1-V8 audit recorded.

## 6. Delete Redundancy

Delete or avoid:

- runtime discovery of current product surface when Roma/Bob already name it;
- duplicate account authorization in San Francisco;
- fallback model/provider routing;
- compatibility wrappers that preserve old fake agent shapes;
- broad tool/action registries for closed-system agents;
- request body product coordinates treated as authority when route/account truth
  already owns them;
- local tests used as normal product dependencies;
- docs claiming future layers are done.

Keep only responsibilities that protect the actual boundary:

- Roma owns account, tier, route, and save.
- San Francisco owns grant, agent capability, model policy, key, and exact
  model availability.
- Tokyo-worker stores exact files.
- Translation Agent owns its output contract before writing overlays.

## 7. Product Copilot Work

Product Copilot completion requires the governed path to work:

```text
Bob/Roma product surface
-> Product Copilot agent home
-> San Francisco model execution
-> Product Copilot returns structured Builder result
-> Bob consumes that result in the browser-memory Builder artifact
```

Direct provider evals are useful brain tests. They do not prove the product
path works.

Product Copilot is not a chat feature bolted onto Bob. It is the agent home that
operates the structured Builder surface: widget spec, editable fields, current
draft state, allowed controls, and browser-memory edit result. Bob owns the open
editor state and undo surface; Product Copilot owns Builder reasoning.

Done means:

- Product Copilot can complete a real turn through the product route.
- The turn uses the authorized model path.
- The result is structured and belongs to the Builder artifact.
- Bob can apply and undo the edit.
- Missing route/model/grant/context fails explicitly.

## 8. Translation Agent Work

121D is complete only when `121D__PRD__Translation_Agent.md` is executed.

The umbrella completeness path is simple:

```text
Bob click
-> Roma reads account active locales
-> Roma calls Translation Agent Worker
-> Translation Agent Worker calls San Francisco for model execution
-> Translation Agent writes locale overlays through Tokyo-worker
-> Bob shows the returned operation result and refreshes overlay inspection
```

The umbrella PRD must not add Translation Agent work beyond 121D.

## 9. Translation Locale Rules

The 121 series uses this product vocabulary:

- available locales: account tier entitlement;
- active locales: account settings selection;
- base locale: source language;
- locale overlay: saved translated values.

Legacy field names may exist in current code. New docs and product-path code
must use active locales.

Served locale list means:

```text
base locale + saved overlays in the instance overlay folder
```

Do not invent another field or authority for widget selector languages.

## 10. Future Scope

These are future PRDs, not 121-to-121D work:

| Future work | Owner doc |
| --- | --- |
| clk.live / Pages crawlable locale serving | Future runtime/pages PRD |
| Ranking/measurement agent for locale pages | `121E__PRD__Future_Internal_Agents_Scope.md` |
| Product Copilot invoking Translation Agent | Future internal-agent PRD |
| background/admin translation | Future internal-agent PRD |
| self-hosted/Ombra model readiness | `121H__PRD__Ombra_Model_Strategy_And_Self_Hosted_Readiness.md` |

Future work may use Translation Agent overlays. It must not be smuggled into
121D execution.

## 11. Done Means

121 through 121D completeness requires:

- Product Copilot runtime path works.
- 121D Translation Agent runtime path works through Roma, Translation Agent
  Worker, San Francisco, and Tokyo-worker.
- 121D makes Translation Agent a real Cloudflare Worker agent home.
- Account settings active-locale save reconciles saved instance overlay folders
  against the next active locale set: inactive overlays are deleted, missing
  active overlays are generated, and existing active overlays are left alone.
- Bob translation panel follows 121D exactly.
- Roma owns active locales and account authorization.
- Translation Agent owns translation reasoning only.
- San Francisco owns exact AI model execution only.
- Tokyo-worker owns exact R2 storage only.
- No fallback model/provider/locale/path substitution exists.
- Runtime docs match current code.
- Executed notes link to developer commands, runtime result, files changed, and deploy or
  product-data state.
- The core violation audit from `AGENTS.md` is recorded before moving to
  executed.

## 12. Execution Checklist

Code:

- Product Copilot runtime path is complete;
- 121D Translation Agent runtime path is complete on cloud-dev;
- account settings active-locale reconciliation updates overlay files through the
  Roma settings route;
- 121D added the Translation Agent Worker home;
- delete redundant runtime discovery and compatibility paths only when still
  present in current product code;
- remove stale docs that describe future agent work as current execution.

Docs:

- keep `CONTEXT.md` current-system only;
- update Roma, Bob, Tokyo-worker, and San Francisco service docs only where
  behavior changes;
- keep Translation Agent details in 121D;
- keep future ranking/measurement and serving work out of 121D and this PRD
  except as future scope.

Evidence:

- run focused developer commands for touched surfaces;
- prove behavior through owning product routes;
- record runtime result after code works;
- record no-fallback behavior where it can be proved without mutating live
  infrastructure; do not break cloud-dev secrets or service bindings just to
  manufacture a negative runtime case.

Current evidence:

- Product Copilot runtime smoke is green through
  `pnpm e2e:smoke:copilot-runtime`.
- Translation Agent generation was proved on `QD1G068MX7` in account
  `CLICKEEN` through `pnpm e2e:smoke:translation-agent-runtime`: Bob clicked
  Generate translations, Roma returned `200`, all 28 active non-base locales
  generated, `skippedLocales: []`, and Tokyo/R2 contains 28 exact overlay
  files.
- The same smoke opens Bob's deployed Builder, selects one generated locale, and
  renders translated overlay values.
- Translation Agent negative behavior is verified through code and focused evals:
  malformed model output, unexpected paths, missing paths, corrupted rich text,
  and placeholder mismatch fail explicitly. Live cloud-dev model/grant/write
  outage cases are not forced by this PRD because doing so would require
  altering managed runtime configuration.
