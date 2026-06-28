# 126 — research

Per-domain, **multi-LLM, original-source** research. This is how each domain
audit gets its "2026 best practice" bar (per-domain method step 3, MAMA §9): two
independent LLMs read what M3, Apple HIG, and OpenAI actually do for that area,
and the converged findings become the lens the audit measures clickeen against.

## North stars (the only allowed sources)

- Material 3 (Google): https://m3.material.io
- Apple HIG: https://developer.apple.com/design/human-interface-guidelines
- OpenAI UI: https://developers.openai.com/apps-sdk/concepts/ui-guidelines

**Original source only (MAMA §4).** No Reddit, no Stack Overflow, no "how to
build X UI" blogposts — that contaminated distribution is what caused the
dated-UI rot. Fetch the primary pages directly.

## Per domain — one pair of docs

For each subPRD (126A accessibility, 126B color, …), **two independent passes**:

- `126X_Research_GLM.md` — GLM's pass.
- `126X_Research_Codex.md` — Codex's pass.

Each doc contains:

- **Sources consulted** — the specific primary pages/sections fetched.
- **What each company does** for this area — extracted from the source, cited
  (not paraphrased from memory).
- **Findings** — where clickeen's current state aligns vs diverges from the bar.
- **Recommendations** — what to adopt/change to meet the 2026 bar, concrete and
  sourced back to the primary.

## Why two LLMs (convergence)

The two docs are compared:

- **Agreement** — both independently extract the same thing from the primaries →
  high-confidence bar; feeds the domain audit directly.
- **Disagreement** — flagged for resolution, re-checked against the source.

Two different LLMs reading the same primaries is **adversarial verification at
the research layer** — it catches each one's blind spots and any hallucination.
A single LLM's summary could be rot; two independently converging is trustworthy.

## How it feeds the program

Converged research **is** step 3 of the per-domain method — the modern lens. The
doctrine (step 5) carries it into the kb doc; the gap audit (step 6, in
`../audits/`) measures clickeen's code against that doctrine; and the final PRD
(step 7) is written from the audit. **Research → doctrine → audit → PRD.**

Research is done once per domain, in series order (§7), scoped to that domain's
question — not a bulk summary of all three systems.
