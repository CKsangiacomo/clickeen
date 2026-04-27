# 078 PRD - Translation Truth Lives On The Saved Widget

Status: EXECUTED IN CODE
Owner: Tokyo-worker, Roma Builder save, Bob translations panel, San Francisco generation
Priority: P0
Date: 2026-04-27

## 1. Product Truth

Admin widgets and customer widgets use the same translation flow.

Admin is a regular superuser account with broader language entitlement. Widget ownership can affect who may see, copy, or edit a widget. Ownership must not create a separate translation path.

The surviving authority is:

**The Tokyo saved widget pointer and its `l10n` block.**

That block carries the current `baseFingerprint`, account language summary, translation `generationId`, `status`, ready locales, failed locales, and timestamps.

## 2. What Was Wrong

The previous PRD version introduced a separate per-widget translation-state file. That was the wrong shape because it made a second product truth next to the saved widget.

The failure mode was visible in Roma Builder: the widget existed and had saved l10n data, but the translations panel looked for the separate state file and showed "unavailable" when that file was absent.

That was not a translation problem. It was an authority problem.

## 3. Correct Flow

When Bob saves a widget through Roma:

1. Roma sends the widget config and account language intent to Tokyo-worker.
2. Tokyo-worker writes the saved widget config.
3. Tokyo-worker writes the l10n base fingerprint and language summary onto the saved pointer.
4. Tokyo-worker writes translation status onto that same saved pointer.
5. Async queue work generates or refreshes locale artifacts.
6. Queue completion updates the same saved pointer `l10n` status.
7. Bob's translations panel reads that same saved pointer truth through Roma.

No separate translation-state file exists on the product path.

## 4. Hard Rules

- Translation logic must not branch on widget owner.
- Translation logic must not branch on admin versus customer account.
- Queue jobs are machinery, not product truth.
- Public/live text pointers are serving artifacts, not product truth.
- A missing separate state file must never make a saved widget look untranslatable.
- A stale queue job must lose to the latest saved pointer `generationId`.
- If generation fails, the saved pointer `l10n.status` becomes `failed`.

## 5. Verification

The implementation is green only when:

- `tokyo-worker/src/domains/translation-state.ts` is deleted.
- No active code imports or references that deleted translation-state module.
- No active code references `l10n/instances/<publicId>/state/current.json`.
- Tokyo-worker typecheck passes.
- Bob typecheck passes.
- The Bob runtime receives widget configs merged with widget defaults before preview and save.
- Roma Builder translations for admin account widgets use the same path as all other widgets.
