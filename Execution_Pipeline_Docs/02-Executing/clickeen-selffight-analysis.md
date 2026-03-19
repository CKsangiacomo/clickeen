# Where Clickeen Fights Itself

**A deep analysis of how abstract assumptions in code conflict with the actual product**

| | |
|---|---|
| **Audit date** | March 18, 2026 |
| **Commit** | ce265c15 (post PRD-074 closure) |
| **Scope** | Full monorepo — session layer, policy, compiler, copilot, normalization |
| **Premise** | The product is simple: open a widget, edit it, save it. Entitlements limit what you can do. |
| **Prior audit** | Authoring System Audit (A- overall), 4-Tenet Audit (B+ overall) |

---

### Key Numbers

| 8 | 28 | 154 | 3,199 |
|:-:|:-:|:-:|:-:|
| Processing layers between edit and save | Independent copies of isRecord() | Minibob references in editor + server | LOC in session layer for open/edit/save |

---

### The Core Diagnosis

Clickeen is a simple product: accounts have assets, users open a widget editor, edit, save. Entitlements from their tier are the only constraint. But the codebase was built by AI that coded from abstract assumptions about what the product *might be* rather than what it *is*. The result is a system that doesn't trust its own state, validates data at every boundary instead of once, runs normalization on every keystroke, and mixes an acquisition funnel (Minibob) into the core editing path at 154 touchpoints. The system is not broken — it is fighting itself.

---

## 1. The Actual Product vs. What the Code Assumes

### 1.1 What the product actually is

A user logs in, opens a widget instance in the editor (Bob), changes some fields, saves. Their tier determines what they can and can't do. That's the entire product for the editing surface. There are accounts, each account has assets and widget instances, and one editor.

### 1.2 What the code assumes the product is

The code assumes a multi-product platform with at least two separate editing surfaces (authenticated editor + anonymous acquisition funnel), multiple AI copilot personas with different prompt pipelines, a translation management system with staleness tracking and fingerprint-based change detection, three-dimensional limit enforcement (per-operation, per-load, per-publish), a distributed budget system with client-side shadow counters, a retry/idempotency protocol for frame communication, and a rules engine for data repair.

### 1.3 The gap creates the fighting

When code is written for a product that doesn't exist yet, every layer adds defensive logic against scenarios that never happen. The system ends up checking the same things repeatedly, running normalization on every operation instead of once, maintaining parallel state copies it doesn't need, and branching on product modes that share 90% of their logic. The result: every simple action passes through abstraction layers that were built for a bigger product.

---

## 2. The 8-Layer Edit Path

When a user types a single character in the FAQ editor, this is what happens:

| Layer | What Happens | Where | Should It? |
|---|---|---|---|
| 1. UI binding | Dieter web component emits event, useTdMenuBindings expands linked ops | `bob/components/td-menu-content/` | Yes |
| 2. Op validation | applyWidgetOps validates the op against compiled controls schema | `useSessionEditing.ts` | Yes |
| 3. Normalization | applyWidgetNormalizationRules runs ID dedup, type coercion on FULL config | `useSessionEditing.ts` L174 | No — only on save |
| 4. Limit evaluation | evaluateLimits checks plan caps/flags against the modified config | `useSessionEditing.ts` L176 | Client preview only |
| 5. Locale filtering | If in locale mode, ops on non-allowlisted paths are silently dropped | `useSessionEditing.ts` | Yes, but silently? |
| 6. State cloning | structuredClone to update instanceData + baseInstanceData + undo snapshot | `useSessionEditing.ts` | Partly — 3 copies is excess |
| 7. Preview dispatch | postMessage sends state to widget iframe for live preview | `sessionTransport.ts` | Yes |
| 8. Save (on click) | Server validates: persistable config + asset URLs + widget contract + stableStringify diff | `roma/account-instance-direct.ts` | Yes |

Layers 3 and 6 are the main fighters. Normalization on every keystroke means the system doesn't trust the state it produced 1ms ago. Maintaining 3 copies of the config (instanceData, baseInstanceData, savedBaseInstanceData) exists to support locale overlay compositing and discard comparison — but for a single-locale editor, you need one copy.

### 2.1 Normalization runs 3x per operation cycle

`applyWidgetNormalizationRules` is called in: (1) `applyOps` — every committed edit, (2) `setPreviewOps` — every hover/preview, (3) `applyMinibobInjectedState` — every AI injection. The normalization itself traverses the entire config object doing ID deduplication and type coercion. This is a save-time or load-time concern, not an every-keystroke concern. The server never runs it.

### 2.2 The server doesn't trust the client it just validated

After the client runs 6 validation/normalization layers and sends the config to Roma, the server runs its own entirely separate validation stack: (1) is it a plain object? (2) `configNonPersistableUrlIssues` — scans all URLs for blob/localhost/data URIs, (3) `configAssetUrlContractIssues` — verifies asset URLs match the account, (4) `validateWidgetConfigContract` — checks the full spec shape. Then it also runs the same contract validation on READ, meaning a spec change can make previously-saved data unloadable. The client and server validation stacks don't share a single function.

---

## 3. Minibob: The Acquisition Funnel Inside the Editor

Minibob is an anonymous widget personalization tool — the acquisition funnel. It shares the same editor codebase, the same session state machine, and the same React components as the real product. 154 references across `bob/`, `roma/`, and `sanfrancisco/` show how deeply it's embedded.

### 3.1 Where Minibob pollutes the core editor

| Location | What It Does | Impact on Core Editor |
|---|---|---|
| PolicyProfile type | `'minibob'` is a synthetic tier alongside `'free'/'tier1'/'tier2'/'tier3'` | Every policy-sensitive callsite must handle this extra case |
| `gate.ts` can() | instance.create returns `{allow:false}` for minibob specifically | Widget-specific action in the generic entitlement package |
| `useSessionEditing.ts` | `profile === 'minibob' ? 'signup' : 'upgrade'` appears 3 times | Every upsell branch carries acquisition logic |
| `CopilotPane.tsx` | AccountCopilotPane + MinibobCopilotPane + CopilotSurfaceContract | Entire abstraction exists only to share UI between two modes |
| `ToolDrawer.tsx` | `copilotSurface === 'minibob' ? MinibobCopilotPane : AccountCopilotPane` | Editor layout branches on acquisition mode |
| `widgetCopilotCore.ts` | ~250 LOC of UI_STRINGS + CONSENT_LEXICON + website-fetch flow | SDR personalization flow baked into shared AI core |
| `ai.ts` in ck-policy | Two copilot agents: `sdr.widget.copilot.v1` + `cs.widget.copilot.v1` | Entitlement package knows about AI product variants |
| `sessionTransport.ts` | `resolvePolicySubject(policy)` called 3x to route API calls | Every server request carries acquisition mode metadata |

The fundamental problem: Minibob is not a deployment boundary. It's a runtime string check (`policy.profile === 'minibob'`) that creates branching in every layer. If Minibob were a separate deployment with its own entry point and its own simplified session, the core editor would lose ~150 conditional branches and the CopilotSurfaceContract abstraction would dissolve entirely.

---

## 4. The System Doesn't Trust Its Own State

72 distrust-pattern hits (sanitize/normalize/fallback/coerce/guard) across 7 of 10 session files. The same concern is handled in multiple places because each layer was added independently without removing the one that preceded it.

### 4.1 Duplicate validation across the stack

| Concern | Client (Bob) | Server (Roma) | Should Be |
|---|---|---|---|
| Config shape valid? | sanitizeConfig on load + on AI injection | validateWidgetConfigContract on save AND read | Once on save (server) |
| Fields within plan limits? | evaluateLimits x2 (ops + preview) | Manual raw cap read on publish only | Server on save; client for UX hint only |
| Normalization applied? | applyWidgetNormalizationRules x3 (ops + preview + AI) | Never | Once on load, once before save (server) |
| Policy role is editor? | 3 separate role checks across editing + saving | — | Once at session boundary |
| Policy is non-null? | 5 separate `!policy` early-returns | — | Assert at load; type system after |
| Data changed? | isDirty flag in React state | stableStringify comparison on save | Client skips call if !isDirty |
| AI budget remaining? | consumeBudget() in React (shadow counter) | readAccountBudgetUsed() from KV | KV only; client reads from server |

### 4.2 The 28-copy isRecord problem

The function `isRecord(value)` — a 3-line type guard — is defined independently 28 times across the monorepo. 4 copies live in `bob/lib/session/` alone. Every file that needed it wrote its own because the modules can't safely depend on each other. This prevents shared validation pipelines from ever being built, which is why each layer re-implements validation independently.

### 4.3 Data healing hides bugs

When the editor loads saved data, `sanitizeConfig` strips policy-unauthorized fields before the user sees them. When the user edits, normalization re-shapes the result. When they save, the server validates and may transform the data. When the response comes back, the client replaces its own state with the server's version. At no point does the system say "this data is wrong" — it silently fixes everything. This means bugs in the save path, the AI, or the spec are invisible. The system heals around them instead of failing visibly.

---

## 5. Ghost Scaffolding: Code for Features That Don't Exist

AI that codes from theoretical assumptions builds scaffolding for future features that never arrive. The codebase contains multiple systems that were designed for capabilities the product has never shipped.

| Scaffolding | What It Prepared For | Current Status | LOC Impact |
|---|---|---|---|
| LimitContext: `'ops' \| 'load' \| 'publish'` | Per-context enforcement behavior | `'publish'` context never called in Roma | 3-dimensional limit specs for 1 use |
| AiExecutionSurface: `'queue'` | Async/queued AI agent execution | Never used in any agent registry entry | Dead type member |
| AiBudget.maxCostUsd | AI cost accounting per request | Field never populated, no UI reads it | Dead field |
| AiGrantPolicy.tokenBudgetDay/Month | Daily/monthly token rate limiting | Fields never populated | Dead fields |
| `widget.faq.section.add` ActionKey | Per-action FAQ item limits | Always returns `{allow: true}` | Phantom gate in generic policy |
| SessionId/RequestId map (cap 50) | Multi-host retry/idempotency protocol | One host, one frame, one request | Retry infra for single message |
| Dual boot paths (message + url) | Multiple editor hosting contexts | URL mode is dev-only but ships in prod | Two load paths, one product |
| 543 LOC `ai.ts` in ck-policy | Full AI provisioning in entitlement pkg | Agent registry + model picker in wrong package | Package scope creep |

---

## 6. The Localization Tax

Localization accounts for 1,139 LOC of the 3,199-line session layer — 35.6% of the complexity budget. For a user editing a single-language widget, this code is dead weight.

| File | LOC | Purpose | Impact on Single-Language Editing |
|---|---|---|---|
| `useSessionLocalization.ts` | 845 | Locale switching, allowlist loading, persistence, monitoring | Everything is no-op except baseLocale init |
| `sessionLocalization.ts` | 294 | Snapshot normalization, overlay state resolution, fingerprinting | 28 distrust-pattern hits for unused feature |

The localization state machine tracks: baseLocale, activeLocale, baseOps, userOps, allowlist, allowedLocales, readyLocales, overlayEntries, accountLocalesInvalid, accountL10nPolicy (with IP routing and switcher config), source, dirty, stale, loading, error, and sync (with 5 stages: idle, queuing, translating, ready, failed). This is a translation management system embedded in the widget editor. It's a real feature that the product needs — but it's wired into every save (fingerprint computation), every load (snapshot normalization), and every edit (locale mode filtering). The tax is paid by every user, not just multi-language ones.

---

## 7. Recommended Fixes: Make the Code Match the Product

Every fix below removes code or moves it to the correct boundary. None adds abstraction.

### P0 — Stop fighting on every keystroke

| # | Action | Effort | Impact |
|---|---|---|---|
| 1 | Remove `applyWidgetNormalizationRules` from `applyOps()` and `setPreviewOps()`. Keep it only on load (already there) and add it once before save on the server. | 1 day | Eliminates per-keystroke full-config traversal |
| 2 | Collapse `evaluateLimits` to one client-side call (UX hint only). Add server-side evaluateLimits on save/publish in Roma. | 1-2 days | Ends client-as-authority anti-pattern |
| 3 | Extract `isRecord`/`isPlainRecord` to `@clickeen/ck-contracts`. Delete 28 copies. | 0.5 day | Unblocks shared validation pipelines |

### P1 — Remove Minibob from the editor

| # | Action | Effort | Impact |
|---|---|---|---|
| 4 | Make Minibob a separate entry point / deployment. Remove `'minibob'` from PolicyProfile. Collapse CopilotSurfaceContract. | 2-3 days | Removes ~150 conditional branches from the editor |
| 5 | Move SDR copilot (`widgetCopilotSdrProduct`, UI_STRINGS, CONSENT_LEXICON, website-fetch) out of `widgetCopilotCore.ts` into its own entry. | 1 day | ~250 LOC of acquisition logic exits the shared core |
| 6 | Move `ai.ts` out of ck-policy into sanfrancisco or a dedicated ck-ai package. | 1 day | 543 LOC of AI provisioning exits the entitlement library |

### P2 — Delete ghost scaffolding

| # | Action | Effort | Impact |
|---|---|---|---|
| 7 | Delete AiExecutionSurface `'queue'`, AiBudget.maxCostUsd, tokenBudgetDay/Month, phantom FAQ ActionKeys. | 0.5 day | Removes dead abstractions |
| 8 | Remove URL boot path from production bundle (gate behind dev flag). | 0.5 day | Eliminates dual-boot branching |
| 9 | Remove SessionId/RequestId map and retry protocol. Single message handshake. | 0.5 day | Eliminates unnecessary idempotency infra |
| 10 | Collapse 3 config copies to 2 (remove savedBaseInstanceData, use server response as discard reference). | 1 day | Reduces clone overhead and state surface |

---

## 8. Conclusion

The Clickeen codebase was not built by an engineer who forgot the product requirements. It was built by AI that never had them. When an AI codes without deep product context, it defaults to generic defensive patterns: validate at every boundary, normalize on every operation, support multiple product modes in one codebase, pre-build scaffolding for features that might be needed. Each decision is locally rational but globally creates a system that fights itself.

PRD 074 recognized this and made real progress: it closed the FAQ contract, hardened the compiler boundary, split the copilot surfaces, and held a net-negative LOC bar. But the deeper structural issues remain. Normalization still runs on every keystroke. Minibob is still a runtime string check in 154 places. The policy package still contains an AI provisioning system. 28 copies of isRecord prevent shared pipelines from being built.

The fix is not more abstraction. It's less. Make the code match the product. A user opens a widget, edits it, saves it. That's 3 operations. The session layer should be proportional to that simplicity. Normalize once, validate once, save once. The entitlement package should know about entitlements, not AI models. The editor should know about editing, not acquisition funnels. Every line of code should be there because the product needs it today, not because something might need it tomorrow.

---

*Sources: Direct code analysis of [CKsangiacomo/clickeen](https://github.com/CKsangiacomo/clickeen) repository at commit ce265c15. PRD 074 execution log. Prior audit findings from March 17-18, 2026.*
