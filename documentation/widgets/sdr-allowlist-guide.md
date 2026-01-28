# SDR Allowlist Authoring Guide

Purpose: define the **only** copy fields the Minibob SDR agent may personalize.

Location:
`tokyo/widgets/{widgetType}/sdr.allowlist.json`

Schema:
```json
{
  "v": 1,
  "paths": [
    { "path": "title", "type": "string", "role": "headline" }
  ]
}
```

Rules:
1. Include **conversion‑critical copy only** (headlines, questions, answers, CTAs).
2. Exclude legal, branding, disclaimers, embed URLs, and any structural fields.
3. Use precise paths; allow `*` only for arrays.
4. `type` must be `string` or `richtext`.
5. Production rule: **no allowlist = no SDR personalization** (fail closed).

Examples:
- FAQ:
  - `title`
  - `sections.*.faqs.*.question`
  - `sections.*.faqs.*.answer`
- Countdown:
  - `timer.headline`
  - `actions.during.text`
  - `actions.after.text`
- LogoShowcase:
  - `header.title`
  - `header.textHtml`
  - `cta.label`
