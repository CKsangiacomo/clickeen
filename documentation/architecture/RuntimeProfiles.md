# Runtime Profiles

The local Bob/Berlin/Tokyo support-stack emulation has been retired. Product
runtime evidence comes from the deployed cloud-dev surfaces:

- Bob: `https://bob.dev.clickeen.com`
- Berlin: `https://berlin.dev.clickeen.com`
- Roma: `https://roma.dev.clickeen.com`
- Tokyo: `https://tokyo.dev.clickeen.com`
- Public serving: `https://dev.clk.live`
- DevStudio: `https://devstudio.clickeen.com`

There is no supported local Tokyo CDN stub, local Berlin worker fork, local
Tokyo-worker fork, or one-command local stack script. Local package commands are
for isolated build/debug work only and are not product runtime evidence.

Tokyo-worker keeps the same PBX boundary in deployed runtime. It may validate
service auth, account capsule to path match, method/path/ID shape, widget
codebook, object schema, R2 existence, and technical request bounds; it does not
decide product policy, billing/tier state, publication eligibility, l10n version
caps, upload entitlements, or account storage caps. Product state and policy come
from the real Roma -> Bob -> Tokyo account path.

DevStudio's canonical internal runtime is `https://devstudio.clickeen.com` on
Cloudflare Pages behind Berlin/Google auth. Local DevStudio is not part of the
supported runtime profile and must not own hidden local write lanes.

Tokyo storage follows the PRD 099 root model:

```txt
accounts/
dieter/
fonts/
product/
prague/
```

Account-owned runtime bytes live under
`accounts/{accountPublicId}/instances/{instanceId}/` and
`accounts/{accountPublicId}/assets/`. Widget software lives under
`product/widgets/`. Public instance serving uses the environment public-serving
host plus `/{accountPublicId}/{instanceId}` and maps to generated browser files in
the instance folder. Cloud-dev uses `https://dev.clk.live`; production release
stages use `https://clk.live`. Routes must not rely on root published, root
widgets, or account widgets storage.

Rules:

- Do not reintroduce `scripts/dev-up.sh`, local Tokyo stub serving, or local
  Wrangler `env.local` forks as runtime authority.
- Product state must come from the real Roma -> Bob -> Tokyo account path.
