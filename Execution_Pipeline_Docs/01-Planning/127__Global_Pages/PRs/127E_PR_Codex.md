# 127E — CODEX Execution-Readiness Peer Review

Status: **NOT READY — PRODUCT SHAPE IS RIGHT; EXECUTION BOUNDARIES NEED TO BE PINNED**

Subject: `127E__PRD__Roma_Pages_And_Page_Builder.md`

Date: 2026-08-05

This review consolidates three independent lenses: Staff Engineer, Senior PM,
and Principal TPM. Each reviewer checked 127E against the 127 Mama PRD,
accepted 127A–127D contracts, current product laws and documentation, and the
actual Roma, Bob, Dieter, and Tokyo code.

This is an execution-readiness review. It does not redesign Page Builder and it
does not authorize execution.

## What 127E really does

127E replaces Roma's current all-in-one Pages screen with two real product
surfaces:

1. **Your pages** — the account's saved ordinary Pages and their real stored
   state.
2. **Page Builder** — a Page-specific editor for Page name, ordered Widget
   Instances, SEO/sharing fields, languages, Save, Update, and publication.

Page Builder uses the same proven visual structure as Bob—TopDrawer,
ToolDrawer, and Workspace—and uses Dieter components. It does not turn Bob into
a generic editor, and Bob remains the editor for one Widget Instance.

Creating a Page starts only a browser draft. Save is the first remote write.
Save and Update invoke Web Code Generator. Publish only publishes already-saved
current files.

## Verdict

The customer model, Page taxonomy, and direct cutover are correct. The PRD is
not yet safe to execute because phrases such as "reuse Bob where
product-neutral" leave the hardest boundary open, while the Page-list and Page
Builder input payloads are not named at all. Those gaps would force an executor
to improvise and could produce either a copied Bob, a generic editor framework,
or many browser requests per Page.

The solution is small and remains inside Roma, Bob, Dieter, and existing Tokyo
reads. No new service, draft store, registry, component framework, Queue, or
background process is needed.

## What is correct and must remain

1. **Separate products:** Bob edits one Widget Instance; Page Builder edits one
   Page.
2. **Direct replacement:** the 1,200-plus-line `pages-domain.tsx` is reduced to
   a thin domain/route wrapper, with named inventory and Page Builder
   responsibilities.
3. **Four Page sections:** Page, Content, SEO & sharing, and Languages map
   directly to the accepted 127A Page source.
4. **Browser-only creation:** `/pages/new` creates no Page ID in Tokyo, no
   object, and no generated files before Save.
5. **Explicit operations:** Save and Update generate; Publish does not.
6. **Existing product law:** Pages and retained Pages remain visible to every
   tier; blocked actions use the existing Upgrade interaction and change
   nothing.
7. **Dieter ownership:** Page Builder uses Dieter primitives and established
   Roma interaction/dialog behavior rather than local lookalikes.
8. **No temporary Catalog:** My templates and Page catalog remain 127F work.
9. **Translation stays separate:** Generate translations writes exact Page
   overlays; it never invokes Web Code Generator, and Save/Update never invokes
   Translation Agent.

## Required corrections before execution

### 1. Define the exact Bob-sharing boundary

Bob's current `TopDrawer`, `ToolDrawer`, and `Workspace` are not neutral UI
components:

- `TopDrawer` reads Widget session metadata and sends Bob host actions;
- `ToolDrawer` consumes compiled Widget panels, Widget translations, and
  Copilot state;
- `Workspace` consumes Widget source/packages/assets and uses Bob's Widget
  iframe preview;
- their layout CSS is local to the Bob app.

Therefore 127E must not tell the executor to import those components directly,
widen `WidgetSession` to include Pages, wrap them in compatibility props, or
create a generic editor framework.

Correction:

- reuse the proven builder DOM/class/layout contract and Dieter primitives;
- extract only a genuinely stateless shell/layout seam and its CSS if Bob and
  Page Builder both consume that exact seam;
- keep the Page TopDrawer content, four ToolDrawer sections, Page state, and
  Workspace behavior as small Roma-owned Page components;
- do not route Page controls through Bob's compiler, `CompiledPanel`,
  `WidgetSession`, or control host.

This is visual and structural convergence, not product-state convergence.

### 2. Define one Page-list response

The required Your-pages rows need facts the current summary does not contain:
publication state, `needsUpdate`, and exact saved-output locales. The current
Page list contains only source-derived Page facts.

Correction: extend the existing Roma Page-list response so one request returns
one product-shaped row per Page:

```text
pageId
displayName
published
needsUpdate
saved-output locales
```

Tokyo supplies exact stored facts; Roma assembles their product meaning. The UI
must not issue per-row Page opens or substitute Settings locales for stored
output. This is an existing route response, not a summary service or index.

### 3. Define one authenticated Page Builder open response

Page Builder needs the Page source, serving state, saved Page files, ordered
referenced Instance source/files/overlays, current Page overlays, assets,
typography, and Settings locale facts. No current route owns that complete
input.

Correction: the existing authenticated Roma Page-open boundary returns one
validated, ordered Page Builder envelope assembled through existing Tokyo
reads. It contains exactly the accepted 127B inputs and Page state. It is a
Roma route—not a new service—and it must not call the public Widget URLs or
Bob's full Widget-open route once per placement.

### 4. Make draft Workspace behavior executable

"Mount the Instance files one-for-one" is not precise enough because each
Instance has a complete HTML document plus its own CSS and behavior-only JS.

Correction: for each placement, the draft composition:

- extracts that saved Instance's body content;
- mounts it in Page order inside an editor placement boundary;
- attaches only that Instance's saved CSS and runtime to that placement;
- shows an explicit invalid/missing Instance error instead of omitting or
  replacing it;
- does not deduplicate, apply visitor locale selection, generate Page files, or
  become a second public serving path.

If 127C already exposes a genuinely product-neutral function that mounts
provided generated files into a target, reuse that exact function. Do not
create a shared loader layer only to satisfy the word "reuse."

The UI must distinguish **Draft composition** from the exact saved/generated
Page preview shown after Save or Update.

### 5. Keep locale authorities read-only and truthful

The Languages section must not create a Page-owned locale selector.

- `baseLocale` and current selected locales are read-only facts from account
  Settings.
- Page Builder can link the customer to Settings to change them.
- Save/Update uses the current account `baseLocale` in the submitted ordinary
  Page source.
- The Your-pages Languages column shows locales actually present in the saved
  Page output, not the Settings list.
- Translation status is derived from exact saved-overlay completeness plus the
  current in-memory operation result. It is not persisted as a job or second
  lifecycle.

### 6. Instance Save—not navigation—sets Needs update

The PRD currently says returning from Bob causes Page currency to be derived.
That would make navigation a mutation/probe and miss Instance Saves performed
elsewhere.

Correction: Bob's successful Instance Save triggers 127D. Returning to Page
Builder only reloads the stored Page state. The Page return coordinate uses the
existing non-persisted `returnTo` mechanism and is restricted to the originating
`/pages/{pageId}` route; invalid Page return coordinates fall back to `/pages`.

### 7. Protect dirty Page drafts before Edit in Bob

Navigating to Bob unmounts Roma Page Builder. Current `returnTo` carries a route,
not a Page draft. A dirty draft would therefore disappear unless the executor
invented remote draft storage.

Correction: use the existing unsaved-navigation interaction. A clean, saved
Page may open Bob and return to its exact Page route. A dirty or unsaved Page
must Save, explicitly Discard, or keep editing before navigation. Do not add a
remote draft/session service.

### 8. Keep Update in Page Builder

The Needs-update row action must not run Web Code Generator from the table.
It opens the one Page Builder Update journey, which loads current saved truth,
runs generation in the browser, shows the exact generated result, and submits
through the accepted Save/Update boundary.

### 9. Remove duplicate and open-ended actions

- Remove row-level **Rename**. Page name is already a Page Builder field and is
  persisted through normal Save.
- Remove "other domain actions, if any" and "remaining actions." Only actions
  explicitly named in the PRD may be implemented.
- Remove **Save as template**, Template badge, and template-only UI from 127E.
  127F extends the completed Page Builder with those owned behaviors; 127E must
  not add placeholder branches or feature flags.
- Copy URL and Copy code remain available for every published Page, including a
  published Page that Needs update, because its last stored output is still
  live.

### 10. Pin first-Save identity and blank-draft values

The compact Page ID is minted once in browser memory on the first Save attempt
and retained across retries. It is discarded only when the browser draft is
discarded or creation succeeds. A retry must not silently generate a different
identity.

`/pages/new` initializes directly from the 127A ordinary Page draft contract,
not from a vague "blank Page/template authority" or a temporary Catalog. 127E
must state the exact accepted initial values before coding.

### 11. Apply the existing responsive law

Page Builder follows the documented Roma operational-workspace responsive
contract. It does not silently inherit Bob's unsupported mobile-portrait
exception or Bob's Widget host/device selector. Any Page-specific device
control requires a separately named product need; none is authorized in 127E.

### 12. Consolidate repeated exclusions

Keep the structural cutover table and one short exclusions section. Remove the
repeated prose about frameworks, duplicate CSS, loaders, renderers, temporary
Catalogs, and stale helpers. The named ownership and deletion checklist should
carry the execution contract.

## Proposals from reviewers that are not required

One reviewer proposed two independent inventory filters so customers could
combine Published and Needs update. That is a reasonable future refinement but
not required for the accepted first Page inventory. Keep the one specified
filter—Show all, Published, Unpublished, Needs update—unless product direction
changes.

No reviewer found justification for a generic editor framework, remote draft
store, Page-specific loader service, persisted translation-status system, or
background Page operation.

## Product-owner decisions required

### 1. Edit in Bob from a dirty Page

Approve the recommended simple rule: **Edit in Bob requires a clean saved
Page.** If the Page is dirty, the existing navigation guard requires Save,
explicit Discard, or Keep editing. An unsaved Page cannot open Bob.

### 2. Generate translations inside an already-open Page Builder

Choose the active-session behavior. The recommended rule is:

- the overlay writes set `needsUpdate: true`;
- the already-open Builder remains available so the customer can inspect or
  edit the generated values;
- its primary action becomes **Update page**;
- a fresh open is gated by the 127D modal until Update succeeds.

Immediately blocking the active session would contradict the translation
review flow.

### 3. Blank ordinary Page defaults

Approve exact values for `displayName`, required `values.title`, optional
metadata, and `robots`. The remaining defaults are already decided:
`isTemplate: false`, current account `baseLocale`, empty placements, and no
remote identity before first Save. These values must be written into 127E; the
executor must not invent them.

## Exact documentation updates required after deployment

- `documentation/services/roma.md` — `/pages`, `/pages/new`,
  `/pages/{pageId}`, Page-list row response, Page Builder open envelope,
  browser draft, Save/Update/Publish, tier behavior, and exact Bob return.
- `documentation/services/bob.md` — Bob remains Instance-only; exact Page
  return coordinate and any genuinely shared stateless shell seam.
- `documentation/services/tokyo-worker.md` — only the Page list/open facts its
  existing routes expose.
- `documentation/engineering/UI/surfaces.md` — Page Builder layout and
  responsive contract.
- `documentation/engineering/UI/interactions.md` and
  `dialogs-and-modals.md` — unsaved navigation, Needs update, Add Instance,
  delete confirmation, and Upgrade behavior.
- `documentation/architecture/OverlayArchitecture.md` and
  `documentation/capabilities/localization.md` — read-only Settings authority,
  saved output, overlay completeness, and Page translation UX.
- `documentation/capabilities/seo-geo.md` — always-on ordinary Page metadata
  controls and output.
- `documentation/capabilities/multitenancy.md` — same-account Instance
  selection and retained downgraded Page visibility.
- `documentation/architecture/RuntimeProfiles.md` — draft composition versus
  exact saved/generated Page output.
- `documentation/engineering/PlaywrightE2E.md` — deployed `/pages/new`, dirty
  navigation, Bob return, Save/Update, tier gates, and public actions.
- the 127B Web Code Generator package documentation — Page Builder is the
  browser caller and only Save/Update invokes `generatePage`.

No new Page Builder manual is required unless an existing named workflow doc
cannot own the operational journey.

## V1–V8 result

| Gate | Result before correction | Reason |
| --- | --- | --- |
| V1 | Open | Settings locales can masquerade as saved output; blank defaults remain unstated. |
| V2 | Open | Vague blank/template initialization invites invented defaults. |
| V3 | Open | Page-list facts and the authenticated Page Builder input envelope are missing; return navigation must not become a currency trigger. |
| V4 | Open | Bob return must be constrained to the originating same-account Page route. |
| V5 | Green in intent | Invalid Page/Instance truth remains an explicit error, not a blank draft. |
| V6 | Green in intent | Save, Update, translation, and publication outcomes remain separate. |
| V7 | Open | Wrapping Widget-bound Bob components as generic would preserve the wrong path under a new name. |
| V8 | Green | Normal Page work does not depend on tests, probes, helper checks, or validation rituals. |

Every open gate has a direct correction above. None requires new architecture.

## Execution-readiness conclusion

127E becomes ready after it:

1. pins the small Bob/Dieter sharing boundary without genericizing Bob;
2. defines one Page-list response and one Page Builder open response;
3. defines editor-only draft composition and truthful locale facts;
4. makes Instance Save—not return navigation—the currency trigger;
5. protects dirty drafts and constrains the Bob return route;
6. removes 127F placeholders, duplicate Rename, and open-ended actions;
7. resolves the three product-owner decisions above;
8. names the exact current documentation and deployed verification owners.
