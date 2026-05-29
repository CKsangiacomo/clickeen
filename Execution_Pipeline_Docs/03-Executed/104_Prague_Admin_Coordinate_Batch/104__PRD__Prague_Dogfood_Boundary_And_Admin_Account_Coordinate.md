# PRD 104 - Prague Dogfood Boundary And Admin Account Coordinate

Status: Parent PRD split for execution
Owner: Product + Architecture
Date: 2026-05-26

## Purpose

Prepare Prague to use Clickeen's own published widgets as proof that the product is good, without making Prague depend on translation internals that are about to change.

This PRD is now the parent architecture contract. Execution is split into focused sub-PRDs:

```text
104A - Admin Account Coordinate Migration
104B - Berlin/Roma Account Context Cleanup
104C - Prague Dogfood Boundary Cleanup
104D - Prague Locale Stub Cleanup
```

## Product Contract

Prague must dogfood Clickeen like a real customer website:

```text
Prague page content embeds a published account-owned widget.
The embed references accountPublicId + instanceId.
The public serving layer serves the widget.
Translation, generation, locale sync, queue state, and materialization internals stay behind Tokyo, San Francisco, and the clk.live static public-serving boundary.
```

Prague may know:

```ts
accountInstanceRef: {
  accountPublicId: "CLICKEEN";
  instanceId: string;
  locale?: string;
}
```

Prague must not know or consume:

```text
translation-generation-job.json
localeSync
translatedValues
localeStatus
baseContentMarker
generationRequestMarker
queuedLocales
pendingLocales
completedLocales
currentReadyLocales
supersededLocales
San Francisco job ids
Tokyo private R2 paths
overlay IDs as product identity
```

## Account Coordinate Decision

The Clickeen platform/admin account coordinate changes from:

```text
00000001
```

to:

```text
CLICKEEN
```

`CLICKEEN` is an 8-character uppercase base36 string and is valid under the existing compact account id contract. This is not a slug system, not an alias layer, and not a special product mode.

Rules:

- `CLICKEEN` is the one compact Clickeen/admin account coordinate, not a slug.
- Runtime field names may still say `accountPublicId`, but that value must equal the one compact account id from the DB Pivot target model.
- No route, policy, entitlement, authoring, or publish behavior may branch on `accountPublicId === "CLICKEEN"`.
- `00000001` becomes historical evidence only. It must not survive as an alias, redirect, fallback, compatibility path, or active product coordinate.
- Old public paths such as `dev.clk.live/00000001/{instanceId}` must return `404` after migration.

## System Vocabulary

All systems must speak the same identity language even if current API field names differ:

| System boundary | Surviving language | Meaning |
| --- | --- | --- |
| Supabase | `accounts.id` | The compact account id. For the Clickeen/admin account this becomes `CLICKEEN`. |
| Berlin | Account context source | Reads account data and emits the same compact account id; must not infer platform/admin behavior from the id string. |
| Roma / auth capsule | `accountPublicId` field carrying the same id | Existing API/capsule field name during cutover. It is not a second public id. |
| Tokyo | `accountId` route/storage coordinate | Authorizes account instance operations against the same compact account id. |
| R2 | `accounts/{accountId}/...` | Stores source documents, assets, and public artifacts under the same compact account id. |
| `clk.live` | `/{accountPublicId}/{instanceId}` URL segment | Public embed coordinate carrying the same compact account id. |
| Prague | `accountInstanceRef.accountPublicId` | Page content reference to a published widget. It must not become Prague-specific identity. |

## Execution Order

Execute the sub-PRDs in this order:

1. `104B` first: delete the fake `isPlatform` account/auth context path and remove magic-id behavior from Berlin/Roma.
2. `104D` next: delete or replace the null Prague locale stub so Prague does not advertise fake locale discovery.
3. `104A` next: migrate the admin account coordinate from `00000001` to `CLICKEEN`.
4. `104C` last: verify Prague dogfoods only public widget coordinates and launch proof pages resolve.

Reason:

```text
Do not migrate the account coordinate while magic-id behavior still exists.
Do not launch Prague while it contains fake locale discovery.
Do not treat Prague boundary verification as complete until the coordinate migration is real.
```

## Required Non-Scope

Do not:

- add `accountSlug`;
- add vanity alias routing;
- add special `CLICKEEN` behavior;
- change the compact account id validator;
- preserve `isPlatform` as an account/auth context field;
- preserve null-returning locale discovery stubs in Prague;
- redesign translation generation in this PRD;
- move translation operation state out of R2 in this PRD;
- implement automatic generate-on-save in this PRD;
- implement automatic rematerialization in this PRD;
- redirect or alias old `00000001` public URLs to `CLICKEEN`;
- preserve both `00000001` and `CLICKEEN` as equal active product coordinates.

## Parent Acceptance

PRD 104 is complete when all sub-PRDs are complete and:

- the Clickeen/admin account coordinate is `CLICKEEN`;
- `00000001` is historical only and cannot resolve as active product truth;
- old `dev.clk.live/00000001/{instanceId}` paths return `404` with no redirect or alias;
- Prague launch pages reference Clickeen-owned widgets by public coordinates only;
- Prague does not depend on translation operation internals;
- the current `isPlatform` account/auth context path is deleted;
- Prague does not retain null-returning locale-discovery stubs;
- all active systems use the same compact account coordinate value for the admin account: Berlin bootstrap, Roma account context, Tokyo account operations, Supabase rows, R2 paths, Prague refs, and `clk.live` URLs.

## Related Sub-PRDs

- [104A - Admin Account Coordinate Migration](./104A__PRD__Admin_Account_Coordinate_Migration.md)
- [104B - Berlin Roma Account Context Cleanup](./104B__PRD__Berlin_Roma_Account_Context_Cleanup.md)
- [104C - Prague Dogfood Boundary Cleanup](./104C__PRD__Prague_Dogfood_Boundary_Cleanup.md)
- [104D - Prague Locale Stub Cleanup](./104D__PRD__Prague_Locale_Stub_Cleanup.md)

