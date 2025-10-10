STATUS: INFORMATIVE — CONTEXT ONLY
Do NOT implement from this file. For specifications, see:
1) documentation/dbschemacontext.md (DB Truth)
2) documentation/*Critical*/TECHPHASES/Techphases-Phase1Specs.md (Global Contracts)
3) documentation/systems/<System>.md (System PRD, if Phase-1)

# Deployment: c-keen-site

- Stack: Next.js on Vercel  
- Hosts: Marketing site and Prague gallery  
- Root Directory: apps/site  
- Build Command: pnpm build

# Deployment: c-keen-embed

- Stack: Edge Functions on Vercel  
- Hosts: Venice runtime, Atlas cache (KV)  
- Root Directory: services/embed  
- Build Command: pnpm build  
- Notes: Strict size budget; preview belongs here.

# Deployment: c-keen-app

- Stack: Next.js on Vercel  
- Hosts: Bob (Builder & Studio), Robert UI, Tokyo UI  
- Serves: Dieter assets at /dieter/* (components.html, icons, tokens)  
- Root Directory: apps/app  
- Build Command: pnpm build  
- Install Command: (Vercel default) pnpm install  
- Notes: Push to main → production deploy via Vercel Git integration.




### Runtime & Assets (Frozen)
- Vercel uses Node 20 as declared by `"engines": { "node": "20.x" }`.  
- Dieter assets are served as static files from `apps/app/public/dieter/` produced by **copy-on-build**. Symlinks are forbidden.
- Edge Config is read-only at runtime in Phase-1; administrative updates require INTERNAL_ADMIN_KEY.
### Additional server env (c-keen-api)
-  — header  guard for admin endpoints
-  — provisioned by Vercel Edge Config Integration (read-only at runtime)

### Administrative variables (never set in runtime)
-  — Edge Config store id used when an administrator publishes config
-  — Vercel API token used manually when updating Edge Config (rotate regularly)
