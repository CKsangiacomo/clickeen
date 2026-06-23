# 121D PRD - Translation Agent

Status: EXECUTING
Owner: Product + Localization + Roma + Translation Agent + San Francisco
Priority: P0
Date: 2026-06-22
Type: Execution PRD

Related:

- `121__PRD__Clickeen_Agentic_Framework_Umbrella.md`
- `121A__PRD__Agent_Architecture.md`
- `121B__PRD__San_Francisco_Orchestrator_And_Routing.md`
- `121PRD_Umbrella_to_121D_completeness.md`
- `Execution_Pipeline_Docs/03-Executed/105_Instance_Runtime_And_Verification_Batch/105E__PRD__Generic_Translation_Field_And_Agent_Contract_Verification.md`
- `Execution_Pipeline_Docs/03-Executed/103_Translation_Field_And_Agent_Contract_Batch/103B__PRD__Instance_Translation_Agent_Contract.md`
- `Execution_Pipeline_Docs/03-Executed/103_Translation_Field_And_Agent_Contract_Batch/103J__PRD__Generic_Widget_Translation_System.md`

---

## 1. Product Truth

Clickeen serves content. Translation Agent exists because Clickeen serves one
source instance globally through locale overlays, not by duplicating widgets or
content trees.

The content source authority matters:

- Human-generated instance text remains under human intent. Translation Agent
  translates it into locale overlays and preserves the source structure.
- AI-generated instance text can be translated and improved by agents under
  approved product rules.
- Integration-sourced content cannot be rewritten by Translation Agent unless a
  separate authorized integration write path exists. Translation Agent may use
  it only as source/display content inside the saved artifact.

Clickeen is a closed account product.

- The codebase stays lean.
- Product artifacts are structured and schema-driven.
- Agents operate the system through named folders, routes, contracts, and
  storage shapes.
- Product code provides the rails. Agents do the operational work.
- Bob edits one saved account instance in browser memory.
- Roma is the app. Roma owns current account, tier, routes, and save.
- Tokyo-worker stores exact account runtime files in R2.
- 121D makes Translation Agent a real Cloudflare Worker agent home.
- San Francisco executes governed AI model calls.
- Translation Agent translates saved account instance text into locale overlays.

Translation Agent exists to keep one saved account instance as the source and
add locale overlays. It does not create duplicate widgets, duplicate pages, or
duplicate content trees.

Translation Agent is a first-class agent runtime. Roma calls it with
account-authorized work. Translation Agent owns translation reasoning and
locale overlay creation. San Francisco owns only governed model execution.
Tokyo-worker stores exact files.

This is the point of 121D: prove Clickeen's agent architecture by letting a real
agent operate a structured product artifact. Translation Agent knows the saved
instance shape, knows the overlay folder, and writes the overlay files the rest
of the system uses.

This is the same direction as Product Copilot. Product Copilot operates the
structured Builder artifact. Translation Agent operates the structured overlay
artifact. Different artifact, same agent-operated system.

121D runtime proof means Translation Agent writes exact locale overlay files
through Tokyo-worker. Future `clk.live` public locale consumption, crawlable
serving, and optimization may use the same overlays later; those future surfaces
are not 121D work.

## 2. Locale Words

121D uses only these locale words in product paths:

- available locales: locales allowed by the account tier;
- active locales: locales selected by the user in account language settings;
- base locale: source language for the saved account instance;
- locale overlay: saved translated values for one locale.

Current code still has old storage/API locale names. Execution must treat those
names as old storage/API names only. New product code and docs must speak active
locales.

Generation locale choice is not passed by Bob and not chosen by San Francisco.
Roma reads active locales from account state and removes the base locale.

## 3. Current Code State

Current working pieces:

- `agents/translation-agent` contains the Translation Agent brain.
- `agents/translation-agent` has a Cloudflare Worker entrypoint and deployment
  config.
- Translation Agent Worker verifies the Roma signed grant, calls San Francisco
  `/v1/model/chat` through a service binding, and writes locale overlays through
  Tokyo-worker through a service binding.
- Roma has account instance translation routes.
- Tokyo-worker can store and read account instance translation values.
- Roma generation already reads account locale state before calling generation.
- Roma generation mints the Translation Agent grant and calls the Translation
  Agent Worker.

Current closure state:

- The product generation path is live on cloud-dev.
- Bob translation UI is one explicit Generate translations action,
  active-locale selection, running state while the operation is in flight, and
  direct result text with the generated active-locale count after Roma returns.
- Account settings active-locale changes compare the previous active locales to
  the new active locales: removed locales delete exact overlay files,
  added locales generate exact overlay files, and unchanged locales are left
  alone.
- Public `clk.live`/pages locale consumption remains future work, not a 121D
  closure blocker.

## 4. 121D Scope

121D implements this path:

```text
Bob user clicks Generate translations
-> Roma account translation route
-> Roma loads saved instance truth from Tokyo-worker
-> Roma reads account active locales and removes the base locale
-> Roma mints Translation Agent grant
-> Roma calls Translation Agent Worker
-> Translation Agent Worker accepts the saved-instance request
-> Translation Agent Worker calls San Francisco /v1/model/chat
-> San Francisco executes the exact authorized model route
-> Translation Agent writes locale overlays through Tokyo-worker
-> Tokyo stores the overlay files in R2
-> Bob refreshes overlay inventory after the operation returns
```

121D does not implement:

- Product Copilot invoking Translation Agent;
- background/admin translation;
- a separate execution system;
- a second product authorization layer inside Translation Agent;
- locale selection from Bob request body;
- translation review dashboard;
- future ranking/measurement work;
- live model calls from published widget visitors;
- new Tokyo-worker product logic.

## 5. Execution Process

121D executes Translation Agent in product slices. Do not start by building
generic agent framework code.

### Slice 1 - Worker Home

Make `agents/translation-agent` a real Cloudflare Worker agent home:

- worker entrypoint;
- deploy config;
- request contract for saved account instance translation;
- San Francisco `/v1/model/chat` client;
- Tokyo-worker overlay write client.

Done for this slice means Translation Agent can receive a Roma-issued request
and run without being hosted inside San Francisco.

### Slice 2 - Roma Invocation

Replace the generation-unavailable path with the real Roma route:

- Roma loads saved instance truth through the existing account path;
- Roma reads active locales from account state;
- Roma removes the base locale;
- Roma mints the Translation Agent grant;
- Roma calls the Translation Agent Worker.

Bob does not send locale authority. San Francisco does not choose locales.

### Slice 3 - Overlay Writes

Translation Agent writes exact locale overlay files through Tokyo-worker:

- one overlay file per completed locale;
- exact account instance overlay folder;
- exact path/value structure;
- no writes outside the overlay folder.

Tokyo-worker stores exact requested files. It does not reason about translation
meaning, active locales, or source content.

### Future Scope - Runtime Consumption

Later clk.live/pages runtime consumption must be file-based:

```text
Translation Agent has written files
-> Tokyo has stored files in R2
-> clk.live/pages serves files from the account instance folder
-> widget shell selector shows locales whose overlay files exist
```

Tokyo is the CDN/storage plane. It stores files.
Later clk.live/pages work must serve exactly what it finds in the account
instance folder.

This section is not current 121D execution or closure evidence.

### Slice 4 - Bob Panel

Bob translation UI becomes one product operation:

```text
Generate translations
Generated translations
Translations could not be generated
```

Bob sends only the instance generation command. Roma resolves active locales.
After the operation returns, Bob refreshes the overlay list and lets the user
select active locales in the Translations panel. If a selected active locale has
no overlay values, Bob says to generate translations instead of showing base
copy as translated copy.

### Slice 5 - Account Settings Locale Changes

Account settings saves active locales. Roma then performs exact overlay work:

- added active locales -> call Translation Agent Worker for those locale
  overlays on saved account instances before the settings row is written;
- removed active locales -> after the settings row is written, delete exact
  overlay files through Tokyo-worker for saved account instances;
- unchanged active locales -> leave existing overlay files alone.

There is no user prompt. Saving settings is the user decision.

This is account-wide work over saved account instances. Roma must list the
saved account instances it is updating. 121D does not introduce a separate
retry system.

### Transition Cleanup

Once the Worker path works, remove the product dependency on the San Francisco
saved-instance translation route. Broader series cleanup belongs in
`121PRD_Umbrella_to_121D_completeness.md`.

## 6. Authority

Authority is fixed:

| Concern | Owner |
| --- | --- |
| Current account, tier, active locales | Roma |
| Saved account instance source | Tokyo-worker through Roma |
| Translatable fields and allowed paths | Saved instance + widget contracts |
| Agent runtime and translation reasoning | Translation Agent Worker |
| Model key and model execution | San Francisco |
| Locale overlay creation | Translation Agent Worker |
| Overlay file storage | Tokyo-worker |
| Future runtime locale consumption | Later clk.live/pages work reads overlay files from Tokyo/R2 |

Tokyo-worker stores exact files. It does not decide what active locales mean.
San Francisco executes AI. It does not decide account product permissions.
Translation Agent translates. It does not decide account product permissions or
write outside the overlay folder. Bob displays and edits. It does not choose
locales.

## 7. No Fallbacks

The run has no silent fallback.

```text
exact authorized path available -> execute
exact authorized path unavailable -> fail explicitly
```

No substitute model. No substitute provider. No substitute locale. No substitute
artifact. No partial success reported as full success.

## 8. Roma Work

Roma must:

1. Remove the generation-unavailable stub for the real account generation path.
2. Load the saved instance/source truth through the existing account instance
   route/Tokyo-worker path.
3. Read active locales from account state and remove the base locale.
4. Mint a Translation Agent grant for `widget.instance.translator`.
5. Call the Translation Agent Worker home.
6. Pass the saved instance coordinate and active locale list to Translation
   Agent.
7. Return Translation Agent run result to Bob.

Roma must not accept a locale list from Bob for generation.

## 9. Translation Agent Worker Work

Translation Agent must become a Cloudflare Worker agent home.

It must:

1. Add a worker entrypoint under `agents/translation-agent`.
2. Add deployment config for the Translation Agent Worker.
3. Accept only Roma-issued saved-instance translation requests over the internal
   service boundary, with the Roma-issued Translation Agent grant.
4. Read the saved-instance request before model execution.
5. Build Translation Agent prompts and structured output requirements.
6. Call San Francisco `/v1/model/chat` with the Roma-issued grant.
7. Create overlay files for each completed locale.
8. Write overlay files under the account instance overlay folder through
   Tokyo-worker.
9. Return the final run result to Roma.
10. Return explicit error when the request, grant, model call, overlay output,
    or overlay write cannot be completed.

It must not:

- write outside the account instance overlay folder;
- decide account tier or active locales;
- expose chat/session behavior;
- own a review dashboard;
- call models directly.

## 10. San Francisco Work

San Francisco must:

1. Serve governed `/v1/model/chat` calls from the Translation Agent Worker.
2. Accept the Translation Agent grant.
3. Require `agent:widget.instance.translator`.
4. Require the grant AI agent id to match `widget.instance.translator`.
5. Execute only the exact authorized provider/model route.
6. Return explicit error when grant, policy, key, model, provider, or route is
   unavailable.

San Francisco must not add account product authorization. Roma already owns
account and tier permission.

The required shared model-boundary guard is:

```text
request.agentId === grant.ai.agentId
```

This must be enforced in `/v1/model/chat` for Translation Agent and covered so
Product Copilot does not regress.

The existing San Francisco saved-instance translation route is transitional. 121D
must not keep it as the product Translation Agent home after the Worker path is
live.

## 11. Translation Agent Brain Work

Translation Agent receives saved text items and writes locale overlay files for
the requested locales.

It must preserve:

- exact paths;
- rich text shape;
- placeholders;
- links;
- protected tokens;
- field ownership.

It writes complete overlay JSON for each completed locale.

## 12. Overlay Folder Contract

The overlay folder is the product artifact contract:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  overlays/
    locales/
      {locale}.json
```

Translation Agent owns creating and writing these locale overlay files through
Tokyo-worker.

The rest of the system consumes the overlay folder. It does not reinterpret the
translation run.

Translation Agent writes a locale overlay only when it has a complete overlay
for that locale. It writes no partial overlay file.

## 13. Bob Translation Panel

Bob shows one action:

```text
Generate translations
Generating {activeLocaleCount} active locales
Generated translations
Translations could not be generated
```

After the click, Bob disables the button while the operation is in flight. When
Roma returns, Bob shows the operation result and refreshes the overlay list.
Bob does not show backend job state, raw reason keys, or locale authority
details in this panel.

The in-flight count is only the active locale count Bob already received in the
open editor payload. Bob does not create a job, poll for backend state, stream a
counter, or invent another locale authority.

Bob treats generation as successful only when Roma returns the exact generated
shape:

```json
{
  "ok": true,
  "translation": {
    "ok": true,
    "accepted": true,
    "baseLocale": "en",
    "activeLocales": ["fr"],
    "skippedLocales": []
  }
}
```

`activeLocales` must contain at least one locale string. Any other 2xx shape is
an explicit generation failure in Bob.

## 14. Account Settings Locale Changes

Account settings own active locales.

When the user saves account language settings:

- added active locales cause Roma to call the same Translation Agent Worker
  path to create those overlay files before the settings row is written;
- removed active locales cause Roma to ask Tokyo-worker to delete exact overlay
  files after the settings row is written;
- unchanged active locales remain untouched.

There is no popup asking whether to update translations. Saving settings is the
user decision.

Tokyo-worker only receives exact delete/write requests for overlay files.
Tokyo-worker does not reason about shrinking or extending active locales.

Roma owns the account-wide update loop for saved account instances:

- list saved account instances;
- compare previous active locales to new active locales;
- return immediately when active locales and locale policy are unchanged;
- call Translation Agent Worker for added active locales before writing account
  settings;
- write account settings;
- delete removed active locale overlay files through Tokyo-worker after writing
  account settings;
- return the settings result and translation update result.

If account-wide translation work is too large for a direct save path, Roma must
return an explicit translation update failure and leave no background work. A
future PRD may add a separate path.

## 15. Future Scope - Overlay Consumption And Widget Selector

Later clk.live/pages work must make public runtime consumption this simple: the
widget shell language selector reads the overlay files that exist.

The future published language menu is:

```text
base locale + locale overlay files found in the account instance overlay folder
```

The selector does not list all available locales. It does not list active
locales that have no saved overlay in the overlay folder. It does not store locale
authority.

`clk.live` serves the account instance files from Tokyo/R2. It does not invent
locales, hide locales, or reason about active locales. If an overlay file exists,
that locale exists. If an overlay file is deleted, that locale does not exist.

## 16. Developer Commands

Run focused commands for the changed surfaces:

```bash
pnpm e2e:auth:roma-dev
pnpm e2e:smoke:translation-agent-runtime
pnpm --filter @clickeen/translation-agent eval:translation-agent
pnpm --filter @clickeen/translation-agent typecheck
pnpm --filter @clickeen/sanfrancisco typecheck
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/ck-contracts typecheck
```

Broaden commands only if implementation touches shared contracts or policy.

## 17. Done Means

121D is done only when:

Slice status as of the current execution: Translation Agent Worker home exists
and Roma invokes it from the product generation route. Bob's Translations panel
uses account active locales for language selection, sends only the instance
generation command to Roma, shows running state while the operation is in
flight, shows the generated active-locale count after Roma returns, and does not
run save-follow-up generation state, polling, jobs, or backend status machinery.
Runtime public locale consumption and
public page/runtime consumption remain later work.

- Translation Agent has a Cloudflare Worker entrypoint and deploy config.
- Bob panel is one explicit Generate translations button and direct operation
  status from that click.
- Bob does not send locales for generation.
- Bob removes old translation-dashboard vocabulary from the generation panel.
- Roma reads active locales from account state.
- Roma calls the Translation Agent Worker home.
- Roma no longer returns the generation-unavailable stub for a real saved
  instance generation run.
- Translation Agent Worker calls San Francisco only for governed model
  execution.
- San Francisco executes only the exact authorized Translation Agent model
  route.
- Translation Agent writes exact-path locale overlays through Tokyo-worker.
- Overlay files live under the account instance overlay folder.
- Tokyo-worker stores exact requested files and does not interpret product
  meaning.
- Overlay write/read validation uses saved `instance.content.json` field paths,
  not a rederived field list from the current widget definition.
- Account settings active-locale changes compare previous active locales to new
  active locales: unchanged settings return no overlay work, added locales are
  generated before the settings write, and removed locales are deleted after the
  settings write.
- Missing provider/model/grant/locale/source/overlay write fails explicitly.
- A partial run cannot report full success.
- Service docs and executed notes are updated after the runtime path works.

Current cloud-dev evidence:

- Repeatable smoke command: `pnpm e2e:smoke:translation-agent-runtime`.
- Runtime path proved on `QD1G068MX7` in account `CLICKEEN`.
- Bob click invoked the Roma generation route and it returned `200`.
- Translation Agent generated all 28 active non-base locales.
- `skippedLocales: []`.
- Tokyo/R2 contains 28 overlay files under the account instance overlay folder.
- Sampled overlays use exact `{ v, values }` shape.
- Bob Translations panel opens on the deployed Builder, selects Japanese, and
  renders translated overlay values.
- Translation Agent writes only complete locale overlay files. If a later locale
  fails, the run must return explicit failure and must not report full success;
  any completed overlay file already written remains an exact file in the
  account instance overlay folder.

## 18. Required Audit

Before moving this PRD out of executing, audit the implementation against the
core violations in `AGENTS.md`.
