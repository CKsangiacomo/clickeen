# SEO + GEO optimized embed (Iframe++)

STATUS: REFERENCE - MUST MATCH PRD 099E
Last updated: 2026-05-15 (PRD 099E Venice public PBX route contract)

This capability makes an iframe embed SEO/GEO-friendly by adding deterministic host-page metadata:

- SEO: Schema.org JSON-LD in the host `<head>`
- GEO: a readable HTML excerpt in the host DOM for humans and AI crawlers

UI still renders in the iframe at `/widget/{accountPublicId}/{instanceId}`. The "++" part is extra metadata on the host page.

---

## The one thing to remember

Venice does not generate SEO/GEO at request time.

For public traffic, Venice is DB-free and serves only Tokyo published projection bytes:

- the live pointer: `/renders/accounts/{accountPublicId}/instances/{instanceId}/live/r.json` (`no-store`)
- when projected, the meta pointer and immutable meta pack under `/renders/accounts/{accountPublicId}/instances/{instanceId}/meta/...`

If the meta bytes do not exist in Tokyo, the loader skips meta injection and still attempts to render the iframe UI. Venice does not infer, repair, or authorize SEO/GEO at serve time.

---

## Host opt-in

```html
<div
  data-clickeen-account-id="00000001"
  data-clickeen-id="A1B2C3D4E5"
  data-ck-optimization="seo-geo"
></div>
<script src="<VENICE_URL>/embed/latest/loader.js" async></script>
```

This does not change UI mode. UI is always iframe.

Embed producers must provide both `accountPublicId` and `instanceId`. Instance-only `data-clickeen-id` or `/widget/{instanceId}` references are stale PRD 098-era public truth and are not the surviving route contract.

---

## Management-plane gating

SEO/GEO remains an entitlement-gated capability, but the gate is not evaluated by Venice.

Source of truth:

- Entitlement flag: `embed.seoGeo.enabled` in `packages/ck-policy/entitlements.matrix.json`
- Published projection contract: `/renders/accounts/{accountPublicId}/instances/{instanceId}/live/r.json` includes `seoGeo` bases only when Roma/system account operations and Tokyo publication have projected SEO/GEO metadata for that instance.

Non-entitled or disabled instances:

- Bob must not offer the SEO/GEO snippet.
- The published live pointer must not advertise `seoGeo`, so the loader does not request meta artifacts for that instance.
- Missing, unauthorized, or disabled meta bytes are not healed at serve time. Venice returns or proxies the projection state it observes; it does not check billing, tier, compliance, caps, or publish eligibility.

---

## Data flow

When the loader sees `data-ck-optimization="seo-geo"`:

1. Loader fetches the live pointer:

```text
GET <VENICE_URL>/renders/accounts/{accountPublicId}/instances/{instanceId}/live/r.json
```

2. Loader chooses the effective locale using the pointer's `localePolicy`:

- If an embed URL forces `?locale=<token>` and `<token>` is the base locale or has a published language overlay ID, use it.
- Else if `localePolicy.ip.enabled=true`, use geo headers such as `X-Ck-Geo-Country` plus `countryToLocale`.
- Else use `baseLocale`.

3. If and only if the pointer indicates `seoGeo` exists, loader fetches the meta pointer:

```text
GET <VENICE_URL>/renders/accounts/{accountPublicId}/instances/{instanceId}/meta/live/{effective}.json
```

4. The meta pointer returns `metaFp`, then loader fetches the immutable meta pack:

```text
GET <VENICE_URL>/renders/accounts/{accountPublicId}/instances/{instanceId}/meta/{locale}/{metaFp}.json
```

5. Loader injects what it got:

- `<script type="application/ld+json" id="ck-schema-{instanceId}">...</script>` into `<head>`
- Excerpt HTML next to the embed container

Failure rule:

- If any SEO/GEO request fails because the projection or meta pack is missing, disabled, malformed, or temporarily unreachable, the loader skips host metadata injection and still mounts the iframe UI when the widget projection is available.

---

## Notes

- Locale is never encoded into `accountPublicId` or `instanceId`.
- Venice public routes stay DB-free.
- SEO/GEO bytes are produced in the write/management plane and mirrored into Tokyo's account-scoped published projection.
- Public SEO/GEO serving must not depend on root `published/`, root `public/`, root `l10n/`, or instance-only `/renders/widgets/{instanceId}/...` truth.
