# Clickeen Account Asset Library Contract

This file is the architecture contract for account-owned assets across Roma,
Bob, and Tokyo-worker.

For platform context see [CONTEXT.md](./CONTEXT.md), [Overview.md](./Overview.md),
and [Tenets.md](./Tenets.md).

## Product Model

Account assets are account-owned library files.

Widget instances reference account assets. Account assets remain account-owned
library files. Generated instance output keeps account asset references and
resolves them through the account asset library.

Asset ownership is the account. The active cloud-dev admin account is the normal
account `CLICKEEN`.

SVG logos are regular account assets. When the admin account uploads SVG logos,
Tokyo-worker stores them under:

```text
accounts/CLICKEEN/assets/{filename}
```

## Naming Boundary

Use `assets` for account-owned uploads in Tokyo:

```text
accounts/{accountPublicId}/assets/
```

Use `media` for Clickeen-owned product files used by Prague, Roma, Bob, Dieter,
widget software, marketing surfaces, app UI, screenshots, icons, fonts, and
other product-owned files.

## Authority Chain

| Surface        | Authority                                                                      |
| -------------- | ------------------------------------------------------------------------------ |
| Bob            | Editor control, upload trigger, picker use action, editor reference assignment |
| Roma           | Current account, policy checks, account asset library UX, account asset routes |
| Tokyo-worker   | R2 write/read/delete/resolve for accepted account assets                       |
| Widget runtime | Consumes saved asset references                                                |

The route chain for account assets is:

```text
Roma current account
  -> accountPublicId
  -> Roma account asset route
  -> Tokyo-worker
  -> accounts/{accountPublicId}/assets/{filename}
```

## Operations

The account asset library supports:

- upload
- list
- resolve for authoring and runtime consumption
- delete by exact account asset reference
- reuse from Bob controls

Accepted uploads are direct files under the account asset folder:

```text
accounts/{accountPublicId}/assets/{filename}
```

The account asset list returns current account facts from Tokyo-worker. Storage
usage reads the same account asset authority.

## Upload Boundary

Validation happens before a file becomes an account asset.

Accepted files satisfy:

- account route has a valid current account
- filename is safe for the account asset folder
- path stays inside `accounts/{accountPublicId}/assets/`
- extension and MIME/type match the accepted asset contract
- size is inside the account upload limit enforced by Roma/system account policy
- bytes are accepted by the upload safety checks

SVG is accepted as `image/svg+xml` and classified as a vector asset. SVG safety
checks happen before Tokyo-worker writes the object.

## Resolve Boundary

Authoring surfaces store account asset references, not invented public URLs.
Roma resolves those references through Tokyo-worker for the current account.

Generated widget output uses the saved asset reference. Public delivery reads
the asset from the same account folder.

## Delete Boundary

Delete addresses one exact account asset reference in the current account.
Tokyo-worker removes the addressed object from the account asset folder and
returns current account facts after the mutation.

Roma accepts delete success only when Tokyo-worker returns the current account
public id, the exact asset reference, and `deleted: true`. Missing, malformed,
wrong-account, wrong-asset, or error-shaped `2xx` responses fail as upstream
contract failures.

References from existing widget instances remain saved widget data. A user can
repair or replace those references by editing the instance in Bob and saving
through Roma.

## Compliance

This contract matches product law:

- widgets are software; uploaded files belong to the account asset library
- users create and save widget instances in their account
- account assets live in Tokyo under the account
- Bob edits in browser memory and delegates persistence to Roma
- Roma owns current account, policy, and save/upload routes
- Tokyo-worker owns R2 reads and writes
- admin is the normal account `CLICKEEN`, using the same asset library
