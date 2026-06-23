# SEO + GEO Optimized Embed

STATUS: CURRENT SYSTEM CAPABILITY NOTE

Current public widget serving is generated-file serving. Public visitors receive
generated files from:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

Current runtime rule:

- no public visitor request may fetch authoring JSON;
- no public visitor request may fetch overlay JSON directly;
- no public visitor request may call Bob/Roma account APIs;
- no public visitor request may call San Francisco or an agent endpoint;
- public serving uses generated artifacts only.

Locale overlay source truth remains the account instance overlay model owned by
Tokyo-worker:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

Translation generation is documented in
`documentation/ai/agents/translation-agent.md`. Public serving details belong to
the runtime service that serves `clk.live`.
