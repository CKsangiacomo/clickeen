# SDR Copilot

STATUS: PLANNED — NOT BUILT

## What it is

A lightweight agent that runs on Prague (the marketing site) inside the minibob
block. It reads a visitor's website, populates a widget showcase with the
visitor's actual content, and converts the visitor into a free account signup.

It is the top of the PLG funnel — the first AI interaction a visitor has with
Clickeen.

## The flow

1. Visitor lands on Prague, sees a widget showcase in the minibob block
2. SDR Copilot asks for the visitor's website URL
3. SDR Copilot fetches the page HTML directly (HTTP fetch — no browser
   automation, no agent-browser)
4. San Francisco executes an approved model from SDR Copilot's free-model pool
   to extract business name, services, FAQ text, contact info, and other
   relevant content
5. SDR Copilot populates the widget showcase with the extracted content using
   simple ops the widget declares for demo purposes
6. Visitor sees what the widget would look like on THEIR site with THEIR content
7. SDR Copilot pushes: "Like what you see? Create a free account"
8. Visitor creates account → email captured → prospect flow → conversion

## How it reads websites — self-contained

SDR Copilot does NOT use agent-browser. Its agent home owns the fetch,
extraction, and showcase-population operation:

- **HTTP fetch** of the visitor's page HTML (one request, no rendering)
- **Governed LLM text extraction** — San Francisco runs one model from the
  approved free-model pool to extract the relevant content (business name,
  FAQs, services, etc.)
- **Widget population** — the extracted content fills the widget showcase

No browser process. No JavaScript execution. No external tool dependencies
that add per-visitor cost. Just an HTTP request and the model's ability to
parse HTML.

**Per-visitor cost: one HTTP request (free) + one free-tier LLM call ($0).**
PLG-viable at any scale.

## LLM — approved free-model pool only

SDR Copilot uses an explicitly approved pool of free model routes through San
Francisco. The pool may include eligible routes from Z.ai, Gemini, Groq, or
other providers approved through Clickeen's existing model-policy authority.
SDR Copilot contains no provider credentials, provider-specific request code,
or provider selection logic.

The economic contract is exact: an SDR request may use only a route currently
approved for the free-model pool and must never substitute a paid route. If no
approved free route is available within its current capacity, the operation
fails visibly. Pool selection is the intended signed policy contract, not an
unbounded provider fallback chain, marketplace, or new registry.

The operations are simple — HTML parsing, text extraction, and content
population — and the approved pool is evaluated for that exact task.

**Model currency dependency:** SDR Copilot depends on the DevOps Agent's LLM
Updates job (weekly) to keep its approved free-model pool current. The DevOps
Agent scouts which free routes are best for SDR Copilot's task profile, detects
rate-limit and term changes, and recommends pool additions or removals. SDR
Copilot is the system's primary free-tier consumer — its viability is directly
tied to that weekly scouting.

## Widget-declared ops

Each widget type declares a small set of simple showcase operations SDR Copilot
can perform in the demo context. Examples:

- FAQ widget: "populate with FAQs extracted from this website"
- Reviews widget: "show what reviews would look like for this business type"
- Contact form: "pre-fill with this business's info"
- Calculator widget: "set up a calculator for this industry"

These are showcase ops — simple content changes that demonstrate the widget's
value with the visitor's own content. Not full editing. The widget contract
declares what's possible; SDR Copilot operates within it.

## Conversion goal

SDR Copilot's entire job is to make the visitor create a free account. The
account creation flows through Berlin's auth system (Google/Apple/Microsoft/
email-password). The captured email feeds prospect sequences through the Comms
Systems email infrastructure.

SDR Copilot is not a sales automation tool or a CRM integration. It is a
product-demo-to-conversion engine.

## Separation from Product Copilot

| | SDR Copilot | Product Copilot |
| --- | --- | --- |
| Surface | Prague / minibob (public, unauthenticated) | Roma / Bob (authenticated product) |
| Users | Anonymous visitors | Logged-in account owners |
| LLM | Approved free-model pool through San Francisco ($0 per visitor) | Exact model allowed by Roma/San Francisco policy |
| Website reading | Approved HTTP fetch + governed extraction | Not part of the current Product Copilot contract; rendered visual context is separate future scope |
| Ops | Simple showcase edits declared per widget | Full widget editing through control catalog |
| Goal | Convert visitor to free account | Help user build their widgets |
| Per-visitor cost | ~$0 | Justified (authenticated user) |

They share San Francisco's governed model-execution seam only. Their agent
homes, product surfaces, context, tools, operation boundaries, and goals remain
separate.

## Safety

Prospect input is data, not instructions. Visitor text must not control tool
calls beyond the declared showcase ops, override product policy, or exfiltrate
account or internal context. SDR Copilot operates in an untrusted environment
— it reads the visitor's website as content to populate a demo, not as
instructions to execute.

## What a future execution PRD must define

- which widgets get SDR Copilot showcases and what ops each declares
- the exact approved free-model pool, signed selection rule, capacity policy,
  and visible failure when no approved free route is available;
- the conversion UX (how SDR Copilot presents the signup prompt)
- HTML fetch limits (timeout, max page size, what happens on fetch failure)
- the prospect email capture flow and handoff to Comms Systems

Do not build SDR Copilot inside Product Copilot work.
