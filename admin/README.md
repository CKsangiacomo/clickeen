# DevStudio - Clickeen Design System Documentation & Preview Environment

**Package**: `@clickeen/devstudio`
**Port**: 5173
**URL**: http://localhost:5173

---

## Non-Negotiable Principle

DevStudio is a **transparent dev/QA surface**. It either shows the system exactly as it runs or it breaks. That means:

- **No fallbacks, mocks, or “temporary” scaffolds** – every control, preview, and data point must come from the real sources (Supabase, Paris, Dieter, Bob).
- **No hardcoded shortcuts** to “make it work” – if the real pipeline fails, DevStudio SHOULD fail.
- **No hidden state** – any tooling or switchers must reflect actual instances/widgets; anything absent stays absent.

This contract keeps DevStudio trustable for engineers, QA, and AI agents.

---

## What is DevStudio?

DevStudio is Clickeen's **design system documentation and preview environment** - a Vite-powered static app that showcases the Dieter design system with live, interactive component examples.

**Core Purpose:**
- 📚 **Document Dieter** - Visual reference for all design system components
- 🔍 **Preview Components** - See all variants, sizes, and states
- 🎯 **Truth Mirror** - Shows exactly what Bob/Compiler deliver (enforced architecturally)
- 🤖 **AI-Legible** - Structured for AI agent comprehension

**It's NOT:**
- ❌ A component library (Dieter is)
- ❌ A runtime bundle (components are CSS-only)
- ❌ A widget builder (Bob is)

---

## The Truth Mirror Principle

**DevStudio shows EXACTLY what Bob/Compiler deliver.**

This is enforced architecturally through **build-time generation**:

```
/dieter/components/toggle/
  ├── toggle.html          (template with {{placeholders}})
  ├── toggle.css           (component styles)
  └── toggle.spec.json     (preview configurations)
      ↓
  [BUILD TIME: generate-component-pages.ts]
      ↓ (reads Dieter source, renders with same logic as BobCompiler)
      ↓
/admin/src/html/components/toggle.html
      ↓ (GENERATED - read-only build artifact)
      ↓
DevStudio preview at http://localhost:5173/#/dieter/toggle
```

**Result:** DevStudio CANNOT show stale components. Generated on every `dev` and `build`.

---

## Architecture Overview

### Source of Truth: `/dieter/components/`

All component HTML, CSS, and preview configs live in Dieter (the "mama library"):

```
dieter/components/
├── toggle/
│   ├── toggle.html         # Template with {{label}}, {{path}}, etc.
│   ├── toggle.css          # Component styles
│   ├── toggle.spec.json    # Preview variants (sm/md/lg sizes)
│   └── toggle.ts           # Hydration logic (optional)
├── dropdown/
│   ├── dropdown.html
│   ├── dropdown.css
│   ├── dropdown.spec.json
│   └── dropdown.ts
└── [other components...]
```

### Build-Time Generation

**On every `pnpm dev` or `pnpm build`:**

1. **Predev/Prebuild Hook** runs `tsx scripts/generate-component-pages.ts`
2. **Script reads** all `*.spec.json` files from `/dieter/components/`
3. **Renders templates** using same mustache-style logic as BobCompiler
4. **Writes HTML files** to `/admin/src/html/components/`
5. **DevStudio loads** generated HTML fragments at runtime

**Benefits:**
- ✅ Zero manual maintenance
- ✅ Impossible to have stale showcases
- ✅ Components auto-discovered from Dieter
- ✅ Same rendering logic as BobCompiler (Truth Mirror)

### Shared Hydration

Interactive components (dropdowns, textfields, etc.) use **shared hydration functions** from Dieter:

```typescript
// DevStudio imports from Dieter
import {
  hydrateDropdownActions,
  hydrateDropdownEdit,
  hydrateTextfield,
  hydrateTextedit,
  hydrateTabs,
  hydrateMenuactions,
} from '@dieter/components';

// Calls after rendering HTML
hydrateDieterComponents(fragment);
```

**Result:** Single hydration logic shared across Bob, Venice, and DevStudio.

---

## File Structure

```
admin/
├── src/
│   ├── main.ts                          # App entry, routing, shell, hydration
│   ├── data/
│   │   ├── routes.ts                    # Auto-discover showcase pages, navigation
│   │   ├── componentRegistry.ts         # Vite glob import from /dieter/components/
│   │   ├── componentRenderer.ts         # Template rendering (mustache logic)
│   │   ├── componentTypes.ts            # TypeScript interfaces
│   │   ├── dieterComponents.ts          # Re-exports from componentRegistry
│   │   ├── typography.ts                # Typography showcase data
│   │   └── icons.ts                     # Icon registry utils
│   ├── html/
│   │   ├── components/                  # 🤖 GENERATED (build artifacts, read-only)
│   │   │   ├── toggle.html              # Generated from /dieter/components/toggle/
│   │   │   ├── dropdown.html
│   │   │   └── [other components...]
│   │   ├── tools/
│   │   │   ├── bob-ui-native.html       # Bob native UI showcase
│   │   │   └── dev-widget-workspace.html # Bob iframe integration
│   │   └── foundations/
│   │       ├── colors.html              # Color tokens showcase
│   │       ├── typography.html          # Typography showcase
│   │       └── icons.html               # Icon registry showcase
│   ├── css/
│   │   └── layout.css                   # DevStudio shell styles
│   └── BobNativeCatalog.ts             # Bob native UI catalog generator
├── scripts/
│   ├── generate-component-pages.ts      # 🔥 BUILD SCRIPT (runs on predev/prebuild)
│   ├── generate-icons-showcase.local.cjs
│   └── generate-typography-json.cjs
├── index.html                           # Entry HTML
├── package.json                         # Build scripts, dependencies
├── vite.config.ts                       # Vite config (port 5173, @dieter alias)
├── tsconfig.json                        # TypeScript config
└── README.md                            # This file
```

### Key Paths Explained

| Path | Purpose | Notes |
|------|---------|-------|
| `src/html/components/*.html` | Component showcase pages | **GENERATED** - Don't edit manually |
| `src/data/componentRegistry.ts` | Auto-discovers Dieter components | Vite glob import from `/dieter/components/` |
| `src/data/componentRenderer.ts` | Renders component templates | Same mustache logic as BobCompiler |
| `scripts/generate-component-pages.ts` | Build-time generator | Runs on every `dev` and `build` |

---

## Starting DevStudio

```bash
# Start DevStudio (includes build-time generation)
pnpm --filter @clickeen/devstudio dev

# Or start all services
./scripts/dev-up.sh
```

**Access**: http://localhost:5173

### Build Scripts

```json
// package.json
"predev": "node scripts/generate-typography-json.cjs && node scripts/generate-icons-showcase.local.cjs && tsx scripts/generate-component-pages.ts",
"prebuild": "node scripts/generate-typography-json.cjs && node scripts/generate-icons-showcase.local.cjs && tsx scripts/generate-component-pages.ts"
```

**What happens:**
1. Typography data generated from `typography.usage.json`
2. Icons showcase generated from Dieter icon registry
3. **Component pages generated from `/dieter/components/`** 🔥

---

## Navigation Structure

DevStudio auto-generates navigation from filesystem:

### 🎨 **Dieter Components**
- Auto-discovered from `/dieter/components/` (via `componentRegistry.ts`)
- Each component gets a showcase page with all variants
- Examples: Toggle, Dropdown, Textfield, Tabs, etc.

### 🛠️ **Tools**
- **Bob UI Native** - Bob-specific UI components
- **Dev Widget Workspace** - Bob iframe integration (for testing)

### 📐 **Foundations**
- **Colors** - Color tokens and palettes
- **Typography** - Typography scale and usage
- **Icons** - Icon registry with search

---

## Adding a New Component

**1. Create component in Dieter:**

```bash
dieter/components/
└── mycomponent/
    ├── mycomponent.html        # Template with {{placeholders}}
    ├── mycomponent.css         # Component styles
    ├── mycomponent.spec.json   # Preview configurations
    └── mycomponent.ts          # Hydration logic (optional)
```

**2. Define `mycomponent.spec.json`:**

```json
{
  "defaults": [
    {
      "id": "default",
      "spec": ["diet-mycomponent", "data-size='{{size}}'"],
      "context": {
        "label": "Label",
        "size": "md"
      },
      "sizes": ["sm", "md", "lg"]
    }
  ]
}
```

**3. Run DevStudio:**

```bash
pnpm --filter @clickeen/devstudio dev
```

**Result:**
- ✅ Predev hook generates `src/html/components/mycomponent.html`
- ✅ Component appears in navigation automatically
- ✅ Showcase page at `http://localhost:5173/#/dieter/mycomponent`

**No manual registration needed.** 🎉

---

## How Component Rendering Works

### Template Placeholders

Dieter components use mustache-style placeholders:

```html
<!-- dieter/components/toggle/toggle.html -->
<div class="diet-toggle" data-size="{{size}}">
  <span class="diet-toggle__label label">{{label}}</span>
  <input id="{{id}}" type="checkbox" {{#if path}}data-path="{{path}}"{{/if}} />
  <label class="diet-toggle__switch" for="{{id}}"></label>
</div>
```

### Rendering Logic

**componentRenderer.ts** renders templates with context from `spec.json`:

```typescript
// Example: Toggle with size="md", label="Show heading"
const context = { size: 'md', label: 'Show heading', id: 'toggle-1' };
const rendered = renderTemplate(toggleHTML, context);
// Output: <div class="diet-toggle" data-size="md">...
```

### Build-Time Generation Flow

```
1. generate-component-pages.ts reads toggle.spec.json
2. For each preview in spec.defaults:
   - Extracts context (size, label, etc.)
   - Renders toggle.html with context
   - Generates tile HTML with specs
3. Wraps all tiles in devstudio-page layout
4. Writes to src/html/components/toggle.html
```

### Runtime Hydration

```typescript
// main.ts
function hydrateDieterComponents(scope: Element | DocumentFragment): void {
  hydrateTextfield(scope);
  hydrateTextedit(scope);
  hydrateDropdownActions(scope);
  hydrateDropdownEdit(scope);
  hydrateTabs(scope);
  hydrateMenuactions(scope);
}

// Called after rendering
const fragment = renderHtmlPage(page.htmlPath, pageStyles);
hydrateDieterComponents(fragment);
```

**Hydration adds interactivity:**
- Dropdown menus open/close
- Textfields handle input
- Tabs switch panels
- Etc.

---

## Technical Stack

| Technology | Purpose | Notes |
|------------|---------|-------|
| **Vite** | Build tool | Fast HMR, native ESM |
| **TypeScript** | Type safety | Strict mode enabled |
| **Vanilla JS** | Runtime | Zero framework overhead |
| **Dieter CSS** | Styling | Pure CSS, no CSS-in-JS |
| **Hash Routing** | Navigation | Client-side only |

### Why Vanilla JS?

- ✅ **Fast** - No framework overhead
- ✅ **Simple** - Easy to understand
- ✅ **Portable** - Easy to extract snippets
- ✅ **Intentional** - DevStudio is documentation, not an app

---

## Vite Configuration

```typescript
// vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@dieter': path.resolve(__dirname, '../dieter'),  // Import from Dieter source
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, '..')],  // Access parent dir
    },
  },
});
```

**Key Points:**
- `@dieter` alias for importing Dieter source files
- Port 5173 (canonical)
- `fs.allow` grants access to `/dieter` directory

---

## Development Workflows

### Working on Dieter Components

1. Edit component in `/dieter/components/[name]/`
   - Modify `[name].html`, `[name].css`, or `[name].spec.json`
2. DevStudio auto-reloads (Vite HMR)
3. See changes immediately in showcase

**Example:**
```bash
# Edit dropdown spec
vim dieter/components/dropdown/dropdown.spec.json

# DevStudio regenerates on next save
# Navigate to http://localhost:5173/#/dieter/dropdown
# See updated preview
```

### Testing BobCompiler Output

DevStudio uses the same template rendering logic as BobCompiler, so:

- If DevStudio shows it correctly → BobCompiler will too
- If DevStudio shows it wrong → Fix the Dieter template

**Truth Mirror in action.**

### Adding New Foundations

1. Create HTML file in `src/html/foundations/`
   - Example: `spacing.html`
2. Add styles if needed
3. Run DevStudio - navigation auto-generates

---

## Architecture Principles

### 1. Single Source of Truth
- All component HTML/CSS lives in `/dieter/components/`
- DevStudio reads from Dieter, never duplicates

### 2. Build-Time Generation
- Component showcases generated at build time
- Prevents stale/outdated documentation
- Enforces Truth Mirror architecturally

### 3. Shared Logic
- Template rendering shared with BobCompiler
- Hydration shared with Bob/Venice
- Zero duplication

### 4. Auto-Discovery
- Components discovered via Vite glob imports
- Navigation generated from filesystem
- Zero manual registration

### 5. AI-First Design
- Clear file structure
- Semantic naming
- Documentation as code
- Single source of truth

---

## Key URLs

| URL | Content |
|-----|---------|
| `http://localhost:5173` | DevStudio home |
| `http://localhost:5173/#/dieter/toggle` | Toggle component showcase |
| `http://localhost:5173/#/dieter/dropdown` | Dropdown component showcase |
| `http://localhost:5173/#/dieter/colors` | Color tokens |
| `http://localhost:5173/#/dieter/typography` | Typography scale |
| `http://localhost:5173/#/dieter/icons` | Icon registry |
| `http://localhost:5173/#/dieter/bob-ui-native` | Bob native UI |

---

## Integration with Other Services

DevStudio is standalone but can integrate:

| Service | Port | Integration | Purpose |
|---------|------|-------------|---------|
| **Bob** | 3000 | Iframe in dev-widget-workspace | Test widgets in DevStudio |
| **Paris** | 3001 | Not integrated | (Widget API) |
| **Venice** | 3002 | Not integrated | (Widget SSR) |
| **Dieter** | N/A | `@dieter` alias | Import source files |

**Note:** DevStudio is primarily for Dieter documentation, not full-stack widget testing (use standalone Bob for that).

---

## Troubleshooting

### Components not appearing in navigation

**Cause:** Missing or invalid `*.spec.json` file

**Fix:**
1. Ensure component has `[name].spec.json` in `/dieter/components/[name]/`
2. Validate JSON syntax
3. Restart DevStudio (kill and run `pnpm dev`)

### Generated HTML looks wrong

**Cause:** Template placeholders not matching spec.json context

**Fix:**
1. Check `[name].html` placeholders: `{{label}}`, `{{size}}`, etc.
2. Check `[name].spec.json` context object has matching keys
3. Debug `componentRenderer.ts` if needed

### Hydration not working

**Cause:** Hydration function not called or component not exported from `dieter/components/index.ts`

**Fix:**
1. Ensure component exports hydration function: `export { hydrateMyComponent }`
2. Import in `main.ts`: `import { hydrateMyComponent } from '@dieter/components'`
3. Call in `hydrateDieterComponents()` function

---

## Performance

DevStudio is **intentionally fast**:

- ✅ **Static HTML** - Pre-generated at build time
- ✅ **Vanilla JS** - Zero framework overhead (~359 lines)
- ✅ **CSS-only components** - No JavaScript bundles for components
- ✅ **Hash routing** - No server requests
- ✅ **Lazy hydration** - Only hydrate visible components

**Build time:** ~2-3 seconds (includes component generation)
**Page load:** <100ms
**Hot reload:** <50ms

---

## Contributing

### When adding new DevStudio features:

1. **Ask:** Does this help document Dieter?
2. **Keep it simple:** Vanilla JS, no frameworks
3. **Auto-generate:** Prefer build scripts over manual files
4. **Document:** Update this README
5. **Test:** Verify with actual Dieter components

### When adding new Dieter components:

1. Create component in `/dieter/components/[name]/`
2. Add `[name].spec.json` with preview configs
3. DevStudio auto-discovers and generates showcase
4. No DevStudio code changes needed

---

## Philosophy

> **DevStudio is the Truth Mirror - it shows exactly what ships to production.**

- Components are documented at the source of truth (`/dieter/components/`)
- Showcases are generated automatically (build-time)
- Same rendering logic as BobCompiler (shared templates)
- Same hydration logic as Bob/Venice (shared functions)
- Impossible to have stale documentation (regenerated every build)

**Result:** What you see in DevStudio IS what users get in production.

---

**Last Updated**: 2025-11-03
**Maintained By**: Platform Team
**Status**: Production-ready ✅
