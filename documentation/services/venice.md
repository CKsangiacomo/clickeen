# System: Venice

STATUS: SUPERSEDED FOR PUBLIC WIDGET SERVING BY PRD 100

PRD 100 removes Venice from the normal public embed hot path.

Public widget serving target:

```text
public visitor -> embed.clickeen.com/{publicEmbedId} -> cached static files
```

Not:

```text
public visitor -> Venice -> config/overlay/render decision
```

Because Clickeen is pre-GA, old Venice runtime embed routes do not require customer compatibility. They may be deleted, blocked, or replaced as part of PRD 100.

If any Venice route remains during PRD 100 execution, it is dev-only scaffolding for local/internal verification. It must not appear in copied embed code, define production architecture, own account lifecycle behavior, or become a public serving dependency.

Venice must not:

- fetch instance config JSON for public views
- fetch overlay JSON for public views
- apply overlays
- fetch widget HTML and assemble a response
- run publish/unpublish policy
- call Roma, Bob, Berlin, Michael, or San Francisco
- resolve account storage on normal public traffic

The copied embed code is:

```text
https://embed.clickeen.com/{publicEmbedId}
```

Any remaining Venice code must be treated as removal/migration work under PRD 100 slice `100I`.
