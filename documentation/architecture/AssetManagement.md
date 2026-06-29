# Clickeen Account Asset Library Contract

STATUS: CURRENT SYSTEM OPERATOR SPEC

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
widget software, marketing surfaces, app UI, screenshots, icons, and other
product-owned files.

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

## Route And Storage Contract

Roma owns the user-facing account asset API. Tokyo-worker owns the R2 object
operation.

Operator shape:

```text
authenticated Roma request
-> current account from Berlin/Roma context
-> Roma account asset route
-> Tokyo-worker asset operation
-> accounts/{accountPublicId}/assets/{filename}
```

Tokyo-worker responses must identify the current account asset operation result
without exposing private storage object identity as product truth.

## Upload Boundary

Validation happens before a file becomes an account asset.

Accepted files satisfy:

- account route has a valid current account
- filename is safe for the account asset folder
- path stays inside `accounts/{accountPublicId}/assets/`
- extension is non-scriptable, MIME is accepted, and SVG-like uploads pass SVG
  safety checks
- size is inside the account upload limit enforced by Roma/system account policy
- bytes are accepted by the upload safety checks

SVG is accepted as `image/svg+xml` and classified as a vector asset. SVG safety
checks happen before Tokyo-worker writes the object.

Uploaded fonts are account assets, not product-root media. The accepted font
upload pairs are exact:

- `.woff2` with `font/woff2`;
- `.woff` with `font/woff`, `application/font-woff`, or
  `application/x-font-woff`;
- `.ttf` with `font/ttf` or `application/x-font-ttf`;
- `.otf` with `font/otf` or `application/x-font-otf`.

Do not accept broad `font/*`. SVG fonts, CSS, JavaScript, HTML, XML, WASM, and
scriptable/executable extensions are rejected. Accepted uploaded fonts are
classified as `assetType: "font"` and served through the same account asset CDN
path as other account assets.

## Operator Routes

| Product operation | Roma route | Min role | Tokyo-worker route | Success payload |
| --- | --- | --- | --- | --- |
| List assets | `GET /api/account/assets` | `viewer` | `GET /__internal/assets/account/{accountPublicId}` | `{ accountId, storageBytesUsed, assets }` |
| Resolve asset refs | `POST /api/account/assets/resolve` | `viewer` | `POST /__internal/assets/account/{accountPublicId}/resolve` | `{ assets: [{ assetRef, url }] }` |
| Upload asset | `POST /api/account/assets/upload` | `editor` | `POST /__internal/assets/upload` | `AccountAssetRecord` |
| Delete asset | `DELETE /api/account/assets/{assetRef}` | `editor` | `DELETE /__internal/assets/account/{accountPublicId}/asset/{assetRef}` | `{ accountId, assetRef, deleted: true }` |
| Public asset read | generated/public asset URL | public read | account asset public route | asset bytes or `404` |

Upload also rejects disabled accounts at the Tokyo-worker boundary.

## Upload Contract

Roma upload requests use:

```text
content-type: [accepted MIME type]
x-filename: [single safe filename]
x-source: [asset source]
body: [raw file bytes]
```

The browser/client must not send `x-account-id`. Roma derives the account from
the current session and rejects client-supplied account ids.

Accepted `x-source` values are:

```text
bob.publish
bob.export
devstudio
promotion
api
```

Filename rules:

- one filename only, no folders;
- maximum length is 180 characters;
- starts and ends with an alphanumeric character;
- may contain `A-Z`, `a-z`, `0-9`, `.`, `_`, and `-`.

Upload type rules:

- accepted MIME families are `image/*`, `video/*`, and `audio/*`;
- `application/pdf` is accepted;
- accepted font uploads must match the exact font extension/MIME pairs above;
- scriptable/executable extensions are rejected;
- SVG-like uploads pass SVG safety checks before write.

SVG safety rejects scripts, `foreignObject`, event handlers, JavaScript hrefs,
HTML data URLs, invalid UTF-8, and missing SVG roots.

Uploading the same filename overwrites that account asset. Replacement preserves
the existing `createdAt` value and storage-limit math subtracts the replaced
bytes before applying the new upload size.

## Resolve Boundary

Authoring surfaces store account asset references, not invented public URLs.
Roma resolves those references through Tokyo-worker for the current account.

Generated widget output uses the saved asset reference. Public delivery reads
the asset from the same account folder.

Account asset references are external dependencies of generated widget package
bytes. Replacing an account asset can change delivered media without rewriting
the widget package that references it. That is account asset authority, not a
visitor-time package re-resolution path.

## Delete Boundary

Delete addresses one exact account asset reference in the current account.
Tokyo-worker removes the addressed object from the account asset folder and
returns:

```json
{
  "accountId": "[accountPublicId]",
  "assetRef": "[assetRef]",
  "deleted": true
}
```

Roma accepts delete success only when Tokyo-worker returns the current account
public id, the exact asset reference, and `deleted: true`. Missing, malformed,
wrong-account, wrong-asset, or error-shaped `2xx` responses fail as upstream
contract failures.

References from existing widget instances remain saved widget data. A user can
repair or replace those references by editing the instance in Bob and saving
through Roma.

## Failure Semantics

- Malformed Tokyo success payloads become Roma `502`.
- Missing resolved assets return `422`.
- Corrupt asset metadata or invalid asset keys return validation errors.
- Corrupt metadata/key state is not treated as absence.
- Asset delete of a missing object returns `404`; Roma must not report success.

## Verification

Verify asset behavior through the owning surface:

| Concern | Verification |
| --- | --- |
| Asset appears in product UI | Roma account asset library or `/api/account/assets` |
| Asset object exists | R2 evidence under `accounts/{accountPublicId}/assets/{filename}` after `pnpm cf:preflight` |
| Asset reference saved in a widget | Roma/Bob saved instance state through account instance route |
| Public asset delivery | public runtime request for the generated artifact that references the account asset |

Browser memory proves only the current Bob draft. It does not prove asset
persistence.

## Compliance

This contract matches product law:

- widgets are software; uploaded files belong to the account asset library
- users create and save widget instances in their account
- account assets live in Tokyo under the account
- Bob edits in browser memory and delegates persistence to Roma
- Roma owns current account, policy, and save/upload routes
- Tokyo-worker owns R2 reads and writes
- admin is the normal account `CLICKEEN`, using the same asset library
