# Built Widget Operator Specs

STATUS: CURRENT SYSTEM OPERATOR SPEC

This folder contains one operator spec per built widget.

Each spec documents:

- widget source folder;
- `spec.json` identity and Core namespace;
- adjacent English ToolDrawer label source;
- customer-visible editable fields;
- entitlement bindings and their Widget-local upsell message contract;
- internal Discovery meaning and important customer-content parts;
- Core state families, source topology, and visitor behavior.

## Architecture Status

The canonical Widget architecture is a per-Widget `widget.html`, structured
contracts, and mandatory `core/core.html`, `core/core.css`, and `core/core.js`,
using shared Stage, Pod, Header, and other generic Clickeen services. New writes
nothing; first Save creates editable source and later Save updates it. Only explicit allowed Publish asks Roma to
materialize complete HTML, CSS, and JavaScript. Core JavaScript owns Widget
behavior and is never the initial-content renderer, materializer, localizer,
preview host, validator, or serving engine.

All five built Widgets implement this topology in the deployed cloud-dev
product. The all-Widget generator compiles each through the same Bob and Roma
artifact path; there is no flat-source compatibility path or Widget
discriminator. Technical deployment, shared lifecycle/materialization gates,
and live package verification pass. Owner acceptance is not an architecture
closure gate.

Each Widget's internal `discovery.json` declares its system baseline, Widget
kind, important customer-content parts, and their relationships. Users do not
edit that file. Free and Tier 1 retain the Clickeen baseline; Tier 2+ may enable
SEO/GEO for Publish to express the exact declared customer-content meaning in
the generated files. Save persists that setting but does not generate public
files.

## Entitlement Message Transition

Every Widget's canonical source includes `upsell/en.json`. Every
customer-facing binding in `limits.json` references one exact message identity
from that file. The message is a complete Widget-context popup-body template;
system account policy supplies current/target plan facts and Roma supplies the
system CTA and shared Popup composition. Core and public runtime never consume
this UI contract.

All five built Widgets include the exact message identities and matching
English templates. Their compiled contracts are consumed by the same Bob edit
decision and Roma Popup composition. There is no generic-copy runtime fallback.

Current built widgets:

```text
big-bang
cards
countdown
faq
logoshowcase
```

| Widget | Current source status |
| --- | --- |
| Big Bang | Canonical Core deployed; shared architecture gates pass |
| Cards | Canonical Core deployed; shared architecture gates pass |
| Countdown | Canonical Core deployed; shared architecture gates pass |
| FAQ | Canonical Core and repeated-identity localization deployed and live-verified |
| Logo Showcase | Canonical Core deployed; shared architecture gates pass |
