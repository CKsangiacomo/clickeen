# Clickeen Babel Strategy

STATUS: INFORMATIVE - STRATEGY & VISION

This document explains Babel as a strategic moat. It is not an implementation
spec. Current overlay contracts live in `documentation/architecture/BabelProtocol.md`
and `documentation/architecture/OverlayArchitecture.md`; current localization
behavior lives in `documentation/capabilities/localization.md`.

## Thesis

Babel is Clickeen's doctrine for global content availability.

Clickeen starts from one account-owned source and lets agents create structured
locale overlays from that source. The current implemented surface is
account-instance locale overlays: each active non-base locale can receive a
complete value overlay for declared text fields without duplicating the widget
as separate product truth.

That is the moat: content can become globally available because agents operate
structured artifacts directly, not because humans copy pages and maintain
parallel language trees.

## What Babel Is

Babel is the product principle that:

- source truth is explicit and account-owned;
- translatable fields are declared, not guessed;
- overlays are structured values, not copied products;
- active locales are the account's selected translated locales, capped by
  account policy, not ad hoc request fields;
- generated localized content remains tied to the original source;
- public serving reads stored artifacts instead of inventing localized truth.

Babel can extend beyond widgets only when the surface declares source fields,
overlay paths, write boundaries, and serving semantics. Do not imply that a new
surface participates in Babel until those operator contracts exist.

## Why It Matters

Legacy software treats localization as duplication:

- duplicate a page per language;
- duplicate a widget per language;
- send strings to translators;
- manage stale copies;
- detach discovery metadata from the localized artifact that serves it.

Clickeen treats localization as an agent-operated overlay system:

- the user or system owns one source;
- the Translation Agent operates the declared content;
- the overlay is stored beside the account artifact;
- serving must not pretend a missing localized artifact exists;
- no fallback pretends missing localized content exists.

Babel compounds when more surfaces expose declared translatable fields, exact
overlay value maps, explicit failure on missing values, and named write/read
authorities. Do not add copied locale trees, fallback locale serving, readiness
ledgers, or compatibility readers.

## Strategic Boundary

Babel does not define routes, storage paths, tier ids, worker behavior, page
writer sequencing, model policy, or acceptance criteria. Those belong in
architecture, service, capability, AI, and execution docs.

Use this document to understand why Babel matters. Use the current operator docs
to change how Babel works.
