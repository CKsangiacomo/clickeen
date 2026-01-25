# Instagram Feed Widget — PRD

> **Version**: 0.1 (MVP)  
> **Status**: Draft  
> **Competitor Analysis**: [InstagramFeed_competitoranalysis.md](./InstagramFeed_competitoranalysis.md)

---

## What this widget does (1 sentence)

Displays posts from a public Instagram profile in a performant, beautiful feed that can be embedded anywhere.

## Types available (core framework)

Instagram Feed has multiple **Types** (each is a miniwidget):

Type selector (in state): `layout.mode`

- **Grid** (`layout.mode = 'grid'`)
  - **Why/what’s different**: a tiled feed optimized for scanning; no interactive navigation needed.
  - **Type controls**: `layout.grid.columns*`, `layout.gap`
- **Carousel / Slider** (`layout.mode = 'carousel'`)
  - **Why/what’s different**: an interactive feed with navigation/drag/autoplay.
  - **Type controls**: `layout.carousel.itemsVisible`, `layout.carousel.showArrows`, `layout.carousel.showDots`, `layout.carousel.autoplay`, `layout.carousel.autoplayDelay`, `layout.gap`
- **Masonry / Gallery Wall** (`layout.mode = 'masonry'`)
  - **Why/what’s different**: a masonry wall with a different layout engine (varied sizes/flow).
  - **Type controls**: `layout.masonry.columns*`, `layout.gap`

Why this is the core framework:
- Each Type changes the **primary user experience**, requires different **runtime behavior**, implies different **DOM/CSS structure**, and has a different set of **relevant controls**.

How it differs from other widgets:
- It’s a data-backed content widget: it depends on an external “posts” dataset that is rendered by the chosen Type.

## Entitlements + limits (v1)

Notes:
- This widget is not yet a Tokyo widget package in this repo; exact state paths are TBD until `tokyo/widgets/instagramfeed/spec.json` exists.
- Tier values live in the global matrix: `config/entitlements.matrix.json`.
- Widget enforcement lives in `tokyo/widgets/instagramfeed/limits.json` (create this when the widget ships).
- The PRD lists entitlement keys and how they map to state paths; do not repeat per-tier matrices here.

### Limits mapping (initial / TBD)

```text
key                  | kind | path(s)                           | metric/mode          | enforce                    | notes
-------------------- | ---- | --------------------------------- | -------------------- | -------------------------- | ------------------------------
seoGeo.enabled       | flag | seoGeo.enabled (TBD)              | boolean (deny true)  | load sanitize; ops+publish | SEO/GEO toggle
branding.remove      | flag | behavior.showBacklink (TBD)       | boolean (deny false) | load sanitize; ops+publish | Remove branding
media.images.enabled | flag | posts[].imageUrl (TBD)            | nonempty-string      | ops+publish                | Images require image access
media.videos.enabled | flag | posts[].videoUrl (TBD)            | nonempty-string      | ops+publish                | Videos require video access
links.enabled        | flag | posts[].linkUrl (TBD)             | nonempty-string      | ops+publish                | Post links require link access
media.meta.enabled   | flag | posts[].alt/posts[].title (TBD)   | nonempty-string      | ops+publish                | Meta requires meta access
```

Budgets are global, per-session counters (no per-widget matrices):
- `budget.copilot.turns` (Copilot send)
- `budget.edits` (any successful edit)
- `budget.uploads` (file inputs; InstagramFeed may add uploads later)

If this widget needs caps (e.g., max posts or max hidden IDs), add new global cap keys in `config/entitlements.matrix.json` and map them in `limits.json` (no per-widget tier tables).

---

## Overview

Display Instagram posts from a public profile. Follows Behold.so's simpler model: public profile scraping (no OAuth for MVP), beautiful layouts, performant loading.

---

## Core Architecture Tenets

| Tenet | Application |
|-------|-------------|
| **No Fallbacks** | widget.client.js throws errors on missing data |
| **Widget Files = Truth** | Core runtime files + contracts in tokyo/widgets/instagramfeed/ |
| **Dieter Tokens** | All colors use Dieter tokens by default |
| **Venice = Dumb Pipe** | Venice fetches and combines, doesn't transform |

---

## 1. Data Schema

### 1.1 defaults (spec.json)

```json
{
  "source": {
    "username": "",
    "maxPosts": 12,
    "filterType": "all",
    "hidePostIds": []
  },
  "layout": {
    "mode": "grid",
    "grid": {
      "columnsDesktop": 4,
      "columnsTablet": 3,
      "columnsMobile": 2
    },
    "carousel": {
      "itemsVisible": 4,
      "showArrows": true,
      "showDots": false,
      "autoplay": false,
      "autoplayDelay": 3
    },
    "masonry": {
      "columnsDesktop": 3,
      "columnsTablet": 2,
      "columnsMobile": 1
    },
    "gap": 8
  },
  "post": {
    "aspectRatio": "square",
    "hoverEffect": "fade",
    "showOverlay": true,
    "overlayContent": "caption",
    "borderRadius": 0,
    "clickAction": "lightbox"
  },
  "appearance": {
    "backgroundColor": "var(--color-surface)",
    "overlayColor": "rgba(0,0,0,0.6)",
    "overlayTextColor": "var(--color-on-primary)"
  },
  "settings": {
    "lazyLoad": true,
    "showLoadMore": true,
    "loadMoreText": "Load More",
    "postsPerLoad": 6
  },
  "stage": {
    "background": "var(--color-surface)",
    "alignment": "center",
    "paddingLinked": true,
    "padding": 0
  },
  "pod": {
    "background": "transparent",
    "paddingLinked": true,
    "padding": 0,
    "widthMode": "full",
    "contentWidth": 1200,
    "radiusLinked": true,
    "radius": "none"
  },
  "typography": {
    "globalFamily": "Inter",
    "roles": {
      "caption": {
        "family": "Inter",
        "sizePreset": "s",
        "weight": "400"
      },
      "button": {
        "family": "Inter",
        "sizePreset": "m",
        "weight": "600"
      }
    }
  },
  "behavior": {
    "showBacklink": true
  }
}
```

### 1.2 External Data (fetched at runtime)

```typescript
interface InstagramPost {
  id: string;
  mediaUrl: string;
  thumbnailUrl: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  caption: string;
  permalink: string;
  timestamp: string;
}

interface InstagramFeed {
  username: string;
  profilePicture: string;
  posts: InstagramPost[];
  lastUpdated: string;
}
```

---

## 2. ToolDrawer Panels

### 2.1 Content Panel

```
┌─────────────────────────────────────┐
│ INSTAGRAM SOURCE                    │
├─────────────────────────────────────┤
│ Username: [@username_________]      │
│                                     │
│ Max posts: [====12====]             │
│                                     │
│ Filter: [All posts        ▼]       │
│   - All posts                       │
│   - Photos only                     │
│   - Videos only                     │
└─────────────────────────────────────┘
```

### 2.2 Layout Panel

```
┌─────────────────────────────────────┐
│ LAYOUT MODE                         │
├─────────────────────────────────────┤
│ Layout: [Grid ▼]                    │
│   - Grid                            │
│   - Carousel                        │
│   - Masonry                         │
├─────────────────────────────────────┤
│ GRID SETTINGS (show-if grid)        │
├─────────────────────────────────────┤
│ Desktop columns: [====4====]        │
│ Tablet columns:  [====3====]        │
│ Mobile columns:  [====2====]        │
├─────────────────────────────────────┤
│ CAROUSEL SETTINGS (show-if carousel)│
├─────────────────────────────────────┤
│ Items visible: [====4====]          │
│ Show arrows: [ON]                   │
│ Show dots: [OFF]                    │
│ Autoplay: [OFF]                     │
│ Delay (sec): [====3====]            │
├─────────────────────────────────────┤
│ SPACING                             │
├─────────────────────────────────────┤
│ Gap: [====8====] px                 │
└─────────────────────────────────────┘
```

### 2.3 Appearance Panel

```
┌─────────────────────────────────────┐
│ POST STYLE                          │
├─────────────────────────────────────┤
│ Aspect ratio: [Square ▼]            │
│   - Square (1:1)                    │
│   - Original                        │
│   - Portrait (4:5)                  │
│   - Landscape (16:9)                │
│                                     │
│ Border radius: [====0====] px       │
│                                     │
│ Hover effect: [Fade ▼]              │
│   - None                            │
│   - Fade                            │
│   - Zoom                            │
│   - Zoom + Fade                     │
│   - To Grayscale                    │
│   - From Grayscale                  │
├─────────────────────────────────────┤
│ OVERLAY                             │
├─────────────────────────────────────┤
│ Show overlay: [ON]                  │
│ Overlay content: [Caption ▼]        │
│ Overlay color: [████████]           │
│ Text color: [████████]              │
├─────────────────────────────────────┤
│ COLORS                              │
├─────────────────────────────────────┤
│ Background: [████████]              │
└─────────────────────────────────────┘
```

### 2.4 Settings Panel

```
┌─────────────────────────────────────┐
│ LOADING                             │
├─────────────────────────────────────┤
│ Lazy load images: [ON]              │
│ Show load more: [ON]                │
│ Load more text: [Load More___]      │
│ Posts per load: [====6====]         │
├─────────────────────────────────────┤
│ CLICK ACTION                        │
├─────────────────────────────────────┤
│ On click: [Open lightbox ▼]         │
│   - Open lightbox                   │
│   - Go to Instagram                 │
│   - Do nothing                      │
├─────────────────────────────────────┤
│ OTHER                               │
├─────────────────────────────────────┤
│ Show Clickeen badge: [ON]           │
└─────────────────────────────────────┘
```

---

## 3. Technical Architecture

### 3.1 Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                    EDITOR (Bob)                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. User enters username                                │
│     ↓                                                   │
│  2. Bob calls Paris: GET /api/instagram/feed?user=...   │
│     ↓                                                   │
│  3. Paris fetches/caches from Instagram                 │
│     ↓                                                   │
│  4. Paris returns InstagramFeed data                    │
│     ↓                                                   │
│  5. Bob stores feed in instanceData.externalData        │
│     ↓                                                   │
│  6. Bob sends postMessage with full state               │
│     ↓                                                   │
│  7. widget.client.js renders posts                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Paris API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/instagram/feed` | GET | Fetch public profile feed |
| `/api/instagram/refresh` | POST | Force refresh cached data |

### 3.3 Caching

- Profile data cached in R2 for 1 hour
- Images proxied through CDN
- Manual refresh button in editor

---

## 4. Widget Files

### 4.1 spec.json (panels only)

```json
{
  "widgetname": "instagramfeed",
  "defaults": { /* see section 1.1 */ },
  "html": [
    "<bob-panel id='content'>",
    "  <tooldrawer-cluster>",
    "    <tooldrawer-field type='textfield' size='lg' path='source.username' label='Username' hint='@username' />",
    "    <tooldrawer-field type='slider' size='md' path='source.maxPosts' label='Max posts' min='4' max='48' />",
    "    <tooldrawer-field type='dropdown-actions' size='md' path='source.filterType' label='Filter' value='{{source.filterType}}' options='[{&quot;label&quot;:&quot;All posts&quot;,&quot;value&quot;:&quot;all&quot;},{&quot;label&quot;:&quot;Photos only&quot;,&quot;value&quot;:&quot;photo&quot;},{&quot;label&quot;:&quot;Videos only&quot;,&quot;value&quot;:&quot;video&quot;}]' />",
    "  </tooldrawer-cluster>",
    "</bob-panel>",
    "",
    "<bob-panel id='layout'>",
    "  <tooldrawer-cluster>",
    "    <tooldrawer-field type='dropdown-actions' size='md' path='layout.mode' label='Layout' value='{{layout.mode}}' options='[{&quot;label&quot;:&quot;Grid&quot;,&quot;value&quot;:&quot;grid&quot;},{&quot;label&quot;:&quot;Carousel&quot;,&quot;value&quot;:&quot;carousel&quot;},{&quot;label&quot;:&quot;Masonry&quot;,&quot;value&quot;:&quot;masonry&quot;}]' />",
    "  </tooldrawer-cluster>",
    "  <tooldrawer-cluster show-if='layout.mode == &apos;grid&apos;'>",
    "    <tooldrawer-field type='slider' size='md' path='layout.grid.columnsDesktop' label='Desktop' min='2' max='6' />",
    "    <tooldrawer-field type='slider' size='md' path='layout.grid.columnsTablet' label='Tablet' min='2' max='4' />",
    "    <tooldrawer-field type='slider' size='md' path='layout.grid.columnsMobile' label='Mobile' min='1' max='3' />",
    "  </tooldrawer-cluster>",
    "  <tooldrawer-cluster show-if='layout.mode == &apos;carousel&apos;'>",
    "    <tooldrawer-field type='slider' size='md' path='layout.carousel.itemsVisible' label='Items visible' min='1' max='6' />",
    "    <tooldrawer-field type='toggle' size='md' path='layout.carousel.showArrows' label='Show arrows' />",
    "    <tooldrawer-field type='toggle' size='md' path='layout.carousel.showDots' label='Show dots' />",
    "    <tooldrawer-field type='toggle' size='md' path='layout.carousel.autoplay' label='Autoplay' />",
    "    <tooldrawer-field type='slider' size='md' path='layout.carousel.autoplayDelay' label='Delay (sec)' min='1' max='10' show-if='layout.carousel.autoplay == true' />",
    "  </tooldrawer-cluster>",
    "  <tooldrawer-cluster show-if='layout.mode == &apos;masonry&apos;'>",
    "    <tooldrawer-field type='slider' size='md' path='layout.masonry.columnsDesktop' label='Desktop' min='2' max='5' />",
    "    <tooldrawer-field type='slider' size='md' path='layout.masonry.columnsTablet' label='Tablet' min='1' max='3' />",
    "    <tooldrawer-field type='slider' size='md' path='layout.masonry.columnsMobile' label='Mobile' min='1' max='2' />",
    "  </tooldrawer-cluster>",
    "  <tooldrawer-cluster>",
    "    <tooldrawer-field type='slider' size='md' path='layout.gap' label='Gap' min='0' max='32' unit='px' />",
    "  </tooldrawer-cluster>",
    "</bob-panel>",
    "",
    "<bob-panel id='appearance'>",
    "  <tooldrawer-cluster>",
    "    <tooldrawer-field type='dropdown-actions' size='md' path='post.aspectRatio' label='Aspect ratio' value='{{post.aspectRatio}}' options='[{&quot;label&quot;:&quot;Square (1:1)&quot;,&quot;value&quot;:&quot;square&quot;},{&quot;label&quot;:&quot;Original&quot;,&quot;value&quot;:&quot;original&quot;},{&quot;label&quot;:&quot;Portrait (4:5)&quot;,&quot;value&quot;:&quot;portrait&quot;},{&quot;label&quot;:&quot;Landscape (16:9)&quot;,&quot;value&quot;:&quot;landscape&quot;}]' />",
    "    <tooldrawer-field type='slider' size='md' path='post.borderRadius' label='Border radius' min='0' max='24' unit='px' />",
    "    <tooldrawer-field type='dropdown-actions' size='md' path='post.hoverEffect' label='Hover effect' value='{{post.hoverEffect}}' options='[{&quot;label&quot;:&quot;None&quot;,&quot;value&quot;:&quot;none&quot;},{&quot;label&quot;:&quot;Fade&quot;,&quot;value&quot;:&quot;fade&quot;},{&quot;label&quot;:&quot;Zoom&quot;,&quot;value&quot;:&quot;zoom&quot;},{&quot;label&quot;:&quot;Zoom + Fade&quot;,&quot;value&quot;:&quot;zoom-fade&quot;},{&quot;label&quot;:&quot;To Grayscale&quot;,&quot;value&quot;:&quot;to-grayscale&quot;},{&quot;label&quot;:&quot;From Grayscale&quot;,&quot;value&quot;:&quot;from-grayscale&quot;}]' />",
    "  </tooldrawer-cluster>",
    "  <tooldrawer-cluster>",
    "    <tooldrawer-field type='toggle' size='md' path='post.showOverlay' label='Show overlay on hover' />",
    "    <tooldrawer-field type='dropdown-actions' size='md' path='post.overlayContent' label='Overlay content' value='{{post.overlayContent}}' show-if='post.showOverlay == true' options='[{&quot;label&quot;:&quot;Caption&quot;,&quot;value&quot;:&quot;caption&quot;},{&quot;label&quot;:&quot;Instagram icon&quot;,&quot;value&quot;:&quot;icon&quot;}]' />",
    "    <tooldrawer-field type='dropdown-fill' size='md' path='appearance.overlayColor' label='Overlay color' show-if='post.showOverlay == true' />",
    "    <tooldrawer-field type='dropdown-fill' size='md' path='appearance.overlayTextColor' label='Text color' show-if='post.showOverlay == true' />",
    "  </tooldrawer-cluster>",
    "  <tooldrawer-cluster>",
    "    <tooldrawer-field type='dropdown-fill' size='md' path='appearance.backgroundColor' label='Background' />",
    "  </tooldrawer-cluster>",
    "</bob-panel>",
    "",
    "<bob-panel id='settings'>",
    "  <tooldrawer-cluster>",
    "    <tooldrawer-field type='toggle' size='md' path='settings.lazyLoad' label='Lazy load images' />",
    "    <tooldrawer-field type='toggle' size='md' path='settings.showLoadMore' label='Show load more button' />",
    "    <tooldrawer-field type='textfield' size='md' path='settings.loadMoreText' label='Button text' show-if='settings.showLoadMore == true' />",
    "    <tooldrawer-field type='slider' size='md' path='settings.postsPerLoad' label='Posts per load' min='3' max='12' show-if='settings.showLoadMore == true' />",
    "  </tooldrawer-cluster>",
    "  <tooldrawer-cluster>",
    "    <tooldrawer-field type='dropdown-actions' size='md' path='post.clickAction' label='On click' value='{{post.clickAction}}' options='[{&quot;label&quot;:&quot;Open lightbox&quot;,&quot;value&quot;:&quot;lightbox&quot;},{&quot;label&quot;:&quot;Go to Instagram&quot;,&quot;value&quot;:&quot;instagram&quot;},{&quot;label&quot;:&quot;Do nothing&quot;,&quot;value&quot;:&quot;none&quot;}]' />",
    "  </tooldrawer-cluster>",
    "  <tooldrawer-cluster>",
    "    <tooldrawer-field type='toggle' size='md' path='behavior.showBacklink' label='Show Clickeen badge' />",
    "  </tooldrawer-cluster>",
    "</bob-panel>"
  ]
}
```

### 4.2 widget.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Instagram Feed</title>
  <link rel="stylesheet" href="/dieter/tokens/tokens.css" />
  <link rel="stylesheet" href="./widget.css" />
</head>
<body>
  <div class="stage" data-role="stage">
    <div class="pod" data-role="pod">
      <div class="ck-widget ck-instagram-widget" data-ck-widget="instagramfeed" data-role="instagram-widget">
        
        <!-- Empty state -->
        <div class="ck-instagram__empty" data-role="empty" hidden>
          Enter an Instagram username to display posts.
        </div>
        
        <!-- Loading state -->
        <div class="ck-instagram__loading" data-role="loading" hidden>
          Loading posts...
        </div>
        
        <!-- Posts grid/carousel/masonry -->
        <div 
          class="ck-instagram__posts" 
          data-role="posts"
          data-layout="grid"
          data-hover="fade"
        ></div>
        
        <!-- Load more button -->
        <div class="ck-instagram__loadmore" data-role="loadmore" hidden>
          <button class="ck-instagram__button" data-role="loadmore-btn">
            Load More
          </button>
        </div>
        
        <!-- Lightbox -->
        <div class="ck-instagram__lightbox" data-role="lightbox" hidden>
          <button class="ck-instagram__lightbox-close" data-role="lightbox-close">×</button>
          <div class="ck-instagram__lightbox-content" data-role="lightbox-content"></div>
        </div>
        
        <script src="../shared/typography.js" defer></script>
        <script src="../shared/stagePod.js" defer></script>
        <script src="../shared/branding.js" defer></script>
        <script src="./widget.client.js" defer></script>
      </div>
    </div>
  </div>
</body>
</html>
```

### 4.3 widget.css (key sections)

```css
/* ============================================
   Instagram Feed Widget
   ============================================ */

.ck-instagram-widget {
  --columns-desktop: 4;
  --columns-tablet: 3;
  --columns-mobile: 2;
  --gap: 8px;
  --border-radius: 0;
  --overlay-bg: rgba(0,0,0,0.6);
  --overlay-text: #fff;
  --bg-color: transparent;
}

/* Posts Container */
.ck-instagram__posts {
  display: grid;
  gap: var(--gap);
  background: var(--bg-color);
}

/* Grid Layout */
[data-layout="grid"] .ck-instagram__posts {
  grid-template-columns: repeat(var(--columns-desktop), 1fr);
}

/* Carousel Layout */
[data-layout="carousel"] .ck-instagram__posts {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}

[data-layout="carousel"] .ck-instagram__post {
  flex: 0 0 calc(100% / var(--columns-desktop));
  scroll-snap-align: start;
}

/* Masonry Layout */
[data-layout="masonry"] .ck-instagram__posts {
  column-count: var(--columns-desktop);
  column-gap: var(--gap);
}

[data-layout="masonry"] .ck-instagram__post {
  break-inside: avoid;
  margin-bottom: var(--gap);
}

/* Post Item */
.ck-instagram__post {
  position: relative;
  overflow: hidden;
  border-radius: var(--border-radius);
}

.ck-instagram__post img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Aspect Ratios */
[data-aspect="square"] .ck-instagram__post { aspect-ratio: 1; }
[data-aspect="portrait"] .ck-instagram__post { aspect-ratio: 4/5; }
[data-aspect="landscape"] .ck-instagram__post { aspect-ratio: 16/9; }

/* Hover Effects */
[data-hover="fade"] .ck-instagram__post:hover img { opacity: 0.8; }
[data-hover="zoom"] .ck-instagram__post:hover img { transform: scale(1.1); }
[data-hover="zoom-fade"] .ck-instagram__post:hover img { transform: scale(1.1); opacity: 0.8; }
[data-hover="to-grayscale"] .ck-instagram__post:hover img { filter: grayscale(1); }
[data-hover="from-grayscale"] .ck-instagram__post img { filter: grayscale(1); }
[data-hover="from-grayscale"] .ck-instagram__post:hover img { filter: grayscale(0); }

.ck-instagram__post img {
  transition: transform 0.3s ease, opacity 0.3s ease, filter 0.3s ease;
}

/* Overlay */
.ck-instagram__overlay {
  position: absolute;
  inset: 0;
  background: var(--overlay-bg);
  color: var(--overlay-text);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.ck-instagram__post:hover .ck-instagram__overlay {
  opacity: 1;
}

/* Responsive */
@media (max-width: 1024px) {
  [data-layout="grid"] .ck-instagram__posts {
    grid-template-columns: repeat(var(--columns-tablet), 1fr);
  }
  [data-layout="masonry"] .ck-instagram__posts {
    column-count: var(--columns-tablet);
  }
}

@media (max-width: 640px) {
  [data-layout="grid"] .ck-instagram__posts {
    grid-template-columns: repeat(var(--columns-mobile), 1fr);
  }
  [data-layout="masonry"] .ck-instagram__posts {
    column-count: var(--columns-mobile);
  }
}

/* Lightbox */
.ck-instagram__lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.9);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ck-instagram__lightbox-close {
  position: absolute;
  top: 20px;
  right: 20px;
  font-size: 32px;
  color: white;
  background: none;
  border: none;
  cursor: pointer;
}
```

### 4.4 agent.md

```markdown
# Instagram Feed — Agent Context

## Widget Purpose
Display Instagram posts from a public profile in grid, carousel, or masonry layout.

## Editable Paths

### Source
- `source.username` (string) — Instagram username without @
- `source.maxPosts` (number: 4-48) — Maximum posts to display
- `source.filterType` (enum: all, photo, video) — Filter by media type

### Layout
- `layout.mode` (enum: grid, carousel, masonry) — Layout type
- `layout.gap` (number: 0-32) — Gap between posts in pixels
- `layout.grid.columnsDesktop` (number: 2-6)
- `layout.grid.columnsTablet` (number: 2-4)
- `layout.grid.columnsMobile` (number: 1-3)

### Post
- `post.aspectRatio` (enum: square, original, portrait, landscape)
- `post.hoverEffect` (enum: none, fade, zoom, zoom-fade, to-grayscale, from-grayscale)
- `post.showOverlay` (boolean)
- `post.clickAction` (enum: lightbox, instagram, none)

### Appearance
- `appearance.backgroundColor` (color)
- `appearance.overlayColor` (color)
- `appearance.overlayTextColor` (color)

## Parts Map

| Role | Selector | Updates |
|------|----------|---------|
| posts | [data-role="posts"] | Post grid HTML |
| empty | [data-role="empty"] | Visibility |
| loading | [data-role="loading"] | Visibility |
| loadmore | [data-role="loadmore"] | Visibility, button text |
| lightbox | [data-role="lightbox"] | Visibility, content |

## Enums

| Path | Values |
|------|--------|
| layout.mode | grid, carousel, masonry |
| post.aspectRatio | square, original, portrait, landscape |
| post.hoverEffect | none, fade, zoom, zoom-fade, to-grayscale, from-grayscale |
| post.clickAction | lightbox, instagram, none |
| source.filterType | all, photo, video |
```

---

## 5. Dependencies

| Dependency | Purpose |
|------------|---------|
| `paris/src/routes/instagram.ts` | API endpoint for fetching public profiles |
| `tokyo/widgets/shared/typography.js` | Typography module |
| `tokyo/widgets/shared/stagePod.js` | Stage/Pod module |

---

## 6. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Instagram blocks scraping | Widget shows no posts | Visible error message, suggest OAuth upgrade |
| Rate limiting | Slow/failed fetches | Aggressive caching (1hr), CDN for images |
| Large image files | Slow loading | Lazy load, thumbnail URLs, CDN proxy |

---

## 7. Open Questions

1. **OAuth for post-MVP**: Which OAuth provider? Instagram Basic Display API is deprecated.
2. **Video handling**: Autoplay muted? Thumbnail until click?
3. **Carousel physics**: CSS-only or need JS library for elastic feel?
