# PRD 085C - San Francisco Customer-Facing Agent Ownership

STATUS: PRE-EXECUTION DISCUSSION

Parent: `085__PRD__San_Francisco_Agentic_Platform_Product_Strategy.md`

This PRD defines how customer-facing agents are allowed to exist.

Customer-facing agents touch trust, product state, budgets, and user experience. They need strict ownership.

---

## 1. Product Goal

Keep only real customer-facing agents.

Every surviving customer-facing agent must have:

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

If an agent cannot answer those questions, it is a deletion or quarantine candidate.

---

## 2. Surviving Product Owner

The surface owner owns the product behavior.

Examples:

- Roma owns Builder copilot UX.
- Tokyo-worker owns account-widget localization storage and queue state.
- San Francisco executes localization generation privately.
- Future support/admin surfaces must own their own user experience and account effects.

San Francisco owns:

- agent execution
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

## 3. Current Agents

Clearly real now:

- `cs.widget.copilot.v1` - Builder copilot
- `widget.instance.translator` - account-owned widget instance translation

Questionable or unowned:

- `sdr.copilot`
- `agent.personalization.onboarding.v1`

Future agents are allowed only after they have a real surface and owner.

Naming decisions:

- Rename `l10n.instance.v1` to `widget.instance.translator`.
- Do not keep the vague `l10n` agent name in active code, contracts, policy, or live docs.
- Prague translation is not this agent. Prague owns a separate internal job: `website.prague.copy.translator`.

---

## 4. Approach

### 4.1 Minimal Agent Ownership Fields

Do not create a new ownership framework.

Ownership must be just enough to prevent zombie agents.

For customer-facing agents, add only these fields to the existing registry/docs:

- `owner`
- `surface`
- `boundary`

The existing boot-time cross-validation between contracts and `AGENT_EXECUTORS` is a good pattern and should be preserved. These fields should strengthen that registry, not bypass it.

No database. No admin UI. No checklist engine. No second registry service.

### 4.2 Contract Checklist

No customer-facing agent can be added without:

- typed input
- typed output
- structured validation
- runtime policy
- budget behavior
- failure behavior
- outcome events
- tests
- docs

### 4.3 Keep / Delete Rule

Keep:

- Builder copilot, because it is live product.
- `widget.instance.translator`, because account-owned widget translation is core product.

Delete:

- `sdr.copilot`
- `agent.personalization.onboarding.v1`

Future sales/acquisition/personalization agents require a new PRD with a real owner and surface.

---

## 5. Deletion Targets

- Placeholder customer agents.
- Agent registry entries without live product owner.
- Grant issuance for deleted/unowned agents.
- Routes for deleted/unowned agents.
- Docs describing deleted agents as live.
- Tests/fixtures that keep deleted agent IDs alive.
- All active `l10n.instance.v1` IDs, after replacing them with `widget.instance.translator`.

---

## 6. Blast Radius

Likely code areas:

- `sanfrancisco/src/agents/*`
- `sanfrancisco/src/index.ts`
- `packages/ck-contracts/src/ai.ts`
- `packages/ck-policy/src/ai-runtime.ts`
- Roma copilot caller code
- account-widget translation caller code
- any Prague/Minibob/funnel references if SDR is deleted or quarantined

Docs:

- `documentation/ai/*`
- San Francisco docs
- Prague/minibob docs if affected

Deleting an agent must not break Builder copilot or account-widget localization generation.

---

## 7. Why This Is World-Class SaaS

Customer-facing AI needs the same discipline as payments, auth, or data writes.

Every agent must have:

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

Builder copilot and `widget.instance.translator` are core because they directly improve widget authoring and global readiness.

Placeholder agents create confusion, cost, and fake architecture. Deleting them makes San Francisco easier to trust and easier to extend.

---

## 9. Execution Readiness Checklist

Before execution:

- Surviving customer-facing/product agents are decided: `cs.widget.copilot.v1` and `widget.instance.translator`.
- Deleted now: `sdr.copilot` and `agent.personalization.onboarding.v1`.
- Rename is decided: `l10n.instance.v1` -> `widget.instance.translator`.
- Ownership metadata is decided: minimal existing-registry/docs fields only (`owner`, `surface`, `boundary`).

Execution is green only when:

- every surviving customer-facing agent has owner metadata in the registry/doc contract
- every deleted agent has no route, registry entry, grant issuance, caller, or live doc
- `l10n.instance.v1` has no active-code or live-doc residue
- Builder copilot still works
- localization generation still works
- residue checks pass for deleted agent IDs

---

## 10. Verification

Required:

- `./node_modules/.bin/tsc -p sanfrancisco/tsconfig.json --noEmit`
- relevant `packages/ck-contracts` checks
- Roma checks if Builder copilot contracts move
- Tokyo-worker checks if localization contracts move
- `rg` residue checks for deleted/renamed agent IDs: `sdr.copilot`, `agent.personalization.onboarding.v1`, `l10n.instance.v1`
- smoke test: Builder copilot
- smoke test: account-widget localization generation
- git-based Cloudflare deploy after implementation
