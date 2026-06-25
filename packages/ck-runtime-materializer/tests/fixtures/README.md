These fixtures lock PRD 124B base-byte parity against the current Roma
`buildSavedWidgetPublicPackage` implementation.

Capture command used during implementation:

```bash
pnpm --filter @clickeen/ck-runtime-materializer exec tsx tests/capture-legacy-fixture.ts
```

The temporary capture script imported:

```ts
buildSavedWidgetPublicPackage from roma/lib/account-instance-public-package
```

The script was removed after generating `base-expected.ts`; runtime tests do not
import Roma.

