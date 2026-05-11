# SEO + GEO optimized embed (Iframe++)

STATUS: REFERENCE — MUST MATCH RUNTIME  
Last updated: 2026-05-11 (PRD 89 account-instance route closure)

This capability makes an iframe embed **SEO/GEO-friendly** by adding deterministic **host-page** metadata:
- **SEO:** Schema.org JSON‑LD in the host `<head>`
- **GEO:** A readable HTML excerpt in the host DOM (for humans + AI crawlers)

UI still renders in the iframe (`/widget/:instanceId`). The “++” part is just extra metadata on the host page.

---

## The one thing to remember

**Venice does not generate SEO/GEO at request time.**

For public traffic, Venice is DB‑free and serves **only Tokyo bytes**:
- a tiny pointer (`/renders/widgets/:instanceId/live/r.json`, `no-store`), and
- (when entitled) tiny meta pointers + immutable meta packs.

If the meta bytes don’t exist in Tokyo, the loader simply skips meta injection and still renders the iframe UI.

---

## Host opt-in (how a site enables it)

```html
<div data-clickeen-id="ins_..." data-ck-optimization="seo-geo"></div>
<script src="<VENICE_URL>/embed/latest/loader.js" async></script>
```

This does **not** change UI mode. UI is always iframe.

---

## Tier gating (non-negotiable)

SEO/GEO embed is **tier-gated**.

Source of truth:
- Entitlement flag: `embed.seoGeo.enabled` in `packages/ck-policy/entitlements.matrix.json`
- Public live pointer contract: `/renders/widgets/<instanceId>/live/r.json` includes `seoGeo` bases **only when entitled**.

Non-entitled tiers:
- Bob must not offer the SEO/GEO snippet.
- Tokyo must not expose meta artifacts under `/renders/widgets/<instanceId>/meta/...`.

---

## Data flow (what actually happens on the web)

When the loader sees `data-ck-optimization="seo-geo"`:

1) Loader fetches the live pointer:
- `GET <VENICE_URL>/renders/widgets/:instanceId/live/r.json`

2) Loader chooses the effective locale using the pointer’s `localePolicy`:
- If an embed URL forces `?locale=<token>` and `<token>` is in `readyLocales`, use it.
- Else if `localePolicy.ip.enabled=true`: use geo headers (`X-Ck-Geo-Country`, etc) + `countryToLocale`.
- Else use `baseLocale`.

3) If (and only if) the pointer indicates `seoGeo` exists:
- Loader fetches the meta pointer:
  - `GET <VENICE_URL>/renders/widgets/:instanceId/meta/live/<effective>.json`
- The meta pointer returns `metaFp`
- Loader fetches the immutable meta pack from Tokyo (via Venice proxy):
  - `GET <VENICE_URL>/renders/widgets/:instanceId/meta/<locale>/<metaFp>.json`

4) Loader injects what it got:
- `<script type="application/ld+json" id="ck-schema-<instanceId>">…</script>` into `<head>`
- Excerpt HTML next to the embed container

Failure rule:
- If any SEO/GEO request fails (missing pointer/pack, network, etc), the loader still mounts the iframe UI.

---

## Notes

- Locale is never encoded into `instanceId`.
- Venice public routes stay DB‑free.
- SEO/GEO bytes are produced in the write plane (PRD 54B) and mirrored into Tokyo (PRD 54C cleanup rules apply).
