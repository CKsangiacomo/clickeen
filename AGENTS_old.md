# Agent Philosophy for Clickeen

This is an **AI-native company**. Agents (AI or human) write the code. We succeed or fail based on the quality of engineering decisions, not on shortcuts.

## Core Principles

### 1. Understand the System First
Clickeen is complex and interconnected. **Before touching code:**
- Read `CONTEXT.md` (what we're building)
- Read `WhyClickeen.md` (why it matters)
- Read the relevant system PRD (how it works)
- Understand the architecture, data flow, and constraints

Edit in context. Every change affects the whole.

### 2. No Smoke and Mirrors
- We care about the **integrity of the system**, not ad-hoc fixes that "work for now"
- A change that makes something work but breaks another thing silently is worse than no change
- If downstream impact is unclear, **stop and ask**
- Technical debt compounds; elegant solutions scale

### 3. Elegant Engineering Only
Clickeen scales through **architectural elegance**, not brute force:
- Widget JSON as data (not code) → AI-legible
- Two-API-Call Pattern → infinite scalability
- Dieter tokens → consistent, maintainable design
- ToolDrawer widget-agnostic → one codebase, 100 widgets

When tempted to add special cases, parameters, or workarounds, redesign to be elegant.

### 4. Design & UX is the Moat
**Dieter and design tokens are not optional.** They are the competitive advantage:
- Every component must be beautiful and delightful
- Every component must work consistently across all widgets
- Tokens must be the source of truth (not overrides or exceptions)
- No "good enough" components; design-led excellence applies to everything

When building features:
- Start with Dieter; use existing tokens
- If a new component is needed, design it properly (not a quick patch)
- Update Dieter showcase when adding components
- Ensure it works across all contexts, not just the current widget

### 5. Propose Before Executing
- **Always** show your plan and get approval before making changes
- Declare scope: which systems/files will change?
- Explain trade-offs and alternatives
- If the change is ambiguous, ask clarifying questions (yes/no only)

### 6. Preserve What Works
- No speculative refactors
- No "modernizing" code that isn't broken
- If it works and is well-designed, leave it alone
- Change only what's necessary to solve the problem

### 7. Documentation is Truth
- Update docs when behavior changes
- Documentation drift is a P0 incident
- Code review must include doc review
- If something is undocumented, document it before changing it

---

## In Practice

**Before touching code:**
1. Read the relevant docs (not "I'll figure it out")
2. Understand why the system is designed this way
3. Propose your change (show the diff)
4. Get approval

**While coding:**
1. Follow existing patterns (consistency matters)
2. Use Dieter components and tokens; reuse instead of reinventing
3. Write elegant code, not clever code
4. Update docs simultaneously

**When uncertain:**
1. Ask a yes/no question
2. Ask instead of guessing or proceeding with assumptions
3. Stop and clarify before continuing

---

This is how we maintain a system that scales. Not through patches. Through design.

The moats are **AI-Native, PLG, and Design-Led Excellence**. Protect them.
