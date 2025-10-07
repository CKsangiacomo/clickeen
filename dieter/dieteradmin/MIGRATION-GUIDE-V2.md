# Migration Guide: newcomponentsSept25.md → V2

## What Changed & Why

### **Problem 1: Semantic Color Soup ("Red/Yellow/Green Junk")**

**Old Approach:**
```markdown
**States:**
- Error: Red border, helper text changes color
- Success: Green border
- Warning: Yellow/orange indicators
```

**Why It's Bad:**
- AIs interpret "error/success/warning" as requiring RGB traffic lights
- Destroys Apple's elegant neutral aesthetic
- Makes forms look like construction signs

**New Approach:**
```markdown
**V0 States (Minimum):**
- default, focus, disabled
(Error/success states deferred to V1)
```

**Result:** Components stay neutral, refined, and Apple-like by default.

---

### **Problem 2: Over-Specification Before Build**

**Old Approach:**
```markdown
**Variants:**
- Default: Standard text input
- With prefix icon (search, email, etc.)
- With suffix button (clear, visibility toggle)
- With character counter
- Indeterminate state
- With validation tooltip
```

**Why It's Bad:**
- AIs try to build 10 variants simultaneously
- None work properly because foundation isn't solid
- Complexity explodes before basics are proven

**New Approach:**
```markdown
**V0 Scope (Minimum):**
- One variant: clean text input with label
- Three sizes: sm, md, lg
- States: default, focus, disabled

**Out of V0 Scope:**
- Prefix/suffix icons (V1)
- Character counters (V1)
- Error states (V1)
```

**Result:** Build one beautiful thing, then iterate.

---

### **Problem 3: Raw Pixels Instead of Tokens**

**Old Approach:**
```markdown
**Sizes:** sm, md, lg (heights: 20px, 24px, 28px)
```

**Why It's Bad:**
- AIs write `height: 28px` instead of using tokens
- Breaks the design system's size ladder
- Inconsistent with Button/Segmented

**New Approach:**
```markdown
**CSS Mandate:**
- Field height = `--control-size-md` (24px)
- Use `var(--control-size-sm)` / `md` / `lg` tokens
```

**Result:** All components use the same height system automatically.

---

### **Problem 4: No Apple Aesthetic Enforcement**

**Old Approach:**
- Specs didn't reference existing components as templates
- No mandate to study Button/Segmented patterns
- No "neutral first, color sparingly" principle

**New Approach:**
```markdown
## Build Philosophy (CRITICAL)

1. **V0 = Elegant Minimum**
2. **Apple Aesthetic** — Study Button/Segmented for inspiration
3. **Tokens Only** — No #hex, no raw px
4. **Color Sparingly** — Accent for focus/active only
5. **No Semantic Color Soup**
```

**Result:** Every component starts with the right design DNA.

---

### **Problem 5: Unclear Token Reference**

**Old Approach:**
- Token names scattered throughout spec
- No quick reference guide
- AIs guess at values

**New Approach:**
- **Token Reference section upfront** with copy-pasteable examples
- Shows exact usage patterns: `color-mix(in oklab, ...)`
- Lists all relevant tokens in one place

**Result:** AIs use tokens correctly from the start.

---

## Key Structural Changes

### **1. Added "Build Philosophy" Section**
- Sets mindset before implementation
- Mandates V0 thinking ("simplest elegant version")
- Kills semantic color soup upfront

### **2. Added "Component Build Checklist"**
- Pre-flight check before coding
- Forces study of Button/Segmented
- Confirms token knowledge

### **3. Simplified Component Specs**
Each component now has:
- **Purpose** (one line)
- **V0 Scope** (minimal viable elegance)
- **V0 HTML** (target structure)
- **CSS Mandate** (exact token usage)
- **Out of V0 Scope** (deferred features)

### **4. Added "Anti-Patterns" Section**
- Shows bad code vs. good code side-by-side
- Explicitly demonstrates semantic color soup problem
- Teaches correct token usage patterns

### **5. Added "Success Criteria"**
- Clear acceptance checklist
- Enforces quality bar before keeping a component in Dieter
- Prevents half-baked components shipping

---

## Component-Specific Simplifications

### **Input (Before → After)**

**Before:**
- 5+ variants listed upfront
- Error/success states specified
- Character counter, validation tooltip, etc.

**After:**
- V0: Clean input + label + helper
- 3 sizes, 3 states
- Everything else deferred to V1

### **Checkbox (Before → After)**

**Before:**
- Indeterminate state in V0
- Helper description text
- Error state with red outline

**After:**
- V0: Checked/unchecked only
- Custom checkmark icon
- Scale animation on check
- Indeterminate deferred to V1

### **Badge (Before → After)**

**Before:**
- Five types: info, success, warning, error, neutral
- Three tones each
- Icons, dismissible, counters

**After:**
- V0: One type (info/blue)
- Two tones (solid, subtle)
- No icons, no dismiss, no counters

---

## Migration Instructions for AIs

**If you're implementing a component:**

1. **Ignore the old spec** (`newcomponentsSept25.md`)
2. **Read V2 spec** (`newcomponentsSept25-v2.md`)
3. **Start with "Build Philosophy"** — internalize the mindset
4. **Run the checklist** — confirm you've studied Button/Segmented
5. **Build V0 only** — resist feature creep
6. **Test in DieterAdmin** — showcase must match Button quality
7. **Verify no semantic colors** — form shouldn't look like a traffic light

**If you see red/green/yellow in your output:**
- You're building V1 features in V0
- Stop, re-read "Build Philosophy"
- Strip back to neutral elegance

---

## Example: Input Component Evolution

### **V0 (Now):**
```html
<div class="diet-input" data-size="md">
  <label class="diet-input__label">Email</label>
  <input type="text" class="diet-input__field" placeholder="you@example.com" />
  <span class="diet-input__helper">Optional supporting text</span>
</div>
```
- Clean, neutral, elegant
- Focus → blue accent border
- Disabled → grayed out
- No color-coded states

### **V1 (Future):**
- Add prefix icon slot
- Add error state (red border when `data-state="error"`)
- Add character counter

### **V2 (Future):**
- Add suffix button (clear, visibility toggle)
- Add inline validation
- Add autocomplete suggestions

---

## Why This Matters

**Old spec produced:**
- ❌ Forms with red/green/yellow everywhere
- ❌ Inconsistent heights (raw pixels)
- ❌ Half-implemented features
- ❌ No visual cohesion with Button/Segmented

**New spec produces:**
- ✅ Neutral, elegant components
- ✅ Consistent size system
- ✅ One polished variant at a time
- ✅ Apple-inspired aesthetic throughout

---

## Quick Decision Tree

**When building a component, ask:**

1. **Am I using semantic colors in V0?**
   - ❌ Red/green/yellow states → Strip them out
   - ✅ Neutral + blue accent only → Good

2. **Am I using raw pixels?**
   - ❌ `height: 28px` → Use `--control-size-lg`
   - ✅ `var(--control-size-*)` → Good

3. **Am I building multiple variants?**
   - ❌ 5 variants at once → Pick one, defer rest
   - ✅ One clean variant → Good

4. **Have I studied Button.css?**
   - ❌ No → Read it now
   - ✅ Yes, copying patterns → Good

---

**TL;DR:** V2 spec kills semantic color soup, enforces token usage, mandates V0 thinking, and produces Apple-quality components from the start.
