# SEO/GEO/AEO Agent

STATUS: PLANNED - NOT BUILT

The SEO/GEO/AEO Agent is future internal-agent scope.

It will measure and improve crawlable localized content surfaces after the
runtime serving layer exists for locale pages. It is not part of current 121D
Translation Agent execution and is not a visitor request-path model call.

## Future Role

The agent may eventually:

- inspect crawlable locale pages;
- analyze SEO, GEO, and answer-engine performance;
- propose locale-specific title, metadata, schema, and phrasing improvements;
- feed approved improvements back into the Translation Agent or content
  artifacts through governed review/apply paths.

## Boundary

It must not:

- silently rewrite live overlays;
- own Translation Agent generation;
- call models from visitor runtime;
- create duplicate content trees;
- become a generic marketing platform.

The planned sequence remains:

```text
Translation Agent produces overlays
-> clk.live/pages serve crawlable locale pages
-> SEO/GEO/AEO Agent measures and proposes improvements
```
