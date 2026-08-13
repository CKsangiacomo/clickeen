# SEO/GEO/AEO Agent

STATUS: PLANNED - NOT BUILT

The SEO/GEO/AEO Agent is future planned-agent scope.

It will measure and improve crawlable localized content surfaces after the
runtime serving layer exists for locale pages. It is not part of current 121D
Translation Agent execution and is not a visitor request-path model call.

It is a focused cron/async agent, not Product Copilot, not Translation Agent,
and not a generic marketing platform.

## Product Job

The agent's job is to make Clickeen's locale surfaces rank and get cited after
those surfaces are crawlable.

The intended loop is:

```text
Translation Agent generates locale overlays
-> clk.live/pages serve crawlable locale surfaces
-> SEO/GEO/AEO Agent measures performance
-> SEO/GEO/AEO Agent proposes improvements
-> approved improvements feed future Translation Agent/content work
```

Definitions:

- SEO: search-engine discoverability and ranking in each locale.
- GEO: geographic/local-market intent inside a language or region.
- AEO: answer-engine optimization for AI answer engines and search answer
  experiences.

## Future Role

The agent may eventually:

- inspect crawlable locale pages;
- analyze SEO, GEO, and answer-engine performance;
- propose locale-specific title, metadata, schema, and phrasing improvements;
- feed approved improvements back into the Translation Agent or content
  artifacts through governed review/apply paths.
- track locale-page ranking and indexing status by market;
- identify weak titles, headings, labels, snippets, FAQ answers, and thin
  fields;
- detect local-market phrasing gaps, including regional differences inside a
  language;
- detect answer-engine citation opportunities and answerability gaps;
- produce traceable recommendations that can be reviewed, evaluated, and
  applied through product-owned routes.

## Artifact

This agent operates measurement and recommendation artifacts for published
locale surfaces.

It does not own:

- source instance content;
- Translation Agent overlay generation;
- public serving;
- live overlay files;
- account active locale settings.

## Trigger

Likely triggers are:

- scheduled cron runs;
- explicit operator runs;
- future product events after locale pages are published or changed.

Normal visitor/crawler traffic must never trigger the agent.

## Boundary

It must not:

- silently rewrite live overlays;
- own Translation Agent generation;
- call models from visitor runtime;
- create duplicate content trees;
- become a generic marketing platform.
- directly mutate customer-visible content from cron output;
- bypass eval/review/apply for changes to human-generated content;
- treat external ranking/search data as product truth when the source is
  unavailable or malformed.

The planned sequence remains:

```text
Translation Agent produces overlays
-> clk.live/pages serve crawlable locale pages
-> SEO/GEO/AEO Agent measures and proposes improvements
```

## Execution PRD Admission Gate

A future execution PRD must:

- name the published surface authority: clk.live runtime, Pages, or both;
- name the metrics/source authorities for ranking, indexing, answer visibility,
  and crawler evidence;
- define the measurement artifact shape;
- define the recommendation artifact shape;
- define how recommendations flow back into Translation Agent or content work
  without bypassing review/apply;
- define failure behavior when external search/answer data is unavailable;
- prove that normal product serving stays off the AI request path;
- prove that customer-visible content is not silently rewritten by cron output.
