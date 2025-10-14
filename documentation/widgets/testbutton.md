# testbutton — Test Widget PRD

STATUS: NORMATIVE — Test widget for Phase-1 validation

## Purpose

`testbutton` is Clickeen's minimal test widget used to validate the complete widget system architecture. It demonstrates the Bob ↔ Paris (GET/PUT) ↔ Venice (SSR) loop with the smallest possible surface.

**This is not a production widget.** It exists solely to test the platform.

---

## Widget Type

- **Type ID:** `testbutton`
- **Category:** Test/Internal
- **Renderer:** `venice/lib/renderers/testButton.ts`

---

## Schema (Phase-1)

**Schema Version:** `2025-09-01`

```json
{
  "type": "object",
  "properties": {
    "text": {
      "type": "string",
      "minLength": 1,
      "maxLength": 50,
      "default": "Click me"
    },
    "color": {
      "type": "string",
      "enum": ["green", "red"],
      "default": "green"
    },
    "radiusPx": {
      "type": "number",
      "minimum": 0,
      "maximum": 32,
      "default": 12
    }
  },
  "required": ["text", "color"]
}
```

---

## Templates

**Phase-1 Template:** `testbutton-pill`

**Descriptor:**
```json
{
  "templateId": "testbutton-pill",
  "widgetType": "testbutton",
  "layout": "INLINE",
  "skin": "MINIMAL",
  "density": "COZY",
  "schemaVersion": "2025-09-01"
}
```

---

## Tokenization (Phase-0 Requirement)

**Critical:** testbutton MUST be fully tokenized to support Bob's preview system.

### CSS Variables (Required)

```css
.pill {
  /* Tokenized radius (patchable) */
  border-radius: var(--btn-radius, 12px);

  /* Tokenized background color (patchable) */
  background: var(--btn-bg, #22c55e);

  /* Tokenized text color (patchable) */
  color: var(--btn-color, #fff);
}
```

### HTML Structure (Required)

```html
<button
  type="button"
  class="pill"
  data-widget-element="button"
  style="--btn-radius: 12px; --btn-bg: #22c55e; --btn-color: #fff;"
>
  Click me
</button>
```

**Key attributes:**
- `data-widget-element="button"` — Stable selector for postMessage patches
- Inline `style` with CSS variables — Set from config values

### Color Mapping

```typescript
function mapColor(color: 'green' | 'red'): string {
  return color === 'red' ? '#ef4444' : '#22c55e';
}
```

---

## Bob Controls Mapping

**Bob Tool Drawer Controls:**

1. **Button Text** (Text Field)
   - Maps to: `config.text`
   - Control: Dieter text input
   - Validation: 1-50 characters

2. **Color** (Button Group)
   - Maps to: `config.color`
   - Control: Two Dieter buttons (Green | Red)
   - Visual: Shows color preview

3. **Border Radius** (Slider - Phase-1+)
   - Maps to: `config.radiusPx`
   - Control: Range slider 0-32px
   - Visual: Live preview of corner rounding

---

## Preview System Integration

### postMessage Patch Contract

**Patchable Fields:**
- `text` — Updates button text content
- `color` — Updates `--btn-bg` CSS variable
- `radiusPx` — Updates `--btn-radius` CSS variable

**Message Format:**
```javascript
{
  type: 'patch',
  widget: 'testbutton',
  fields: {
    text: 'New text',
    color: 'red',
    radiusPx: 16
  }
}
```

**Venice Handler (preview=1 only):**
```javascript
// Injected only when ?preview=1 query param present
window.addEventListener('message', (event) => {
  // Origin check (Bob/MiniBob origins only)
  if (!allowedOrigins.includes(event.origin)) return;

  const { type, widget, fields } = event.data;
  if (type !== 'patch' || widget !== 'testbutton') return;

  const button = document.querySelector('[data-widget-element="button"]');
  if (!button) return;

  // Update text (safe)
  if ('text' in fields) {
    button.textContent = String(fields.text).slice(0, 50);
  }

  // Update color (whitelisted values only)
  if ('color' in fields && ['green', 'red'].includes(fields.color)) {
    const bgColor = fields.color === 'red' ? '#ef4444' : '#22c55e';
    button.style.setProperty('--btn-bg', bgColor);
  }

  // Update radius (clamped 0-32)
  if ('radiusPx' in fields) {
    const radius = Math.max(0, Math.min(32, Number(fields.radiusPx) || 12));
    button.style.setProperty('--btn-radius', `${radius}px`);
  }
});
```

**Security:**
- Origin whitelist: Bob and MiniBob origins only
- Field whitelist: Only `text`, `color`, `radiusPx` allowed
- Value validation: Clamp radiusPx, enum check color
- Script only injected when `?preview=1` (never in production embeds)

---

## Renderer Implementation

**Location:** `venice/lib/renderers/testButton.ts`

**Signature:**
```typescript
export function renderTestButton(config: TestButtonConfig): string
```

**Current Implementation (BEFORE Phase-0 Tokenization):**
```typescript
// ❌ PROBLEM: Hardcoded styles, not patchable
const html = `
  <button type="button" class="pill">
    ${escapeHtml(text)}
  </button>
`;

const css = `
  .pill {
    border-radius: 999px; /* ❌ Hardcoded */
    background: ${color === 'red' ? red : green}; /* ❌ Not tokenized */
  }
`;
```

**Required Implementation (AFTER Phase-0 Tokenization):**
```typescript
// ✅ CORRECT: Tokenized, patchable
const radiusPx = config.radiusPx ?? 12;
const bgColor = config.color === 'red' ? '#ef4444' : '#22c55e';

const html = `
  <button
    type="button"
    class="pill"
    data-widget-element="button"
    style="--btn-radius: ${radiusPx}px; --btn-bg: ${bgColor}; --btn-color: #fff;"
  >
    ${escapeHtml(text)}
  </button>
`;

const css = `
  .pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    padding: 0 20px;
    border-radius: var(--btn-radius, 12px); /* ✅ Tokenized */
    background: var(--btn-bg, #22c55e);     /* ✅ Tokenized */
    color: var(--btn-color, #fff);          /* ✅ Tokenized */
    border: 0;
    cursor: pointer;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.01em;
  }
`;
```

---

## Acceptance Criteria (Phase-0)

- [ ] Schema includes `radiusPx` field (0-32, default 12)
- [ ] Renderer uses CSS variables for radius, background, color
- [ ] HTML includes `data-widget-element="button"` attribute
- [ ] CSS variables set from config in inline style
- [ ] Test: Change config → Venice renders correctly
- [ ] Test: postMessage patch → CSS variables update (preview=1 only)
- [ ] DoD: testbutton is fully Dieter-tokenized and patchable

---

## Testing

### Manual Testing Checklist

1. **SSR Rendering:**
   ```bash
   curl http://localhost:3002/e/wgt_xxxxxx
   # Verify: HTML includes data-widget-element="button"
   # Verify: Inline style sets CSS variables
   ```

2. **Config Changes:**
   ```bash
   # Change text via Paris
   curl -X PUT http://localhost:3001/api/instance/wgt_xxxxxx \
     -H "Content-Type: application/json" \
     -d '{"config":{"text":"New text","color":"red","radiusPx":24}}'

   # Verify Venice renders updated values
   curl http://localhost:3002/e/wgt_xxxxxx?ts=$(date +%s)
   ```

3. **Preview Patches (Phase-1+):**
   - Open Bob with testbutton instance
   - Type in text field → verify instant update (no reload)
   - Click color buttons → verify instant color change
   - Move radius slider → verify instant corner rounding
   - Click Save → verify cross-fade (no white flash)

---

## Common Mistakes

### ❌ WRONG: Hardcoded styles
```css
.pill {
  border-radius: 999px;
  background: #22c55e;
}
```

### ✅ RIGHT: Tokenized styles
```css
.pill {
  border-radius: var(--btn-radius, 12px);
  background: var(--btn-bg, #22c55e);
}
```

---

### ❌ WRONG: Missing data attribute
```html
<button type="button" class="pill">Click me</button>
```

### ✅ RIGHT: Stable selector included
```html
<button type="button" class="pill" data-widget-element="button">
  Click me
</button>
```

---

### ❌ WRONG: CSS variables not set
```html
<button type="button" class="pill">Click me</button>
```

### ✅ RIGHT: Inline style sets variables
```html
<button
  type="button"
  class="pill"
  style="--btn-radius: 12px; --btn-bg: #22c55e;">
  Click me
</button>
```

---

## For AIs Reading This

**When working with testbutton:**

1. **Phase-0 MUST come first** — Tokenization is a prerequisite for preview system
2. **Use CSS variables** — All patchable fields must be CSS variables
3. **Include data attributes** — Stable selectors for postMessage targeting
4. **Set variables in inline style** — CSS variables come from config values
5. **Whitelist patch fields** — Only allow schema-defined fields in patches
6. **Clamp numeric values** — Enforce min/max on radiusPx (0-32)
7. **Check `?preview=1`** — Patch script only injected in preview mode

**Related documentation:**
- `documentation/systems/bob.md` — Preview system architecture
- `documentation/systems/venice.md` — SSR rendering and preview=1 mode
- `documentation/systems/Dieter.md` — Component patterns
- `documentation/CONTEXT.md` — Runtime contracts

---

## Status

**Phase-0 Status:** IN PROGRESS (tokenization required)

**Blockers:** None

**Next Steps:**
1. Add `radiusPx` to testbutton schema in database
2. Update `venice/lib/renderers/testButton.ts` with tokenized CSS
3. Test config changes render correctly
4. Proceed to Phase-1a (Bob preview manager)
