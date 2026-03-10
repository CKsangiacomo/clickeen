# SEO + GEO optimized embed (Iframe++)

STATUS: REFERENCE — MUST MATCH RUNTIME  
Last updated: 2026-03-01 (PRD 54 pivot)

This capability makes an iframe embed **SEO/GEO-friendly** by adding deterministic **host-page** metadata:
- **SEO:** Schema.org JSON‑LD in the host `<head>`
- **GEO:** A readable HTML excerpt in the host DOM (for humans + AI crawlers)

UI still renders in the iframe (`/e/:publicId`). The “++” part is just extra metadata on the host page.

---

## The one thing to remember

**Venice does not generate SEO/GEO at request time.**

For public traffic, Venice is DB‑free and serves **only Tokyo bytes**:
- a tiny pointer (`/r/:publicId`, `no-store`), and
- (when entitled) tiny meta pointers + immutable meta packs.

If the meta bytes don’t exist in Tokyo, the loader simply skips meta injection and still renders the iframe UI.

---

## Host opt-in (how a site enables it)

```html
<div data-clickeen-id="wgt_..." data-ck-optimization="seo-geo"></div>
<script src="<VENICE_URL>/embed/latest/loader.js" async></script>
```

This does **not** change UI mode. UI is always iframe.

---

## Tier gating (non-negotiable)

SEO/GEO embed is **tier-gated**.

Source of truth:
- Entitlement flag: `embed.seoGeo.enabled` in `packages/ck-policy/entitlements.matrix.json`
- Live pointer contract: `renders/instances/<publicId>/live/r.json` includes `seoGeo` bases **only when entitled**

Non-entitled tiers:
- Bob must not offer the SEO/GEO snippet.
- Tokyo must not store meta pointers/packs under `renders/instances/<publicId>/live/meta/...` or `renders/instances/<publicId>/meta/...`.

---

## Data flow (what actually happens on the web)

When the loader sees `data-ck-optimization="seo-geo"`:

1) Loader fetches the live pointer:
- `GET <VENICE_URL>/r/:publicId`

2) Loader chooses the effective locale using the pointer’s `localePolicy`:
- If an embed URL forces `?locale=<token>` and `<token>` is in `availableLocales`, use it.
- Else if `localePolicy.ip.enabled=true`: use geo headers (`X-Ck-Geo-Country`, etc) + `countryToLocale`.
- Else use `baseLocale`.

3) If (and only if) the pointer indicates `seoGeo` exists:
- Loader fetches the meta pointer:
  - `GET <VENICE_URL>/r/:publicId?meta=1&locale=<effective>`
- The meta pointer returns `metaFp`
- Loader fetches the immutable meta pack from Tokyo (via Venice proxy):
  - `GET <VENICE_URL>/renders/instances/<publicId>/meta/<locale>/<metaFp>.json`

4) Loader injects what it got:
- `<script type="application/ld+json" id="ck-schema-<publicId>">…</script>` into `<head>`
- Excerpt HTML next to the embed container

Failure rule:
- If any SEO/GEO request fails (missing pointer/pack, network, etc), the loader still mounts the iframe UI.

---

## Notes

- Locale is never encoded into `publicId`.
- Venice public routes (`/e`, `/r`) stay DB‑free.
- SEO/GEO bytes are produced in the write plane (PRD 54B) and mirrored into Tokyo (PRD 54C cleanup rules apply).
