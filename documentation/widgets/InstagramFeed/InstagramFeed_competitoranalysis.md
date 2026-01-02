# Instagram Feed Widget — Competitor Analysis

> **Purpose**: Document competitor features from Elfsight and Behold.so to inform Clickeen's Instagram Feed widget.

---

## Competitors Analyzed

| Competitor | URL | Approach |
|------------|-----|----------|
| **Elfsight** | elfsight.com/instagram-feed-instashow | Feature-rich, OAuth required, many templates |
| **Behold.so** | behold.so | Simple, privacy-focused, public scraping, beautiful carousels |

---

## Behold.so — The Better Model

Behold takes a simpler, more performant approach that aligns with Clickeen's philosophy:

### Key Advantages

| Aspect | Behold Approach |
|--------|-----------------|
| **Data Source** | Public profile scraping (no OAuth for basic feeds) |
| **Performance** | Lazy loading, CDN-served images, minimal JS |
| **Privacy** | No OAuth tokens stored for basic feeds |
| **UI** | Clean configuration, fewer options that matter more |
| **Aesthetics** | Gorgeous carousels with physics-based animations |

### Behold Widget Types

| Type | Description |
|------|-------------|
| **Flexible Grid** | Responsive grid that adapts to container |
| **Gallery Wall** | Masonry-style layout with varied sizes |
| **Elastic Carousel** | Physics-based drag with momentum |

### Behold Hover Effects (9 options)

| Effect | Description |
|--------|-------------|
| `fade` | Opacity fade on hover |
| `zoom-fade` | Scale up + fade |
| `blur` | Gaussian blur |
| `zoom-blur` | Scale up + blur |
| `to-grayscale` | Color → grayscale |
| `zoom-to-grayscale` | Scale + grayscale |
| `from-grayscale` | Grayscale → color |
| `zoom-from-grayscale` | Scale + grayscale → color |
| `none` | No effect |

### Behold Filter Options

- By hashtag
- By media type (photo/video/carousel)
- Hide specific posts
- Maximum posts limit

---

## Elfsight — Feature Inventory

### Layout Options

| Layout | Description |
|--------|-------------|
| Grid | Fixed columns |
| Slider | Horizontal carousel |
| Masonry | Pinterest-style |
| Collage | Mixed sizes |
| Highlight | Featured post + grid |

### Source Options

| Source | OAuth Required |
|--------|----------------|
| Instagram Account | Yes |
| Hashtag | Yes |
| Tagged Posts | Yes |
| Multiple Sources | Yes |

### Post Display Options

- Caption overlay
- Like/comment counts
- Post date
- Username display
- Lightbox popup
- Link to Instagram

### Style Options

- Background color
- Border radius
- Spacing/gap
- Post hover effects
- Caption styling
- Header customization

### Settings

- Auto-update interval
- Posts per page
- Load more button
- Responsive breakpoints
- Custom CSS (paid)

---

## Complexity Assessment

| Aspect | Elfsight | Behold | Clickeen Target |
|--------|----------|--------|-----------------|
| OAuth | Required | Optional (basic) | Optional (basic) |
| Layouts | 5+ | 3 | 3-4 |
| Hover effects | 3-4 | 9 | 6-9 |
| Configuration | Complex | Simple | Simple |
| Performance | Heavy | Light | Light |

**Recommendation**: Follow Behold's model — fewer, better options with beautiful defaults.

---

## Features to Implement

### MVP (Must Have)

| Feature | Source |
|---------|--------|
| Public profile feed (no OAuth) | Behold |
| Grid layout | Both |
| Carousel/slider layout | Both |
| Masonry layout | Elfsight |
| 6+ hover effects | Behold |
| Lazy loading | Behold |
| Filter by media type | Behold |
| Maximum posts limit | Both |
| Lightbox popup | Elfsight |
| Responsive breakpoints | Both |

### Post-MVP

| Feature | Source |
|---------|--------|
| OAuth for private accounts | Elfsight |
| Hashtag feeds | Elfsight |
| Multiple sources | Elfsight |
| Video autoplay | Behold |
| Elastic carousel (physics) | Behold |
| Caption overlay options | Elfsight |

### Skip

| Feature | Reason |
|---------|--------|
| Custom CSS | Clickeen doesn't support custom code |
| Templates | Clickeen treats templates as instances |
| Like/comment counts | Privacy concerns, API complexity |

---

## Technical Considerations

### Data Architecture

```
┌─────────────────────────────────────────┐
│          Instagram Feed Widget          │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐    ┌─────────────┐     │
│  │ Basic Mode  │    │ OAuth Mode  │     │
│  │ (public)    │    │ (private)   │     │
│  └──────┬──────┘    └──────┬──────┘     │
│         │                  │            │
│         ▼                  ▼            │
│  ┌─────────────────────────────────┐    │
│  │     Paris API Endpoint          │    │
│  │     /api/instagram/feed         │    │
│  └──────────────┬──────────────────┘    │
│                 │                       │
│                 ▼                       │
│  ┌─────────────────────────────────┐    │
│  │     Cached Media (R2/CDN)       │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

### Caching Strategy

- Cache public profile data for 1 hour
- Cache images in CDN indefinitely
- Refresh on user request (manual button)

### Rate Limits

- Instagram API: 200 calls/hour per token
- Public scraping: Respect robots.txt, add delays

---

## Screenshot Reference

| Screenshot | Content |
|------------|---------|
| `01-landing-page.png` | Elfsight marketing page |
| `02-create-page.png` | Elfsight widget creation |
| `03-features-page-1.png` | Elfsight features |
| `04-templates-page.png` | Elfsight templates |
| `05-grid-template.png` | Elfsight grid example |
| `06-demo-templates.png` | Elfsight template gallery |
| `07-configurator-main.png` | Elfsight main config |
| `08-layout-panel.png` | Elfsight layout options |
| `09-post-panel.png` | Elfsight post settings |
| `10-style-panel.png` | Elfsight styling |
| `11-settings-panel.png` | Elfsight settings |
| `12-sources-panel.png` | Elfsight source config |
| `behold-01-example-gallery.png` | Behold showcase |
| `behold-02-gallery-viewport.png` | Behold gallery view |
| `behold-03-circular-carousel.png` | Behold carousel |
| `behold-04-more-styles.png` | Behold style options |
| `behold-05-gallery-wall.png` | Behold masonry |
| `behold-06-elastic-carousel.png` | Behold physics carousel |
| `behold-07-more-layouts.png` | Behold layout options |
| `behold-08-horizontal-slider.png` | Behold slider |
| `behold-09-builder-overview.png` | Behold builder UI |
| `behold-10-widget-types.png` | Behold widget types |
| `behold-11-customize-panel.png` | Behold customization |



