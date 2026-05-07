# PRD 085C - San Francisco Customer-Facing Copilot Ownership

STATUS: EXECUTED - 2026-05-06

Parent: `085__PRD__San_Francisco_Agentic_Platform_Product_Strategy.md`

This PRD defines how customer-facing copilots are allowed to exist.

Customer-facing AI is called `copilot`. It touches trust, product state, budgets, and user experience. It needs strict ownership.

All other AI work is internal job work, not customer-facing copilot work.

---

## 1. Product Goal

Keep only real customer-facing copilots.

Every surviving customer-facing copilot must have:

- product owner
- surface owner
- subject identity
- auth mode
- runtime policy
- output contract
- write permission boundary
- user-visible failure behavior
- budget/upsell behavior
- outcome events

If a copilot cannot answer those questions, it is a deletion or quarantine candidate.

---

## 2. Surviving Product Owner

The surface owner owns the product behavior.

Examples:

- Roma owns Builder copilot UX.
- Future support/admin surfaces must own their own user experience and account effects.

San Francisco owns:

- copilot execution
- provider/model enforcement
- structured output validation support
- usage metering
- AI logs/outcomes

San Francisco does not own:

- the product surface
- account mutation policy
- widget storage
- support/billing truth
- anonymous funnel truth unless explicitly assigned

---

## 3. Current Copilots

Clearly real now:

- `cs.widget.copilot.v1` - Builder copilot

Product-internal, not customer-facing:

- `widget.instance.translator` - account-owned widget instance translation, owned by PRD 085D as an internal job

Questionable or unowned:

- `sdr.copilot`
- `agent.personalization.onboarding.v1` - not customer-facing; deletion is owned by PRD 085D because it is an internal route/job cleanup.

Future copilots are allowed only after they have a real surface and owner.

Naming rule:

- Customer-facing AI must use `copilot` product language.
- Internal AI must use explicit job language.
- Translators are internal jobs, even when triggered by account/product activity.

Naming decisions:

- Rename `l10n.instance.v1` to `widget.instance.translator` in PRD 085D.
- Do not keep the vague `l10n` agent name in active code, contracts, policy, or live docs after 085D executes.
- Prague translation is not this copilot. Prague owns a separate internal job: `website.prague.copy.translator`.

---

## 4. Approach

### 4.1 Minimal Copilot Ownership Fields

Do not create a new ownership framework.

Ownership must be just enough to prevent zombie agents.

For customer-facing copilots, add only these fields to the existing registry/docs:

- `owner`
- `surface`
- `boundary`

These fields must be required on the existing TypeScript contract shape for surviving copilots. If they are optional, they will drift. Failing the build until each surviving copilot declares them is the desired behavior.

The existing boot-time cross-validation between contracts and `AGENT_EXECUTORS` is a good pattern and should be preserved. These fields should strengthen that registry, not bypass it.

No database. No admin UI. No checklist engine. No second registry service.

### 4.2 Contract Checklist

No customer-facing copilot can be added without:

- typed input
- typed output
- structured validation
- runtime policy
- budget behavior
- failure behavior
- outcome events
- tests
- docs

Execution decision: this checklist is not a new process engine. It is enforced by required TypeScript fields, boot-time registry/executor validation, and the existing PR review checklist. Do not build a separate checklist runner.

### 4.3 Keep / Delete Rule

Keep:

- Builder copilot, because it is live product.

Delete:

- `sdr.copilot`

Future sales/acquisition/personalization copilots require a new PRD with a real owner and surface.

---

## 5. Deletion Targets

- Placeholder customer copilots.
- Copilot registry entries without live product owner.
- Grant issuance for deleted/unowned copilots.
- Routes for deleted/unowned copilots.
- Docs describing deleted copilots as live.
- Tests/fixtures that keep deleted copilot IDs alive.

Deletion ownership:

- PRD 085C owns `sdr.copilot` deletion.
- PRD 085D owns `l10n.instance.v1` -> `widget.instance.translator` rename.
- PRD 085D owns `agent.personalization.onboarding.v1`, `/v1/personalization/onboarding`, and `SanfranciscoCommandMessage` / `sf.command` deletion.

Grant issuance audit:

- Before deleting `sdr.copilot`, run a full-monorepo caller scan, not a San Francisco-only scan.
- Confirm no Roma, Bob, Prague, script, or San Francisco internal path mints an AI grant with `agent:sdr.copilot`.
- Known live account Builder grant issuance is Roma-only for `cs.widget.copilot.v1` in `roma/lib/ai/account-copilot.ts`; verify that remains true.

The widget-translator rename and D1/R2 old-ID safety checks are referenced here only to prevent confusion; execution ownership is PRD 085D.


---

## 6. Blast Radius

Likely code areas:

- `sanfrancisco/src/agents/*`
- `sanfrancisco/src/index.ts`
- `packages/ck-contracts/src/ai.ts`
- `packages/ck-policy/src/ai-runtime.ts`
- Roma copilot caller code
- any Prague/Minibob/funnel references if SDR is deleted or quarantined

Docs:

- `documentation/ai/*`
- San Francisco docs
- Prague/minibob docs if affected

Deleting the SDR agent must not break Builder copilot. Account-widget localization generation is verified in PRD 085D.

---

## 7. Why This Is World-Class SaaS

Customer-facing AI needs the same discipline as payments, auth, or data writes.

Every copilot must have:

- ownership
- permission
- budget
- contract
- audit
- failure semantics

Otherwise AI becomes a pile of demos and hidden product promises.

---

## 8. Why This Is Right For Clickeen

Clickeen's product moat depends on AI that works inside strict product boundaries.

Builder copilot is core because it directly improves widget authoring.

`widget.instance.translator` is also core, but it is a product-internal translation job owned by PRD 085D, not a customer-facing chat/product agent.

Placeholder copilots create confusion, cost, and fake architecture. Deleting them makes San Francisco easier to trust and easier to extend.

---

## 9. Execution Readiness Checklist

Before execution:

- Surviving customer-facing copilot is decided: `cs.widget.copilot.v1`.
- Deleted in this PRD: `sdr.copilot`.
- Deleted in PRD 085D: `agent.personalization.onboarding.v1`.
- Rename owned by PRD 085D: `l10n.instance.v1` -> `widget.instance.translator`.
- Ownership metadata is decided: required existing-registry/docs fields only (`owner`, `surface`, `boundary`), with customer-facing boundary `editor_ops_only`.
- Full-monorepo grant issuance audit must prove no `sdr.copilot` grants survive.

Execution is green only when:

- every surviving customer-facing copilot has owner metadata in the registry/doc contract
- every deleted copilot has no route, registry entry, grant issuance, caller, or live doc
- full-monorepo grant issuance audit is green
- Builder copilot still works
- residue checks pass for deleted copilot IDs

---

## 10. Verification

Required:

- `./node_modules/.bin/tsc -p sanfrancisco/tsconfig.json --noEmit`
- relevant `packages/ck-contracts` checks
- Roma checks if Builder copilot contracts move
- `rg` residue checks for deleted customer-facing copilot IDs: `sdr.copilot`
- full-monorepo grant issuance scan for `agent:sdr.copilot` and `sdr.copilot`
- smoke test: Builder copilot
- git-based Cloudflare deploy after implementation
