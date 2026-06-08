# PRD 108B - Builder Copilot Refactor

Status: PLANNING
Owner: Product + Architecture (Bob, Roma, San Francisco)
Priority: P0
Date: 2026-06-08
Stage: 01-Planning
Type: Sub-PRD from PRD 108
Blocked-by: PRD 108A-1 (model capability + typed provider-error hardening)

Parent:
- `Execution_Pipeline_Docs/01-Planning/108__PRD__San_Francisco_Agent_Platform_Architecture_Decision.md`

Related:
- `bob/components/CopilotPane.tsx`
- `bob/lib/compiler/editor-contract.ts`
- `bob/lib/session/sessionTypes.ts`
- `roma/app/api/account/instances/[instanceId]/copilot/route.ts`
- `roma/lib/ai/account-copilot.ts`
- `sanfrancisco/src/agents/widgetCopilotCore.ts`
- `sanfrancisco/src/agents/csWidgetCopilot.ts`
- `sanfrancisco/src/agents/csPromptPayload.ts`
- `documentation/services/sanfrancisco.md`
- EB-007 (copilot core re-separation)

---

## 0. Purpose

Builder Copilot is the shipped, user-facing AI inside Builder.

It is not a workforce agent. It is not a general chat assistant. It is an interactive
editor assistant for one account-owned widget instance currently open in Bob.

This PRD refactors Builder Copilot so it becomes contract-driven, useful, and safe.
It is the immediate user-facing rescue. It must not wait for the full durable-agent
platform work in 108A-2/108C.

The product definition is simple: **Builder Copilot is a Builder control operator first.**
It operates the same controls the user sees in Builder. It does not "understand widgets"
by reading prose, guessing paths, or hallucinating UI concepts. Bob exposes visible
controls; Copilot resolves user intent to those controls; Bob validates and applies ops to
the in-memory working copy.

This is a grounding/wiring gap, not a schema rebuild. The compiled Builder contract is the
advantage: it already has panels, groups, labels, paths, value types, allowed values, and
current values. The failure is that Copilot currently underuses that strongest local truth
and lets the model guess from raw-ish metadata. Execution must wire Copilot to the contract;
it must not redesign widget state, invent a new schema, or write another agent-platform
paper before passing the editor tests.

Reality gate: before Clickeen can claim an AI-native Builder, the Copilot must handle the
boring edits a user expects. If it cannot understand "button" in the current Builder
contract and change a button from blue to green in preview, the Copilot has failed,
regardless of how correct the broader agent platform is.

That reality gate is necessary, not sufficient. Builder Copilot has two concrete product
jobs:

1. **Operator** - execute clear user intent against visible Builder controls.
2. **Guide** - explain how the current widget works in Builder: what the panels do, where
   controls live, how to add/remove/reorder/configure things, why controls are visible or
   hidden, and how to perform multi-step widget workflows.

The Operator job fixes the lowest embarrassing failure: "change button color to blue" must
be a deterministic Builder edit. The Guide job fixes the larger product failure: Copilot
currently knows isolated ops, but not the whole widget the user is editing. Real users ask
"what do I do in the panels?", "where do I change this?", "how do I add/remove/reorder
that?", and "why is this option missing?" Those are whole-widget questions, not single-op
translation.

Execution is therefore split:

- **108B-1 Operator** - grounding, visible-control resolver, deterministic capability
  answers, structured ops, Bob validation/apply/undo, and the earth-test edits.
- **108B-2 Guide** - whole-widget/panel/workflow understanding: panel map, control map,
  repeatable structures, conditional controls, add/remove/reorder workflows, and
  explanation-to-op apply where appropriate.

108B-1 ships first. 108B-2 is still Builder Copilot, not a workforce agent, but it must not
be confused with abstract advice. It is practical product guidance over the whole current
widget.

The first green bar is not theoretical:

- "What can you edit?" answers from visible Builder controls.
- "Change the button from blue to green" works or asks the right button clarification.
- "Change the button label to Book a demo" works or asks the right button clarification.
- "Hide the button" works or asks the right button clarification.
- "Change the background to white" resolves stage/pod/button/card ambiguity correctly.
- "Make the title bigger" resolves content-vs-typography and title/headline ambiguity
  correctly.
- "Show Made with Clickeen off" edits the Shell behavior control when available.
- "Enable social share" edits the Shell social-share control when available.
- The preview changes immediately through Bob's in-memory working copy.
- No raw provider JSON, fake save/publish, translated-overlay mutation, or stale overwrite
  is allowed.

---

## 1. Product Truth

Builder Copilot is a **User Copilot**.

It is:

- interactive
- synchronous
- account/user-scoped
- bound to one open widget instance
- bound to Bob's in-memory working copy
- driven by one user turn
- allowed to suggest or stage edits
- never an autonomous company operator
- never a direct persistence owner

Builder Copilot consumes San Francisco's AI plane, but it does not define the workforce
agent platform.

---

## 2. Current Product Failure

The current Copilot is below the product bar.

Observed failure:

- User asks: `what can you edit`
- Copilot returns raw upstream provider JSON.
- The error is caused by an invalid model call parameter.

This exposes several failures:

- provider/runtime errors leak into product UX
- model picker can select a model San Francisco cannot call correctly
- Copilot cannot answer basic capability questions from Bob's compiled Builder contract
- Copilot behaves like chat instead of an editor assistant
- the strongest local truth, the Builder control contract, is underused
- Copilot lacks grounded product vocabulary: it does not reliably map user words like
  "button", "CTA", "title", "background", "card", "stage", or "share" to the actual
  Builder controls and paths available in the open widget

Non-failures:

- The widget schema is not missing the ability to represent these edits.
- The Builder contract is not missing an addressable control surface.
- The fix is not to add per-widget Copilot glue for every prompt.
- The fix is not to ask the model to infer product meaning from prose.

The fix is to make natural-language terms resolve deterministically to visible Builder
controls before any model-backed edit plan is accepted.

---

## 3. Target Behavior

### 3.0 Two Copilot capabilities

Builder Copilot must support two capabilities without mixing them:

- **Control operation:** user gives a clear edit request; Copilot resolves it to current
  visible controls and returns validated ops.
- **Builder guidance:** user asks how the widget works or how to do something; Copilot
  answers from the whole current widget contract and current state, using panel/control
  names the user sees.

The second capability depends on the first. Guide answers are only useful if Copilot can
turn direct "do it" follow-ups into exact Builder ops. Otherwise the Guide becomes another
chat panel that explains things but cannot help the user finish.

Runtime Copilot is not Codex with the repo open. It sees the product context Bob/Roma send
to San Francisco for the current turn. Source-code proximity does not automatically give
it whole-widget product understanding. The right input is not "the whole codebase"; the
right input is a shaped Builder snapshot that includes the whole current widget capability
map.

Guide capability requires whole-widget context, not only the single control the user may
edit:

- panel map: Content, Layout, Appearance, Typography, Settings, Translations, and which
  groups each exposes for this widget
- control map: visible controls, labels, aliases, paths, value types, allowed values,
  current values, and disabled/hidden state
- structure map: repeatable lists and item identity for FAQs, cards, logos, splits, etc.
- workflow map: add, remove, reorder, hide/show, link, upload asset, enable social share,
  open in new tab, adjust stage/pod, and other product workflows the widget supports
- conditional map: which controls appear only when another toggle/value is enabled
- current state summary: what is enabled, hidden, empty, missing, or already configured

### 3.1 Copilot answers capability questions deterministically

When the user asks what Copilot can edit, Bob should answer from the compiled Builder
contract without requiring a model call.

The answer should be based on:

- active widget type
- compiled panels
- controls
- control labels
- paths
- current visible/available controls
- Shell vs widget-specific Core ownership

Example answer shape:

```text
I can edit this Call to Action widget's header, Header CTA, stage and pod layout,
appearance, typography, settings, and Call to Action body/action content.
```

The exact wording can be product-designed, but the data source must be deterministic.

### 3.1.1 Copilot understands Builder vocabulary from controls

Copilot must not depend on the model guessing what "button" means. Bob must provide a
grounded vocabulary map derived from the compiled Builder control contract:

- user-facing control label
- group label
- panel name
- path
- value type
- role/category, where declared
- aliases from the contract or deterministic local mapping
- current value

Examples:

- "button" may map to Header CTA controls or widget-specific action controls depending on
  the current visible controls.
- "make the button green" must resolve to the visible button background/color control that
  actually drives the preview.
- "CTA" should resolve to Header CTA only when the user is referring to the Shell header
  control, and to widget-specific action controls only when the current widget exposes
  those controls.

If a user phrase maps to multiple visible controls, Copilot asks a short clarification or
uses the current panel/selection context to choose. It must not silently edit the wrong
button.

The vocabulary map must be user-facing. It may include Shell/Core ownership for reasoning,
but the user should not see internal language like "core.cta" or raw paths as the primary
answer. Similar concepts must have distinct product names:

- Header CTA = the shared Shell header button.
- Action button = the widget-specific body/action button for Call to Action and similar
  widgets.
- Header title = the shared Shell title.
- Action headline, FAQ question, card title, countdown label, etc. = widget-specific
  content controls.

That distinction is the only way "button," "CTA," "title," and "background" become
operable instead of ambiguous model guesses.

### 3.1.2 Deterministic resolver before model planning

Copilot must not start by sending raw control metadata to San Francisco and asking the
model to guess. The first resolver is deterministic:

1. Build the current visible-control vocabulary from Bob's compiled Builder contract.
2. Match the user phrase against user-facing labels, aliases, group labels, panel labels,
   roles/categories, and current selection/panel context.
3. If exactly one visible control target is resolved, pass that target and its value
   contract into the edit planner.
4. If multiple visible controls match, ask one short clarification.
5. If no visible control matches, return a product-safe "I can't edit that from the current
   Builder controls" explanation.

The model may help rewrite text, choose a valid style token, or produce the final op value
after the target control is grounded. It is not allowed to choose between ambiguous product
targets by vibes.

### 3.2 Copilot edits through structured ops only

For edit requests, Copilot returns structured operations.

Allowed output:

- `set`
- `insert`
- `remove`
- `move`

Every op must target a path exposed by the current compiled Builder contract or an
explicitly allowed structural path for repeatable Core data.

No prose instruction may be treated as an edit.

### 3.2.1 Day-one edit intent taxonomy

The execution PRD must cover these Builder Copilot intents first:

- answer what the current widget can edit
- rewrite visible text values
- change tone/length of visible text values
- update Shell content values exposed by the current Builder contract
- update widget-specific content values exposed by the current Builder contract
- update appearance/layout/typography/settings controls exposed by the current Builder
  contract
- add/remove/reorder repeatable Core items where the compiled contract explicitly exposes
  that structure
- explain why a requested edit cannot be performed

Requests outside that taxonomy must fail with a product-safe explanation rather than
guessing or writing private paths.

### 3.2.2 Earth-test scenarios

The first execution slice must prove these simple edits work before any broader Copilot
claim is considered successful:

- "What can you edit?"
- "Change the button from blue to green."
- "Change the button label to Book a demo."
- "Hide the button."
- "Make the title shorter."
- "Make the title bigger."
- "Change the background to white."
- "Make the card/pod shadow softer."
- "Show Made with Clickeen off."
- "Enable social share."
- "Turn off Facebook sharing."
- "Make the button open in a new tab."

Each scenario must update the same in-memory Builder state the manual controls edit, and
preview must reflect the change.

Required scenario tracking:

| User prompt | Required behavior |
|---|---|
| `What can you edit?` | Answer deterministically from visible controls; no model call. |
| `Change the button from blue to green.` | Resolve to the visible button background if unambiguous; otherwise ask Header CTA vs Action button. |
| `Change the button label to Book a demo.` | Resolve label path if unambiguous; otherwise ask Header CTA vs Action button. |
| `Hide the button.` | Hide the resolved button; never delete a scalar path. |
| `Make the title shorter.` | Ask Header title vs widget-specific title/headline unless context resolves it. |
| `Make the title bigger.` | Ask whether the user means text content or typography, and which title if multiple are visible. |
| `Change the background to white.` | Ask stage, pod/container, button, or card background when multiple are visible. |
| `Make the card/pod shadow softer.` | Target card shadow only where card controls exist; otherwise ask whether pod shadow is intended. |
| `Show Made with Clickeen off.` | Set the shared Shell behavior control when visible/available. |
| `Enable social share.` | Set the shared Shell social-share control when visible/available. |
| `Turn off Facebook sharing.` | Edit only the Facebook channel, not the whole social-share feature. |
| `Save it` / `Publish it` | Explain that Copilot edits in Builder; Save/Publish use Builder controls. |
| `Translate this widget to French.` | Explain that translations run from the Translations panel after save; do not rewrite base content. |

### 3.2.3 Guide scenarios

After the Operator earth tests are green, Copilot must support whole-widget Builder Guide
questions. These are not abstract design critiques. They are product-help answers about the
current widget, panels, controls, and workflows.

Required Guide prompts:

- "What do I do in the panels?"
- "Where do I change the button?"
- "How do I add another FAQ/card/logo?"
- "How do I remove this FAQ/card/logo?"
- "How do I reorder the items?"
- "How do I hide the header?"
- "How do I remove the Header CTA?"
- "How do I add social share?"
- "How do I change the stage vs the pod?"
- "Why don't I see the setting for X?"
- "What does this widget let me edit?"
- "Can you do that for me?"

Expected behavior:

- Answer from the current widget's compiled Builder contract and current state.
- Use the same panel/group/control labels the user sees.
- Explain the shortest path through the panels, not generic product documentation.
- Name whether the target is shared Shell or widget-specific only when that distinction
  prevents confusion; otherwise use product labels like Header CTA, Action button, FAQ
  item, card, logo, stage, pod.
- For add/remove/reorder workflows, identify the repeatable structure and item identity.
- For hidden or disabled controls, explain the dependency that reveals it, or state that
  the current widget does not support it.
- When the user asks "Can you do it?", convert the described workflow into validated ops
  when possible.
- Do not invent panels, controls, or workflows that are not present in the current widget
  contract.

Example response shape:

```text
Use Content -> FAQ items to add or remove questions. To reorder them, use the item order
controls in that same group. I can add a new FAQ item for you if you want.
```

If the user asks "do it," the follow-up must target the repeatable FAQ item structure with
validated Bob ops.

### 3.2.4 Guide substrate

108B-2 must define and build the Guide substrate explicitly. It is not implied by schema
access, and it is not a design-judgment layer.

Required substrate:

- **Whole-widget capability map** - Bob/Roma send the full relevant current Builder
  snapshot: widget type, user-facing widget name, panels, groups, visible controls,
  current values, hidden/disabled controls with dependencies, repeatable structures,
  layout, appearance, typography, behavior, active locale, and preview/device context.
- **Panel/workflow map** - a derived map of what users can do in each panel for the current
  widget: content edits, layout changes, appearance changes, typography roles, settings,
  translations, repeatable item actions, asset actions, social share, backlink, header,
  Header CTA, stage, pod, and widget-specific workflows.
- **Repeatable structure map** - item arrays and stable item identity for FAQ questions,
  cards, logos, countdown segments, split sections, and any future repeatable Core data.
- **Conditional control map** - toggles/dependencies that reveal controls, such as enabling
  social share channels, showing a button before button fields appear, or selecting image
  mode before asset controls appear.
- **Guide-to-op bridge** - answers that describe an action must know whether the action can
  be applied immediately as validated ops, needs a required value from the user, or is
  unsupported by the current widget.

### 3.3 Bob validates every op before applying

Bob must validate:

- path exists in the current contract or allowed repeatable structure
- operation is allowed for that control/path
- value type is valid for the target
- index operations are valid
- op does not touch forbidden/private paths
- op does not overwrite unrelated in-memory user edits

Invalid ops fail loudly with a product-safe explanation.

### 3.4 Copilot stages edits in memory

Copilot edits are applied to Bob's in-memory working copy only.

Save remains the normal Roma/Tokyo save path.

No Copilot execution writes durable instance state directly.

The Builder UX uses immediate in-memory apply for valid Copilot ops:

- Bob validates all ops first.
- If validation passes, Bob applies them to the working copy and preview.
- Bob shows a concise summary of what changed using Builder labels, not internal path
  jargon.
- Bob keeps a one-turn undo/revert action for the last Copilot-applied operation set.
- The instance remains dirty until the normal Save path succeeds.

If the working-copy snapshot changed while a Copilot request was in flight, Bob must
revalidate against the current snapshot before applying. If the ops no longer target the
same state safely, Bob rejects them with a product-safe conflict message.

### 3.4.1 Locale rule

Copilot edits only the active Builder base-authoring working copy. It does not write
translated locale overlays, does not generate translations, and does not mutate translated
preview values. Translation remains explicit Translations-panel work after save.

### 3.5 Raw provider errors never reach the user

Builder UI receives product-safe errors only.

Examples:

- `Copilot could not run this model. Try another model or try again.`
- `Copilot could not produce a valid edit for this widget.`
- `Copilot timed out.`

Detailed provider payloads stay in logs/telemetry.

---

## 4. Required Context Passed to Copilot

For model-backed edit turns, Copilot context must include a normalized Builder contract,
not an unbounded dump.

Minimum context:

- widget type
- instance id
- active locale
- current panel/control taxonomy
- editable control paths and labels
- current values for relevant requested paths
- repeatable item summaries where needed
- forbidden paths
- Shell/Core distinction for reasoning, not user-facing jargon
- current state snapshot hash
- grounded vocabulary map from visible controls

The context must represent current visible/available controls, not merely every compiled
path that exists somewhere in the widget contract. Hidden conditional controls, disabled
controls, unavailable account-policy controls, translated-preview values, and private
implementation paths are not Copilot's action surface.

For resolved edit turns, the model-backed context should be smaller than the full control
contract: include the resolved target control(s), relevant neighboring ambiguity context,
allowed value shape, current value, and any repeatable item identity needed for safe
indexing. The whole point of the deterministic resolver is to keep the model from
rediscovering the UI from scratch every turn.

For Guide turns, context must additionally include:

- widget type and user-facing widget name
- panel/group/control map for the current widget
- current content/layout/appearance/typography/behavior summary
- repeatable structures and item identities
- conditional visibility/dependency map
- supported workflows for add/remove/reorder/hide/show/configure/upload/link/share
- visible control vocabulary and allowed edit targets
- account/base locale context where relevant

The Guide context should describe what the user can do in Builder now. It should not be a
generic help-center article, a full source-code dump, or an abstract design critique.

The model should map intent to valid ops. It should not discover the product from raw HTML
or infer allowed paths from stale docs.

---

## 5. UX Requirements

Builder Copilot must feel like part of Builder.

Required UX:

- deterministic capability answer
- no raw JSON provider errors
- clear running state
- clear failed state
- visible summary of proposed/applied edits
- one-turn undo/revert for the last Copilot-applied op set
- ability to retry
- model picker only shows valid, callable options
- Copilot tab does not reset user edit state

The model picker is not the primary UX. It is an advanced/eligible control surfaced only
when policy and model capability allow it.

---

## 6. In Scope

- Fix Builder Copilot's user-facing runtime behavior.
- Separate Copilot behavior from future workforce-agent behavior.
- Use compiled Builder controls as the source of edit capability.
- Build the visible-control vocabulary map that lets Copilot understand user words like
  button/title/background/share/card/stage/pod.
- Build the deterministic resolver that maps natural-language user phrases to visible
  Builder controls before model planning.
- Add deterministic answer for "what can you edit?"
- Add 108B-2 whole-widget Guide answers for "how do I do X?", "where is X?", "what do I
  do in the panels?", and "why is X missing?"
- Validate structured ops before applying.
- Map AI/provider failures to product-safe messages.
- Remove `role`-flag flattening from Copilot core where EB-007 requires it.
- Ensure model picker respects the San Francisco model capability contract from PRD 108A.
- Add day-one intent coverage and fixture/eval scenarios for each shipped widget.

---

## 7. Out of Scope

- GTM Agent.
- UX Writer.
- Support Reply.
- Community Moderation.
- Durable workforce-agent orchestration.
- External outbound tool/MCP layer.
- Any direct San Francisco write to account instance persistence.
- Replacing Builder controls.
- Rebuilding widget schema or adding per-widget prompt glue to compensate for missing
  grounding.
- Letting the model choose edit targets from raw metadata without deterministic visible
  control resolution first.
- Treating repository/source-code access as a substitute for current widget state,
  product/design heuristics, or Builder-control grounding.
- Treating repository/source-code access as a substitute for whole-widget panel/workflow
  context.
- Abstract design critique as the 108B-2 deliverable. Users need practical Builder
  guidance first.

---

## 8. Acceptance Criteria

This PRD is execution-ready only when the execution spec can answer:

- What exact compiled control metadata does Bob expose to Copilot?
- Which paths are editable by Copilot?
- Which paths are forbidden?
- Which ops are supported?
- How does Bob validate op type/value/index?
- How does Bob preserve in-memory edits during Copilot calls?
- What deterministic responses bypass model calls?
- What product-safe errors map from San Francisco errors?
- Which day-one intents are supported?
- How does one-turn undo/revert work?
- What happens when the working-copy snapshot changes while Copilot is running?
- How does locale/base-authoring behavior stay bounded?
- Which fixture/eval scenarios prove Copilot behavior for each shipped widget?
- Which grounded vocabulary entries map common user words to current controls?
- Which panels, groups, controls, repeatable structures, and workflows does Guide expose
  for each shipped widget?
- How are hidden/disabled control dependencies represented?
- How does a Guide answer become validated Builder ops when the user says "do it"?

Execution is complete only when:

- Asking `what can you edit?` returns a useful deterministic answer.
- Day-one supported intents pass fixture/eval scenarios for every shipped widget type.
- Earth-test scenarios pass on Call to Action first, then every shipped widget before
  broader Copilot work is considered green.
- "Change the button from blue to green" passes as a concrete e2e fixture, including
  correct ambiguity handling when Header CTA and Action button both exist.
- The model is never the first system asked to decide what "button," "title,"
  "background," "card," "stage," "pod," or "share" means.
- "What do I do in the panels?" returns a useful whole-widget explanation grounded in the
  current widget's actual panels, groups, and controls.
- "How do I add/remove/reorder X?" answers with the correct current-widget workflow and can
  apply validated ops when enough information is present.
- "Why don't I see X?" explains the actual conditional dependency or states that the
  current widget does not support it.
- Guide answers that offer "I can do that" convert to the same validated Bob ops as manual
  controls.
- Raw upstream provider JSON never renders in Copilot UI.
- Copilot cannot target paths outside the current widget contract.
- Valid edit requests update preview through Bob's in-memory state.
- Valid edit requests show a concise Builder-label summary and provide one-turn undo.
- Invalid model output is rejected without corrupting state.
- In-flight snapshot conflicts are rejected without replacing user edits.
- Copilot edits base-authoring state only; translated locale preview remains read-only.
- Model picker cannot select a currently unsupported model call shape.
- Docs for Builder Copilot and San Francisco match shipped behavior.

---

## 9. Planning Review

1. **Elegant engineering and scalability**
   Yes. The compiled Builder contract is already the source of truth; Copilot should use
   it instead of inventing product knowledge.

2. **Compliance with architecture and tenets**
   Yes. Bob remains the in-memory editor, Roma remains the product host, Tokyo remains
   persistence, and San Francisco remains AI execution.

3. **Avoids over-architecture**
   Yes if execution starts with deterministic contract answers and structured op
   validation before adding broader conversational features.

4. **Moves toward intended architecture**
   Yes. This makes the shipped Copilot worthy of the Builder surface without waiting for
   the future workforce-agent platform.
