# Supernova — NextGen Web Design

## What Supernova Is

**Supernova** is Clickeen's premium visual technology layer—the cutting-edge design capabilities that make web experiences mindblowing.

> "Supernova is the technological expression of Clickeen's design moat."

### The Core Idea

**Clickeen's moat is Design.** Supernova is how we give that advantage to users.

- Competitors ship functional widgets that look like 2010.
- Clickeen ships widgets that make the web beautiful.
- Supernova unlocks the NextGen technologies that define the modern web.

### What Supernova Includes

| Category | Technologies | What It Does |
|----------|--------------|--------------|
| **Motion** | GSAP, Framer Motion, CSS animations | Movement that delights |
| **Effects** | Three.js, WebGL, particles, shaders | Depth, atmosphere, wow |
| **Micro-interactions** | Lottie, spring physics, magnetic | Polish, responsiveness |
| **Generative Images** | Flux, Midjourney, DALL-E | AI-created visuals, backgrounds, graphics |
| **Generative Video** | Sora, Runway, Pika | AI-created video backgrounds, demos |
| **Future Visual Tech** | WebGPU, View Transitions, spatial | Whatever comes next |

**All visual. All about beauty. All under one premium umbrella.**

### What Supernova Is NOT

| Feature | Where It Lives | Why Not Supernova |
|---------|----------------|-------------------|
| Translation | Auto-translate (Tier 2+) | Localization, not design |
| Content generation | SDR Copilot | Words, not visuals |
| SEO/GEO | Tier 1+ | Indexability, not beauty |
| Analytics | Separate feature | Data, not design |

### The Problem We're Solving

**NextGen visual technologies exist but go unused:**
- GSAP (butter-smooth animations, ScrollTrigger, morphing)
- Three.js / WebGL (3D, particles, shaders)
- Lottie (designer-grade vector animations)
- Framer Motion (physics-based micro-interactions)
- Canvas effects (liquid, noise, particles)
- Generative AI (Flux, Sora, Runway for images/video)
- View Transitions API (page-level cinema)

**Why 99% of websites don't use these:**
1. Too complex to implement (need specialized developers)
2. Easy to break (conflicts with existing code)
3. Hard to maintain (libraries update, things break)
4. Performance concerns (bundle size, Core Web Vitals)
5. No design system integration (custom one-offs)
6. Generative AI is expensive and hard to integrate

**Clickeen's unique position:**
- We control the embed surface (Shadow DOM = isolated, predictable)
- We control the runtime (ship any library, lazy-loaded)
- We control the CDN (Cloudflare Edge = performance optimized)
- We control the editor (expose controls, no code required)
- We control the AI integration (generate visuals, cache on R2)

---

## Plan Gating

| Tier | Supernova Access |
|------|------------------|
| **Free** | ❌ Disabled, "Upgrade" message |
| **Tier 1** | ❌ Disabled |
| **Tier 2** | ❌ Disabled |
| **Tier 3** | ✅ Full Supernova effects |

Supernova is the top-tier differentiator. Lower tiers get full functionality but standard visuals; Tier 3 adds the "wow factor."

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

### 4) Generative Images (AI-created visuals)

| Effect | Description | Provider |
|--------|-------------|----------|
| `gen-background` | AI-generated background image | Flux, DALL-E |
| `gen-pattern` | AI-generated repeating pattern | Midjourney, Flux |
| `gen-icon` | AI-generated custom icons | DALL-E, Ideogram |
| `gen-hero` | AI-generated hero imagery | Flux, Midjourney |
| `gen-avatar` | AI-generated placeholder avatars | Flux |

**How it works:**
- User describes what they want or picks from presets
- AI generates image → cached on R2 (zero egress)
- Served from edge with immutable cache headers
- Generation cost incurred once, served forever

### 5) Generative Video (AI-created motion)

| Effect | Description | Provider |
|--------|-------------|----------|
| `gen-video-bg` | AI-generated video background loop | Sora, Runway |
| `gen-demo` | AI-generated product demo clip | Sora, Pika |
| `gen-transition` | AI-generated transition between states | Runway |

**How it works:**
- User provides prompt or selects from templates
- AI generates video → encoded and cached on R2/Stream
- Served via Cloudflare Stream (adaptive bitrate)
- Generation cost incurred once, served forever

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

### Generative Assets (R2)

```
r2://supernova-assets/
  {workspaceId}/
    images/
      {assetId}.webp      # Generated images (optimized)
    video/
      {assetId}/
        manifest.mpd      # DASH manifest (adaptive)
        segments/         # Video segments
```

**Generation flow:**
1. User requests generation (prompt or preset)
2. Paris calls external API (Flux, Sora, etc.)
3. Result saved to R2 with workspace-scoped key
4. AssetId stored in widget state (`supernova.generatedAssets[]`)
5. Venice serves from R2 with immutable cache headers

**Cost model:**
- Generation cost: $0.01-0.50 per image, $0.10-2.00 per video
- Serving cost: $0 (R2 zero egress)
- Generation happens once; served forever

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

For users below Tier 3, the toggle shows:
> ☐ Enable Supernova — *Upgrade to unlock*

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

### Supernova Is The Design Moat, Technologized

Clickeen's strategic moat #3 is **Design-Led Culture**. Supernova is how we weaponize that moat:

| Layer | What It Means |
|-------|---------------|
| **Free tier** | Clean, solid, well-designed (already better than competitors' paid) |
| **Supernova tier** | Mindblowing — motion, effects, AI-generated visuals, the full arsenal |

### Why Competitors Can't Copy This

| Requirement | Clickeen | Incumbents |
|-------------|----------|------------|
| **Design DNA** | Architect is a designer | Engineering-led, functional but dated |
| **Embed isolation** | Shadow DOM | Legacy iframe/inline |
| **CDN architecture** | Cloudflare Edge, zero egress | Traditional CDN, cost per byte |
| **Generative AI infra** | R2 caching, one-time gen cost | Would need new infra |
| **Lazy loading** | Context-aware at edge | One-size-fits-all |
| **Tier gating** | State-level, server-enforced | Would need rewrite |
| **Codebase** | Modern, designed for this | 15 years of tech debt |

### The Pitch

> "Your competitors use widgets that look like 2010.
> You paste one line and go Supernova."

> "GSAP. Three.js. Flux. Sora.
> The technologies that define the modern web.
> With Clickeen Supernova, paste one line. Make it beautiful."

> "Supernova: The technologies that make the web beautiful."

---

## References

- `documentation/strategy/WhyClickeen.md` — Supernova as a moat
- `documentation/widgets/WidgetArchitecture.md` — How widgets declare Supernova support
- `documentation/widgets/HowWeBuildWidgets.md` — Implementing Supernova in a widget
