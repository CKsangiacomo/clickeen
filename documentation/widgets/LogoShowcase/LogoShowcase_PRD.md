# Logo Showcase Widget PRD

**Status:** NORMATIVE — Ready for Implementation  
**Widget ID:** `content.logoshowcase`  
**Category:** Content Display / Social Proof  

---

## Overview

The Logo Showcase widget displays client/partner logos in a visually appealing carousel, ticker (infinite scroll), or static grid layout. It builds trust and social proof by showcasing partnerships.

### Performance Advantage

| Metric | Elfsight (Competitor) | Clickeen (Target) | Improvement |
|--------|----------------------|-------------------|-------------|
| Initial JS | 120KB+ | <3KB | 40× smaller |
| First Paint | ~2s | ~300ms | 6× faster |
| SSR | No | Yes (Venice) | 100% SEO |
| Max Logos | 50 | 100 | 2× capacity |

---

## Feature Scope (70%+ Elfsight Parity)

### ✅ MUST Implement (Core 70%)

1. **3 Layout Modes**: Ticker, Carousel, Grid
2. **Logo Management**: Upload, reorder, delete (object-manager pattern)
3. **Responsive Controls**: Desktop, tablet, mobile sizing
4. **Header Section**: Title, caption, show/hide
5. **CTA Button**: Text, link, colors, radius
6. **Logo Styling**: Size, spacing, color schemes (original/grayscale/custom)
7. **Ticker Settings**: Speed slider, pause on hover
8. **Carousel Settings**: Items visible, arrow navigation
9. **Random Order**: Server-side shuffle toggle

### ⚠️ Skip for V1 (<30%)

- Background gradient/image/video (color only)
- Font library (use Clickeen typography system)
- Custom JS
- Pre-configured starter designs (curated instances) (add later)
- Link settings per logo (new tab, nofollow)

---

## Widget Definition (Tokyo)

**Location:** `tokyo/widgets/logoshowcase/`

Files:
- `spec.json` — Configuration schema and ToolDrawer panels
- `widget.html` — Stage/Pod HTML scaffold
- `widget.css` — Widget-specific styles (extends Dieter)
- `widget.client.js` — Runtime state application (like FAQ)
- `agent.md` — AI editing context (future)

---

## Data Schema (`spec.json → defaults`)

```json
{
  "widgetname": "logoshowcase",
  "defaults": {
    "logos": [
      {
        "id": "logo-1",
        "url": "/placeholder-logo-1.svg",
        "alt": "Company 1",
        "link": ""
      },
      {
        "id": "logo-2",
        "url": "/placeholder-logo-2.svg",
        "alt": "Company 2",
        "link": ""
      }
    ],
    "header": {
      "show": true,
      "title": "Trusted by leading companies",
      "caption": "",
      "alignment": "center"
    },
    "button": {
      "show": false,
      "text": "Contact Us",
      "url": "",
      "alignment": "center"
    },
    "layout": {
      "mode": "ticker",
      "width": 1200,
      "logoSize": 80,
      "spacing": 80,
      "randomOrder": false,
      "ticker": {
        "speed": 5,
        "pauseOnHover": true,
        "direction": "left"
      },
      "carousel": {
        "itemsVisible": 6,
        "showArrows": true
      },
      "grid": {
        "columnsDesktop": 6,
        "columnsTablet": 4,
        "columnsMobile": 3
      }
    },
    "responsive": {
      "tablet": {
        "logoSize": 60,
        "spacing": 40
      },
      "mobile": {
        "logoSize": 50,
        "spacing": 20
      }
    },
    "appearance": {
      "colorScheme": "original",
      "customColor": "#000000",
      "hoverEffect": "none"
    },
    "stage": {
      "background": "var(--color-system-white)",
      "alignment": "center",
      "paddingLinked": true,
      "padding": 60,
      "paddingTop": 60,
      "paddingRight": 60,
      "paddingBottom": 60,
      "paddingLeft": 60
    },
    "pod": {
      "background": "transparent",
      "paddingLinked": true,
      "padding": 0,
      "paddingTop": 0,
      "paddingRight": 0,
      "paddingBottom": 0,
      "paddingLeft": 0,
      "widthMode": "full",
      "contentWidth": 1200,
      "radiusLinked": true,
      "radius": "none",
      "radiusTL": "none",
      "radiusTR": "none",
      "radiusBR": "none",
      "radiusBL": "none"
    },
    "typography": {
      "globalFamily": "Inter",
      "roleScales": {
        "title": {
          "xs": "20px", "s": "24px", "m": "28px", "l": "32px", "xl": "36px"
        },
        "caption": {
          "xs": "14px", "s": "15px", "m": "16px", "l": "17px", "xl": "18px"
        },
        "button": {
          "xs": "14px", "s": "15px", "m": "16px", "l": "18px", "xl": "20px"
        }
      },
      "roles": {
        "title": {
          "family": "Inter",
          "sizePreset": "m",
          "sizeCustom": "28px",
          "fontStyle": "normal",
          "weight": "600"
        },
        "caption": {
          "family": "Inter",
          "sizePreset": "m",
          "sizeCustom": "16px",
          "fontStyle": "normal",
          "weight": "400"
        },
        "button": {
          "family": "Inter",
          "sizePreset": "m",
          "sizeCustom": "16px",
          "fontStyle": "normal",
          "weight": "600"
        }
      }
    },
    "style": {
      "buttonColor": "var(--color-brand-primary)",
      "buttonTextColor": "var(--color-system-white)",
      "buttonRadius": 8,
      "titleColor": "var(--color-system-black)",
      "captionColor": "color-mix(in oklab, var(--color-system-black), transparent 40%)"
    },
    "behavior": {
      "showBacklink": true
    }
  }
}
```

---

## ToolDrawer Panels (`spec.json → html[]`)

### Panel Structure

Following Clickeen convention, 4 main panels + auto-generated Typography panel:

| Panel ID | Icon | Purpose |
|----------|------|---------|
| `content` | `pencil` | Logos, header, button content |
| `layout` | `square.grid.2x2` | Layout mode, sizes, responsive |
| `appearance` | `paintpalette` | Colors, effects, Stage/Pod appearance |
| `settings` | `gearshape` | Behavior, advanced options |
| (auto) `typography` | `textformat` | Font controls (compiler-generated) |

### Content Panel

```html
<bob-panel id='content'>
  <tooldrawer-cluster>
    <tooldrawer-eyebrow text='Logos' />
    <tooldrawer-field 
      type='logo-gallery' 
      path='logos' 
      add-label='Upload logo' 
      max-items='100'
      accept='image/png,image/jpeg,image/svg+xml,image/webp'
      max-size='10485760'
      default-item='{"id":"","url":"","alt":"","link":""}' />
  </tooldrawer-cluster>
  
  <tooldrawer-cluster>
    <tooldrawer-eyebrow text='Header' />
    <tooldrawer-field type='toggle' size='md' path='header.show' label='Show header' />
    <tooldrawer-field type='textfield' size='lg' path='header.title' label='Title' hint='Trusted by leading companies' show-if="header.show == true" />
    <tooldrawer-field type='textfield' size='lg' path='header.caption' label='Caption' hint='Optional subtitle' show-if="header.show == true" />
    <tooldrawer-field type='segmented' size='md' path='header.alignment' label='Alignment' show-if="header.show == true" options='[{"label":"Left","value":"left","icon":"text.alignleft"},{"label":"Center","value":"center","icon":"text.aligncenter"},{"label":"Right","value":"right","icon":"text.alignright"}]' />
  </tooldrawer-cluster>
  
  <tooldrawer-cluster>
    <tooldrawer-eyebrow text='Call to Action' />
    <tooldrawer-field type='toggle' size='md' path='button.show' label='Show button' />
    <tooldrawer-field type='textfield' size='lg' path='button.text' label='Button text' hint='Contact Us' show-if="button.show == true" />
    <tooldrawer-field type='textfield' size='lg' path='button.url' label='Button URL' hint='https://...' show-if="button.show == true" />
    <tooldrawer-field type='segmented' size='md' path='button.alignment' label='Alignment' show-if="button.show == true" options='[{"label":"Left","value":"left","icon":"text.alignleft"},{"label":"Center","value":"center","icon":"text.aligncenter"},{"label":"Right","value":"right","icon":"text.alignright"}]' />
  </tooldrawer-cluster>
</bob-panel>
```

### Layout Panel

```html
<bob-panel id='layout'>
  <tooldrawer-cluster>
    <tooldrawer-eyebrow text='Display mode' />
    <tooldrawer-field type='choice-tiles' size='lg' path='layout.mode' label='Layout' options='[{"label":"Ticker","value":"ticker","icon":"arrow.right.square"},{"label":"Carousel","value":"carousel","icon":"rectangle.split.3x1"},{"label":"Grid","value":"grid","icon":"square.grid.3x3"}]' />
  </tooldrawer-cluster>
  
  <tooldrawer-cluster>
    <tooldrawer-eyebrow text='Size & spacing' />
    <tooldrawer-field type='slider' size='md' path='layout.logoSize' label='Logo size' min='20' max='200' unit='px' />
    <tooldrawer-field type='slider' size='md' path='layout.spacing' label='Spacing' min='0' max='200' unit='px' />
    <tooldrawer-field type='textfield' size='md' path='layout.width' label='Max width (px)' hint='1200' />
  </tooldrawer-cluster>
  
  <tooldrawer-cluster show-if="layout.mode == 'ticker'">
    <tooldrawer-eyebrow text='Ticker settings' />
    <tooldrawer-field type='slider' size='md' path='layout.ticker.speed' label='Speed' min='1' max='10' hint-left='Slow' hint-right='Fast' />
    <tooldrawer-field type='toggle' size='md' path='layout.ticker.pauseOnHover' label='Pause on hover' />
    <tooldrawer-field type='segmented' size='md' path='layout.ticker.direction' label='Direction' options='[{"label":"Left","value":"left"},{"label":"Right","value":"right"}]' />
  </tooldrawer-cluster>
  
  <tooldrawer-cluster show-if="layout.mode == 'carousel'">
    <tooldrawer-eyebrow text='Carousel settings' />
    <tooldrawer-field type='slider' size='md' path='layout.carousel.itemsVisible' label='Items visible' min='1' max='10' />
    <tooldrawer-field type='toggle' size='md' path='layout.carousel.showArrows' label='Show navigation arrows' />
  </tooldrawer-cluster>
  
  <tooldrawer-cluster show-if="layout.mode == 'grid'">
    <tooldrawer-eyebrow text='Grid columns' />
    <tooldrawer-field type='slider' size='md' path='layout.grid.columnsDesktop' label='Desktop columns' min='2' max='12' />
    <tooldrawer-field type='slider' size='md' path='layout.grid.columnsTablet' label='Tablet columns' min='2' max='8' />
    <tooldrawer-field type='slider' size='md' path='layout.grid.columnsMobile' label='Mobile columns' min='1' max='4' />
  </tooldrawer-cluster>
  
  <tooldrawer-cluster>
    <tooldrawer-eyebrow text='Responsive sizes' />
    <tooldrawer-field type='slider' size='md' path='responsive.tablet.logoSize' label='Tablet logo size' min='20' max='150' unit='px' />
    <tooldrawer-field type='slider' size='md' path='responsive.tablet.spacing' label='Tablet spacing' min='0' max='150' unit='px' />
    <tooldrawer-field type='slider' size='md' path='responsive.mobile.logoSize' label='Mobile logo size' min='20' max='120' unit='px' />
    <tooldrawer-field type='slider' size='md' path='responsive.mobile.spacing' label='Mobile spacing' min='0' max='100' unit='px' />
  </tooldrawer-cluster>
  
  <tooldrawer-cluster>
    <tooldrawer-eyebrow text='Stage/Pod layout' />
    <tooldrawer-field-podstagelayout type='dropdown-actions' size='md' path='pod.widthMode' label='Pod width' options='[{"label":"Full width","value":"full"},{"label":"Fixed width","value":"fixed"}]' />
    <tooldrawer-field-podstagelayout type='textfield' size='md' path='pod.contentWidth' label='Width in pixels' show-if="pod.widthMode == 'fixed'" />
    <tooldrawer-field-podstagelayout type='dropdown-actions' size='md' path='stage.alignment' label='Pod alignment' options='[{"label":"Center","value":"center"},{"label":"Left","value":"left"},{"label":"Right","value":"right"}]' />
  </tooldrawer-cluster>
</bob-panel>
```

### Appearance Panel

```html
<bob-panel id='appearance'>
  <tooldrawer-cluster>
    <tooldrawer-eyebrow text='Logo style' />
    <tooldrawer-field type='dropdown-actions' size='md' path='appearance.colorScheme' label='Color scheme' options='[{"label":"Original colors","value":"original"},{"label":"Grayscale","value":"grayscale"},{"label":"Custom color","value":"custom"}]' />
    <tooldrawer-field type='dropdown-fill' size='md' allow-image='false' path='appearance.customColor' label='Logo tint color' show-if="appearance.colorScheme == 'custom'" />
    <tooldrawer-field type='dropdown-actions' size='md' path='appearance.hoverEffect' label='Hover effect' options='[{"label":"None","value":"none"},{"label":"Restore color","value":"color-restore"},{"label":"Scale up","value":"scale"}]' />
  </tooldrawer-cluster>
  
  <tooldrawer-cluster>
    <tooldrawer-eyebrow text='Header style' />
    <tooldrawer-field type='dropdown-fill' size='md' allow-image='false' path='style.titleColor' label='Title color' />
    <tooldrawer-field type='dropdown-fill' size='md' allow-image='false' path='style.captionColor' label='Caption color' />
  </tooldrawer-cluster>
  
  <tooldrawer-cluster show-if="button.show == true">
    <tooldrawer-eyebrow text='Button style' />
    <tooldrawer-field type='dropdown-fill' size='md' allow-image='false' path='style.buttonColor' label='Button color' />
    <tooldrawer-field type='dropdown-fill' size='md' allow-image='false' path='style.buttonTextColor' label='Button text color' />
    <tooldrawer-field type='slider' size='md' path='style.buttonRadius' label='Button corner radius' min='0' max='50' unit='px' />
  </tooldrawer-cluster>
  
  <tooldrawer-cluster>
    <tooldrawer-eyebrow text='Stage/Pod appearance' />
    <tooldrawer-field-podstageappearance type='dropdown-fill' size='md' path='stage.background' label='Background' />
    <tooldrawer-field-podstageappearance type='dropdown-fill' size='md' path='pod.background' label='Widget background' />
  </tooldrawer-cluster>
</bob-panel>
```

### Settings Panel

```html
<bob-panel id='settings'>
  <tooldrawer-cluster>
    <tooldrawer-eyebrow text='Behavior' />
    <tooldrawer-field type='toggle' size='md' path='layout.randomOrder' label='Randomize logo order' />
    <tooldrawer-field type='toggle' size='md' path='behavior.showBacklink' label='Show Clickeen badge' />
  </tooldrawer-cluster>
</bob-panel>
```

---

## New Control: `logo-gallery`

The Logo Showcase requires a **new tooldrawer-field type** for file upload and management. This differs from existing controls.

### Requirements

1. **File Upload**
   - Drag-and-drop zone
   - "Browse Files" button fallback
   - Progress indicator during upload
   - Multi-file selection support
   
2. **Gallery Display**
   - Thumbnail grid of uploaded logos
   - Drag handles for reordering
   - Delete button per logo
   - Alt text input (inline or modal)
   - Optional link URL input

3. **Upload Flow**
   - Client uploads to Bob → Bob proxies to Paris API
   - Paris stores to CDN (Supabase Storage or Cloudflare R2)
   - Paris returns CDN URL
   - Bob updates `logos[]` array via ops

### Paris API Endpoint

**New:** `POST /api/upload`

```typescript
// Paris: app/api/upload/route.ts
export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const workspaceId = formData.get('workspaceId') as string;
  
  // Validate file type & size
  // Upload to Supabase Storage bucket
  // Return CDN URL
  
  return NextResponse.json({ 
    url: 'https://cdn.clickeen.com/logos/abc123.png',
    width: 200,
    height: 80
  });
}
```

### Dieter Component

**New:** `dieter/components/logo-gallery/`

- `logo-gallery.html` — Upload zone + thumbnail grid HTML
- `logo-gallery.css` — Styles for upload zone, thumbnails, drag handles
- `logo-gallery.spec.json` — Component specification

---

## Shared Runtime Module

**File:** `tokyo/widgets/shared/logoShowcase.js`

```javascript
// Logo Showcase runtime helpers
(function () {
  if (typeof window === 'undefined') return;

  function applyLogoShowcase(cfg, scopeEl) {
    const root = scopeEl.querySelector('[data-role="logoshowcase"]');
    if (!root) return;
    
    // Apply CSS custom properties
    root.style.setProperty('--ls-logo-size', `${cfg.layout.logoSize}px`);
    root.style.setProperty('--ls-spacing', `${cfg.layout.spacing}px`);
    root.style.setProperty('--ls-ticker-duration', `${mapSpeedToDuration(cfg.layout.ticker.speed)}s`);
    root.style.setProperty('--ls-title-color', cfg.style.titleColor);
    root.style.setProperty('--ls-caption-color', cfg.style.captionColor);
    root.style.setProperty('--ls-button-bg', cfg.style.buttonColor);
    root.style.setProperty('--ls-button-color', cfg.style.buttonTextColor);
    root.style.setProperty('--ls-button-radius', `${cfg.style.buttonRadius}px`);
    
    // Apply layout mode
    root.setAttribute('data-layout', cfg.layout.mode);
    root.setAttribute('data-color-scheme', cfg.appearance.colorScheme);
    root.setAttribute('data-hover-effect', cfg.appearance.hoverEffect);
    
    // Ticker direction
    if (cfg.layout.mode === 'ticker') {
      root.setAttribute('data-ticker-direction', cfg.layout.ticker.direction);
      root.setAttribute('data-pause-on-hover', cfg.layout.ticker.pauseOnHover);
    }
    
    // Render logos
    renderLogos(root, cfg.logos, cfg.layout.mode);
  }

  function mapSpeedToDuration(speed) {
    // speed 1=slow (60s), 10=fast (10s)
    return 70 - (speed * 6);
  }

  function renderLogos(root, logos, mode) {
    const track = root.querySelector('[data-role="logo-track"]');
    if (!track) return;
    
    const html = logos.map(logo => `
      <div class="ck-ls__item" data-role="logo-item">
        <img src="${escapeHtml(logo.url)}" alt="${escapeHtml(logo.alt)}" loading="lazy" />
      </div>
    `).join('');
    
    // For ticker, duplicate for seamless loop
    if (mode === 'ticker') {
      track.innerHTML = html + html;
    } else {
      track.innerHTML = html;
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  window.CKLogoShowcase = { applyLogoShowcase };
})();
```

---

## Widget HTML Markup (`widget.html`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Logo Showcase</title>
  <link rel="stylesheet" href="/dieter/tokens.css">
  <link rel="stylesheet" href="widget.css">
</head>
<body>
  <div class="stage" data-ck-widget="logoshowcase">
    <div class="pod">
      <div class="ck-logoshowcase" data-role="logoshowcase" data-layout="ticker" data-state="ready">
        
        <!-- Header -->
        <header class="ck-ls__header" data-role="header">
          <h2 class="ck-ls__title" data-role="title">Trusted by leading companies</h2>
          <p class="ck-ls__caption" data-role="caption"></p>
        </header>
        
        <!-- Logo Track (Ticker/Carousel/Grid) -->
        <div class="ck-ls__viewport" data-role="viewport">
          <div class="ck-ls__track" data-role="logo-track">
            <!-- Logo items rendered by JS -->
          </div>
          
          <!-- Carousel Nav (hidden for ticker/grid) -->
          <button class="ck-ls__nav ck-ls__nav--prev" data-role="nav-prev" aria-label="Previous">
            <span class="diet-btn-ic__icon" data-icon="chevron.left"></span>
          </button>
          <button class="ck-ls__nav ck-ls__nav--next" data-role="nav-next" aria-label="Next">
            <span class="diet-btn-ic__icon" data-icon="chevron.right"></span>
          </button>
        </div>
        
        <!-- CTA Button -->
        <div class="ck-ls__cta" data-role="cta">
          <a class="ck-ls__button" data-role="button" href="#">Contact Us</a>
        </div>
        
        <!-- Empty State -->
        <div class="ck-ls__empty" data-role="empty" hidden>
          <p>Upload logos to get started</p>
        </div>
        
      </div>
    </div>
  </div>
  
  <script src="/widgets/shared/stagePod.js"></script>
  <script src="/widgets/shared/typography.js"></script>
  <script src="/widgets/shared/branding.js"></script>
  <script src="widget.client.js"></script>
</body>
</html>
```

---

## Widget CSS (`widget.css`)

```css
/* Logo Showcase Widget Styles */

.ck-logoshowcase {
  --ls-logo-size: 80px;
  --ls-spacing: 80px;
  --ls-ticker-duration: 30s;
  --ls-title-color: var(--color-system-black);
  --ls-caption-color: color-mix(in oklab, var(--color-system-black), transparent 40%);
  --ls-button-bg: var(--color-brand-primary);
  --ls-button-color: var(--color-system-white);
  --ls-button-radius: 8px;
  
  width: 100%;
  max-width: var(--content-width, 1200px);
}

/* Header */
.ck-ls__header {
  text-align: var(--ls-header-align, center);
  margin-bottom: var(--spacing-6);
}

.ck-ls__header[hidden] {
  display: none;
}

.ck-ls__title {
  font-size: var(--ls-title-size, 28px);
  font-weight: var(--ls-title-weight, 600);
  color: var(--ls-title-color);
  margin: 0 0 var(--spacing-2) 0;
}

.ck-ls__caption {
  font-size: var(--ls-caption-size, 16px);
  color: var(--ls-caption-color);
  margin: 0;
}

.ck-ls__caption:empty {
  display: none;
}

/* Viewport */
.ck-ls__viewport {
  position: relative;
  overflow: hidden;
  width: 100%;
}

/* Track */
.ck-ls__track {
  display: flex;
  gap: var(--ls-spacing);
  align-items: center;
}

/* Logo Item */
.ck-ls__item {
  flex-shrink: 0;
  width: var(--ls-logo-size);
  height: var(--ls-logo-size);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ck-ls__item img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: filter 0.2s, transform 0.2s;
}

/* Color Schemes */
[data-color-scheme="grayscale"] .ck-ls__item img {
  filter: grayscale(100%);
}

[data-color-scheme="custom"] .ck-ls__item img {
  filter: grayscale(100%) brightness(0.5);
  /* Custom color applied via CSS variable overlay or mix-blend-mode */
}

/* Hover Effects */
[data-hover-effect="color-restore"][data-color-scheme="grayscale"] .ck-ls__item:hover img {
  filter: grayscale(0%);
}

[data-hover-effect="scale"] .ck-ls__item:hover img {
  transform: scale(1.1);
}

/* ===== TICKER LAYOUT ===== */
[data-layout="ticker"] .ck-ls__track {
  animation: ls-scroll var(--ls-ticker-duration) linear infinite;
  will-change: transform;
}

[data-layout="ticker"][data-ticker-direction="right"] .ck-ls__track {
  animation-name: ls-scroll-right;
}

[data-layout="ticker"][data-pause-on-hover="true"]:hover .ck-ls__track {
  animation-play-state: paused;
}

[data-layout="ticker"] .ck-ls__nav {
  display: none;
}

@keyframes ls-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

@keyframes ls-scroll-right {
  from { transform: translateX(-50%); }
  to { transform: translateX(0); }
}

/* ===== CAROUSEL LAYOUT ===== */
[data-layout="carousel"] .ck-ls__track {
  transition: transform 0.3s ease;
}

[data-layout="carousel"] .ck-ls__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-system-white);
  border: 1px solid var(--color-system-gray-200);
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

[data-layout="carousel"] .ck-ls__viewport:hover .ck-ls__nav {
  opacity: 1;
}

[data-layout="carousel"] .ck-ls__nav--prev {
  left: 8px;
}

[data-layout="carousel"] .ck-ls__nav--next {
  right: 8px;
}

[data-layout="carousel"] .ck-ls__nav:disabled {
  opacity: 0.3;
  cursor: default;
}

/* ===== GRID LAYOUT ===== */
[data-layout="grid"] .ck-ls__track {
  display: grid;
  grid-template-columns: repeat(var(--ls-grid-cols, 6), 1fr);
  justify-items: center;
}

[data-layout="grid"] .ck-ls__nav {
  display: none;
}

/* ===== CTA Button ===== */
.ck-ls__cta {
  text-align: var(--ls-button-align, center);
  margin-top: var(--spacing-6);
}

.ck-ls__cta[hidden] {
  display: none;
}

.ck-ls__button {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3) var(--spacing-5);
  background-color: var(--ls-button-bg);
  color: var(--ls-button-color);
  text-decoration: none;
  font-weight: 600;
  border-radius: var(--ls-button-radius);
  transition: opacity 0.2s;
}

.ck-ls__button:hover {
  opacity: 0.9;
}

/* ===== Empty State ===== */
.ck-ls__empty {
  text-align: center;
  padding: var(--spacing-8);
  color: var(--color-system-gray-500);
}

/* ===== Responsive ===== */
@media (max-width: 1024px) {
  .ck-logoshowcase {
    --ls-logo-size: var(--ls-tablet-logo-size, 60px);
    --ls-spacing: var(--ls-tablet-spacing, 40px);
  }
  
  [data-layout="grid"] .ck-ls__track {
    grid-template-columns: repeat(var(--ls-grid-cols-tablet, 4), 1fr);
  }
}

@media (max-width: 768px) {
  .ck-logoshowcase {
    --ls-logo-size: var(--ls-mobile-logo-size, 50px);
    --ls-spacing: var(--ls-mobile-spacing, 20px);
  }
  
  [data-layout="grid"] .ck-ls__track {
    grid-template-columns: repeat(var(--ls-grid-cols-mobile, 3), 1fr);
  }
}
```

---

## Client Runtime (`widget.client.js`)

```javascript
// Logo Showcase widget runtime (strict, deterministic)
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const scriptEl = document.currentScript;
  if (!(scriptEl instanceof HTMLElement)) return;

  const widgetRoot = scriptEl.closest('[data-ck-widget="logoshowcase"]');
  if (!(widgetRoot instanceof HTMLElement)) {
    throw new Error('[LogoShowcase] widget.client.js must be inside [data-ck-widget="logoshowcase"]');
  }

  const lsRoot = widgetRoot.querySelector('[data-role="logoshowcase"]');
  if (!(lsRoot instanceof HTMLElement)) {
    throw new Error('[LogoShowcase] Missing [data-role="logoshowcase"] root');
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mapSpeedToDuration(speed) {
    // speed 1=60s (slow), 10=10s (fast)
    return 70 - (speed * 6);
  }

  function renderLogos(track, logos, mode) {
    if (!track) return;
    
    const items = logos.map(logo => `
      <div class="ck-ls__item" data-role="logo-item">
        ${logo.link ? `<a href="${escapeHtml(logo.link)}" target="_blank" rel="noopener">` : ''}
        <img src="${escapeHtml(logo.url)}" alt="${escapeHtml(logo.alt || '')}" loading="lazy" />
        ${logo.link ? '</a>' : ''}
      </div>
    `).join('');
    
    // Duplicate logos for seamless ticker loop
    if (mode === 'ticker') {
      track.innerHTML = items + items;
    } else {
      track.innerHTML = items;
    }
  }

  function applyLayout(state) {
    const mode = state.layout.mode;
    lsRoot.setAttribute('data-layout', mode);
    
    // CSS variables for sizing
    lsRoot.style.setProperty('--ls-logo-size', `${state.layout.logoSize}px`);
    lsRoot.style.setProperty('--ls-spacing', `${state.layout.spacing}px`);
    lsRoot.style.setProperty('--content-width', `${state.layout.width}px`);
    
    // Responsive variables
    lsRoot.style.setProperty('--ls-tablet-logo-size', `${state.responsive.tablet.logoSize}px`);
    lsRoot.style.setProperty('--ls-tablet-spacing', `${state.responsive.tablet.spacing}px`);
    lsRoot.style.setProperty('--ls-mobile-logo-size', `${state.responsive.mobile.logoSize}px`);
    lsRoot.style.setProperty('--ls-mobile-spacing', `${state.responsive.mobile.spacing}px`);
    
    // Layout-specific settings
    if (mode === 'ticker') {
      const duration = mapSpeedToDuration(state.layout.ticker.speed);
      lsRoot.style.setProperty('--ls-ticker-duration', `${duration}s`);
      lsRoot.setAttribute('data-ticker-direction', state.layout.ticker.direction);
      lsRoot.setAttribute('data-pause-on-hover', String(state.layout.ticker.pauseOnHover));
    }
    
    if (mode === 'grid') {
      lsRoot.style.setProperty('--ls-grid-cols', String(state.layout.grid.columnsDesktop));
      lsRoot.style.setProperty('--ls-grid-cols-tablet', String(state.layout.grid.columnsTablet));
      lsRoot.style.setProperty('--ls-grid-cols-mobile', String(state.layout.grid.columnsMobile));
    }
  }

  function applyAppearance(state) {
    lsRoot.setAttribute('data-color-scheme', state.appearance.colorScheme);
    lsRoot.setAttribute('data-hover-effect', state.appearance.hoverEffect);
    
    if (state.appearance.colorScheme === 'custom') {
      lsRoot.style.setProperty('--ls-custom-color', state.appearance.customColor);
    }
  }

  function applyStyle(state) {
    lsRoot.style.setProperty('--ls-title-color', state.style.titleColor);
    lsRoot.style.setProperty('--ls-caption-color', state.style.captionColor);
    lsRoot.style.setProperty('--ls-button-bg', state.style.buttonColor);
    lsRoot.style.setProperty('--ls-button-color', state.style.buttonTextColor);
    lsRoot.style.setProperty('--ls-button-radius', `${state.style.buttonRadius}px`);
  }

  function applyHeader(state) {
    const headerEl = lsRoot.querySelector('[data-role="header"]');
    const titleEl = lsRoot.querySelector('[data-role="title"]');
    const captionEl = lsRoot.querySelector('[data-role="caption"]');
    
    if (headerEl) {
      headerEl.hidden = state.header.show !== true;
      headerEl.style.textAlign = state.header.alignment;
      lsRoot.style.setProperty('--ls-header-align', state.header.alignment);
    }
    
    if (titleEl) titleEl.textContent = state.header.title;
    if (captionEl) captionEl.textContent = state.header.caption || '';
  }

  function applyButton(state) {
    const ctaEl = lsRoot.querySelector('[data-role="cta"]');
    const buttonEl = lsRoot.querySelector('[data-role="button"]');
    
    if (ctaEl) {
      ctaEl.hidden = state.button.show !== true;
      ctaEl.style.textAlign = state.button.alignment;
      lsRoot.style.setProperty('--ls-button-align', state.button.alignment);
    }
    
    if (buttonEl) {
      buttonEl.textContent = state.button.text;
      buttonEl.href = state.button.url || '#';
    }
  }

  let carouselPosition = 0;

  function wireCarousel(state) {
    if (state.layout.mode !== 'carousel') return;
    
    const prevBtn = lsRoot.querySelector('[data-role="nav-prev"]');
    const nextBtn = lsRoot.querySelector('[data-role="nav-next"]');
    const track = lsRoot.querySelector('[data-role="logo-track"]');
    
    if (!prevBtn || !nextBtn || !track) return;
    
    const itemWidth = state.layout.logoSize + state.layout.spacing;
    const maxScroll = (state.logos.length - state.layout.carousel.itemsVisible) * itemWidth;
    
    prevBtn.onclick = () => {
      carouselPosition = Math.max(0, carouselPosition - itemWidth);
      track.style.transform = `translateX(-${carouselPosition}px)`;
      updateNavButtons();
    };
    
    nextBtn.onclick = () => {
      carouselPosition = Math.min(maxScroll, carouselPosition + itemWidth);
      track.style.transform = `translateX(-${carouselPosition}px)`;
      updateNavButtons();
    };
    
    function updateNavButtons() {
      prevBtn.disabled = carouselPosition <= 0;
      nextBtn.disabled = carouselPosition >= maxScroll;
    }
    
    updateNavButtons();
  }

  function applyState(state) {
    // Stage/Pod
    if (!window.CKStagePod?.applyStagePod) {
      throw new Error('[LogoShowcase] Missing CKStagePod.applyStagePod');
    }
    window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot);

    // Typography
    if (!window.CKTypography?.applyTypography) {
      throw new Error('[LogoShowcase] Missing CKTypography.applyTypography');
    }
    window.CKTypography.applyTypography(state.typography, lsRoot, {
      title: { varKey: 'title' },
      caption: { varKey: 'caption' },
      button: { varKey: 'button' },
    });

    // Layout & content
    applyLayout(state);
    applyAppearance(state);
    applyStyle(state);
    applyHeader(state);
    applyButton(state);

    // Logos
    const track = lsRoot.querySelector('[data-role="logo-track"]');
    const logosToRender = state.layout.randomOrder 
      ? shuffleArray([...state.logos]) 
      : state.logos;
    renderLogos(track, logosToRender, state.layout.mode);

    // Empty state
    const emptyEl = lsRoot.querySelector('[data-role="empty"]');
    const hasLogos = state.logos && state.logos.length > 0;
    lsRoot.setAttribute('data-state', hasLogos ? 'ready' : 'empty');
    if (emptyEl) emptyEl.hidden = hasLogos;

    // Carousel nav
    carouselPosition = 0;
    wireCarousel(state);
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Listen for state updates from Bob editor
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'ck:state-update') return;
    if (data.widgetname !== 'logoshowcase') return;
    applyState(data.state);
  });

  // Initial state from SSR
  const initialState = window.CK_WIDGET && window.CK_WIDGET.state;
  if (initialState) applyState(initialState);
})();
```

---

## Implementation Phases

### Phase 1: Core Structure (3-4 days)
- [ ] Create `tokyo/widgets/logoshowcase/` directory
- [ ] Implement `spec.json` with defaults and panels
- [ ] Implement `widget.html` with Stage/Pod structure
- [ ] Implement `widget.css` with all layout modes
- [ ] Implement `widget.client.js` with `applyState`
- [ ] Add widget to Bob's widget catalog
- [ ] Test basic rendering in preview iframe

### Phase 2: Logo Management (4-5 days)
- [ ] Design `logo-gallery` control in Dieter
- [ ] Implement Paris `POST /api/upload` endpoint
- [ ] Set up Supabase Storage bucket (or Cloudflare R2)
- [ ] Implement logo upload flow in Bob
- [ ] Implement logo reordering (drag handles)
- [ ] Implement logo deletion
- [ ] Alt text and link editing per logo

### Phase 3: Layout Modes (3-4 days)
- [ ] Ticker animation (CSS keyframes, pause on hover)
- [ ] Carousel navigation (minimal JS, arrow buttons)
- [ ] Grid layout (CSS Grid, responsive columns)
- [ ] Layout mode switcher UI
- [ ] Responsive controls (tablet/mobile sliders)

### Phase 4: Styling & Polish (2-3 days)
- [ ] Color scheme application (original/grayscale/custom)
- [ ] Hover effects (color-restore, scale)
- [ ] Button styling controls
- [ ] Header alignment and colors
- [ ] Stage/Pod appearance integration

### Phase 5: Testing & Edge Cases (2 days)
- [ ] Test with 1 logo, 100 logos
- [ ] Test responsive breakpoints
- [ ] Test carousel edge cases (fewer logos than visible)
- [ ] Test ticker seamless loop
- [ ] Accessibility review (WCAG AA)
- [ ] Performance audit (<3KB JS target)

**Total Estimate: 14-18 days**

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Initial JS bundle | <3KB |
| First contentful paint | <400ms |
| Layout modes | 3 (Ticker, Carousel, Grid) |
| Max logos | 100 |
| Elfsight feature parity | 70%+ |
| Accessibility | WCAG AA |
| Mobile responsiveness | Separate tablet/mobile controls |

---

## Dependencies

### Requires Before Implementation

1. **Paris `/api/upload` endpoint** — New file upload capability
2. **Supabase Storage bucket** — CDN for logo images
3. **Dieter `logo-gallery` component** — New control type
4. **Dieter `slider` component** — Speed/size controls (partially exists)

### Reuses Existing

- CKStagePod shared runtime
- CKTypography shared runtime  
- `dropdown-actions`, `dropdown-fill`, `toggle`, `textfield`, `segmented` controls
- `tooldrawer-field-podstagelayout`, `tooldrawer-field-podstageappearance` macros

---

## For AI Implementers

**Key files to reference:**
- `tokyo/widgets/faq/spec.json` — Panel structure pattern
- `tokyo/widgets/faq/widget.client.js` — Runtime pattern
- `tokyo/widgets/shared/stagePod.js` — Shared runtime pattern
- `bob/lib/compiler.server.ts` — Panel compilation
- `dieter/components/object-manager/` — Array management pattern

**Critical implementation notes:**
1. Ticker animation uses CSS `@keyframes`, duplicate logo array in DOM for seamless loop
2. Carousel uses minimal JS (<500 bytes) for arrow navigation
3. Grid is pure CSS Grid with `auto-fit` for responsiveness
4. All colors/sizes must be CSS variables for instant preview updates
5. `data-role` attributes required on all patchable elements
6. Logo upload is async — show progress, handle errors gracefully
