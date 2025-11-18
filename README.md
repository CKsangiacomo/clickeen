# Bob + Dieter Standalone

Extracted from Clickeen monorepo for reuse in other projects.

## What's Included

- **bob/** - Widget editor UI (Next.js app)
- **admin/** - Component showcase (Vite app)
- **dieter/** - Design system (CSS + Web Components)

## Setup

```bash
# 1. Run the setup script (copies files from clickeen)
chmod +x SETUP.sh
./SETUP.sh

# 2. Install dependencies
pnpm install

# 3. Build Dieter first
pnpm build:dieter

# 4. Run dev servers
pnpm dev:bob      # Bob on http://localhost:3000
pnpm dev:admin    # Admin on http://localhost:5173
```

## To Move to New Git Repo

```bash
# 1. Copy this entire folder
cp -r tools/website ~/Desktop/my-new-project

# 2. Initialize new git repo
cd ~/Desktop/my-new-project
git init
git add .
git commit -m "Initial commit from Clickeen extraction"

# 3. Delete Clickeen-specific code
# - Remove Paris API calls in bob/lib/session/useWidgetSession.tsx
# - Remove widget compilation logic
# - Adapt for your use case
```

## What to Delete (Clickeen-specific)

### In bob/:
- `bob/lib/compiler.ts` - Widget compilation logic
- `bob/lib/session/useWidgetSession.tsx:169-210` - renameInstance API call
- `bob/lib/widgets/` - Widget JSON configs
- `bob/app/api/` - Paris API routes

### In admin/:
- Keep everything - it's just a showcase

### In dieter/:
- Keep everything - it's a standalone design system

## Structure After Cleanup

```
my-new-project/
├── bob/          # UI framework (Next.js)
├── admin/        # Component showcase
├── dieter/       # Design system
└── package.json  # Workspace root
```

## License

Extracted from Clickeen. Adapt as needed.
