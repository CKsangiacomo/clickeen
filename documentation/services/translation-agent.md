# Translation Agent

Translation Agent is Clickeen's account-widget localization agent home.

For platform context see:

- `documentation/architecture/CONTEXT.md`
- `documentation/services/roma.md`
- `documentation/services/sanfrancisco.md`
- `documentation/services/tokyo-worker.md`

## Product Role

Translation Agent owns translation reasoning and locale overlay creation for
saved account widget instances.

Roma owns the current account, tier, active locales, routes, and save.
San Francisco owns governed model execution.
Tokyo-worker stores exact translated locale files in R2.
Bob displays the user operation.

Active locales are the locales the user wants widgets and pages displayed in.
When Roma Settings finds an active locale missing an overlay file for a saved
instance, Roma calls Translation Agent to create that missing overlay. When Roma
Settings finds an overlay file whose locale is not active, Roma asks Tokyo-worker
to delete the exact overlay file; Translation Agent is not involved in deletion.

## Runtime

Translation Agent runs as a Cloudflare Worker:

```text
agents/translation-agent/src/worker.ts
```

The Worker accepts Roma-issued saved-instance translation work, calls San
Francisco `/v1/model/chat` with the Translation Agent grant, and writes completed
locale overlay values through Tokyo-worker.

The Worker is not public-routed. It is a service-bound agent home for Roma.

The Worker request path is:

```text
POST /v1/translate-instance
```

The request body carries the saved instance coordinate, active locale list,
source text items, and Roma-issued Translation Agent grant. Before model
execution or Tokyo writes, the Worker verifies that the signed grant:

- was issued by Roma;
- has `agent:widget.instance.translator`;
- has `ai.agentId = widget.instance.translator`;
- names the same `accountPublicId` in `trace.accountPublicId`;
- names the same `instanceId` in `trace.instanceId`.
- names the same active locales in `trace.activeLocales`.

The request body alone is not authority for account or instance writes.

The Worker writes a locale overlay only after that locale has complete overlay
values. A model, translation, or Tokyo write failure returns an explicit failure
and cannot be reported as full success. Any completed overlay file already
written remains an exact file in the account instance overlay folder.
Tokyo-worker also verifies the same Roma-issued grant on Translation Agent
writes and accepts the write only for the named account instance and locale.

The Worker does not own account permission, tier permission, locale selection,
review dashboards, background workers, or visitor runtime behavior.

## Product Path

```text
Roma account route
-> Translation Agent Worker
-> San Francisco /v1/model/chat
-> Translation Agent writes locale values through Tokyo-worker
-> Tokyo-worker stores overlay files in R2
```

## Storage

Translated locale values live under the account instance overlay folder:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

Tokyo-worker stores the files. It does not decide active locales or translation
meaning.

## Runtime Smoke

Refresh the cloud-dev Roma auth state and run the product-path smoke:

```bash
pnpm e2e:auth:roma-dev
pnpm e2e:smoke:translation-agent-runtime
```

The smoke runs against Roma cloud-dev. It generates translations for the saved
account instance, verifies the generated overlay inventory through Roma read
routes, reads one overlay value file, and opens Bob's Translations panel against
the same instance.
