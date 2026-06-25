# Prague Marketing Sections

STATUS: CURRENT SYSTEM OPERATOR SPEC

This file is the Prague section registry manual. It documents what Prague can render today from `tokyo/prague/pages/{widget}/{page}.json`.

Prague marketing sections are Astro components registered in `prague/src/lib/blockRegistry.ts`. A section type is valid only when it is registered there.

## Runtime Files

| Concern | File |
| --- | --- |
| Registry and validation | `prague/src/lib/blockRegistry.ts` |
| Page JSON loader | `prague/src/lib/markdown.ts` |
| Section renderer | `prague/src/components/WidgetBlocks.astro` |
| Section components | `prague/src/blocks/**` |
| Layout utilities | `prague/public/styles/layout.css` |
| Primitive utilities | `prague/public/styles/primitives.css` |
| Page JSON source | `tokyo/prague/pages/{widget}/{page}.json` |

## Page JSON Shape

```json
{
  "blocks": [
    {
      "id": "[stable-block-id]",
      "type": "[registered-section-type]",
      "copy": {
        "[copyKey]": "[copyValue]"
      }
    }
  ]
}
```

Rules:

- `id` is stable inside the page.
- `type` is one registered section type.
- `copy` holds the base-language strings and structured string arrays for that section.
- Section-level meta keys are allowed only when listed in the registry.

## Registered Section Contracts

| Type | Component | Required copy | Allowed meta | Rendered |
| --- | --- | --- | --- | --- |
| `big-bang` | `blocks/big-bang/big-bang.astro` | `headline`, `body` | none | yes |
| `hero` | `blocks/hero/hero.astro` | `headline`, `subheadline` | `visual`, `accountInstanceRef`, `items` | yes |
| `split` | `blocks/split/split.astro` | `headline`, `subheadline` | `accountInstanceRef`, `layout`, `copy` | yes |
| `split-carousel` | `blocks/split-carousel/SplitCarousel.astro` | `headline` | `items`, `layout`, `copy` | yes |
| `steps` | `blocks/steps/steps.astro` | `title`, `items[]` | `visual` | yes |
| `subpage-cards` | `blocks/subpage-cards/subpage-cards.astro` | `title`, `items[]` | `links` | yes |
| `control-moat` | `blocks/control-moat/control-moat.astro` | `title`, `items[]` | `visual` | yes |
| `global-moat` | `blocks/global-moat/global-moat.astro` | `title`, `items[]` | `visual` | yes |
| `platform-strip` | `blocks/platform-strip/platform-strip.astro` | `title`, `items[]` | `visual` | yes |
| `cta-bottom-block` | `blocks/cta/cta.astro` | `headline`, `subheadline` | `copy`, `primaryCta` | yes |
| `minibob` | `blocks/minibob/minibob.astro` | `heading`, `subhead` | `copy`, `mode`, `accountInstanceRef` | yes |
| `embed-carousel` | `blocks/embed-carousel/embed-carousel.astro` | none | `items`, `options`, `copy` | yes when renderer supports it |
| `mobile-showcase` | `blocks/mobile-showcase/mobile-showcase.astro` | none | `items`, `options`, `copy` | yes when renderer supports it |
| `feature-explorer` | `blocks/feature-explorer/feature-explorer.astro` | `categories[]` | `options`, `copy` | blocked; registry requires `copy.categories[]`, renderer reads top-level `categories` |
| `navmeta` | data only | `title`, `description` | none | no |
| `page-meta` | data only | `title`, `description` | none | no |

Non-visual sections still live in `blocks[]` because the same page JSON owns SEO and menu copy.

## Account Instance References

Only sections with `accountInstanceRef` in their allowed meta may embed a public widget artifact.

Allowed root shape:

```json
{
  "accountInstanceRef": {
    "accountPublicId": "[accountPublicId]",
    "instanceId": "[instanceId]"
  }
}
```

Allowed nested item shape:

```json
{
  "items": [
    {
      "accountInstanceRef": {
        "accountPublicId": "[accountPublicId]",
        "instanceId": "[instanceId]"
      }
    }
  ]
}
```

Nested refs are currently used by `hero`, `split-carousel`, `embed-carousel`,
and `mobile-showcase`. `embed-carousel` and `mobile-showcase` require non-empty
`items`.

The current validator allows an optional `locale` string on the ref. Treat it only as an explicit public artifact selector when a page author deliberately sets it. It is not active locale authority, not account translation state, and not a discovery instruction.

Rules:

- `accountPublicId` and `instanceId` are required when `accountInstanceRef` exists.
- No other keys are supported inside `accountInstanceRef`.
- Prague must not derive instance identity from widget slug.
- Prague must not use private account folders or account translation folders.

## Section Editing Checklist

1. Read `prague/src/lib/blockRegistry.ts`.
2. Edit only a current page JSON under `tokyo/prague/pages/{widget}/{overview|examples|features|pricing}.json`.
3. Use existing section types unless the task explicitly includes a registry/component change.
4. Keep `page-meta` on every widget page.
5. Keep `navmeta` on every widget overview page.
6. Run Prague checks.

Commands:

```bash
pnpm --filter @clickeen/prague typecheck
pnpm --filter @clickeen/prague build
```

## Hard Stops

Stop if:

- the section type is not registered
- a required copy key is missing
- a page needs account data that is not an explicit public `accountInstanceRef`
- the task asks Prague to own account page or account translation operations
- the task asks for generated translation sidecars without an explicit localization task
- the task asks for `feature-explorer`; current registry validation and renderer input shape are not aligned
