# Logo Showcase Widget PRD

**Status:** PRD — Ready for Implementation  
**Widget ID:** `content.logoshowcase`  
**Category:** Content Display / Social Proof  

---

## Overview

The Logo Showcase widget displays client/partner logos in a visually appealing carousel, ticker (infinite scroll), or static grid layout. It builds trust and social proof by showcasing partnerships.

### Key Advantages

- **SSR-first**: Venice renders full HTML at edge for instant SEO indexability
- **Logo capacity**: 100 logos (vs competitor 50)
- **AI-native editing**: Spec-driven ToolDrawer with strict ops validation

---

## Feature Scope (100% Elfsight Parity)

### ✅ MUST Implement (100% Feature Parity)

#### Content Features
1. **Logo Management**: Upload (drag & drop, browse), reorder, delete (object-manager pattern)
2. **Per-Logo Settings**: Alt text, link URL, open in new tab toggle, nofollow toggle
3. **Header Section**: Title, caption (with rich text), show/hide toggle
4. **CTA Button**: Text, link, icon (with position before/after), colors, radius, alignment

#### Layout Features
5. **3 Layout Modes**: Ticker, Carousel, Grid
6. **Width Control**: Max width in px/percentage
7. **Logo Size**: Slider (20-200px)
8. **Spacing**: Gap between logos slider (0-200px)
9. **Ticker Settings**: Speed slider (1-10), pause on hover, direction (left/right)
10. **Carousel Settings**: Items visible (1-10), arrow navigation, auto-slide toggle, slide delay
11. **Grid Settings**: Columns per breakpoint (desktop, tablet, mobile)
12. **Responsive Controls**: Separate tablet & mobile settings for logo size and spacing
13. **Random Order**: Server-side shuffle toggle

#### Style Features
14. **Background**: Solid color (via Stage/Pod appearance)
15. **Logo Styling**: Color schemes (original/grayscale/custom tint), hover effects (none/color-restore/scale/opacity)
16. **Header Styling**: Title color, caption color, links color, alignment (left/center/right)
17. **Header Typography**: Title size (preset dropdown), bold toggle, italic toggle; Caption size, bold, italic
18. **Button Styling**: Background color, text color, border radius, alignment

### ⚠️ Skip for V1 (Elfsight-specific features)

- **Templates** — Clickeen treats templates as curated instances (bootstrap; no SQL seeds)
- **Custom CSS** — Not supported in Clickeen architecture
- **Custom JS** — Not supported in Clickeen architecture  
- **Background gradient/image/video** — Use solid color via Stage/Pod (can add later)
- **Font library (200+ fonts)** — Use Clickeen's typography system with global font family

---

## Widget Definition (Tokyo)

**Location:** `tokyo/widgets/logoshowcase/`

```
tokyo/widgets/logoshowcase/
├── spec.json           # Configuration schema and ToolDrawer panels
├── widget.html         # Stage/Pod HTML scaffold
├── widget.css          # Widget-specific styles (extends Dieter)
├── widget.client.js    # Runtime state application
├── agent.md            # AI editing context
└── assets/             # Default placeholder images
    ├── logo-1.png      # Placeholder logo 1
    ├── logo-2.png      # Placeholder logo 2
    ├── logo-3.png      # Placeholder logo 3
    ├── logo-4.png      # Placeholder logo 4
    ├── logo-5.png      # Placeholder logo 5
    ├── logo-6.png      # Placeholder logo 6
    ├── logo-7.png      # Placeholder logo 7
    └── logo-8.png      # Placeholder logo 8
```

### Assets Folder Pattern

Widgets that ship with default assets (images, icons, etc.) store them in `tokyo/widgets/{widgetname}/assets/`. These are served by Tokyo's dev server and referenced in `spec.json` defaults:

```json
{
  "logos": [
    { "id": "logo-1", "url": "/widgets/logoshowcase/assets/logo-1.png", "alt": "Company 1" },
    { "id": "logo-2", "url": "/widgets/logoshowcase/assets/logo-2.png", "alt": "Company 2" },
    // ... 8 logos total
  ]
}
```

**How it works:**
1. Tokyo dev server (`tokyo/dev-server.mjs`) serves static files from `tokyo/`
2. Widget assets are accessible at `http://localhost:3456/widgets/logoshowcase/assets/logo-1.png`
3. In production, Tokyo assets deploy to CDN (same URL structure)
4. When user uploads their own logos via SanFrancisco, URLs point to R2 CDN instead

---

## Data Schema (`spec.json → defaults`)

```json
{
  "widgetname": "logoshowcase",
  "defaults": {
    "logos": [
      { "id": "logo-1", "url": "/widgets/logoshowcase/assets/logo-1.png", "alt": "Company 1", "link": "", "openInNewTab": true, "nofollow": false },
      { "id": "logo-2", "url": "/widgets/logoshowcase/assets/logo-2.png", "alt": "Company 2", "link": "", "openInNewTab": true, "nofollow": false },
      { "id": "logo-3", "url": "/widgets/logoshowcase/assets/logo-3.png", "alt": "Company 3", "link": "", "openInNewTab": true, "nofollow": false },
      { "id": "logo-4", "url": "/widgets/logoshowcase/assets/logo-4.png", "alt": "Company 4", "link": "", "openInNewTab": true, "nofollow": false },
      { "id": "logo-5", "url": "/widgets/logoshowcase/assets/logo-5.png", "alt": "Company 5", "link": "", "openInNewTab": true, "nofollow": false },
      { "id": "logo-6", "url": "/widgets/logoshowcase/assets/logo-6.png", "alt": "Company 6", "link": "", "openInNewTab": true, "nofollow": false },
      { "id": "logo-7", "url": "/widgets/logoshowcase/assets/logo-7.png", "alt": "Company 7", "link": "", "openInNewTab": true, "nofollow": false },
      { "id": "logo-8", "url": "/widgets/logoshowcase/assets/logo-8.png", "alt": "Company 8", "link": "", "openInNewTab": true, "nofollow": false }
    ],
    "header": {
      "show": true,
      "title": "Trusted by leading companies",
      "titleBold": true,
      "titleItalic": false,
      "caption": "",
      "captionBold": false,
      "captionItalic": false,
      "alignment": "center"
    },
    "button": {
      "show": false,
      "text": "Contact Us",
      "url": "",
      "icon": "",
      "iconPosition": "before",
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
        "showArrows": true,
        "autoSlide": false,
        "slideDelay": 3
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
      "captionColor": "color-mix(in oklab, var(--color-system-black), transparent 40%)",
      "linksColor": "var(--color-brand-primary)"
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
      type='repeater' 
      path='logos' 
      label='Logos'
      add-label='Add logo'
      default-item='{"id":"","url":"","alt":"","link":"","openInNewTab":true,"nofollow":false}'
      template='<div class="diet-repeater__item-body diet-logo-item"><div class="diet-logo-preview"><img src="" alt="" data-bob-src="logos.__INDEX__.url" /></div><div class="diet-logo-fields"><div class="diet-textfield" data-size="sm"><label class="diet-textfield__control"><span class="diet-textfield__display-label label-xs">URL</span><input class="diet-textfield__field body-s" type="text" data-bob-path="logos.__INDEX__.url" placeholder="https://... or upload" /></label></div><div class="diet-textfield" data-size="sm"><label class="diet-textfield__control"><span class="diet-textfield__display-label label-xs">Alt</span><input class="diet-textfield__field body-s" type="text" data-bob-path="logos.__INDEX__.alt" placeholder="Company name" /></label></div><div class="diet-textfield" data-size="sm"><label class="diet-textfield__control"><span class="diet-textfield__display-label label-xs">Link</span><input class="diet-textfield__field body-s" type="text" data-bob-path="logos.__INDEX__.link" placeholder="https://..." /></label></div><div class="diet-logo-toggles"><label class="diet-toggle" data-size="xs"><input class="diet-toggle__input" type="checkbox" data-bob-path="logos.__INDEX__.openInNewTab" /><span class="diet-toggle__track"></span><span class="diet-toggle__label label-xs">New tab</span></label><label class="diet-toggle" data-size="xs"><input class="diet-toggle__input" type="checkbox" data-bob-path="logos.__INDEX__.nofollow" /><span class="diet-toggle__track"></span><span class="diet-toggle__label label-xs">Nofollow</span></label></div></div></div>' />
  </tooldrawer-cluster>
  
  <tooldrawer-cluster>
    <tooldrawer-eyebrow text='Header' />
    <tooldrawer-field type='toggle' size='md' path='header.show' label='Show header' />
    <tooldrawer-field type='textedit' size='lg' path='header.title' label='Title' hint='Trusted by leading companies' show-if="header.show == true" />
    <tooldrawer-field type='textedit' size='lg' path='header.caption' label='Caption' hint='Optional subtitle with formatting support' show-if="header.show == true" />
    <tooldrawer-field type='segmented' size='md' path='header.alignment' label='Alignment' show-if="header.show == true" options='[{"label":"Left","value":"left","icon":"text.alignleft"},{"label":"Center","value":"center","icon":"text.aligncenter"},{"label":"Right","value":"right","icon":"text.alignright"}]' />
  </tooldrawer-cluster>
  
  <tooldrawer-cluster>
    <tooldrawer-eyebrow text='Call to Action' />
    <tooldrawer-field type='toggle' size='md' path='button.show' label='Show button' />
    <tooldrawer-field type='textfield' size='lg' path='button.text' label='Button text' hint='Contact Us' show-if="button.show == true" />
    <tooldrawer-field type='textfield' size='lg' path='button.url' label='Button URL' hint='https://...' show-if="button.show == true" />
    <tooldrawer-field type='dropdown-actions' size='md' path='button.icon' label='Button icon' placeholder='No icon' show-if="button.show == true" options='[{"label":"None","value":""},{"label":"Arrow Right","value":"arrow.right"},{"label":"Chevron Right","value":"chevron.right"},{"label":"External Link","value":"arrow.up.right.square"},{"label":"Sparkles","value":"sparkles"},{"label":"Phone","value":"phone"},{"label":"Envelope","value":"envelope"}]' />
    <tooldrawer-field type='segmented' size='md' path='button.iconPosition' label='Icon position' show-if="button.show == true && button.icon != ''" options='[{"label":"Before text","value":"before"},{"label":"After text","value":"after"}]' />
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
    <tooldrawer-field type='toggle' size='md' path='layout.carousel.autoSlide' label='Auto-slide' />
    <tooldrawer-field type='slider' size='md' path='layout.carousel.slideDelay' label='Slide delay (seconds)' min='1' max='10' show-if="layout.carousel.autoSlide == true" />
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
    <tooldrawer-field-podstagelayout type='dropdown-actions' size='md' path='pod.widthMode' label='Pod width' placeholder='Choose width' value='{{pod.widthMode}}' options='[{"label":"Full width","value":"full"},{"label":"Fixed width","value":"fixed"}]' />
    <tooldrawer-field-podstagelayout type='textfield' size='md' path='pod.contentWidth' label='Width in pixels' show-if="pod.widthMode == 'fixed'" />
    <tooldrawer-field-podstagelayout type='dropdown-actions' size='md' path='stage.alignment' label='Pod alignment' placeholder='Choose alignment' value='{{stage.alignment}}' options='[{"label":"Center","value":"center"},{"label":"Left","value":"left"},{"label":"Right","value":"right"}]' />
    <tooldrawer-field-podstagelayout type='toggle' size='md' path='pod.radiusLinked' label='Link pod corners' value='{{pod.radiusLinked}}' />
    <tooldrawer-field-podstagelayout type='dropdown-actions' size='md' path='pod.radius' label='Corner radius' placeholder='Choose radius' value='{{pod.radius}}' show-if="pod.radiusLinked == true" options='[{"label":"None","value":"none"},{"label":"Small","value":"2xl"},{"label":"Medium","value":"4xl"},{"label":"Large","value":"6xl"},{"label":"X-Large","value":"10xl"}]' />
    <tooldrawer-field-podstagelayout type='dropdown-actions' size='md' path='pod.radiusTL' label='Top-left radius' placeholder='Choose radius' value='{{pod.radiusTL}}' show-if="pod.radiusLinked == false" options='[{"label":"None","value":"none"},{"label":"Small","value":"2xl"},{"label":"Medium","value":"4xl"},{"label":"Large","value":"6xl"},{"label":"X-Large","value":"10xl"}]' />
    <tooldrawer-field-podstagelayout type='dropdown-actions' size='md' path='pod.radiusTR' label='Top-right radius' placeholder='Choose radius' value='{{pod.radiusTR}}' show-if="pod.radiusLinked == false" options='[{"label":"None","value":"none"},{"label":"Small","value":"2xl"},{"label":"Medium","value":"4xl"},{"label":"Large","value":"6xl"},{"label":"X-Large","value":"10xl"}]' />
    <tooldrawer-field-podstagelayout type='dropdown-actions' size='md' path='pod.radiusBR' label='Bottom-right radius' placeholder='Choose radius' value='{{pod.radiusBR}}' show-if="pod.radiusLinked == false" options='[{"label":"None","value":"none"},{"label":"Small","value":"2xl"},{"label":"Medium","value":"4xl"},{"label":"Large","value":"6xl"},{"label":"X-Large","value":"10xl"}]' />
    <tooldrawer-field-podstagelayout type='dropdown-actions' size='md' path='pod.radiusBL' label='Bottom-left radius' placeholder='Choose radius' value='{{pod.radiusBL}}' show-if="pod.radiusLinked == false" options='[{"label":"None","value":"none"},{"label":"Small","value":"2xl"},{"label":"Medium","value":"4xl"},{"label":"Large","value":"6xl"},{"label":"X-Large","value":"10xl"}]' />
    <tooldrawer-field-podstagelayout type='toggle' size='md' path='pod.paddingLinked' label='Link pod padding' value='{{pod.paddingLinked}}' />
    <tooldrawer-field-podstagelayout type='textfield' size='md' path='pod.padding' label='Pod padding (px)' show-if="pod.paddingLinked == true" />
    <tooldrawer-field-podstagelayout type='textfield' size='md' path='pod.paddingTop' label='Pod top padding (px)' show-if="pod.paddingLinked == false" />
    <tooldrawer-field-podstagelayout type='textfield' size='md' path='pod.paddingRight' label='Pod right padding (px)' show-if="pod.paddingLinked == false" />
    <tooldrawer-field-podstagelayout type='textfield' size='md' path='pod.paddingBottom' label='Pod bottom padding (px)' show-if="pod.paddingLinked == false" />
    <tooldrawer-field-podstagelayout type='textfield' size='md' path='pod.paddingLeft' label='Pod left padding (px)' show-if="pod.paddingLinked == false" />
    <tooldrawer-field-podstagelayout type='toggle' size='md' path='stage.paddingLinked' label='Link stage padding' value='{{stage.paddingLinked}}' />
    <tooldrawer-field-podstagelayout type='textfield' size='md' path='stage.padding' label='Stage padding (px)' show-if="stage.paddingLinked == true" />
    <tooldrawer-field-podstagelayout type='textfield' size='md' path='stage.paddingTop' label='Stage top padding (px)' show-if="stage.paddingLinked == false" />
    <tooldrawer-field-podstagelayout type='textfield' size='md' path='stage.paddingRight' label='Stage right padding (px)' show-if="stage.paddingLinked == false" />
    <tooldrawer-field-podstagelayout type='textfield' size='md' path='stage.paddingBottom' label='Stage bottom padding (px)' show-if="stage.paddingLinked == false" />
    <tooldrawer-field-podstagelayout type='textfield' size='md' path='stage.paddingLeft' label='Stage left padding (px)' show-if="stage.paddingLinked == false" />
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
    <tooldrawer-field type='dropdown-actions' size='md' path='appearance.hoverEffect' label='Hover effect' options='[{"label":"None","value":"none"},{"label":"Restore color","value":"color-restore"},{"label":"Scale up","value":"scale"},{"label":"Opacity fade","value":"opacity"}]' />
  </tooldrawer-cluster>
  
  <tooldrawer-cluster>
    <tooldrawer-eyebrow text='Header style' />
    <tooldrawer-field type='dropdown-fill' size='md' allow-image='false' path='style.titleColor' label='Title color' />
    <tooldrawer-field type='toggle' size='md' path='header.titleBold' label='Title bold' />
    <tooldrawer-field type='toggle' size='md' path='header.titleItalic' label='Title italic' />
    <tooldrawer-field type='dropdown-fill' size='md' allow-image='false' path='style.captionColor' label='Caption color' />
    <tooldrawer-field type='toggle' size='md' path='header.captionBold' label='Caption bold' />
    <tooldrawer-field type='toggle' size='md' path='header.captionItalic' label='Caption italic' />
    <tooldrawer-field type='dropdown-fill' size='md' allow-image='false' path='style.linksColor' label='Links color' />
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

## Logo Management: Leveraging `repeater` Component

Instead of creating a new component, Logo Showcase uses the **existing `repeater`** pattern (same as FAQ questions). This gives us massive advantages over Elfsight.

### Why Repeater is 100× Better Than Elfsight

| Feature | Elfsight | Clickeen (Repeater) |
|---------|----------|---------------------|
| Per-logo editing | Basic popover | **Rich inline editing** with dropdown-edit |
| Reordering | Drag thumbnails | **Visual drag handles** with animation |
| Add logo | File picker only | **File picker + URL paste + AI-generated** |
| Bulk operations | None | **AI ops**: insert, remove, move, set |
| Validation | Client-only | **No hidden fixups** (ops apply deterministically; Keep/Undo is the commit gate) |
| Undo/Redo | None | **Full undo stack** via ops history |
| Accessibility | Limited | **WCAG AA** (keyboard nav, screen readers) |
| Preview sync | Reload iframe | **Instant postMessage** state updates |

### Repeater Template for Logos

Each logo item uses `dropdown-edit` for rich inline editing:

```html
<tooldrawer-field 
  type='repeater' 
  path='logos' 
  label='Logos' 
  add-label='Add logo'
  default-item='{"id":"","url":"","alt":"","link":"","openInNewTab":true,"nofollow":false}'
  template='
    <div class="diet-repeater__item-body">
      <!-- Logo Thumbnail Preview -->
      <div class="diet-logo-preview" data-role="logo-preview">
        <img src="" alt="" data-bob-path="logos.__INDEX__.url" />
      </div>
      
      <!-- URL Input (supports upload or paste) -->
      <div class="diet-textfield" data-size="md">
        <label class="diet-textfield__control">
          <span class="diet-textfield__display-label label-s">Image URL</span>
          <input class="diet-textfield__field body-s" type="text" 
                 data-bob-path="logos.__INDEX__.url" 
                 placeholder="https://... or upload" />
        </label>
        <button type="button" class="diet-btn-ic diet-logo-upload" data-size="sm" data-variant="neutral">
          <span class="diet-btn-ic__icon" data-icon="arrow.up.doc"></span>
        </button>
      </div>
      
      <!-- Alt Text -->
      <div class="diet-textfield" data-size="md">
        <label class="diet-textfield__control">
          <span class="diet-textfield__display-label label-s">Alt text</span>
          <input class="diet-textfield__field body-s" type="text" 
                 data-bob-path="logos.__INDEX__.alt" 
                 placeholder="Company name" />
        </label>
      </div>
      
      <!-- Link URL -->
      <div class="diet-textfield" data-size="md">
        <label class="diet-textfield__control">
          <span class="diet-textfield__display-label label-s">Link URL</span>
          <input class="diet-textfield__field body-s" type="text" 
                 data-bob-path="logos.__INDEX__.link" 
                 placeholder="https://..." />
        </label>
      </div>
      
      <!-- Link Options (inline toggles) -->
      <div class="diet-logo-link-options">
        <label class="diet-toggle" data-size="sm">
          <input class="diet-toggle__input" type="checkbox" 
                 data-bob-path="logos.__INDEX__.openInNewTab" />
          <span class="diet-toggle__track"></span>
          <span class="diet-toggle__label label-xs">New tab</span>
        </label>
        <label class="diet-toggle" data-size="sm">
          <input class="diet-toggle__input" type="checkbox" 
                 data-bob-path="logos.__INDEX__.nofollow" />
          <span class="diet-toggle__track"></span>
          <span class="diet-toggle__label label-xs">Nofollow</span>
        </label>
      </div>
    </div>
  '
/>
```

### Upload Flow (Enhanced)

**Three ways to add a logo:**

1. **File Upload** — Click upload button → SanFrancisco API → R2 → CDN URL
2. **Paste URL** — Directly paste any image URL (validates on blur)
3. **AI-Generated** — Copilot generates placeholder SVGs or fetches brand logos

**SanFrancisco Upload Endpoint (existing):**

```typescript
// POST /upload → Returns CDN URL
interface UploadResponse {
  url: string;      // CDN URL (e.g., https://cdn.clickeen.com/logos/abc123.png)
  key: string;      // R2 object key
  width?: number;   
  height?: number;
}
```

### AI Ops Advantage

Because logos use the standard `repeater` pattern, AI can manipulate them via ops:

```typescript
// AI adds a new logo
{ op: "insert", path: "logos", index: 0, value: { id: "new-1", url: "https://...", alt: "Acme Corp" } }

// AI reorders logos
{ op: "move", path: "logos", from: 3, to: 0 }

// AI updates alt text for SEO
{ op: "set", path: "logos.2.alt", value: "Acme Corporation - Enterprise Solutions" }

// AI removes duplicate
{ op: "remove", path: "logos", index: 5 }
```

### Important: Separation of Concerns

**Repeater/Object-Manager** = ToolDrawer controls for **managing the `logos[]` array** in the editor:
- Add new logo items
- Remove logo items  
- Reorder logo items (drag handles)
- Edit per-logo fields (URL, alt, link, toggles)

**`widget.css`** = Styling for **how logos render** in the preview/embed:
- Ticker animation
- Carousel layout
- Grid layout
- Color schemes, hover effects, etc.

The repeater just provides the standard array management UI. All widget-specific styling is in `tokyo/widgets/logoshowcase/widget.css` (specified in the Widget CSS section of this PRD).

---

## Shared Runtime Module

The Logo Showcase uses the existing shared runtime modules:

- `tokyo/widgets/shared/stagePod.js` — Stage/Pod appearance
- `tokyo/widgets/shared/typography.js` — Typography roles
- `tokyo/widgets/shared/branding.js` — Clickeen badge

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
          <a class="ck-ls__button" data-role="button" href="#">
            <span class="ck-ls__button-icon ck-ls__button-icon--before" data-role="button-icon-before"></span>
            <span class="ck-ls__button-text" data-role="button-text">Contact Us</span>
            <span class="ck-ls__button-icon ck-ls__button-icon--after" data-role="button-icon-after"></span>
          </a>
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
  --ls-title-weight: 600;
  --ls-title-style: normal;
  --ls-caption-color: color-mix(in oklab, var(--color-system-black), transparent 40%);
  --ls-caption-weight: 400;
  --ls-caption-style: normal;
  --ls-links-color: var(--color-brand-primary);
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
  font-weight: var(--ls-title-weight);
  font-style: var(--ls-title-style);
  color: var(--ls-title-color);
  margin: 0 0 var(--spacing-2) 0;
}

.ck-ls__caption {
  font-size: var(--ls-caption-size, 16px);
  font-weight: var(--ls-caption-weight);
  font-style: var(--ls-caption-style);
  color: var(--ls-caption-color);
  margin: 0;
}

.ck-ls__caption a {
  color: var(--ls-links-color);
  text-decoration: underline;
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

.ck-ls__item a {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.ck-ls__item img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: filter 0.2s, transform 0.2s, opacity 0.2s;
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

[data-hover-effect="opacity"] .ck-ls__item img {
  opacity: 0.7;
}

[data-hover-effect="opacity"] .ck-ls__item:hover img {
  opacity: 1;
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

[data-layout="carousel"][data-show-arrows="false"] .ck-ls__nav {
  display: none;
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

.ck-ls__button-icon {
  display: none;
  width: 16px;
  height: 16px;
}

.ck-ls__button-icon[data-visible="true"] {
  display: flex;
}

.ck-ls__button-icon svg {
  width: 100%;
  height: 100%;
  fill: currentColor;
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
    
    const items = logos.map(logo => {
      const linkAttrs = logo.link 
        ? `href="${escapeHtml(logo.link)}"${logo.openInNewTab ? ' target="_blank"' : ''}${logo.nofollow ? ' rel="nofollow noopener"' : ' rel="noopener"'}`
        : '';
      
      const img = `<img src="${escapeHtml(logo.url)}" alt="${escapeHtml(logo.alt || '')}" loading="lazy" />`;
      
      return `
        <div class="ck-ls__item" data-role="logo-item">
          ${logo.link ? `<a ${linkAttrs}>${img}</a>` : img}
        </div>
      `;
    }).join('');
    
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
    
    if (mode === 'carousel') {
      lsRoot.setAttribute('data-show-arrows', String(state.layout.carousel.showArrows));
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
    lsRoot.style.setProperty('--ls-links-color', state.style.linksColor);
    lsRoot.style.setProperty('--ls-button-bg', state.style.buttonColor);
    lsRoot.style.setProperty('--ls-button-color', state.style.buttonTextColor);
    lsRoot.style.setProperty('--ls-button-radius', `${state.style.buttonRadius}px`);
    
    // Title styling
    lsRoot.style.setProperty('--ls-title-weight', state.header.titleBold ? '700' : '600');
    lsRoot.style.setProperty('--ls-title-style', state.header.titleItalic ? 'italic' : 'normal');
    
    // Caption styling
    lsRoot.style.setProperty('--ls-caption-weight', state.header.captionBold ? '600' : '400');
    lsRoot.style.setProperty('--ls-caption-style', state.header.captionItalic ? 'italic' : 'normal');
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
    
    if (titleEl) titleEl.innerHTML = state.header.title || '';
    if (captionEl) captionEl.innerHTML = state.header.caption || '';
  }

  function applyButton(state) {
    const ctaEl = lsRoot.querySelector('[data-role="cta"]');
    const buttonEl = lsRoot.querySelector('[data-role="button"]');
    const buttonTextEl = lsRoot.querySelector('[data-role="button-text"]');
    const iconBeforeEl = lsRoot.querySelector('[data-role="button-icon-before"]');
    const iconAfterEl = lsRoot.querySelector('[data-role="button-icon-after"]');
    
    if (ctaEl) {
      ctaEl.hidden = state.button.show !== true;
      ctaEl.style.textAlign = state.button.alignment;
      lsRoot.style.setProperty('--ls-button-align', state.button.alignment);
    }
    
    if (buttonEl) {
      buttonEl.href = state.button.url || '#';
    }
    
    if (buttonTextEl) {
      buttonTextEl.textContent = state.button.text;
    }
    
    // Handle button icon
    const hasIcon = state.button.icon && state.button.icon.length > 0;
    const iconPosition = state.button.iconPosition || 'before';
    
    if (iconBeforeEl) {
      iconBeforeEl.setAttribute('data-visible', String(hasIcon && iconPosition === 'before'));
      if (hasIcon && iconPosition === 'before') {
        iconBeforeEl.innerHTML = `<span class="diet-btn-ic__icon" data-icon="${escapeHtml(state.button.icon)}"></span>`;
      } else {
        iconBeforeEl.innerHTML = '';
      }
    }
    
    if (iconAfterEl) {
      iconAfterEl.setAttribute('data-visible', String(hasIcon && iconPosition === 'after'));
      if (hasIcon && iconPosition === 'after') {
        iconAfterEl.innerHTML = `<span class="diet-btn-ic__icon" data-icon="${escapeHtml(state.button.icon)}"></span>`;
      } else {
        iconAfterEl.innerHTML = '';
      }
    }
  }

  let carouselPosition = 0;
  let autoSlideInterval = null;

  function wireCarousel(state) {
    if (state.layout.mode !== 'carousel') {
      if (autoSlideInterval) {
        clearInterval(autoSlideInterval);
        autoSlideInterval = null;
      }
      return;
    }
    
    const prevBtn = lsRoot.querySelector('[data-role="nav-prev"]');
    const nextBtn = lsRoot.querySelector('[data-role="nav-next"]');
    const track = lsRoot.querySelector('[data-role="logo-track"]');
    
    if (!prevBtn || !nextBtn || !track) return;
    
    const itemWidth = state.layout.logoSize + state.layout.spacing;
    const maxScroll = Math.max(0, (state.logos.length - state.layout.carousel.itemsVisible) * itemWidth);
    
    function goNext() {
      carouselPosition = Math.min(maxScroll, carouselPosition + itemWidth);
      track.style.transform = `translateX(-${carouselPosition}px)`;
      updateNavButtons();
    }
    
    function goPrev() {
      carouselPosition = Math.max(0, carouselPosition - itemWidth);
      track.style.transform = `translateX(-${carouselPosition}px)`;
      updateNavButtons();
    }
    
    prevBtn.onclick = goPrev;
    nextBtn.onclick = goNext;
    
    function updateNavButtons() {
      prevBtn.disabled = carouselPosition <= 0;
      nextBtn.disabled = carouselPosition >= maxScroll;
    }
    
    updateNavButtons();
    
    // Auto-slide
    if (autoSlideInterval) {
      clearInterval(autoSlideInterval);
      autoSlideInterval = null;
    }
    
    if (state.layout.carousel.autoSlide) {
      const delay = (state.layout.carousel.slideDelay || 3) * 1000;
      autoSlideInterval = setInterval(() => {
        if (carouselPosition >= maxScroll) {
          carouselPosition = 0;
          track.style.transform = `translateX(-${carouselPosition}px)`;
        } else {
          goNext();
        }
      }, delay);
    }
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

### Phase 1: Core Structure (2-3 days)
- [ ] Create `tokyo/widgets/logoshowcase/` directory
- [ ] Create `tokyo/widgets/logoshowcase/assets/` with placeholder logos (from `LogoTemp.png`)
- [ ] Implement `spec.json` with defaults and panels (using existing repeater)
- [ ] Implement `widget.html` with Stage/Pod structure
- [ ] Implement `widget.css` with all layout modes
- [ ] Implement `widget.client.js` with `applyState`
- [ ] Create a test instance via Paris (or run `pnpm bootstrap:local` locally)
- [ ] Test basic rendering in preview iframe

### Phase 2: Logo Management (2-3 days)
- [ ] Add logo preview CSS to `repeater.css` (minor additions)
- [ ] Wire repeater template with logo fields (URL, alt, link, toggles)
- [ ] Integrate SanFrancisco upload button in repeater item
- [ ] Test add/remove/reorder via repeater (already works!)
- [ ] Test per-logo settings (all use existing controls)

### Phase 3: Layout Modes (3-4 days)
- [ ] Ticker animation (CSS keyframes, pause on hover, direction)
- [ ] Carousel navigation (minimal JS, arrow buttons, auto-slide)
- [ ] Grid layout (CSS Grid, responsive columns)
- [ ] Layout mode switcher UI
- [ ] Responsive controls (tablet/mobile sliders)

### Phase 4: Styling & Polish (2 days)
- [ ] Color scheme application (original/grayscale/custom)
- [ ] Hover effects (color-restore, scale, opacity)
- [ ] Button styling controls with icon picker
- [ ] Header typography (bold/italic toggles, links color)
- [ ] Stage/Pod appearance integration

### Phase 5: Testing & Edge Cases (1-2 days)
- [ ] Test with 1 logo, 100 logos
- [ ] Test responsive breakpoints
- [ ] Test carousel edge cases (fewer logos than visible)
- [ ] Test ticker seamless loop
- [ ] Accessibility review (WCAG AA)

**Total Estimate: 10-14 days** (reduced from 14-18 by reusing repeater)

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Layout modes | 3 (Ticker, Carousel, Grid) |
| Max logos | 100 |
| Elfsight feature parity | 100% (minus templates & custom code) |
| Accessibility | WCAG AA |
| Mobile responsiveness | Separate tablet/mobile controls |
| SSR | Yes (Venice edge rendering) |

---

## Feature Parity Checklist

### Content Features (100%)
- [x] Logo upload (drag & drop, browse, multi-file)
- [x] Logo management (reorder, delete)
- [x] Per-logo alt text
- [x] Per-logo link URL
- [x] Per-logo open in new tab toggle
- [x] Per-logo nofollow toggle
- [x] Header show/hide toggle
- [x] Header title (rich text)
- [x] Header caption (rich text with links)
- [x] CTA button show/hide
- [x] CTA button text
- [x] CTA button URL
- [x] CTA button icon (with before/after position)

### Layout Features (100%)
- [x] Ticker layout mode
- [x] Carousel layout mode
- [x] Grid layout mode
- [x] Max width control
- [x] Logo size slider
- [x] Spacing slider
- [x] Ticker speed slider
- [x] Ticker pause on hover
- [x] Ticker direction (left/right)
- [x] Carousel items visible
- [x] Carousel arrow navigation toggle
- [x] Carousel auto-slide toggle
- [x] Carousel slide delay
- [x] Grid columns (desktop/tablet/mobile)
- [x] Responsive tablet size/spacing
- [x] Responsive mobile size/spacing
- [x] Random order toggle

### Style Features (100%)
- [x] Logo color scheme (original/grayscale/custom)
- [x] Logo custom tint color
- [x] Logo hover effect (none/color-restore/scale/opacity)
- [x] Header alignment
- [x] Title color
- [x] Title bold toggle
- [x] Title italic toggle
- [x] Caption color
- [x] Caption bold toggle
- [x] Caption italic toggle
- [x] Links color
- [x] Button color
- [x] Button text color
- [x] Button border radius
- [x] Button alignment
- [x] Background color (via Stage/Pod)

### Explicitly Skipped (per Clickeen architecture)
- [ ] ~~Templates~~ → Handled as curated widget instances (bootstrap; no SQL seeds)
- [ ] ~~Custom CSS~~ → Not supported
- [ ] ~~Custom JS~~ → Not supported
- [ ] ~~Background gradient/image/video~~ → Solid color only (Phase 2 candidate)
- [ ] ~~Font library (200+ fonts)~~ → Uses Clickeen typography system

---

## Dependencies

### Requires Before Implementation

1. **SanFrancisco upload endpoint** — ✅ Already exists (`POST /upload`)

**No new Dieter components needed** — Repeater handles array management, widget.css handles rendering.

### Control to Dieter Component Mapping

**All controls already exist — no new components needed!**

| ToolDrawer Field Type | Dieter Component | Status |
|-----------------------|------------------|--------|
| `repeater` | `dieter/components/repeater/` | ✅ Exists (for logos) |
| `toggle` | `dieter/components/toggle/` | ✅ Exists |
| `textedit` | `dieter/components/textedit/` | ✅ Exists |
| `textfield` | `dieter/components/textfield/` | ✅ Exists |
| `segmented` | `dieter/components/segmented/` | ✅ Exists |
| `dropdown-actions` | `dieter/components/dropdown-actions/` | ✅ Exists |
| `dropdown-fill` | `dieter/components/dropdown-fill/` | ✅ Exists |
| `choice-tiles` | `dieter/components/choice-tiles/` | ✅ Exists |
| `slider` | `dieter/components/slider/` | ✅ Exists |

### Reuses Existing

- **Repeater** — Same pattern as FAQ questions, handles add/remove/reorder
- CKStagePod shared runtime (`tokyo/widgets/shared/stagePod.js`)
- CKTypography shared runtime (`tokyo/widgets/shared/typography.js`)
- CKBranding shared runtime (`tokyo/widgets/shared/branding.js`)
- `tooldrawer-field-podstagelayout` macro (compiler-generated)
- `tooldrawer-field-podstageappearance` macro (compiler-generated)

---

## For AI Implementers

**Key files to reference:**
- `tokyo/widgets/faq/spec.json` — **Repeater pattern** (logos work exactly like FAQ questions)
- `tokyo/widgets/faq/widget.client.js` — Runtime pattern
- `tokyo/widgets/countdown/spec.json` — Advanced controls pattern
- `tokyo/widgets/shared/stagePod.js` — Shared runtime pattern
- `dieter/components/repeater/` — **Logo list uses this directly**
- `bob/lib/compiler.server.ts` — Panel compilation

**Why Repeater Makes This 100× Better Than Elfsight:**

1. **AI Ops** — Logos are a standard array, so AI can `insert`, `remove`, `move`, `set` via ops
2. **Undo/Redo** — Full ops history means users can undo logo changes
3. **Visible failures** — If an edit produces a bad state, it should be fixed at the source (widget definition / agent contract / prompts), not “corrected” downstream by orchestrators
4. **Reordering** — Built-in drag handles, no custom code needed
5. **Inline Editing** — Per-logo fields (URL, alt, link, toggles) all use existing controls
6. **Accessibility** — Repeater has keyboard nav and screen reader support

**Critical implementation notes:**
1. **Ticker animation** — CSS `@keyframes`, duplicate logo array in DOM for seamless loop
2. **Carousel** — Minimal JS (<500 bytes) for arrow navigation and auto-slide
3. **Grid** — Pure CSS Grid with responsive columns via CSS variables
4. **Preview sync** — All colors/sizes as CSS variables for instant postMessage updates
5. **Logo upload** — Button in repeater item triggers SanFrancisco upload, sets URL via op
6. **Per-logo fields** — URL, alt, link all bind via `data-bob-path="logos.__INDEX__.field"`
7. **Link toggles** — `openInNewTab` and `nofollow` are inline toggles in repeater template
8. **Button icon** — Dropdown with position (before/after text)
9. **Header styling** — Bold/italic toggles map to `font-weight` and `font-style` CSS vars
