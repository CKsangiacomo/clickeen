# System: Venice

STATUS: REMOVED FROM PUBLIC WIDGET SERVING BY PRD 100F

Venice is no longer an active product service for public widget delivery.

The surviving public serving contract is:

```txt
https://clk.live/{accountPublicId}/{instanceId}
  -> accounts/{accountPublicId}/instances/{instanceId}/index.html
```

Public widget views are static file delivery from Tokyo/R2 through the `clk.live` serving surface. The browser must not call a Venice runtime to resolve identity, fetch config, apply overlays, assemble HTML, or proxy widget software.

Because Clickeen is pre-GA, old Venice routes and loaders were deleted rather than preserved as compatibility shims.
