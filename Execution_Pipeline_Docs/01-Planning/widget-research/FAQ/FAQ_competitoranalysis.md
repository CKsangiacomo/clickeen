# content.faq — FAQ competitor analysis

STATUS: REFERENCE — Competitor inventory (Elfsight) + key takeaways

This doc captures competitor behavior and editor surface area for FAQ widgets (primarily Elfsight), based on the assets in `documentation/widgets/FAQ/CompetitorAnalysis/`.

Canonical Clickeen PRD (what we will build): `documentation/widgets/FAQ/FAQ_PRD.md`.

---

## What competitors ship (the surface area)

### Content model (what users actually edit)
- One or more **sections/categories** (each has a title).
- Each section contains an ordered list of **Q/A items**.
- Each Q/A item is primarily:
  - `question` (short)
  - `answer` (can include links; sometimes rich text)

### Layouts (how the content renders)
Common competitor layouts for the same underlying content:
- **Accordion**: questions collapsed/expanded.
- **List**: all answers visible (non-interactive).
- **Cards / multi-column**: grid layout for dense content.

### Behavior toggles
Typical switches:
- Open first question by default
- Allow multiple open
- Expand all

### Visual customization
Competitors expose similar primitives across widgets:
- Typography (family/size/weight per role)
- Colors (question/answer, surfaces/backgrounds)
- Spacing (gap between items; padding is usually part of the container)
- Icons for accordion expand/collapse

### Media in answers
Many competitors treat URLs in answers as “smart content”:
- Image URLs → render as images
- YouTube/Vimeo URLs → render as embeds
- Otherwise → render as clickable links

---

## Key takeaways for Clickeen

- The widget should be spec’d as **one content tree** (`sections[] → faqs[]`) with stable IDs.
- Layout changes are primarily **data attributes + CSS vars** (not separate implementations).
- Accordion icon choice should be a single enum in state, with a deterministic mapping to expand/collapse icons (Dieter icons).
- “Starter designs” are just **Clickeen-owned instances** users can clone (no separate preset system).

