# PRD 103 - Instance Translation Agent Teardown And Rebuild

Status: Automated runtime proofs green; human Bob/Roma/public smoke is the next PRD 103 gate
Owner: Product + Architecture
Date: 2026-05-17
Depends on: PRD 100 - Static Public Embed Delivery; PRD 102 - Translation Overlay Panel Simplification; PRD 103_00; PRD 103_01; PRD 103_02

## Purpose

Tear down the current fake translation pipeline and rebuild it around the real product object:

```text
an instance translation agent
```

The product experience stays simple:

```text
One FAQ instance.
One save action.
Clickeen knows all editable text.
Clickeen derives translation text from the widget's editable-fields contract and the saved instance content.
Clickeen lets Copilot understand the whole widget folder.
Clickeen translates what changed.
Clickeen shows the translations.
Clickeen publishes them.
```

This PRD exists because the current implementation has agent-shaped words but not an agent-shaped product workflow. It is mostly plumbing:

```text
extract text values
call San Francisco text-values endpoint
validate returned values
write overlay object
let Bob inspect storage inventory
```

That plumbing can supply useful primitives, but it is not the architecture. Clickeen needs an agent that owns the product job:

```text
Translate this saved FAQ instance into the enabled languages using the changed user text.
```

The goal is not to invent a larger framework. The goal is to remove the automation-like pipeline as the product boundary and make the code read like the product.

## Architecture Gate Before More Runtime Work

PRD 103 must not continue until the pre-103 architecture PRDs are executed:

- `103_00__PRD__Pre_103_Architecture_Gate.md`
- `103_01__PRD__Widget_Source_And_Bootstrap_Script_Audit.md`
- `103_02__PRD__Instance_Source_And_Public_Artifact_Model.md`

These PRDs sit before 103A-103Z. They completed the architecture gate before PRD 103 runtime implementation resumed.

This PRD was blocked because the active implementation mixed too many unrelated authorities:

- widget software defaults
- starter account content
- account instance content
- non-content config
- generated public browser files
- generated account navigation indexes
- editable/translatable field contracts
- catalog metadata
- SEO/GEO capability wiring

The required direction is:

- Widget software must not own starter business copy.
- `content.json` must be renamed to `editable-fields.json` because it is a field contract, not content.
- Account instance user-visible base content must live separately from non-content config.
- Translated locale values apply to account instance content only.
- `agent.md`, `catalog.json`, `seo-geo.ts`, generated widget manifests, generated public files, and account indexes must each have a named writer, reader, rebuild rule, and deletion/rebuild rule. Otherwise they are delete candidates.
- Do not add `instance.meta.json` unless the current product/build/runtime system genuinely uses it. If metadata is not used, delete it instead of moving it.
- Do not preserve version markers, sidecars, generated registries, or indexes just because they exist.

`scripts/build-widget-catalog.mjs` was verified as a bootstrap-era product assembly script, and 103_01.3b deleted it. It bundled defaults, catalog metadata, editable fields, overlay contract derivation, and SEO/GEO registry generation into one generated artifact, then other code consumed that artifact instead of reading the simple source it actually needed.

The target is to keep the catchall manifest dependency deleted. Each product path must read the smallest direct source it actually needs, or use a named product operation. `scripts/build-widget-catalog.mjs` and `tokyo/product/widgets/manifest.json` must not return.

The same audit applies to bootstrap-era `.mjs` scripts. Scripts that materialize product files, sync repo files to R2, translate repo-owned content, or generate shared manifests were useful when local Node scripts acted as the assembly line. In the Cloudflare-era product model, those scripts are not automatically valid. Before any slice depends on one of these scripts, that materializer/syncer must be classified as:

- keep: still required by a documented Cloudflare build/deploy/runtime contract
- cloudify: move the responsibility into the Cloudflare-owned product/service boundary
- dev-only: local setup helper, absent from product build/deploy/runtime
- repair-only: explicit operator tool, never called by product paths
- delete: local bootstrap artifact with no current product contract

Verification scripts may remain only as non-mutating guards. They must not become hidden product writers or state repair paths.

## Product Truth

A Clickeen user editing an FAQ widget in Bob should experience this:

1. The user opens one FAQ widget instance.
2. Bob shows normal FAQ editing controls.
3. The user edits any FAQ text: title, subtitle, CTA, section titles, questions, answers.
4. The user clicks Save.
5. Clickeen saves the FAQ.
6. Save does not enqueue translation. It only persists the base locale.
7. The Translations panel owns translation generation.
8. The user clicks `Generate translations` in the Translations panel to run the Instance Translation Agent for the current saved instance.
9. Bob shows those translations in the Translations panel.
10. The user can preview and later edit/review translations.
11. Publish serves the language versions for that same FAQ instance.

The user does not manage:

- duplicate FAQ widgets per language
- translation jobs
- overlay pointers
- generated file lanes
- policy/storage split
- base snapshots
- internal status models

Those may exist internally only when they directly serve the product action and are named in product language.

## Non-Negotiables

- There is one account-owned widget instance.
- Save is one user action.
- Save returns after the base instance is saved; it must not enqueue or wait for enabled-language translations.
- Bob is the Builder editor for that one instance.
- The widget folder is the source family.
- The widget editable-fields contract declares customer-visible content fields once.
- The Translation Agent consumes only that editable-fields projection plus current saved instance content values.
- The Copilot Agent consumes the approved widget package. `agent.md` is included only if it survives as useful guidance with a proven consumer.
- `content.json` is not approved as a name. The approved target name is `editable-fields.json`.
- `per-field Copilot allowlist` is not a content-field product concept.
- `overlays.text[]` is not the canonical text declaration. It is deleted or derived from `editable-fields.json` only if a proven consumer requires it.
- `agent.md` is not a schema authority. It is a kill candidate unless the source model gate proves a real consumer.
- A Clickeen translation agent translates whole changed/new fields after Save.
- Both Copilot and the translation agent select their LLM/model profile from account policy, not from widget code.
- Bob shows the resulting translations.
- Bob's Translations panel is the only user-facing trigger for translation generation for the current saved instance.
- Publish serves generated language versions.
- Translation does not create another widget.
- Translation does not create another authoring mode.
- A text-values endpoint is not the product boundary.
- A value producer is not the product agent.
- Missing or failed internal work is a product failure to surface plainly, not a normal state model to preserve.
- Do not add generalized overlay stacking, A/B, geo, industry, ABM, or personalization behavior in this PRD.

## Failure Prevention Gates

PRD 103 must not be treated as a cleanup. It is a product cutover.

The refactor is not allowed to close unless each failure mode below has a named prevention gate and proof.

1. **Moved files but no surviving authority**
   - Gate: FAQ has one authored editable-fields contract for customer-visible text.
   - Proof: Bob content controls, Translation, translated locale values, Bob review, and generated public artifacts derive from that editable-fields contract plus saved instance content.
   - Fail if: `spec.json`, `overlays.text[]`, compiled-control regexes, or `agent.md` can define FAQ translation text independently.

2. **Translation becomes agent-shaped but not job-shaped**
   - Gate: `widget.instance.translator` accepts an instance/job-shaped request.
   - Proof: request includes saved instance identity, authored content schema/version, base locale, target locale, whole changed fields, deleted fields, existing language values, and field intent.
   - Fail if: the product operation is still loose `{ path, type, value }` text production.

3. **FAQ contract is not defined first**
   - Gate: no Translation migration starts until FAQ's authored editable-fields contract and instance content/config split are approved.
   - Proof: FAQ content fixture exists and can expand current FAQ config into translatable customer-visible fields.
   - Fail if: Copilot or Translation needs a compatibility fallback to discover FAQ text.

4. **Bob breaks because the editor is the real authoring surface**
   - Gate: Bob remains able to open, edit, validate, preview, and save the FAQ from the authored widget source.
   - Proof: real Bob FAQ editing flow passes for title, subtitle, CTA, section title, question, answer, add FAQ, remove FAQ, and reorder FAQ.
   - Fail if: the contract exists beside Bob instead of powering Bob.

5. **Array identity is underestimated**
   - Gate: FAQ diff logic uses stable section/FAQ item IDs where path-only diff would attach translations to the wrong item.
   - Proof: insert, delete, and reorder tests preserve translation ownership by item identity.
   - Fail if: moving a FAQ causes its translation to attach to a different FAQ or unnecessary full retranslation.

6. **Merge semantics are vague**
   - Gate: Translation merge semantics are specified and tested.
   - Proof: current language values equal added/changed translations plus carried-forward unchanged values minus deleted values.
   - Fail if: Bob or Publish can see partial language values as if they were complete translations.

7. **Manual translation overrides become a trap**
   - Gate: manual overrides are not shipped until override/base-edit semantics are decided.
   - Proof: if overrides ship, behavior is defined for unchanged base text, changed base text, deleted field, restored field, and reordered item.
   - Fail if: user-entered translated text can be silently overwritten or silently detached from the FAQ field.

8. **Policy integration is half-done**
   - Gate: both agents resolve provider/model/budget through `ck-policy`.
   - Proof: Free and Tier 3 fixtures prove different model profiles for Copilot and Translation without widget-code branching.
   - Fail if: Translation can bypass `ai-runtime.matrix.json`, entitlement caps, grant policy, or usage/audit recording.

9. **San Francisco folder cleanup lacks execution semantics**
   - Gate: San Francisco runtime behavior changes with the structure.
   - Proof: named agents run through grant verification, runtime policy, provider/model selection, structured execution, validation, usage, and telemetry.
   - Fail if: folders are renamed but endpoints can still act as product boundaries.

10. **Bob Translations panel remains preview-only**
    - Gate: Bob shows actual translated FAQ text grouped by FAQ content structure.
    - Proof: user can select a language and inspect header, CTA, section titles, questions, and answers as text.
   - Fail if: the panel only shows counts, inventory, or preview dropdowns without letting the user inspect translated FAQ text.

11. **Publish is not part of the cutover**
    - Gate: Save base -> Generate translations -> language values -> generated files -> Publish is one tested product path.
    - Proof: published static files serve the base FAQ and enabled language FAQ versions without Roma, Bob, Berlin, or San Francisco during visitor traffic.
    - Fail if: translation only works in Bob preview.

12. **Legacy vocabulary stays central**
    - Gate: old product-boundary names are deleted, moved below the agent boundary, or explicitly marked internal.
    - Proof: no active product path is named around Babel text producer, selected overlay pointer, translation lane, overlay inventory, or text-values as the user-visible/architectural operation.
    - Fail if: new code must learn old folklore to trace the product path.

### TPM / Dev Manager Review Gate

Every major PRD 103 slice must pass three independent TPM + Dev Manager reviews before it is marked complete.

Run the reviews in parallel, three at a time:

1. **Authority / Job / Bob Review**
   - Covers gates 1-4.
   - Focus: surviving authority, job-shaped agent boundary, FAQ-first sequencing, Bob authoring integrity.

2. **Identity / Merge / Publish Review**
   - Covers gates 5-7 and 11.
   - Focus: stable item identity, language value merge, manual override risk, generated publish output.

3. **Policy / Runtime / UX / Vocabulary Review**
   - Covers gates 8-10 and 12.
   - Focus: `ck-policy`, San Francisco runtime semantics, Translation panel product UX, deletion of legacy product-boundary names.

The reviewers must answer:

```text
Would this slice still allow the "one week later nothing works" scenario?
If yes, block the slice.
```

## Current Code Shape Observed

This audit looked only at the active product path, not old strategy docs.

### Salvageable Primitives

The current code has pieces worth keeping underneath the rebuild:

- FAQ has a useful starting shape in `tokyo/product/widgets/faq/spec.json`, but its `overlays.text[]` section must not survive as the canonical declaration.
- Existing extraction utilities can identify concrete text paths from saved config.
- San Francisco can call an LLM and return translated text values.
- Tokyo-worker can store language value objects under the account instance.
- Bob can apply language values in preview.

These are implementation ingredients, not the product architecture.

### Teardown Targets

The current shape is wrong as the product architecture:

1. There is no real instance translation agent.
   - Current code uses `widget.instance.translator` naming, but the active workflow is an RPC-like text-values call.
   - The missing product owner is: "translate this saved instance."

2. Save translates the full extracted text graph on each save.
   - Product truth: translate text the user added or changed.
   - Unchanged existing translations should be carried forward by Clickeen without asking the AI again.

3. The Translations panel mostly proves preview plumbing.
   - It shows setup counts and a preview dropdown.
   - It does not yet show the actual FAQ translations as user-reviewable/editable text.

4. The selected overlay pointer concept is not honest.
   - `writeSelectedOverlayPointer` currently returns an object but does not write a pointer.
   - `deleteSelectedOverlayPointer` deletes overlay objects.
   - For this feature, Clickeen needs current language values for the FAQ, not a fake pointer subsystem.

5. Publish/generation is not expressed as the same Save/Publish product flow.
   - Static language file generation exists as a capability.
   - The active connection from Save -> translated language values -> generated publishable files needs to be made direct and boring.

6. Product vocabulary has been replaced with infrastructure vocabulary.
   - "Babel text producer", "follow-up", "selected overlay", "generation lane", and "inventory" are not the user's product action.
   - The code should make the agent/job/result visible in Clickeen language.

7. Copilot and translation do not share one text base.
   - Before the 103_01 source gate, translation used `spec.json.overlays.text[]`.
   - Copilot uses compiled editor controls plus heuristics for content-like fields.
   - This creates two different ways to decide what "FAQ text" is.
   - PRD 103 must remove that split.

8. FAQ is close as a rendered widget but not yet clean enough to be the standard for future widgets.
   - Its HTML/CSS/runtime shape is mostly correct: one scoped root, stable roles, deterministic render, shared primitives, and validated state.
   - Its config mixes default state, editor UI, content structure, overlay translation declarations, normalization, SEO/GEO, locale switcher styling, and agent-readable meaning.
   - The FAQ content model is partly buried inside object-manager/repeater/editor markup instead of being a first-class product contract.
   - Future widgets must not copy that split.

9. Policy/caps/budgets already exist, but Translation is not using them as a real product agent.
   - `ck-policy` already has entitlement caps and AI runtime model/budget matrices.
   - `cs.widget.copilot.v1` is registered as an executable agent and goes through Roma grant issuance plus San Francisco `/v1/execute`.
   - `widget.instance.translator` is registered in the AI runtime matrix, but its execution surface is still endpoint-shaped.
   - PRD 103 should not create a second policy system. It should make the translation agent use the existing policy/grant/budget/model machinery.

10. San Francisco is not shaped like the AI engine/orchestrator Clickeen claims to have.
   - The service has useful parts: grants, provider adapters, model routing, telemetry, Copilot execution, translation helpers, and safety checks.
   - But the structure reads as accumulated AI-related files, not a world-class agent runtime.
   - Agent runtime, product agents, provider calls, route handlers, translation primitives, Prague tooling, and generation jobs sit too close together conceptually.
   - PRD 103 must make San Francisco express the product architecture: Clickeen runs governed agents that return validated product objects.

## Surviving Product Model

### San Francisco Agent Runtime

San Francisco is Clickeen's AI execution service.

For PRD 103, it must stop reading like a drawer of model-call helpers and start reading like the agent runtime:

```text
San Francisco
  -> verifies grants
  -> resolves ck-policy agent runtime policy
  -> selects provider/model
  -> runs the named agent
  -> validates structured output
  -> records usage/events
  -> returns a product object
```

The first two product agents are:

```text
Bob Copilot Agent
  input: widget contract + draft state + user instruction
  output: validated draft widget patch

Instance Translation Agent
  input: saved widget instance + whole changed fields + target locale + widget contract
  output: validated current language values
```

San Francisco may still expose routes, queues, and internal helpers. But those are transport/runtime details below the agent boundary.

The folder structure should teach the architecture. A target shape is:

```text
sanfrancisco/src/
  runtime/
    executeAgent.ts
    resolveRuntimePolicy.ts
    validateAgentResult.ts
    usage.ts
    traces.ts

  agents/
    bob-copilot/
      contract.ts
      runner.ts
      prompt.ts
      validatePatch.ts
      session.ts

    instance-translator/
      contract.ts
      runner.ts
      prompt.ts
      richtext.ts
      validateLanguageValues.ts

    prague-copy-translator/
      contract.ts
      runner.ts
      prompt.ts

  providers/
    openai.ts
    deepseek.ts

  shared/
    json.ts
    language.ts
    translationSafety.ts
```

The exact file names can change. The boundary cannot.

San Francisco must not keep product agents hidden behind names like:

```text
Babel text producer
text-values endpoint
CS prompt payload
translation core
```

Those can survive only as lower-level modules underneath a clearly named product agent.

### Instance Translation Agent

The central product object is the instance translation agent.

The agent owns this job:

```text
Given one saved widget instance, its base locale, enabled target languages, and changed editable text,
produce current language values for that instance.
```

The agent is not Bob, not Tokyo, and not Roma as separate products. It is Clickeen doing work for the user. Internally, Roma may trigger it, San Francisco may execute LLM calls, Tokyo may store results, and Bob may display results. But the product architecture names one job:

```text
translate saved instance
```

The agent must receive enough context to translate well:

- widget type
- base locale
- target language
- whole changed/new field values
- field labels or field intent from the widget contract
- surrounding FAQ structure when needed for context
- account/widget terminology context when available

The agent must return a product result:

```text
language values updated for this instance
```

not merely:

```text
text-values payload returned
```

### Agent Model Profiles

Copilot and the translation agent are different product agents, but they must share one execution-policy mechanism.

That mechanism already exists in the Clickeen policy system:

- `packages/ck-policy/entitlements.matrix.json` owns plan limits and caps.
- `packages/ck-policy/ai-runtime.matrix.json` owns agent model/budget profiles by tier.
- `packages/ck-contracts/src/ai.ts` owns the AI agent registry and model catalog.
- DevStudio's entitlements tool edits these matrices locally.

PRD 103 must use this system. It must not invent another policy layer.

The user's account policy decides the model profile:

```text
ck-policy entitlement/profile
  -> ai-runtime matrix cell
  -> agent runtime policy
  -> provider/model
  -> budget
  -> timeout
  -> model picker allowance
  -> learning capture
```

Current intended direction:

```text
Free
  Copilot: DeepSeek or equivalent low-cost profile
  Translation: DeepSeek or equivalent low-cost profile

Paid Tier 1 / Tier 2
  Copilot: stronger editing model
  Translation: stronger translation model, higher language/count limits

Paid Tier 3
  Copilot: GPT-5.5-class profile
  Translation: GPT-5.5-class profile, deeper context, stronger validation, higher priority
```

The exact model names live in the model catalog and runtime matrix. If Tier 3 should use GPT-5.5, that is a catalog + `ai-runtime.matrix.json` change, not a widget-code change.

The widget must not know which LLM is used.

Bob, FAQ, overlays, and publish only receive validated product results:

```text
Copilot result: valid draft widget patch
Translation result: current language values for the saved instance
```

This replaces two broken patterns:

- Translation as a black-box text endpoint that does not behave like the registered product agent.
- Copilot policy/model selection exists, but Copilot still lacks a proper widget-package view and validated patch contract.

### FAQ Gold Standard Contract

FAQ is the first widget that must become the gold standard for widgets after it.

The good parts to preserve:

- one account-owned widget instance
- one scoped public widget root
- deterministic render from validated state
- stable section and FAQ item IDs
- shared stage/pod/header/typography/surface primitives
- scoped CSS using tokens
- Bob editing the same instance that publish serves

The part to fix is the contract.

FAQ must declare its product model once:

```text
FAQ
  header
    title
    subtitleHtml
  cta
    label
  sections[]
    id
    title
    faqs[]
      id
      question
      answer
      defaultOpen
```

The FAQ editable-fields contract must carry only the meaning needed by Translation and Bob review:

```text
path
type
label
role
translatable
richText/plainText
array item identity
```

The authored widget source is the authority.

Translation Agent input, translated locale values, and Bob translation review derive from `editable-fields.json` plus saved `instance.content.json`.

Copilot is different: it is a widget specialist and must understand the whole widget package, not a narrow translation text list.

### Widget Source Split

The current 3k+ line `spec.json` shape is not scalable for hundreds of widgets or AI execution. PRD 103 must introduce an authored widget source split before more execution.

Current approved FAQ source for PRD 103 runtime:

```text
faq/
  spec.json              # current editor/default/config source; not translation field authority
  editable-fields.json   # customer-visible editable/translatable field contract
  widget.html            # runtime HTML scaffold
  widget.css             # runtime styles
  widget.client.js       # runtime applyState/client logic
  catalog.json           # small listing metadata only while proven useful
  limits.json            # widget path/operation/cap mappings to ck-policy
```

For FAQ, `editable-fields.json` declares:

```text
header.title
header.subtitleHtml
cta.label
sections[].title
sections[].faqs[].question
sections[].faqs[].answer
```

It does not declare:

```text
sections[].id
sections[].faqs[].id
sections[].faqs[].defaultOpen
```

IDs are identity. `defaultOpen` is behavior/config state. Neither is customer-visible content.

The split produces two different projections:

```text
editable-fields.json
  -> Translation Agent
  -> translated locale values
  -> Bob translation review
  -> publish language files

whole widget folder
  -> Copilot Agent
  -> Bob/ToolDrawer compiler
  -> runtime/render understanding
```

`editable-fields.json` is the hand-authored translation field contract. `agent.md` is deleted as widget source and must not return as schema authority.

### Save

Save persists the current FAQ instance and stops there.

Translation is a Translations panel operation. When the user clicks `Generate translations`, Clickeen asks the Instance Translation Agent to translate the current saved instance delta.

Before queueing changed-field agent work, PRD 103 must name the owned-system authority Clickeen uses to compare current saved fields with the current translated language values already in Tokyo.

The result is:

```text
added text paths
changed field identities
deleted text paths
unchanged field identities
```

Only added/changed fields need AI translation. Each changed field is translated as a whole value.

Deleted text disappears from the language values.

Unchanged fields keep their existing translated values.

### Language Values

For each enabled language, the translation agent produces the current language values for the FAQ.

This is still stored as an overlay value object because the overlay object is the right storage primitive:

```json
{
  "v": 1,
  "values": {
    "sections.0.faqs.0.question": "..."
  }
}
```

But the product vocabulary should stay simple:

```text
FAQ language values
```

The overlay object must not carry provenance, generation state, or history. It is the current language value object only. If Generate needs a comparison source, that authority must be named at the Generate/job boundary, not hidden inside overlay storage.

When Generate is clicked again while earlier translation work is queued or running, supersession must be solved through the owned Generate/job boundary. Do not add an overlay sidecar, readiness subsystem, or generation lane for PRD 103.

not:

```text
selected overlay pointer state
internal translation state machine
overlay readiness subsystem
```

### Bob Translations Panel

The panel should become the place where the user sees the translation agent's result.

Minimum target UX:

```text
Translations

Language: Spanish

Header
Title
[translated value]

Sections
Booking
Q: [translated question]
A: [translated answer]
```

The preview dropdown remains useful, but it is not enough. The user must be able to inspect the translated text directly.

Translation editing/overrides can be sliced separately if needed, but the refactor should not paint the system into a preview-only corner.

### Publish

Publish serves the language versions for the same FAQ instance.

The public product promise is:

```text
One embedded FAQ can be shown in enabled languages.
```

The public serving path should receive generated files. It should not call Bob, Roma, Berlin, or San Francisco during visitor traffic.

## Refactor Direction

### Replace The Product Boundary

The current product boundary is effectively:

```text
Roma follow-up calls San Francisco text-values endpoint.
```

That must be replaced by:

```text
Clickeen runs the instance translation agent for the saved instance.
```

The endpoint can remain as an internal implementation detail only if it is clearly below the agent boundary.

### Centralize Agent Execution Policy

Both agents must resolve their execution profile through the existing `ck-policy` path.

The refactor target is:

```text
agent request
  -> account authz/profile
  -> ck-policy ai-runtime matrix
  -> agent runtime policy
  -> model/provider selection
  -> budget/timeout/caps
  -> structured agent execution
  -> validated product result
```

The wrong shape is:

```text
widget code decides model
route decides model
hard-coded endpoint decides model
environment variable silently changes behavior
```

Policy is allowed to choose different models for Copilot and Translation. It is also allowed to choose different providers. But the rest of the product should only see the agent result.

Existing profile fields to preserve and extend only when needed:

```text
agentId
policyProfile
defaultModel
modelsByProvider
allowModelPicker
maxTokensPerCall
timeoutMs
maxTurnsPerThread
maxMonthlyTurns
learningCapture
policyVersion
```

Translation may need additional product limits, such as language count and retained version caps, but those should also come from `ck-policy` entitlements:

```text
l10n.locales.max
l10n.versions.max
```

If PRD 103 needs queue priority, retry policy, context depth, or quality-check profile by tier, add those fields to the existing AI runtime matrix deliberately. Do not create a parallel config file.

For Translation, quality checks must validate:

- every requested changed path has a returned value
- no unknown path is returned
- rich text remains valid safe rich text
- plain text remains plain text
- returned language values fit widget limits

For Copilot, quality checks must validate:

- every patch operation targets a declared editable path
- no operation targets translated overlay storage
- array operations preserve required IDs or create valid new IDs
- resulting draft state passes widget validation
- the user can review the change before Save

### Reshape San Francisco Around Agents

The current San Francisco shape must be treated as part of the refactor, not incidental cleanup.

Current conceptual problem:

```text
agents/
  csPromptPayload.ts
  widgetCopilotCore.ts
  l10nTranslationCore.ts
  translationSafety.ts
  ...

routes/
  execute
  babel text-values
  prague strings
```

This makes AI work look like prompts, helpers, and endpoints.

The target is named product agents:

```text
agents/bob-copilot
agents/instance-translator
agents/prague-copy-translator
runtime/*
providers/*
shared/*
```

PRD 103 should not require a giant mechanical rename before product behavior improves. But any file touched for Copilot or Translation must move toward this structure and away from endpoint/helper vocabulary.

Specific cleanup targets:

- Move Copilot prompt payload construction behind `bob-copilot`.
- Replace control-label content guessing with widget contract expansion.
- Move Translation richtext segmentation and safety under `instance-translator` or `shared`.
- Move `widget.instance.translator` off endpoint-shaped product behavior.
- Keep Prague copy translation as its own agent/tooling lane, not mixed with account widget translation.
- Keep provider adapters in `providers`.
- Keep grant/policy/model execution in runtime-level modules.

### Separate Copilot And Translation Projections

The current Copilot prompt path must stop pretending Copilot is a text-field assistant.

Translation and Copilot share the widget folder as the source family, but they do not consume the same narrow contract.

The difference between the two agents is scope:

```text
Translation Agent:
  scope = editable-fields contract plus saved instance.content.json
  job = localize saved customer-visible text after Save

Copilot Agent:
  scope = whole widget folder
  job = understand the widget and apply valid config changes from user intent
```

This does not mean Copilot should start reading `overlays.text[]` or a generated translation projection. It means Copilot needs the approved widget package view: editable fields, editor controls, defaults/config shape, normalization, limits, HTML, CSS, and client runtime.

### Demote Overlay Declarations

Language overlays remain a storage/output primitive.

They are not where FAQ text is discovered.

The correct direction is:

```text
FAQ widget contract
  -> translatable fields
  -> concrete saved field graph
  -> whole changed fields
  -> translation agent
  -> current language values
  -> stored language overlay object
```

not:

```text
hand-written overlays.text[]
  -> translation
```

The overlay object stores language values for an instance. It does not define what the widget is.

### Delete Or Rename

Delete or rename code that preserves fake concepts:

- "Babel text producer" as the product boundary.
- `runBabelTextFollowupAfterSave` as the central product concept.
- old text-value routes as the named product operation.
- "selected overlay pointer" if no durable pointer exists.
- "clear selection" if the behavior is deleting language values.
- "translation status/progress" in Builder if the user cannot act on it as a product concept.
- generation lanes that are not wired into Save/Publish as visible product outcomes.

### Keep But Simplify

Keep the overlay object storage primitive, but make the flow direct:

```text
save FAQ
extract current field graph
compare against previous saved field graph by stable field identity
ask instance translation agent to translate whole added/changed fields
combine with carried-forward existing language values
write current language values
Bob shows current language values
publish generates language files
```

### Changed Text Diff

PRD 103 should introduce product-path changed-field detection. It must not introduce word-level text diffing.

FAQ repeated content must diff and merge by stable item identity, not array index alone.

A translatable FAQ field coordinate is:

```text
instanceId
widgetType
field role/path
sectionId where applicable
faqId where applicable
locale
```

Array index may be used for display order. It must not be the identity for carrying translations.

For non-repeated fields, the comparison key is the canonical field path:

```text
header.title
```

For repeated fields, the comparison key must include stable IDs:

```text
sections[sectionId].faqs[faqId].question
```

Acceptance:

- Reordering sections or FAQ items does not retranslate unchanged fields.
- Reordering does not attach a translation to the wrong question or answer.
- Deleting a FAQ removes only that FAQ's language values.
- Inserting a new FAQ translates only the new FAQ fields.
- Duplicate or missing section/FAQ IDs fail validation before translation.

### Language Value Merge

Introduce `buildCurrentLanguageValues()` as the only merge authority.

Input:

- previous saved field graph
- current saved field graph
- previous language values
- translation agent result for whole changed/new fields
- deleted field identities

Output:

```text
complete current language values for one instance + locale
```

Merge contract:

```text
changed field -> translate the whole field
new text -> new translation
unchanged field -> carried forward
deleted text -> removed
unknown returned field -> rejected
missing changed field -> locale job failure
```

The merge must be idempotent. Running it twice with the same inputs produces the same current language values.

Partial agent failure must not overwrite the last good current language set.

### Manual Translated-Locale Edits

Manual translation editing is a direct edit to the current translated-locale values object.

The product payload remains:

```text
{ locale, values: Record<content path, translated string> }
```

Product decision:

```text
Bob edits an existing translated value.
Bob writes the full current-language values object through Roma.
Roma writes it through Tokyo's translated-locale value product operation.
Publish reads the current translated-locale value.
```

The edit is temporary. Clickeen does not store override status, review state, or protection metadata for the edited field. If the same field is regenerated, the new AI translation overwrites the manual edit.

No provenance layer, review state, or second translation authority is part of PRD 103.

### Publish Cutover Gate

Publish is not complete unless generated base and enabled-language files are produced from the saved instance and current language values.

Acceptance:

- Generated files read saved instance state and current language values.
- Publish serves generated files.
- Publish does not call Bob, Roma editor state, or San Francisco LLMs.
- Missing generated files are a generation failure, not a new publish status subsystem.
- Published language files include the same field identities used by Bob translation review.
- A post-publish verification test loads the public FAQ in the base locale and at least one translated locale.
- Save/translation success without publishable language files is not considered PRD 103 complete.

### Policy Cutover Gate

Translation is not complete until `widget.instance.translator` executes through the same policy/grant/budget/profile discipline as Copilot.

Acceptance:

- Every Translation Agent run resolves `agentId`, account tier, policy profile, provider, model, budget, timeout, and caps from `ck-policy`.
- No translation path may call OpenAI, DeepSeek, or any provider adapter directly.
- Translation audit records include `accountId`, `agentId`, `policyProfile`, `provider`, `model`, `policyVersion`, token usage, and result status.
- DevStudio policy changes affect Translation without widget, Roma, Bob, or San Francisco route code changes.
- Tests prove Free and Tier 3 resolve different Translation model profiles through the same mechanism.
- Tests prove Free and Tier 3 resolve different Copilot model profiles through the same mechanism.

### Runtime Semantics Gate

Folder movement does not count as completion. San Francisco cleanup is accepted only when agent execution behavior goes through one visible runtime path.

Acceptance:

- Bob Copilot and Instance Translation both enter through a shared runtime execution path or through intentionally equivalent runtime-backed job entrypoints.
- The runtime path performs grant/auth verification, policy resolution, provider/model selection, structured execution, validation, usage recording, and trace emission.
- Product agents cannot bypass runtime by calling provider adapters directly.
- Routes are transport only; they do not own model choice, prompt execution, validation, or product result semantics.
- Tests fail if either agent can execute without runtime policy resolution and result validation.

### Translation Review UX Gate

The Translations panel is not complete if it only changes preview language.

Acceptance:

- Bob renders actual translated FAQ text grouped by FAQ structure: header, CTA, section title, question, answer.
- Roma settings define the expected target languages; Tokyo overlays define which translations are ready.
- The panel may show `X of Y translations ready`, where `X` is ready Tokyo overlays for enabled target locales and `Y` is enabled target locales from Roma settings.
- Preview language selection only includes translations with existing Tokyo overlays.
- A product/E2E test saves an FAQ edit, receives language values, opens Bob, and verifies translated text is visible in the panel.
- The review UI reads from stored current language values, not from preview-only state.

### Legacy Vocabulary Exit Gate

Old infrastructure vocabulary may remain only as compatibility implementation detail, not as product boundary.

Acceptance:

- No new product-facing code, logs, UI labels, PRD sections, route names, or agent contracts use `Babel text producer`, `text-values`, `selected overlay pointer`, `translation inventory`, or `generation lane` as the central concept.
- If an old endpoint remains temporarily, it is wrapped below `InstanceTranslationAgent` and marked internal/deprecated.
- Product logs and errors say `Instance Translation Agent`, `current language values`, `saved instance`, and `publish language files`.
- A teardown map lists each legacy name as deleted, renamed, or internal compatibility.
- PRD 103 cannot be marked complete while any legacy term is still the named product boundary.

## Execution Slices

PRD 103 executes in review batches of at most three slices.

After each three-slice batch:

- TPM verifies user journey coverage and product acceptance.
- Dev Manager verifies surviving authority, runtime semantics, deletion targets, and test coverage.
- The next batch cannot start while a prior batch leaves duplicate truth, preview-only UX, policy bypass, or legacy product vocabulary unresolved.

Each slice needs explicit signoff:

```text
TPM signoff: the slice preserves the user product story.
Dev Manager signoff: the slice has one surviving code authority and no compatibility bridge pretending to be product architecture.
```

A slice is not complete if it only moves files, renames routes, or introduces an adapter while preserving the old authority split.

Blocking order:

```text
103A -> 103B -> 103C.0 -> 103C.1 -> 103C -> 103D.0 -> 103D -> 103E -> 103V -> 103G -> 103H -> 103I -> 103F
```

Executable sub-PRDs:

- `103Z__PRD__Sub_PRD_Verification_Protocol.md`
- `103A__PRD__Teardown_Map_And_Agent_Boundary.md`
- `103C1__PRD__FAQ_Widget_Gold_Standard_Contract.md`
- `103C__PRD__Shared_Content_Text_Base_For_Copilot_And_Translation.md`
- `103D0__PRD__FAQ_Identity_Diff_Merge_And_Override_Contract.md`
- `103B__PRD__Instance_Translation_Agent_Contract.md`
- `103D__PRD__Changed_Text_Translation.md`
- `103E__PRD__Translation_Panel_FAQ_Text_Review.md`
- `103V__PRD__FAQ_Single_Language_Vertical_Slice.md`
- `103G__PRD__Save_Publish_Generated_Language_Files.md`
- `103H__PRD__Shared_Agent_Model_Profiles.md`
- `103I__PRD__San_Francisco_Agent_Runtime_Cleanup.md`
- `103F__PRD__Translation_Override_UX.md`

Notes:

- `103Z` is a verification protocol, not an implementation workstream.
- `103C.0` must restore the test floor without restoring FAQ `spec.json` as translation authority.
- `103C.1` must complete before widget contract work can be marked done.
- `103D.0` is concept-green but cannot mark Bob review or Publish complete until those product paths read the same current language values.
- `103V` must prove the real product path before publish expansion, policy hardening, San Francisco reshaping, or override UX.
- `103F` manual override UX stays last unless product explicitly cuts it from PRD 103.
- San Francisco cleanup may start earlier as analysis, but broad folder/runtime reshaping is not complete until `103V` proves the product path and the runtime semantics gate passes.

Immediate restart order after the deterministic audit:

```text
1. Fix the Tokyo translated-locale test floor while keeping `editable-fields.json` plus saved `instance.content.json` as FAQ translation authority.
2. Wire Bob's Translations panel to render review rows from the generic content projection.
3. Name and prove the panel-owned Generate delta authority, then prove changed/missing whole fields, agent result, and Tokyo write.
4. Upgrade 103V from helper proof to real product-path proof. This is green as of 2026-05-20.
5. Publish proof and manual override reproof are green as of 2026-05-20; continue with human Bob/Roma/public smoke as the next PRD 103 gate.
```

### 103A - Teardown Map And Agent Boundary

Map the current language pipeline and declare the surviving agent boundary.

Acceptance:

- List every active route/function/type involved in Save -> translation -> Bob preview -> Publish.
- Mark each item as keep, internal primitive, rename, replace, or delete.
- Define the new `translate saved instance` product operation.
- Confirm old text-value routes are not the product boundary.
- Confirm `runBabelTextFollowupAfterSave` is not the product boundary.

### 103B - Instance Translation Agent Contract

Define and implement the agent-facing contract.

Acceptance:

- The operation is named in product language: `translate saved instance` or equivalent.
- The request is instance/job shaped, not loose text-values shaped.
- It includes account ID, instance ID, widget type, save/base revision, base locale, target locale, widget contract version, current saved field graph, previous saved field graph, whole changed fields, deleted fields, existing language values, and policy/runtime profile.
- It can carry existing language values for unchanged paths.
- It returns current language values for the instance language.
- The implementation rejects translation requests that are only `{ path, value, locale }[]` without instance/job context.
- Product logs/errors name the translation agent, not a generic producer.
- Product logs/errors include job ID and instance ID.

### 103C.0 - Widget Source Split And Content JSON

Split FAQ's authored widget source so `spec.json` stops being the 3k+ line monolith that hides product truth.

Acceptance:

- FAQ has an authored `editable-fields.json` containing only customer-visible editable/translatable field definitions for Translation.
- FAQ has authored editor/defaults/normalization sources or an explicit composition plan that removes the monolithic hand-authored `spec.json` as the long-term source format.
- `editable-fields.json` is the authored translation field contract; saved base values live in `instance.content.json`.
- `per-field Copilot allowlist` is removed from the content-field model.
- The authored source can still generate or supply the current Bob/Tokyo artifacts needed during migration.
- Tokyo overlay tests pass from generated/content-derived translation contract data, not from a restored hand-authored FAQ translation section in `spec.json`.
- A future widget can copy the file layout without reading a 3k+ `spec.json`.

### 103C - Agent Source Projections

Make Translation and Copilot consume the right projection from the same widget folder.

Acceptance:

- Translation receives declared text paths and labels from authored `editable-fields.json` and saved base values from `instance.content.json`.
- Copilot receives a widget package view, not only a translation text list.
- Current state is not product-green while Copilot receives only compiled controls instead of the full widget package.
- Copilot no longer decides FAQ content fields with regexes over path/label/group label.
- Copilot can reason about content, behavior, appearance, limits, and runtime behavior from the widget package.
- Translation ignores behavior/config state such as IDs and `defaultOpen`.
- `overlays.text[]` is not used as an authored source contract.

### 103C.1 - FAQ Widget Gold Standard Contract

Refactor FAQ so future widgets can copy its shape.

Acceptance:

- FAQ has one authored `editable-fields.json` for header, CTA, section titles, questions, and answers.
- FAQ editor controls reference authored content fields instead of burying product meaning only in object-manager/repeater markup.
- FAQ translation paths derive from authored content fields.
- FAQ Copilot context derives from the whole FAQ widget package.
- FAQ runtime validation/rendering consumes the same canonical state shape.
- FAQ `agent.md` no longer acts as a separate schema authority.
- No future widget needs to hand-maintain a separate overlay text graph to participate in translation.
- A validation test fails if a translated field exists outside authored `editable-fields.json`.
- A deletion/derivation decision is recorded for each duplicate source: `spec.json` translation fields, `overlays.text[]`, Copilot control heuristics, `agent.md`, and object-manager markup paths.
- Future widget PRDs must use FAQ's corrected contract shape, not the current FAQ `spec.json` shape.

### 103D.0 - FAQ Identity, Diff, And Merge Contract

Define the data contract that prevents language values from drifting.

Acceptance:

- FAQ repeated fields use stable section/FAQ IDs for diff and merge.
- Array index is display order only, not translation identity.
- `buildCurrentLanguageValues()` is the only merge authority.
- Language values are the current overlay values Bob reviews and Publish consumes.
- Manual overlay edits write the full current-language values object; no separate provenance/review-state system is introduced.
- Publish consumes the same current language values Bob reviews.
- Reorder, insert, delete, changed question, changed answer, deleted FAQ, restored FAQ, and partial agent failure cases are covered by tests or explicit fixtures.

### 103D - Changed Text Translation

Add current-vs-previous field graph comparison after save.

Acceptance:

- New text is translated.
- Changed text is translated.
- If one word changes, the whole editable field is translated; Roma does not send word-level diffs.
- Unchanged fields are not sent to the AI translator again.
- Deleted text is removed from the current language values.
- The resulting stored language values represent the current FAQ text.
- Reordered unchanged FAQ text is not translated again.
- Reordered unchanged FAQ text keeps the correct language value by stable ID.
- Stored language values are complete for the current FAQ, not partial agent output.
- Unknown returned fields are rejected.
- Missing changed fields fail the locale job.
- Partial agent failure does not overwrite the last good current language set.

### 103E - Translation Panel Shows Contract Text

Turn the Translations panel from a preview selector into a review surface.

Acceptance:

- User selects a language.
- Bob shows translated fields from the editable-fields/current-language-values review projection.
- FAQ is the first proven contract shape, not a hardcoded Bob review path.
- Preview still works.
- Bob shows `X of Y translations ready` only while the number of ready Tokyo overlays is lower than the number of enabled target locales from Roma settings.
- The dropdown lists only translations that have Tokyo overlays, plus the base locale.
- While translations are incomplete, clicking the dropdown refreshes Tokyo overlay inventory; once all translations are ready, the dropdown does not refresh while the user stays in the panel.
- The review UI reads stored current language values, not preview-only state.
- The panel has the only user-facing `Generate translations` button; Save does not enqueue translation.
- `Generate translations` asks the product backend to run the Instance Translation Agent for the current saved instance and enabled target languages.
- `Generate translations` does not send Bob form text or a Bob-computed diff.
- Helper-only review tests are not enough; the production Translations panel must render the rows.

### 103V - FAQ Single-Language Vertical Slice

Prove the first real product path before expanding the refactor.

Acceptance:

- User edits one FAQ title, question, or answer in Bob.
- Save persists the base FAQ.
- Clickeen detects only the changed field.
- Instance Translation Agent translates that field for one target locale.
- `buildCurrentLanguageValues()` writes a complete current language value set for that locale.
- Bob Translations panel shows the translated FAQ text through the editable-fields/current-language-values review path.
- Preview uses the same current language values.
- No `spec.json` translation field list, `overlays.text[]`, compiled-control regex, or preview-only state is used as authored text authority.
- This proof runs through the real production path, not a demo lane.
- A helper-only verifier does not satisfy this slice.

### 103F - Translation Override UX

Add manual translation edits only as edits to the current translated-locale values object.

Acceptance:

- User can edit a translated value.
- Bob writes the full translated-locale values object for the same FAQ instance and same language.
- Tokyo validates the full values object through the saved instance editable-fields contract and rejects partial maps.
- Publish consumes the edited translated locale value.
- No second translation authority, provenance layer, or review-state layer is added.

### 103G - Save/Publish Generated Language Files

Make static language generation a direct product outcome.

Acceptance:

- After save/translation, current language values can be used to generate language files.
- Generated base and enabled-language files are produced from the same saved instance content/config and current translated locale values.
- Publish serves the generated base and language files.
- Publish reads only saved instance state and current language values.
- Publish does not call Bob, Roma editor state, or San Francisco LLMs.
- Publish blocks or clearly excludes a language when required language files are missing.
- Published language files include the same field identities used by Bob translation review.
- A post-publish verification test loads the public FAQ in the base locale and at least one translated locale.
- Publish failure copy names the missing product outcome plainly.
- Public visitor serving remains static.
- 103V has proven Tokyo translated-locale value write/read and Bob review in the real product path; this slice is the next runtime proof.

### 103H - Shared Agent Model Profiles

Make Copilot and the translation agent use the existing `ck-policy` account-policy-based model/profile selection mechanism.

Acceptance:

- `packages/ck-policy/ai-runtime.matrix.json` remains the source for agent model/budget profiles.
- `packages/ck-policy/entitlements.matrix.json` remains the source for plan caps such as Copilot turns and language limits.
- DevStudio remains the local tool for inspecting/editing these policy matrices.
- Account policy can assign different model profiles to Copilot and Translation through the existing matrix.
- Free tier can route Translation to a low-cost model such as DeepSeek.
- Paid Tier 3 can route Translation to a GPT-5.5-class profile once that model is added to the shared model catalog and runtime matrix.
- The same policy mechanism continues to work for Copilot.
- Widget code does not choose providers or models.
- No translation path may call OpenAI, DeepSeek, or any provider adapter directly.
- Agent results record which profile/model was used for audit/debugging.
- Translation audit records include account ID, agent ID, policy profile, provider, model, policy version, token usage, and result status.
- DevStudio policy changes affect Translation without widget, Roma, Bob, or San Francisco route code changes.
- Tests prove Free and Tier 3 resolve different Translation model profiles through the same mechanism.
- Tests prove Free and Tier 3 resolve different Copilot model profiles through the same mechanism.
- Bob receives only validated draft patches from Copilot.
- Bob receives only validated language values from Translation.
- `widget.instance.translator` stops being endpoint-only product plumbing and becomes executable through the same agent/grant/budget discipline as Copilot, or an intentionally equivalent service-job path that still uses the same runtime policy.

### 103I - San Francisco Agent Runtime Cleanup

Reshape San Francisco so it is visibly Clickeen's AI engine/orchestrator.

Acceptance:

- San Francisco has an explicit runtime layer for grant verification, runtime policy resolution, provider/model selection, execution, usage, and telemetry.
- Bob Copilot is represented as a first-class agent folder/module.
- Instance Translation is represented as a first-class agent folder/module.
- Prague copy translation is separated from account widget translation.
- Bob Copilot and Instance Translation both enter through a shared runtime execution path or intentionally equivalent runtime-backed job entrypoints.
- Product agents cannot bypass runtime by calling provider adapters directly.
- Routes are transport only; they do not own model choice, prompt execution, validation, or product result semantics.
- Tests fail if either agent can execute without runtime policy resolution and result validation.
- Translation helper names no longer define the product boundary.
- Copilot prompt payload construction no longer sits as a loose top-level agent helper.
- Shared utilities such as JSON parsing, language detection, and translation safety are clearly separated from agent product logic.
- The folder structure makes it obvious that San Francisco runs governed agents returning validated product objects.

## Decisions And Open Questions

Decided:

- The first Translation panel review UI is read-only; manual overrides are deferred to PRD 103F.
- Bob does not own translation status. Bob compares Roma settings with Tokyo overlays and may show `X of Y translations ready`.
- Bob's dropdown lists only the base locale plus translations that have Tokyo overlays for enabled target locales.
- While translations are incomplete, clicking the dropdown refreshes Tokyo overlay inventory. Once complete, Bob does not refresh while the user stays in the panel.
- `Generate translations` is the translation trigger for the saved-instance translation agent path, using the current saved instance, current Tokyo language values, and current account policy.
- Publish must prove static base and language files without adding a second readiness/status subsystem.

Open:

1. Where should durable current language value provenance live before manual overrides ship?
   - Option A: one latest overlay object per language coordinate, replacing old versions.
   - Option B: versioned overlay files, latest by version, but no separate pointer vocabulary.

## Out Of Scope

- A/B overlays.
- Geo overlays.
- Industry overlays.
- ABM overlays.
- Multi-overlay stacking.
- Prague page copy localization.
- Minibob/demo translation behavior.
- Translation quality scoring.
- Native-speaker review workflow.

## Success Criteria

The refactor is successful when an engineer can trace the product path without learning internal folklore:

```text
FAQ declares text.
Bob edits FAQ.
Save saves FAQ.
Clickeen translates whole changed fields.
Bob shows translations.
Publish serves them.
```

If a file, route, type, or state machine cannot be explained in that flow, it is deletion-target by default.
