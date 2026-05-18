# PRD 103A Execution - Teardown Map And Agent Boundary

Status: Green
Executed: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild

## Product Boundary

The only surviving product operation is:

```text
translate saved instance
```

Everything else in the current path is either a transport detail, storage primitive, UI consumer, or legacy name. No later slice may make old text-value routes, old Babel follow-up names, `overlays.text[]`, `agent.md`, selected overlay pointers, or Bob preview inventory the product boundary.

## Current Active Path

One FAQ save now flows through:

1. Bob edits one widget instance in the active locale.
2. Roma `PUT /account/instances/[instanceId]` saves the config to Tokyo.
3. Roma immediately calls `runInstanceTranslationFollowupAfterSave`.
4. Roma loads account language policy, loads the Tokyo widget catalog, and derives saved text from authored `content.json`.
5. Roma mints a grant for `widget.instance.translator` and calls the Instance Translation Agent.
6. San Francisco normalizes the saved-instance request, uses `l10nTranslationCore`, and returns translated current language values.
7. Roma validates exact paths and writes language overlay values to Tokyo.
8. Bob reads overlay inventory/object values and applies them with `resolveOverlay` for preview.
9. San Francisco embed generation applies overlay values with `resolveOverlay` when generating locale files.

## Teardown Map

| Area | Current item | Classification | Surviving authority / decision |
| --- | --- | --- | --- |
| Product operation | Save-triggered translation for a saved account widget instance | keep | `translate saved instance` is the only product operation. |
| Roma save boundary | `roma/app/api/account/instances/[instanceId]/route.ts` | keep | Real account save boundary. It may trigger translation after save, but the route itself is not the translation product boundary. |
| Roma follow-up name | `runInstanceTranslationFollowupAfterSave` | keep | Instance Translation Agent follow-up entrypoint. |
| Roma producer client | `roma/lib/instance-translation-agent-client.ts` | keep | Client for `translate saved instance`; grant minting/policy resolution remains an implementation detail. |
| San Francisco route | Instance Translation Agent route | keep | Product boundary route for saved-instance translation. |
| San Francisco translator implementation | `sanfrancisco/src/l10n-account-routes.ts` | replace | Keep prompt/model execution pieces that serve the agent, but rename away from Babel/text producer and accept the canonical saved-instance text contract. |
| Translator agent id | `widget.instance.translator` | keep | Surviving agent identity, backed by `ck-contracts` registry and `ck-policy` runtime matrix. |
| Copilot agent id | `cs.widget.copilot.v1` | keep | Surviving editor copilot identity. It must consume the widget package, not the translator's narrow field list. |
| Shared model policy | `packages/ck-policy/ai-runtime.matrix.json` | keep | Tier/model budget authority for both copilot and translator agents. Later slices must not introduce a second policy source. |
| AI registry | `packages/ck-contracts/src/ai.ts` | keep | Agent identity and capability authority. Later slices may rename execution surfaces, but not duplicate agent registries. |
| FAQ text declarations | `tokyo/product/widgets/faq/content.json` | keep | Authored translation authority for FAQ customer-visible text. `spec.json` and `overlays.text[]` must not define FAQ translation text independently. |
| FAQ agent contract doc | `tokyo/product/widgets/faq/agent.md` | derive | Rendering and binding notes only. It must not be schema or text authority. |
| Overlay primitive parser | `packages/ck-contracts/src/overlay-primitives.ts` | internal primitive | Can apply and validate path/value maps. It is not allowed to discover FAQ text independently after 103C. |
| Overlay storage object | Tokyo overlay object `{ v: 1, values }` | internal primitive | Storage shape for current language values until 103D.0/103D define durable identity/diff semantics. |
| Selected overlay pointer functions | `writeSelectedOverlayPointer`, `readSelectedOverlayPointer`, `deleteSelectedOverlayPointer` | rename/delete | Current implementation does not persist a pointer; it computes latest complete overlay or deletes objects. The name is false product language. |
| Bob translation preview hook | `useLocaleOverlayPreviewState` | replace | Bob must show current language values for user review, not merely preview overlay inventory. |
| Bob translation panel | `TranslationsPanel` | replace | Must become the FAQ text review surface for translated current language values. |
| Bob workspace preview apply | `Workspace` use of `resolveOverlay` | internal primitive | Acceptable as preview application, not a second widget truth. |
| Publish generator | `sanfrancisco/src/embed-file-writer.ts` overlay application | keep/internal primitive | Uses stored current language values to generate publish language files. Product language should be publish files, not "generation lane" as a user concept. |
| Generation jobs | `sanfrancisco/src/widget-generation-jobs.ts` | replace | `widget.translation` job vocabulary is not enough. Later slices must align jobs to `translate saved instance` and `publish language files`. |
| Copilot widget understanding | `sanfrancisco/src/agents/csPromptPayload.ts` | replace | Must move toward a whole widget package view, not regex text discovery or the translator field list. |

## Duplicate Authority Decisions

- FAQ translation authority: authored `tokyo/product/widgets/faq/content.json`.
- `overlays.text[]`: derive from FAQ `content.json` or delete as authority.
- `agent.md`: derive/document only.
- Copilot prompt payload text discovery: replace with whole widget package understanding.
- Overlay values: storage/application primitive only.
- Bob translation preview inventory: UI read model only.

## Legacy Name Decisions

- `Babel`: replace in product-facing and boundary code. It may exist only as old internal file/function names during a tightly bounded migration slice.
- `text-values`: replace with current language values under the Instance Translation Agent contract.
- `selected overlay pointer`: delete/rename because no durable selected pointer exists today.
- `translation overlay`: rename where it describes current language values. Keep `overlay` only in low-level storage primitives.
- `generation lane`: internal publish status only; user/product path is publish language files.

## Blockers For Next Slices

103C.1 and 103C are blocked from passing unless FAQ translation text is declared once in `content.json`, and Copilot consumes the whole widget package rather than the translator field list.

103B and 103D are blocked from passing unless translation is represented as an Instance Translation Agent operation, not a generic Babel text producer API.

103E is blocked from passing unless Bob displays translated FAQ text values for review, not just an overlay preview/inventory shell.

103G is blocked from passing unless publish reads the same current language values that Bob reviewed.

## Verification

- Teardown map covers Roma, San Francisco, Tokyo-worker, Bob, `ck-contracts`, `ck-policy`, FAQ widget docs/config, and publish generation.
- The map identifies exactly one surviving product operation: `translate saved instance`.
- Every duplicate text authority has a decision: canonicalize, derive, replace, or delete.
- Every legacy term named by PRD 103A has a decision.
- No implementation slice is allowed to proceed by preserving a second FAQ text discovery authority.

TPM signoff: Green. The mapped path preserves the user story from one FAQ edit to translated current language values and publish language files.

Dev Manager signoff: Green. Surviving paths have named authorities; legacy routes/functions are classified as replacement or internal primitives, not product architecture.
