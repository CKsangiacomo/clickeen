# PRD 103 - Saved Instance Localization Runtime

Status: Active parent truth
Owner: Product + Architecture
Date: 2026-05-25

## Product Truth

The product is simple:

1. The account opens one widget instance in Roma.
2. Bob edits the saved base-locale content.
3. Roma saves that base content to Tokyo.
4. The user opens the Translations panel.
5. The panel tells the user whether translations match the current saved base content.
6. The user clicks Generate translations when translations are missing or out of sync.
7. Tokyo owns the generation state and translated locale values.
8. San Francisco translates the concrete fields Tokyo gives it.
9. Tokyo accepts only completions that match the current saved base content marker.
10. Bob reads Tokyo state and shows translated locales.

Save does not translate. Preview is not source truth. Bob local state is not generation truth.

## Active Authorities

- Storage architecture: `Execution_Pipeline_Docs/02-Executing/103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`
- Generic widget text contract: `Execution_Pipeline_Docs/01-Planning/103J__PRD__Generic_Widget_Translation_System.md`
- Translation sync contract: `Execution_Pipeline_Docs/01-Planning/103K__PRD__Saved_Base_Content_Translation_Sync.md`
- Agent boundary: `Execution_Pipeline_Docs/01-Planning/103B__PRD__Instance_Translation_Agent_Contract.md`
- Source projection boundary: `Execution_Pipeline_Docs/01-Planning/103C__PRD__Shared_Content_Text_Base_For_Copilot_And_Translation.md`
- Manual translated-locale edit: `Execution_Pipeline_Docs/01-Planning/103F__PRD__Translation_Override_UX.md`
- Publish generated language files: `Execution_Pipeline_Docs/01-Planning/103G__PRD__Save_Publish_Generated_Language_Files.md`

## Required Runtime Model

Tokyo must compute a saved base content marker from the saved instance content plus the widget editable-field contract. That marker is the sync identity for translation.

For every selected target locale:

- if the locale has translated values for the current marker, it is in sync;
- if the locale is missing translated values for the current marker, it is out of sync;
- if generation is active for the current marker, Generate is disabled;
- if base content changes during or after generation, existing translations become out of sync until the user generates again for the new marker.

Repeated Generate for the same active marker must return the active operation. It must not create competing work.

Completion applies by marker and locale, not by accidental current job lineage. A stale completion for an older marker is ignored as old work. It must not be the normal result of clicking Generate again for unchanged base content.

## Product UX

The Translations panel must expose these states in plain product language:

- No translations yet: Generate is enabled.
- In sync: translated locales are available for review.
- Out of sync: show `The base content has changed. Regenerate translations.`
- Active generation: Generate is disabled and the panel shows that translation is running for the current saved base content.
- Failure: show a retryable failure state by locale or whole operation, depending on what Tokyo knows.

The panel must not show vague copy that hides product truth. It must not say work is merely being prepared when Tokyo already knows whether work is accepted, active, completed, failed, or out of sync.

## Deleted Product Models

These are not product authority:

- FAQ-only translation contracts.
- Local Bob spinner state as generation truth.
- translated-locale inventory as generation progress.
- queue message existence as user-facing progress.
- job ID lineage as sync identity.
- duplicate Generate creating a new normal generation for unchanged base content.
- source hashes, review states, override status, selected pointers, overlay IDs, storage keys, or version slots in product payloads.
- public artifacts as authoring source truth.

## World-Class SaaS Bar

The system must scale by having one translation contract for every widget:

- widgets declare editable customer-visible text once;
- Tokyo extracts concrete fields from saved instance content;
- San Francisco translates only those fields;
- Tokyo validates exact path coverage and stores locale value maps;
- Bob renders the same product states for every widget.

Adding a new widget should require registering its editable fields and validating the contract. It must not require custom Bob translation UX, FAQ-specific helpers, widget-specific queue semantics, or one-off completion logic.

## Acceptance

- Saving base content makes stale translations visibly out of sync.
- Generate creates or returns one active operation for the current saved base marker.
- Generate is disabled while that operation is active.
- Completion writes translated locale values for the same marker.
- A stale completion cannot overwrite current-marker values.
- Bob shows readiness from Tokyo sync state, not queue plumbing.
- The same flow works for FAQ, Countdown, Logo Showcase, and future widgets that declare editable fields.

