# Prague Page Agent Guide

STATUS: CURRENT SYSTEM OPERATOR SPEC

Use this guide only for bounded edits to Prague marketing page JSON.

Prague pages are marketing pages. Account Pages are a different product surface: stacks of saved widget instances owned by Roma and Tokyo-worker.

## Read First

Read these files before editing:

```text
documentation/architecture/CONTEXT.md
documentation/services/prague/prague-overview.md
documentation/services/prague/blocks.md
documentation/capabilities/localization.md
prague/src/lib/blockRegistry.ts
```

Then read the specific page JSON being edited:

```text
tokyo/prague/pages/{widget}/{overview|examples|features|pricing}.json
```

## Allowed Edit Scope

Default edit scope:

```text
tokyo/prague/pages/{widget}/{overview|examples|features|pricing}.json
```

Only edit translation sidecars when the task explicitly asks for Prague page localization:

```text
tokyo/prague/pages/{widget}/{page}.translations/{locale}.json
```

Only edit Prague runtime code when the task explicitly asks for a Prague runtime change:

```text
prague/src/lib/blockRegistry.ts
prague/src/blocks/**
prague/src/pages/**
prague/public/styles/**
```

## Stop Conditions

Stop and ask the human if:

- the widget or page is not named
- the page requested is not `overview`, `examples`, `features`, or `pricing`
- the requested section type is not registered in `blockRegistry.ts`
- the change needs account saves, account translations, Bob editor behavior, or Tokyo account-folder writes
- the task asks for generated translation sidecars but is not a Prague localization task

## Execution Steps

1. Identify the exact page JSON.
   - Compliance: Prague page edits must touch the Prague source authority, not account runtime folders.

2. Confirm all section types already exist in `blockRegistry.ts`.
   - Compliance: Prague renders registered section types only. No invented section names.

3. Edit `blocks[]` in the page JSON.
   - Compliance: `blocks[]` is the current Prague marketing-section implementation field.

4. Keep required non-visual sections.
   - `page-meta` on every page.
   - `navmeta` on overview pages.
   - Compliance: SEO and navigation copy stay in the same page source.

5. Use explicit public widget refs only when embedding a widget.
   - Shape: `accountInstanceRef.accountPublicId` + `accountInstanceRef.instanceId`.
   - Nested item shape is allowed where the registered section supports
     `items[].accountInstanceRef`, currently `hero`, `split-carousel`,
     `embed-carousel`, and `mobile-showcase`.
   - Compliance: Prague embeds public artifacts; it does not discover private account state.

6. Run checks.
   - `pnpm --filter @clickeen/prague typecheck`
   - `pnpm --filter @clickeen/prague build`
   - Compliance: Prague operator evidence comes from the owner surface.

## Final Check

Before finishing, confirm:

- no compiled files were edited
- no unrelated service docs were edited
- no account folders were edited
- no unregistered section type was introduced
- no base copy was substituted for missing localized sidecars
