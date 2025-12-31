# Logo Showcase Widget – AI Agent Context

## Widget Identity
- **widgetname**: `logoshowcase`
- **Category**: Content Display / Social Proof
- **Purpose**: Display client/partner logos in ticker, carousel, or grid layout

## Data Structure

### Root Paths
| Path | Type | Description |
|------|------|-------------|
| `logos` | array | Array of logo objects |
| `header` | object | Header configuration |
| `button` | object | CTA button configuration |
| `layout` | object | Layout mode and sizing |
| `responsive` | object | Tablet/mobile overrides |
| `appearance` | object | Color scheme and effects |
| `stage` | object | Stage (outer container) styling |
| `pod` | object | Pod (inner container) styling |
| `typography` | object | Typography roles |
| `style` | object | Color overrides |
| `behavior` | object | Widget behavior settings |

### Logo Item Schema
```json
{
  "id": "string",
  "url": "string (image URL)",
  "alt": "string (alt text for SEO)",
  "link": "string (optional click URL)",
  "openInNewTab": "boolean",
  "nofollow": "boolean"
}
```

### Layout Modes
| Mode | Description |
|------|-------------|
| `ticker` | Infinite scrolling marquee |
| `carousel` | Paginated with navigation arrows |
| `grid` | Static CSS Grid layout |

## Editable Paths

### Content
- `logos` – Array operations: insert, remove, move
- `logos.{n}.url` – Logo image URL
- `logos.{n}.alt` – Alt text
- `logos.{n}.link` – Click destination
- `logos.{n}.openInNewTab` – Open in new tab
- `logos.{n}.nofollow` – Add nofollow to link
- `header.show` – Show/hide header
- `header.title` – Title text (HTML allowed)
- `header.caption` – Caption text (HTML allowed)
- `header.alignment` – left | center | right
- `button.show` – Show/hide CTA button
- `button.text` – Button label
- `button.url` – Button destination
- `button.icon` – Icon name (SF Symbols)
- `button.iconPosition` – before | after
- `button.alignment` – left | center | right

### Layout
- `layout.mode` – ticker | carousel | grid
- `layout.width` – Max width in pixels
- `layout.logoSize` – Logo size in pixels (20-200)
- `layout.spacing` – Gap between logos (0-200)
- `layout.randomOrder` – Shuffle logos on render
- `layout.ticker.speed` – Speed 1-10 (1=slow, 10=fast)
- `layout.ticker.pauseOnHover` – Pause animation on hover
- `layout.ticker.direction` – left | right
- `layout.carousel.itemsVisible` – Logos visible at once (1-10)
- `layout.carousel.showArrows` – Show nav arrows
- `layout.carousel.autoSlide` – Auto-advance slides
- `layout.carousel.slideDelay` – Seconds between slides
- `layout.grid.columnsDesktop` – Grid columns on desktop
- `layout.grid.columnsTablet` – Grid columns on tablet
- `layout.grid.columnsMobile` – Grid columns on mobile

### Responsive
- `responsive.tablet.logoSize` – Logo size on tablet
- `responsive.tablet.spacing` – Spacing on tablet
- `responsive.mobile.logoSize` – Logo size on mobile
- `responsive.mobile.spacing` – Spacing on mobile

### Appearance
- `appearance.colorScheme` – original | grayscale | custom
- `appearance.customColor` – Tint color when scheme=custom
- `appearance.hoverEffect` – none | color-restore | scale | opacity
- `style.titleColor` – Title text color
- `style.captionColor` – Caption text color
- `style.linksColor` – Link color in caption
- `style.buttonColor` – Button background color
- `style.buttonTextColor` – Button text color
- `style.buttonRadius` – Button corner radius (px)
- `header.titleBold` – Bold title
- `header.titleItalic` – Italic title
- `header.captionBold` – Bold caption
- `header.captionItalic` – Italic caption

### Stage/Pod (inherited pattern)
- `stage.background` – Stage background
- `stage.alignment` – Pod alignment within stage
- `stage.padding*` – Stage padding
- `pod.background` – Pod background
- `pod.widthMode` – full | fixed
- `pod.contentWidth` – Width when fixed
- `pod.radius*` – Pod corner radius
- `pod.padding*` – Pod padding

## AI Operations

### Add Logo
```json
{ "op": "insert", "path": "logos", "index": 0, "value": { "id": "new-1", "url": "https://...", "alt": "Company Name", "link": "", "openInNewTab": true, "nofollow": false } }
```

### Remove Logo
```json
{ "op": "remove", "path": "logos", "index": 2 }
```

### Reorder Logos
```json
{ "op": "move", "path": "logos", "from": 5, "to": 0 }
```

### Update Logo Alt Text
```json
{ "op": "set", "path": "logos.0.alt", "value": "Acme Corporation" }
```

### Change Layout Mode
```json
{ "op": "set", "path": "layout.mode", "value": "carousel" }
```

### Set Grayscale with Hover Restore
```json
[
  { "op": "set", "path": "appearance.colorScheme", "value": "grayscale" },
  { "op": "set", "path": "appearance.hoverEffect", "value": "color-restore" }
]
```

## Parts Map (DOM roles)

| data-role | Element | Purpose |
|-----------|---------|---------|
| `logoshowcase` | div | Widget root |
| `header` | header | Title/caption container |
| `title` | h2 | Title text |
| `caption` | p | Caption text |
| `viewport` | div | Logo track viewport |
| `logo-track` | div | Logo items container |
| `logo-item` | div | Individual logo |
| `nav-prev` | button | Previous arrow (carousel) |
| `nav-next` | button | Next arrow (carousel) |
| `cta` | div | CTA button container |
| `button` | a | CTA button |
| `button-text` | span | Button label |
| `button-icon-before` | span | Icon before text |
| `button-icon-after` | span | Icon after text |
| `empty` | div | Empty state message |

## Constraints

1. **Max logos**: 100
2. **Logo size**: 20-200px
3. **Spacing**: 0-200px
4. **Carousel items**: 1-10
5. **Grid columns**: 1-12 (desktop), 1-8 (tablet), 1-4 (mobile)
6. **Ticker speed**: 1-10

## Common Tasks

### "Make logos grayscale but restore color on hover"
```json
[
  { "op": "set", "path": "appearance.colorScheme", "value": "grayscale" },
  { "op": "set", "path": "appearance.hoverEffect", "value": "color-restore" }
]
```

### "Add 5 more logos"
Use insert operations with unique IDs.

### "Reorder logos alphabetically by alt text"
Calculate new order based on alt values, then use move operations.

### "Hide header and button, just show logos"
```json
[
  { "op": "set", "path": "header.show", "value": false },
  { "op": "set", "path": "button.show", "value": false }
]
```

### "Switch to grid with 4 columns on all devices"
```json
[
  { "op": "set", "path": "layout.mode", "value": "grid" },
  { "op": "set", "path": "layout.grid.columnsDesktop", "value": 4 },
  { "op": "set", "path": "layout.grid.columnsTablet", "value": 4 },
  { "op": "set", "path": "layout.grid.columnsMobile", "value": 2 }
]
```

