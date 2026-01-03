# Supernova — Modern Web Effects System

## What Supernova Is

**Supernova** is Clickeen's premium effects layer that brings modern web technologies to widgets—technologies that exist but are inaccessible to most websites because they're too complex to implement.

> "Incumbents ship widgets from 2010. Clickeen ships Supernova."

### The Problem We're Solving

**Modern web capabilities exist but go unused:**
- GSAP (butter-smooth animations, ScrollTrigger, morphing)
- Three.js / WebGL (3D, particles, shaders)
- Lottie (designer-grade vector animations)
- Framer Motion (physics-based micro-interactions)
- Canvas effects (liquid, noise, particles)
- View Transitions API (page-level cinema)

**Why 99% of websites don't use these:**
1. Too complex to implement (need specialized developers)
2. Easy to break (conflicts with existing code)
3. Hard to maintain (libraries update, things break)
4. Performance concerns (bundle size, Core Web Vitals)
5. No design system integration (custom one-offs)

**Clickeen's unique position:**
- We control the embed surface (Shadow DOM = isolated, predictable)
- We control the runtime (ship any library, lazy-loaded)
- We control the CDN (Cloudflare Edge = performance optimized)
- We control the editor (expose controls, no code required)
- We control the AI (generate/customize effects dynamically)

---

## Plan Gating

| Plan | Supernova Access |
|------|------------------|
| **Free (Minibob)** | ❌ Disabled, "Upgrade" message |
| **Free (Bob)** | ❌ Disabled, "Upgrade to Pro" |
| **Pro** | ✅ Standard Supernova effects |
| **Business** | ✅ Full Supernova + custom effects |

**State shape:**

```json
{
  "supernova": {
    "enabled": false,
    "effects": {
      "motion": "spring",
      "hover": "magnetic",
      "scroll": "stagger-fade",
      "celebration": false
    }
  }
}
```

---

## Effect Categories

### 1) Motion (how things move)

| Effect | Description | Library |
|--------|-------------|---------|
| `spring` | Physics-based open/close with overshoot | GSAP, Framer Motion |
| `stagger-fade` | Items fade in one-by-one on scroll | GSAP ScrollTrigger |
| `morph` | Shape transforms into another | GSAP MorphSVG |
| `parallax` | Layers move at different speeds | GSAP, Locomotive |
| `smooth-scroll` | Butter-smooth infinite scroll | GSAP |

### 2) Visuals (how things look beyond CSS)

| Effect | Description | Library |
|--------|-------------|---------|
| `particles` | Floating dots/shapes in background | tsParticles, Three.js |
| `gradient-animate` | Shifting aurora/gradient background | CSS + JS |
| `3d-object` | Rotating 3D model | Three.js |
| `lottie` | Vector animations (characters, icons) | Lottie |
| `confetti` | Celebration burst | canvas-confetti |
| `noise` | Subtle grain/texture overlay | CSS/Canvas |

### 3) Interactions (how things respond to input)

| Effect | Description | Library |
|--------|-------------|---------|
| `magnetic` | Cursor pulls element toward it | GSAP, custom |
| `tilt` | Card tilts based on mouse position | Vanilla-tilt |
| `press` | Satisfying button press animation | CSS + GSAP |
| `drag-physics` | Cards can be thrown, bounce | Framer Motion |
| `cursor-trail` | Custom cursor with trailing effect | Custom |

---

## Widget Examples

### Logo Showcase

| Without Supernova | With Supernova |
|-------------------|----------------|
| Static grid, basic CSS hover | Infinite smooth scroll, magnetic hover, morph on click |

### FAQ Accordion

| Without Supernova | With Supernova |
|-------------------|----------------|
| Height slides, icon rotates | Spring physics, elastic icon, staggered content |

### Countdown Timer

| Without Supernova | With Supernova |
|-------------------|----------------|
| Numbers change | 3D flip with shadows, confetti burst on zero |

### Testimonials

| Without Supernova | With Supernova |
|-------------------|----------------|
| Fade carousel | Physics card stack, drag with momentum, Lottie reactions |

---

## Architecture

### Effect Libraries (Tokyo)

```
tokyo/supernova/
  manifest.json           # Effect registry + variants
  gsap/
    full.js               # Desktop: GSAP + ScrollTrigger + MorphSVG
    lite.js               # Mobile: GSAP core only
  three/
    full.js               # Full Three.js
    particles.js          # Particles system only
  lottie/
    player.js             # Full Lottie player
    light.js              # Reduced feature set
  confetti/
    confetti.js           # Canvas confetti
  shared/
    magnetic.js           # Magnetic hover effect
    spring.js             # Spring physics utilities
```

### Manifest Schema

```json
{
  "v": 1,
  "gitSha": "...",
  "effects": {
    "gsap": {
      "full": "gsap/full.a1b2.js",
      "lite": "gsap/lite.c3d4.js"
    },
    "three": {
      "full": "three/full.e5f6.js",
      "particles": "three/particles.g7h8.js"
    },
    "lottie": {
      "player": "lottie/player.i9j0.js"
    },
    "confetti": {
      "default": "confetti/confetti.k1l2.js"
    }
  },
  "presets": {
    "motion-spring": ["gsap.lite"],
    "motion-full": ["gsap.full"],
    "particles-simple": ["three.particles"],
    "celebration": ["confetti.default"]
  }
}
```

### Widget Declaration (spec.json)

```json
{
  "supernova": {
    "supported": ["motion", "hover", "scroll", "celebration"],
    "defaultEffects": {
      "motion": "none",
      "hover": "none",
      "scroll": "none",
      "celebration": false
    },
    "libraries": {
      "motion-spring": ["gsap.lite"],
      "hover-magnetic": ["gsap.lite"],
      "scroll-stagger": ["gsap.full"],
      "celebration": ["confetti.default"]
    }
  }
}
```

---

## Loading Strategy (Cloudflare-Optimized)

### Why Bundle Size Isn't a Concern

1. **Edge caching (300+ PoPs)** — Libraries cached globally, sub-10ms latency
2. **R2 zero egress** — No bandwidth cost regardless of library size
3. **HTTP/3 multiplexing** — Parallel loading, no head-of-line blocking
4. **Early Hints (103)** — Preload before HTML parse
5. **Brotli compression** — Automatic, best-in-class
6. **Smart splitting (Workers)** — Device/connection-aware variants

### Context-Aware Loading

```javascript
// Venice/loader determines variant based on context
const ua = request.headers.get('user-agent');
const saveData = request.headers.get('save-data');
const connection = request.cf?.httpProtocol;

if (isMobile(ua) || saveData === 'on') {
  return serve('gsap.lite.js');    // 20KB
} else {
  return serve('gsap.full.js');    // 80KB
}
```

### Lazy Hydration Pattern

```html
<!-- Widget shell renders instantly (no Supernova dependency) -->
<div class="ck-faq" data-supernova="spring,magnetic">
  <!-- FAQ content visible immediately -->
</div>

<script>
  // Effects load AFTER content visible (no LCP impact)
  if (!prefersReducedMotion() && supernovaEnabled) {
    import('https://tokyo.clickeen.com/supernova/gsap.lite.js')
      .then(() => initSupernovaEffects());
  }
</script>
```

---

## Editor UI (Bob)

### Supernova Panel

```html
<bob-panel id="supernova">
  <tooldrawer-cluster>
    <tooldrawer-eyebrow text="Supernova Effects" />
    <tooldrawer-field 
      type="toggle" 
      path="supernova.enabled" 
      label="Enable Supernova" 
      plan-gate="pro"
    />
  </tooldrawer-cluster>
  
  <tooldrawer-cluster show-if="supernova.enabled == true">
    <tooldrawer-eyebrow text="Motion" />
    <tooldrawer-field 
      type="dropdown-actions" 
      path="supernova.effects.motion" 
      label="Animation style"
      options='[
        {"label":"None","value":"none"},
        {"label":"Spring physics","value":"spring"},
        {"label":"Elastic","value":"elastic"},
        {"label":"Smooth","value":"smooth"}
      ]'
    />
  </tooldrawer-cluster>
  
  <tooldrawer-cluster show-if="supernova.enabled == true">
    <tooldrawer-eyebrow text="Hover" />
    <tooldrawer-field 
      type="dropdown-actions" 
      path="supernova.effects.hover"
      label="Hover effect"
      options='[
        {"label":"None","value":"none"},
        {"label":"Magnetic pull","value":"magnetic"},
        {"label":"Tilt 3D","value":"tilt"},
        {"label":"Glow","value":"glow"}
      ]'
    />
  </tooldrawer-cluster>
</bob-panel>
```

### Plan Gating UX

For free users, the toggle shows:
> ☐ Enable Supernova — *Upgrade to Pro*

Clicking opens upgrade modal with Supernova showcase.

---

## Accessibility

### `prefers-reduced-motion` Support

```javascript
function supernovaEnabled() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return false; // Respect user preference
  }
  return state.supernova?.enabled === true;
}
```

All Supernova effects automatically disable when user prefers reduced motion. The widget remains fully functional—just without animations.

### Fallback Behavior

| Supernova enabled | Reduced motion | Result |
|-------------------|----------------|--------|
| ✅ | ❌ | Full effects |
| ✅ | ✅ | No effects, functional widget |
| ❌ | Any | No effects, functional widget |

---

## Performance Contracts

### Core Web Vitals Guarantees

| Metric | Guarantee |
|--------|-----------|
| **LCP** | No impact (effects load after content) |
| **FID** | No impact (effects don't block interaction) |
| **CLS** | No impact (effects don't change layout) |
| **INP** | < 50ms for any Supernova interaction |

### How We Achieve This

1. **Shell-first rendering** — Widget content appears before effects load
2. **Lazy hydration** — Effects initialize after LCP
3. **GPU acceleration** — Use `transform`/`opacity` only (no layout thrash)
4. **Frame budget** — All animations capped at 60fps
5. **Mobile reduction** — Lighter effects on mobile by default

---

## Verification

### Acceptance Criteria

1. **Toggle works**: `supernova.enabled` toggles effects on/off
2. **Plan gating**: Free users see "Upgrade to Pro" message
3. **Lazy loading**: Effects don't block initial render (LCP unchanged)
4. **Reduced motion**: Effects disabled when `prefers-reduced-motion: reduce`
5. **Mobile variant**: Lighter bundle served to mobile devices
6. **Edge caching**: Effect libraries return `cache-control: immutable`

---

## The Moat

### Why Competitors Can't Copy This

| Requirement | Clickeen | Incumbents |
|-------------|----------|------------|
| **Embed isolation** | Shadow DOM | Legacy iframe/inline |
| **CDN architecture** | Cloudflare Edge, zero egress | Traditional CDN, cost per byte |
| **Lazy loading infra** | Context-aware at edge | One-size-fits-all |
| **Plan gating** | State-level, server-enforced | Would need rewrite |
| **Codebase** | Modern, designed for this | 15 years of tech debt |

### The Pitch

> "Your competitors use widgets that look like 2010.
> You paste one line and go Supernova."

> "GSAP. Three.js. WebGL. Lottie.
> Technology that exists but nobody uses because it's too hard.
> With Clickeen Supernova, paste one line. Go Supernova."

---

## References

- WhyClickeen.md — Supernova as a moat
- WidgetArchitecture.md — How widgets declare Supernova support
- HowWeBuildWidgets.md — Implementing Supernova in a widget

