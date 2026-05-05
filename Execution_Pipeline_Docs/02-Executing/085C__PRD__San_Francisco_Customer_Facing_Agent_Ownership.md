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
- `l10n.instance.v1` - account-widget localization generation

Questionable or unowned:

- `sdr.copilot`
- `agent.personalization.onboarding.v1`

Future agents are allowed only after they have a real surface and owner.

---

## 4. Approach

### 4.1 Agent Ownership Table

Create a contract/doc table for customer-facing agents.

Required fields:

- `agentId`
- product owner
- surface owner
- surface route/app
- subject type
- auth mode
- grant issuer
- output contract
- write capability
- runtime policy source
- budget behavior
- user-visible failure behavior
- outcome events
- storage owner for output
- deletion owner

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
- Account-widget localization generation, because localization is core product.

Delete or quarantine:

- agents without active product surface
- agents without owner
- agents without caller
- agents with only documentation references
- agents that preserve a dead funnel/demo path

---

## 5. Deletion Targets

- Placeholder customer agents.
- Agent registry entries without live product owner.
- Grant issuance for deleted/unowned agents.
- Routes for deleted/unowned agents.
- Docs describing deleted agents as live.
- Tests/fixtures that keep deleted agent IDs alive.

---

## 6. Blast Radius

Likely code areas:

- `sanfrancisco/src/agents/*`
- `sanfrancisco/src/index.ts`
- `packages/ck-contracts/src/ai.ts`
- Roma copilot caller code
- l10n generation caller code
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

Builder copilot and localization are core because they directly improve widget authoring and global readiness.

Placeholder agents create confusion, cost, and fake architecture. Deleting them makes San Francisco easier to trust and easier to extend.

---

## 9. Execution Readiness Checklist

Before execution:

- Decide which customer-facing agents survive now.
- Decide whether SDR is real now or future-only.
- Decide whether personalization/onboarding is real now or future-only.
- Decide where agent ownership table lives.

Execution is green only when:

- every surviving customer-facing agent has owner table entry
- every deleted agent has no route, registry entry, grant issuance, caller, or live doc
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
- `rg` residue checks for deleted agent IDs
- smoke test: Builder copilot
- smoke test: account-widget localization generation
- git-based Cloudflare deploy after implementation
