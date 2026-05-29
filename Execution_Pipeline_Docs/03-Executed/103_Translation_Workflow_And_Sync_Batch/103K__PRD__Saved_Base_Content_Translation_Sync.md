# PRD 103K - Saved Base Content Translation Sync

Status: Active authority
Owner: Product + Architecture
Date: 2026-05-25
Replaces: deleted FAQ vertical-slice and translation-job-state PRDs

## Purpose

Make account-widget translation match the product the user actually uses:

```text
Content panel edits saved base content.
Translations panel generates translations for that saved base content.
Each translated locale is either in sync with current saved base content or not.
```

Translation is derived output. It is not a second authoring source, a queue status surface, a job-history product, or a FAQ-specific workflow.

## Product Truth

- The user edits one account-owned widget instance in Bob.
- Roma saves the authored base content through Tokyo.
- The Translations panel generates translated locale values for the current saved base content.
- A translated locale is valid only for the saved base content it was generated from.
- If the base content changes after translation, the locale is out of sync.
- If a translation job is active, Generate is disabled.
- The only normal way to make out-of-sync locales valid again is to click Generate after the base content is saved.

## Required UX

The Translations panel must show four product states clearly:

| State | Product meaning | Generate button |
| --- | --- | --- |
| In sync | Current translated locales were generated from current saved base content. | Enabled only if no job is active and there is work to regenerate. |
| Out of sync | Base content changed after one or more translations were generated. | Enabled if no job is active. |
| Generating | Tokyo has accepted generation for current saved base content and work is active. | Disabled. |
| Failed | Generation failed for current saved base content. | Enabled when no job is active, with failure detail visible. |

Required banner copy when base content changed:

```text
The base content has changed. Regenerate translations.
```

The panel must not show vague preparation copy or imply that translation is progressing before Tokyo has durable accepted work for the current saved base content.

## Required System Model

### 1. Saved Base Content Marker

Tokyo must derive a deterministic marker from the current saved authored text that translation uses.

The marker must include:

- widget type;
- editable-fields contract hash;
- base locale;
- target locale set;
- identity-bearing saved text fields;
- current base text for each identity.

The marker is private Tokyo operation state. It does not need to be a public DB column in V1.

### 2. Translation Locale Sync

For each translated locale, Tokyo must know whether its values were generated from the current saved base content marker.

This can be stored behind Tokyo with the translated value payload or another Tokyo-owned private payload. It must be returned through Tokyo product operations as product state:

```text
locale -> inSync | outOfSync | missing | generating | failed
```

Bob must not infer sync from local dirty state, queue messages, browser timers, or translated value presence alone.

### 3. Generate Is Idempotent While Active

If Generate is requested while generation is already active for the same instance and same current saved base content marker, Tokyo must return the active generation. It must not create a new random current generation.

If Generate is requested while any generation is active for the instance, the product should reject or return the active generation and keep Bob's Generate button disabled. There is no product need for competing generations.

### 4. Completion Applies By Saved Content Marker

San Francisco returns translated values for the saved base content marker it received.

Tokyo applies completion only if:

- the instance still exists;
- the widget contract still matches;
- the target locale is still allowed/requested;
- the current saved base content marker matches the marker in the work.

If the marker does not match, Tokyo records the result as not applied because base content changed. It must not be treated as normal progress, and it must not leave Bob pretending translation is still happening.

### 5. Active Job State Is Only Button/Liveness State

`instances.translation_status` remains coarse control state:

- `idle`
- `queued`
- `running`
- `failed`

It controls the button and list-level product state. It is not translation readiness, not sync truth, not per-locale progress, and not the authority for whether the translated text matches current base content.

### 6. Generic Widget Coverage

This model applies to every widget with `editable-fields.json`.

FAQ has no special product standing. CTA text, repeated content, rich text, logo captions, labels, and any other customer-visible authored text follow the same saved-base-content marker and locale sync rule.

## Delete Targets

Implementation must delete these active concepts from product code and docs:

- job id as the only apply authority;
- previous-generation lineage as product logic;
- active duplicate Generate creating competing work;
- vague queue-progress copy as product truth;
- FAQ-only translation product authority;
- Bob-local spinner state as a substitute for Tokyo sync state.

## Acceptance

- Saving base content makes existing translations visibly out of sync when their marker no longer matches.
- The Translations panel shows the regenerate banner when base content changed.
- Generate is disabled while translation generation is active.
- Repeated Generate while active does not create competing generations.
- San Francisco translated output applies when its saved base content marker still matches.
- San Francisco translated output is rejected with explicit base-changed state when its marker no longer matches.
- Bob can preview translated locales only when Tokyo reports translated values for the selected locale.
- The same flow works for FAQ and at least one non-FAQ widget with repeated text identities.

## Verification

- Unit tests prove marker equality and inequality for changed base text, changed target locale set, repeated-field reorder, deletion, and widget contract changes.
- Tokyo tests prove active Generate is idempotent and does not replace an active same-marker generation.
- Tokyo completion tests prove stale marker completion is rejected because base content changed, not because of a random current job id.
- Bob tests prove the out-of-sync banner and disabled Generate while active.
- Cloud-dev smoke proves: edit content, save, see out-of-sync banner, generate, wait for translated locale, preview translated text, edit base content again, see out-of-sync banner.
