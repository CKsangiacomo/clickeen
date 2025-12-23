# content.logoshowcase — Logo Showcase Widget PRD

STATUS: NORMATIVE — Complete Elfsight Feature Parity (70%+ Coverage) + SSR Performance

---

## Quick Reference

- **Type ID:** `content.logoshowcase`
- **Category:** Content Display / Social Proof
- **Competitive Target:** Complete Elfsight Logo Showcase feature set (70%+ coverage)
- **Performance Target:** <8KB SSR (vs Elfsight 120KB+ client JS)
- **Renderer:** Planned Venice SSR renderer (this repo snapshot has no `venice/lib/renderers/*`; Venice currently serves a safe debug shell)
- **Dieter Components:** Custom carousel/ticker/grid (new components needed)

### 🎯 Feature Coverage Goal: 70%+ of Elfsight

Based on comprehensive competitor analysis (**30 screenshots from Elfsight**), this PRD targets the **core 70%** of features that deliver maximum user value while maintaining Clickeen's SSR performance advantage.

**What We MUST Implement (70% Core):**
- ✅ 3 layout modes (Carousel, Ticker, Grid)
- ✅ Complete logo upload & management (drag & drop, browse, reorder, delete)
- ✅ Full responsive controls (desktop, tablet, mobile separately)
- ✅ Header customization (title, caption, alignment, fonts, colors)
- ✅ CTA button with full styling (text, link, colors, radius, icon)
- ✅ Logo styling (color schemes: original/grayscale/custom, sizing)
- ✅ Ticker animation with speed control + pause on hover
- ✅ Carousel navigation (arrows, items visible)
- ✅ Random order toggle
- ✅ Custom CSS support

**What We Skip (<30% Optional):**
- ⚠️ Background gradient/image/video (color only for V1)
- ⚠️ Font library (200+ fonts - use default/system fonts only)
- ⚠️ Custom JS (CSS only)
- ⚠️ 6 pre-configured templates (can add later)
- ⚠️ Link settings (new tab, nofollow - can add later)

---

## Complete Feature Inventory (From Elfsight Screenshots)

### ✅ Content Tab Features (MUST IMPLEMENT)

#### Upload Logos
- **Control:** Drag-and-drop file uploader
- **Supported formats:** PNG, JPG, SVG, WebP
- **Max file size:** 100 MB per logo
- **Features:**
  - Drag and drop zone with visual feedback
  - "Browse Files" button
  - Multi-file upload (select multiple at once)
  - Preview thumbnails after upload
  - Delete individual logos (trash icon)
  - Reorder logos via drag handles
- **Maximum:** 100 logos per widget

#### Logo List Management
- **Display:** Grid of uploaded logo thumbnails
- **Actions per logo:**
  - Delete (trash icon)
  - Reorder (drag handle icon)
- **State:** Shows "Maximum upload file size: 100 MB" text below uploader

#### Header Section
- **Show Header** - Toggle to display/hide entire header section
- **Widget Title** - Text input
  - Default: "Some of our clients"
  - Max length: 100 chars
  - Used as `<h2>` in rendered output
- **Caption** - Text input (optional subtitle)
  - Default: empty
  - Max length: 200 chars
  - Rendered as `<p>` below title

#### Call-to-Action Button
- **Show Button** - Toggle to enable CTA button
  - Default: ON
- **Button Text** - Text input
  - Default: "Contact Us"
  - Max length: 50 chars
- **Button Link** - URL input
  - Supports internal (/pricing) and external (https://)
  - Default: empty
- **Button Icon** - Icon picker (optional)
  - "Add" button to open icon library
  - Dieter icons (sparkles, arrow, etc.)
  - Icon position: before or after text

#### ⚠️ Link Settings (OPTIONAL - Skip for V1)
- Open in new tab toggle
- rel="nofollow" toggle
- *These can be added in future iteration*

---

### ✅ Layout Tab Features (MUST IMPLEMENT)

#### Layout Mode Selector (3 Options)
Visual segmented control with icons:
1. **Carousel** - Horizontal sliding carousel
   - Shows subset of logos
   - Left/right arrow navigation buttons
   - Configurable items visible at once
   - Navigation arrows appear on hover
2. **Ticker** - Continuous infinite scroll animation
   - No navigation controls
   - Seamless horizontal scrolling
   - Duplicates logo list for seamless loop
3. **Grid** - Static responsive grid
   - Configurable columns
   - Responsive wrapping
   - No animation

#### General Layout Settings
- **Width** - Text input with unit selector
  - Default: 1200px
  - Supports: px, %, vw
  - Range: 200px - 2000px
  - Max-width constraint on container

- **Logo Size** - Range slider
  - Default: 80px
  - Range: 20px - 200px
  - Controls max-width AND max-height of logo images
  - Maintains aspect ratio

- **Spacing Between Logos** - Range slider
  - Default: 80px
  - Range: 0px - 200px
  - CSS gap property between items

#### Carousel Settings (Conditional: when mode=carousel)
- **Carousel Settings** - Expandable section (arrow ►)
  - **Items Visible** - Numeric slider
    - Default: 7 items
    - Range: 1-10 items
    - Responsive (auto-reduces on smaller screens)

#### Ticker Settings (Conditional: when mode=ticker)
- **Ticker Settings** - Expandable section (arrow ►)
  - **Transition Speed** - Range slider
    - Label: "Slow" ← slider → "Fast"
    - Range: 1-10 (maps to animation duration)
    - Default: 5 (medium)
    - 1=slow (60s), 10=fast (10s)
  - **Pause on Hover** - Toggle
    - Default: ON
    - CSS: animation-play-state: paused

#### Mobile Responsive Behavior (Expandable)
- **Mobile Behavior** - Expandable section (arrow ►)
  - **Logo Size for Tablets** - Slider
    - Default: 60px
    - Range: 20-150px
    - Applies at @media (max-width: 1024px)
  - **Spacing for Tablets** - Slider
    - Default: 60px
    - Range: 0-150px
  - **Logo Size for Mobiles** - Slider
    - Default: 60px
    - Range: 20-120px
    - Applies at @media (max-width: 768px)
  - **Spacing for Mobiles** - Slider
    - Default: 20px
    - Range: 0-100px

#### Additional Settings
- **Random Order** - Toggle
  - Default: OFF
  - Randomizes logo display order on each page load
  - Server-side shuffle (not client-side)

---

### ✅ Style Tab Features (MUST IMPLEMENT)

#### Font Selection (⚠️ SIMPLIFIED for V1)
- **Font Dropdown** - Typography picker
  - **V1:** "Default (Apply from Website)" only
  - **Future:** Extensive font library (ABeezee, Abel, Abril Fatface, etc.)
  - Searchable font list
  - *Skip font library for V1 - use system fonts only*

#### Background
- **Background Type** - Tab selector (**V1: Color only**)
  - **Color** - Solid color picker ✅ IMPLEMENT
  - **Gradient** - Gradient editor ⚠️ Skip V1
  - **Image** - Image uploader ⚠️ Skip V1
  - **Video** - Video URL input ⚠️ Skip V1

- **Background Color Picker** - Full color palette component
  - 7x7 preset color grid (49 colors from Dieter tokens)
  - Custom HEX input field
  - Eyedropper tool (browser API)
  - Opacity slider (alpha channel)
  - "Clear" button to reset to transparent
  - Default: transparent (#ffffff00) or white (#ffffff)

#### Logo Style
- **Logo Color Scheme** - Dropdown
  - **Original** - Keep logo colors as uploaded (default)
  - **Grayscale Filter** - Convert all logos to black & white (CSS filter)
  - **Custom Color** - Apply color tint/overlay

- **Logo Custom Color** - Color picker (conditional: when scheme=custom)
  - Full color palette (same component as background)
  - Applied as CSS filter or SVG color replacement
  - Only visible when "Custom Color" is selected

- **Logo Background Color** - Color picker (⚠️ OPTIONAL - Skip V1)
  - Background behind each individual logo
  - Useful for logos with transparency
  - Default: Transparent
  - *Can add in future iteration*

#### Header Style
- **Header Style** - Expandable section (arrow ►)

  - **Alignment** - Segmented control (3 buttons)
    - Left align (≡ icon)
    - Center align (≡≡ icon) - default
    - Right align (≡ icon)
    - CSS: text-align property

  - **COLORS** subsection:
    - **Title Color** - Color picker
      - Default: #000000 (black)
      - Applied to `<h2>` element
    - **Caption Color** - Color picker
      - Default: #666666 (gray)
      - Applied to `<p>` element
    - **Links Color** - Color picker
      - Default: #5865F2 (blue)
      - For any `<a>` tags in caption text

  - **FONTS** subsection:
    - **Title Size** - Dropdown with preset pixel values
      - Options: 16px, 18px, 20px, 22px, **24px** (default), 26px, 28px, 32px, 36px, 40px, 44px, 48px, 56px, 64px, 72px
      - **Bold** toggle (B button)
      - **Italic** toggle (I button)
    - **Caption Size** - Similar dropdown
      - Default: 16px
      - Same size options as Title Size

#### Button Style
- **Button Style** - Expandable section (arrow ►)

  - **Alignment** - Segmented control (left/center/right)
    - Default: center

  - **Button Color** - Color picker
    - Default: #5865F2 (blue - Elfsight brand color)
    - Background color of button

  - **Button Text Color** - Color picker
    - Default: #FFFFFF (white)
    - Text and icon color

  - **Button Border Radius** - Range slider
    - Range: 0px (square) - 50px (pill)
    - Default: 8px
    - CSS: border-radius property

#### Advanced
- **Custom CSS** - Expandable section (arrow ►)
  - Textarea with code editor styling (implied)
  - Max length: 10,000 chars
  - Advanced styling overrides
  - Warning note about breaking preview

- **Custom JS** - Expandable section (⚠️ Skip V1)
  - Textarea for custom JavaScript
  - Max length: 10,000 chars
  - Security warning
  - *Skip for V1 - CSS only*

---

## Complete Schema (All Core Features - 70%+)

```json
{
  "content": {
    "type": "object",
    "properties": {
      "logos": {
        "type": "array",
        "maxItems": 100,
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "description": "UUID"
            },
            "url": {
              "type": "string",
              "format": "uri",
              "description": "CDN URL of uploaded logo"
            },
            "alt": {
              "type": "string",
              "maxLength": 100,
              "description": "Alt text for accessibility"
            },
            "link": {
              "type": "string",
              "format": "uri",
              "description": "Optional click-through URL",
              "default": ""
            },
            "originalFilename": {
              "type": "string"
            },
            "width": {
              "type": "number",
              "description": "Original image width in pixels"
            },
            "height": {
              "type": "number",
              "description": "Original image height in pixels"
            }
          },
          "required": ["id", "url"]
        }
      },
      "showHeader": {
        "type": "boolean",
        "default": true
      },
      "title": {
        "type": "string",
        "maxLength": 100,
        "default": "Some of our clients"
      },
      "caption": {
        "type": "string",
        "maxLength": 200,
        "default": ""
      },
      "showButton": {
        "type": "boolean",
        "default": true
      },
      "buttonText": {
        "type": "string",
        "maxLength": 50,
        "default": "Contact Us"
      },
      "buttonLink": {
        "type": "string",
        "format": "uri",
        "default": ""
      },
      "buttonIcon": {
        "type": "string",
        "description": "Icon identifier from Dieter registry",
        "default": ""
      }
    }
  },
  "layout": {
    "type": "object",
    "properties": {
      "mode": {
        "type": "string",
        "enum": ["carousel", "ticker", "grid"],
        "default": "ticker",
        "description": "Display mode for logos"
      },
      "width": {
        "type": "string",
        "pattern": "^\\d+(px|%|vw)$",
        "default": "1200px"
      },
      "logoSize": {
        "type": "number",
        "minimum": 20,
        "maximum": 200,
        "default": 80,
        "description": "Logo max-width and max-height in px"
      },
      "spacing": {
        "type": "number",
        "minimum": 0,
        "maximum": 200,
        "default": 80,
        "description": "Gap between logos in px"
      },
      "randomOrder": {
        "type": "boolean",
        "default": false,
        "description": "Shuffle logos on page load (server-side)"
      },
      "carousel": {
        "type": "object",
        "description": "Settings when mode=carousel",
        "properties": {
          "itemsVisible": {
            "type": "number",
            "minimum": 1,
            "maximum": 10,
            "default": 7,
            "description": "Number of logos visible at once"
          }
        }
      },
      "ticker": {
        "type": "object",
        "description": "Settings when mode=ticker",
        "properties": {
          "speed": {
            "type": "number",
            "minimum": 1,
            "maximum": 10,
            "default": 5,
            "description": "Animation speed: 1=slow (60s), 10=fast (10s)"
          },
          "pauseOnHover": {
            "type": "boolean",
            "default": true,
            "description": "Pause animation on hover"
          }
        }
      },
      "responsive": {
        "type": "object",
        "properties": {
          "tablet": {
            "type": "object",
            "description": "Settings for @media (max-width: 1024px)",
            "properties": {
              "logoSize": {
                "type": "number",
                "minimum": 20,
                "maximum": 150,
                "default": 60
              },
              "spacing": {
                "type": "number",
                "minimum": 0,
                "maximum": 150,
                "default": 60
              }
            }
          },
          "mobile": {
            "type": "object",
            "description": "Settings for @media (max-width: 768px)",
            "properties": {
              "logoSize": {
                "type": "number",
                "minimum": 20,
                "maximum": 120,
                "default": 60
              },
              "spacing": {
                "type": "number",
                "minimum": 0,
                "maximum": 100,
                "default": 20
              }
            }
          }
        }
      }
    }
  },
  "style": {
    "type": "object",
    "properties": {
      "font": {
        "type": "string",
        "default": "default",
        "description": "Font family name or 'default' - V1: default only"
      },
      "background": {
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "enum": ["color"],
            "default": "color",
            "description": "V1: color only. Future: gradient, image, video"
          },
          "color": {
            "type": "string",
            "pattern": "^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$",
            "default": "#ffffff",
            "description": "Supports 6-digit hex or 8-digit with alpha"
          }
        }
      },
      "logo": {
        "type": "object",
        "properties": {
          "colorScheme": {
            "type": "string",
            "enum": ["original", "grayscale", "custom"],
            "default": "original"
          },
          "customColor": {
            "type": "string",
            "pattern": "^#[0-9A-Fa-f]{6}$",
            "description": "Used when colorScheme=custom"
          }
        }
      },
      "header": {
        "type": "object",
        "properties": {
          "alignment": {
            "type": "string",
            "enum": ["left", "center", "right"],
            "default": "center"
          },
          "titleColor": {
            "type": "string",
            "pattern": "^#[0-9A-Fa-f]{6}$",
            "default": "#000000"
          },
          "captionColor": {
            "type": "string",
            "pattern": "^#[0-9A-Fa-f]{6}$",
            "default": "#666666"
          },
          "linksColor": {
            "type": "string",
            "pattern": "^#[0-9A-Fa-f]{6}$",
            "default": "#5865F2"
          },
          "titleSize": {
            "type": "number",
            "enum": [16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 44, 48, 56, 64, 72],
            "default": 24
          },
          "titleBold": {
            "type": "boolean",
            "default": false
          },
          "titleItalic": {
            "type": "boolean",
            "default": false
          },
          "captionSize": {
            "type": "number",
            "enum": [16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 44, 48, 56, 64, 72],
            "default": 16
          }
        }
      },
      "button": {
        "type": "object",
        "properties": {
          "alignment": {
            "type": "string",
            "enum": ["left", "center", "right"],
            "default": "center"
          },
          "backgroundColor": {
            "type": "string",
            "pattern": "^#[0-9A-Fa-f]{6}$",
            "default": "#5865F2"
          },
          "textColor": {
            "type": "string",
            "pattern": "^#[0-9A-Fa-f]{6}$",
            "default": "#FFFFFF"
          },
          "borderRadius": {
            "type": "number",
            "minimum": 0,
            "maximum": 50,
            "default": 8,
            "description": "Border radius in px"
          }
        }
      },
      "customCSS": {
        "type": "string",
        "maxLength": 10000
      }
    }
  }
}
```

---

## Bob Controls Specification (Clickeen Architecture)

### TopDrawer (Header)
- **Widget Title** - Editable text field
- **Save** button
- **Publish** button

### ToolDrawer (Left Sidebar)

#### `tdmenu` (Icon Bar)
Vertical stack of three Dieter icon buttons:

| Icon | `activeMenu` value | Purpose |
| :--- | :--- | :--- |
| `pencil` | `content` | Upload logos, edit header, CTA button |
| `square.grid.2x2` | `layout` | Layout mode, sizing, spacing, responsive |
| `paintpalette` | `style` | Colors, fonts, backgrounds, button style |

---

### `tdmenucontent` Panels (Detailed HTML/TSX Examples)

#### Content Panel (`activeMenu === 'content'`)
```tsx
<>
  <div className="heading-3">Content</div>
  <div className="stack">
    {/* Logo Upload Area */}
    <div className="upload-zone">
      <div className="dropzone" onDrop={handleDrop} onDragOver={handleDragOver}>
        <p className="dropzone-text">Drag and drop files here to start uploading</p>
        <button className="diet-btn" data-variant="primary" data-size="lg" onClick={handleBrowse}>
          <span className="diet-btn__label">Browse Files</span>
        </button>
        <p className="text-sm text-muted">Maximum upload file size: 100 MB</p>
      </div>
      <input type="file" multiple accept="image/*" ref={fileInputRef} style={{display:'none'}} />
    </div>

    {/* Logo List (if logos exist) */}
    {instanceData.content.logos.length > 0 && (
      <div className="logo-list">
        {instanceData.content.logos.map((logo, idx) => (
          <div key={logo.id} className="logo-item" draggable onDragStart={() => handleDragStart(idx)}>
            <div className="drag-handle">⋮⋮</div>
            <img src={logo.url} alt={logo.alt} className="logo-thumbnail" />
            <span className="logo-filename">{logo.originalFilename}</span>
            <button className="delete-btn" onClick={() => handleDelete(logo.id)}>
              🗑️
            </button>
          </div>
        ))}
      </div>
    )}

    {/* Show Header Toggle */}
    <label className="diet-toggle" data-size="lg">
      <input type="checkbox" className="diet-toggle__input" checked={instanceData.content.showHeader} ... />
      <span className="diet-toggle__track" />
      <span className="diet-toggle__label">Show Header</span>
    </label>

    {/* Widget Title (conditional) */}
    {instanceData.content.showHeader && (
      <label className="diet-input" data-size="lg">
        <span className="diet-input__label">Widget Title</span>
        <div className="diet-input__inner">
          <input className="diet-input__field" type="text" value={instanceData.content.title} ... />
        </div>
      </label>
    )}

    {/* Caption (conditional) */}
    {instanceData.content.showHeader && (
      <label className="diet-input" data-size="lg">
        <span className="diet-input__label">Caption</span>
        <div className="diet-input__inner">
          <input className="diet-input__field" type="text" value={instanceData.content.caption} ... />
        </div>
      </label>
    )}

    {/* Show Button Toggle */}
    <label className="diet-toggle" data-size="lg">
      <input type="checkbox" className="diet-toggle__input" checked={instanceData.content.showButton} ... />
      <span className="diet-toggle__track" />
      <span className="diet-toggle__label">Show Button</span>
    </label>

    {/* Button Text (conditional) */}
    {instanceData.content.showButton && (
      <label className="diet-input" data-size="lg">
        <span className="diet-input__label">Button Text</span>
        <div className="diet-input__inner">
          <input className="diet-input__field" type="text" value={instanceData.content.buttonText} ... />
        </div>
      </label>
    )}

    {/* Button Link (conditional) */}
    {instanceData.content.showButton && (
      <label className="diet-input" data-size="lg">
        <span className="diet-input__label">Button Link</span>
        <div className="diet-input__inner">
          <input className="diet-input__field" type="url" value={instanceData.content.buttonLink} ... />
        </div>
      </label>
    )}

    {/* Button Icon (conditional) */}
    {instanceData.content.showButton && (
      <div>
        <label className="diet-input__label">Icon</label>
        <button className="diet-btn" data-variant="neutral" onClick={openIconPicker}>
          <span className="diet-btn__label">Add</span>
        </button>
        {/* Icon picker modal/dropdown */}
      </div>
    )}
  </div>
</>
```

#### Layout Panel (`activeMenu === 'layout'`)
```tsx
<>
  <div className="heading-3">Layout</div>
  <div className="stack">
    {/* Layout Mode Selector */}
    <div className="diet-segmented" data-size="lg" role="group">
      <label className="diet-segment">
        <input type="radio" name="layout-mode" value="carousel" checked={instanceData.layout.mode === 'carousel'} ... />
        <span className="diet-segment__surface" />
        <span className="diet-segment__label">Carousel</span>
      </label>
      <label className="diet-segment">
        <input type="radio" name="layout-mode" value="ticker" checked={instanceData.layout.mode === 'ticker'} ... />
        <span className="diet-segment__surface" />
        <span className="diet-segment__label">Ticker</span>
      </label>
      <label className="diet-segment">
        <input type="radio" name="layout-mode" value="grid" checked={instanceData.layout.mode === 'grid'} ... />
        <span className="diet-segment__surface" />
        <span className="diet-segment__label">Grid</span>
      </label>
    </div>

    {/* Carousel Settings (conditional) */}
    {instanceData.layout.mode === 'carousel' && (
      <div className="diet-expander" data-size="lg">
        <input type="checkbox" className="diet-expander__input" id="carousel-settings" />
        <label className="diet-expander__trigger diet-btn" htmlFor="carousel-settings">
          <span className="diet-btn__label">Carousel Settings</span>
          <span className="diet-btn__icon">›</span>
        </label>
        <div className="diet-expander__content">
          <label className="diet-input" data-size="lg">
            <span className="diet-input__label">Items Visible: {instanceData.layout.carousel.itemsVisible}</span>
            <input type="range" min="1" max="10" value={instanceData.layout.carousel.itemsVisible} ... />
          </label>
        </div>
      </div>
    )}

    {/* Ticker Settings (conditional) */}
    {instanceData.layout.mode === 'ticker' && (
      <div className="diet-expander" data-size="lg">
        <input type="checkbox" className="diet-expander__input" id="ticker-settings" />
        <label className="diet-expander__trigger diet-btn" htmlFor="ticker-settings">
          <span className="diet-btn__label">Ticker Settings</span>
          <span className="diet-btn__icon">›</span>
        </label>
        <div className="diet-expander__content">
          <label className="diet-input" data-size="lg">
            <span className="diet-input__label">Transition Speed</span>
            <div className="speed-slider">
              <span className="text-sm">Slow</span>
              <input type="range" min="1" max="10" value={instanceData.layout.ticker.speed} ... />
              <span className="text-sm">Fast</span>
            </div>
          </label>
          <label className="diet-toggle" data-size="lg">
            <input type="checkbox" className="diet-toggle__input" checked={instanceData.layout.ticker.pauseOnHover} ... />
            <span className="diet-toggle__track" />
            <span className="diet-toggle__label">Pause on Hover</span>
          </label>
        </div>
      </div>
    )}

    {/* Width */}
    <label className="diet-input" data-size="lg">
      <span className="diet-input__label">Width</span>
      <div className="diet-input__inner">
        <input className="diet-input__field" type="text" value={instanceData.layout.width} placeholder="1200px" ... />
      </div>
    </label>

    {/* Logo Size */}
    <label className="diet-input" data-size="lg">
      <span className="diet-input__label">Logo Size: {instanceData.layout.logoSize}px</span>
      <input type="range" min="20" max="200" value={instanceData.layout.logoSize} ... />
    </label>

    {/* Spacing Between Logos */}
    <label className="diet-input" data-size="lg">
      <span className="diet-input__label">Spacing Between Logos: {instanceData.layout.spacing}px</span>
      <input type="range" min="0" max="200" value={instanceData.layout.spacing} ... />
    </label>

    {/* Mobile Behavior Expander */}
    <div className="diet-expander" data-size="lg">
      <input type="checkbox" className="diet-expander__input" id="mobile-behavior" />
      <label className="diet-expander__trigger diet-btn" htmlFor="mobile-behavior">
        <span className="diet-btn__label">Mobile Behavior</span>
        <span className="diet-btn__icon">›</span>
      </label>
      <div className="diet-expander__content">
        <h4 className="heading-4">Tablets</h4>
        <label className="diet-input" data-size="md">
          <span className="diet-input__label">Logo Size: {instanceData.layout.responsive.tablet.logoSize}px</span>
          <input type="range" min="20" max="150" value={instanceData.layout.responsive.tablet.logoSize} ... />
        </label>
        <label className="diet-input" data-size="md">
          <span className="diet-input__label">Spacing: {instanceData.layout.responsive.tablet.spacing}px</span>
          <input type="range" min="0" max="150" value={instanceData.layout.responsive.tablet.spacing} ... />
        </label>

        <h4 className="heading-4">Mobiles</h4>
        <label className="diet-input" data-size="md">
          <span className="diet-input__label">Logo Size: {instanceData.layout.responsive.mobile.logoSize}px</span>
          <input type="range" min="20" max="120" value={instanceData.layout.responsive.mobile.logoSize} ... />
        </label>
        <label className="diet-input" data-size="md">
          <span className="diet-input__label">Spacing: {instanceData.layout.responsive.mobile.spacing}px</span>
          <input type="range" min="0" max="100" value={instanceData.layout.responsive.mobile.spacing} ... />
        </label>
      </div>
    </div>

    {/* Random Order */}
    <label className="diet-toggle" data-size="lg">
      <input type="checkbox" className="diet-toggle__input" checked={instanceData.layout.randomOrder} ... />
      <span className="diet-toggle__track" />
      <span className="diet-toggle__label">Random Order</span>
    </label>
  </div>
</>
```

#### Style Panel (`activeMenu === 'style'`)
```tsx
<>
  <div className="heading-3">Style</div>
  <div className="stack">
    {/* Font (V1: Default only) */}
    <label className="diet-input" data-size="lg">
      <span className="diet-input__label">Font</span>
      <select className="diet-dropdown" disabled>
        <option value="default">Default (Apply from Website)</option>
      </select>
      <p className="text-sm text-muted">Full font library coming in V2</p>
    </label>

    {/* Background */}
    <div className="expander">
      <h4 className="diet-input__label">Background</h4>
      {/* Tab selector (V1: Color only) */}
      <div className="tab-list" role="tablist">
        <button className="tab active" role="tab">Color</button>
        <button className="tab" role="tab" disabled title="Coming in V2">Gradient</button>
        <button className="tab" role="tab" disabled title="Coming in V2">Image</button>
        <button className="tab" role="tab" disabled title="Coming in V2">Video</button>
      </div>
      {/* Color Picker Component (reusable from FAQ widget) */}
      <ColorPicker value={instanceData.style.background.color} onChange={...} />
    </div>

    {/* Logo Style Expander */}
    <div className="diet-expander" data-size="lg">
      <input type="checkbox" className="diet-expander__input" id="logo-style" />
      <label className="diet-expander__trigger diet-btn" htmlFor="logo-style">
        <span className="diet-btn__label">Logo Style</span>
        <span className="diet-btn__icon">›</span>
      </label>
      <div className="diet-expander__content">
        <label className="diet-input" data-size="lg">
          <span className="diet-input__label">Logo Color Scheme</span>
          <select className="diet-dropdown" data-size="lg" value={instanceData.style.logo.colorScheme} ...>
            <option value="original">Original</option>
            <option value="grayscale">Grayscale Filter</option>
            <option value="custom">Custom Color</option>
          </select>
        </label>
        {instanceData.style.logo.colorScheme === 'custom' && (
          <div>
            <label className="diet-input__label">Logo Custom Color</label>
            <ColorPicker value={instanceData.style.logo.customColor} onChange={...} />
          </div>
        )}
      </div>
    </div>

    {/* Header Style Expander */}
    <div className="diet-expander" data-size="lg">
      <input type="checkbox" className="diet-expander__input" id="header-style" />
      <label className="diet-expander__trigger diet-btn" htmlFor="header-style">
        <span className="diet-btn__label">Header Style</span>
        <span className="diet-btn__icon">›</span>
      </label>
      <div className="diet-expander__content">
        {/* Alignment */}
        <label className="diet-input" data-size="lg">
          <span className="diet-input__label">Alignment</span>
          <div className="diet-segmented" data-size="md" role="group">
            <label className="diet-segment">
              <input type="radio" name="header-align" value="left" checked={instanceData.style.header.alignment === 'left'} ... />
              <span className="diet-segment__surface" />
              <span className="diet-segment__label">≡</span>
            </label>
            <label className="diet-segment">
              <input type="radio" name="header-align" value="center" checked={instanceData.style.header.alignment === 'center'} ... />
              <span className="diet-segment__surface" />
              <span className="diet-segment__label">≡≡</span>
            </label>
            <label className="diet-segment">
              <input type="radio" name="header-align" value="right" checked={instanceData.style.header.alignment === 'right'} ... />
              <span className="diet-segment__surface" />
              <span className="diet-segment__label">≡</span>
            </label>
          </div>
        </label>

        <h4 className="heading-4">COLORS</h4>
        <div>
          <label className="diet-input__label">Title Color</label>
          <ColorPicker value={instanceData.style.header.titleColor} onChange={...} />
        </div>
        <div>
          <label className="diet-input__label">Caption Color</label>
          <ColorPicker value={instanceData.style.header.captionColor} onChange={...} />
        </div>
        <div>
          <label className="diet-input__label">Links Color</label>
          <ColorPicker value={instanceData.style.header.linksColor} onChange={...} />
        </div>

        <h4 className="heading-4">FONTS</h4>
        <div className="font-controls">
          <label className="diet-input" data-size="lg">
            <span className="diet-input__label">Title Size</span>
            <div className="font-size-row">
              <select className="diet-dropdown" value={instanceData.style.header.titleSize} ...>
                {[16,18,20,22,24,26,28,32,36,40,44,48,56,64,72].map(size => (
                  <option key={size} value={size}>{size}px</option>
                ))}
              </select>
              <button className="diet-btn" data-variant={instanceData.style.header.titleBold ? 'primary' : 'neutral'} data-size="md" onClick={toggleBold}>
                <span className="diet-btn__label">B</span>
              </button>
              <button className="diet-btn" data-variant={instanceData.style.header.titleItalic ? 'primary' : 'neutral'} data-size="md" onClick={toggleItalic}>
                <span className="diet-btn__label">I</span>
              </button>
            </div>
          </label>
        </div>
        <label className="diet-input" data-size="lg">
          <span className="diet-input__label">Caption Size</span>
          <select className="diet-dropdown" value={instanceData.style.header.captionSize} ...>
            {[16,18,20,22,24,26,28,32,36,40,44,48,56,64,72].map(size => (
              <option key={size} value={size}>{size}px</option>
            ))}
          </select>
        </label>
      </div>
    </div>

    {/* Button Style Expander */}
    <div className="diet-expander" data-size="lg">
      <input type="checkbox" className="diet-expander__input" id="button-style" />
      <label className="diet-expander__trigger diet-btn" htmlFor="button-style">
        <span className="diet-btn__label">Button Style</span>
        <span className="diet-btn__icon">›</span>
      </label>
      <div className="diet-expander__content">
        {/* Similar structure to Header - alignment, colors, border radius */}
        <label className="diet-input" data-size="lg">
          <span className="diet-input__label">Alignment</span>
          <div className="diet-segmented" data-size="md" role="group">
            {/* Left/Center/Right segmented control */}
          </div>
        </label>
        <div>
          <label className="diet-input__label">Button Color</label>
          <ColorPicker value={instanceData.style.button.backgroundColor} onChange={...} />
        </div>
        <div>
          <label className="diet-input__label">Button Text Color</label>
          <ColorPicker value={instanceData.style.button.textColor} onChange={...} />
        </div>
        <label className="diet-input" data-size="lg">
          <span className="diet-input__label">Border Radius: {instanceData.style.button.borderRadius}px</span>
          <input type="range" min="0" max="50" value={instanceData.style.button.borderRadius} ... />
        </label>
      </div>
    </div>

    {/* Custom CSS */}
    <div className="diet-expander" data-size="lg">
      <input type="checkbox" className="diet-expander__input" id="custom-css" />
      <label className="diet-expander__trigger diet-btn" htmlFor="custom-css">
        <span className="diet-btn__label">Custom CSS</span>
        <span className="diet-btn__icon">›</span>
      </label>
      <div className="diet-expander__content">
        <textarea
          className="code-editor"
          value={instanceData.style.customCSS}
          placeholder="/* Add custom CSS here */"
          rows={10}
          ...
        />
      </div>
    </div>
  </div>
</>
```

---

## SSR Rendering Strategy

### Ticker Layout (Default)
```html
<div class="logo-showcase" data-layout="ticker" data-widget-type="logoshowcase">
  <style>
    .logo-showcase {
      --ls-bg-color: #ffffff;
      --ls-logo-size: 80px;
      --ls-spacing: 80px;
      --ls-ticker-speed: 30s;
      --ls-title-color: #000000;
      --ls-title-size: 24px;
      --ls-caption-color: #666666;
      --ls-caption-size: 16px;
      --ls-button-bg: #5865F2;
      --ls-button-text: #FFFFFF;
      --ls-button-radius: 8px;
      --ls-header-align: center;
      --ls-button-align: center;
    }

    .logo-showcase {
      background-color: var(--ls-bg-color);
      padding: 40px 20px;
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
    }

    .ls-header {
      text-align: var(--ls-header-align);
      margin-bottom: 40px;
    }

    .ls-title {
      font-size: var(--ls-title-size);
      color: var(--ls-title-color);
      margin: 0 0 8px 0;
    }

    .ls-caption {
      font-size: var(--ls-caption-size);
      color: var(--ls-caption-color);
      margin: 0;
    }

    .ls-ticker {
      overflow: hidden;
      position: relative;
      width: 100%;
    }

    .ls-ticker-track {
      display: flex;
      gap: var(--ls-spacing);
      animation: scroll-left var(--ls-ticker-speed) linear infinite;
      will-change: transform;
    }

    .ls-ticker-track:hover {
      animation-play-state: paused;
    }

    .ls-logo-item {
      flex-shrink: 0;
      width: var(--ls-logo-size);
      height: var(--ls-logo-size);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .ls-logo-item img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    /* Color scheme filters */
    .ls-logo-item.grayscale img {
      filter: grayscale(100%);
    }

    .ls-button-container {
      text-align: var(--ls-button-align);
      margin-top: 40px;
    }

    .ls-button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      background-color: var(--ls-button-bg);
      color: var(--ls-button-text);
      text-decoration: none;
      border-radius: var(--ls-button-radius);
      font-weight: 500;
      transition: opacity 0.2s;
    }

    .ls-button:hover {
      opacity: 0.9;
    }

    @keyframes scroll-left {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    @media (max-width: 1024px) {
      .ls-logo-item {
        width: 60px;
        height: 60px;
      }
      .ls-ticker-track {
        gap: 60px;
      }
    }

    @media (max-width: 768px) {
      .ls-logo-item {
        width: 60px;
        height: 60px;
      }
      .ls-ticker-track {
        gap: 20px;
      }
    }
  </style>

  <!-- Header -->
  <div class="ls-header" data-widget-element="header">
    <h2 class="ls-title" data-widget-element="title">Some of our clients</h2>
  </div>

  <!-- Ticker Track (duplicated for infinite scroll) -->
  <div class="ls-ticker" data-widget-element="ticker">
    <div class="ls-ticker-track">
      <!-- First set of logos -->
      <div class="ls-logo-item">
        <img src="/cdn/logo1.png" alt="Company 1" />
      </div>
      <div class="ls-logo-item">
        <img src="/cdn/logo2.png" alt="Company 2" />
      </div>
      <!-- ... 8-12 logos ... -->

      <!-- Duplicated set for seamless loop -->
      <div class="ls-logo-item">
        <img src="/cdn/logo1.png" alt="Company 1" />
      </div>
      <div class="ls-logo-item">
        <img src="/cdn/logo2.png" alt="Company 2" />
      </div>
      <!-- ... duplicated logos ... -->
    </div>
  </div>

  <!-- CTA Button -->
  <div class="ls-button-container" data-widget-element="button">
    <a href="#" class="ls-button" data-widget-element="button-link">
      Contact Us
    </a>
  </div>
</div>
```

### Carousel Layout
```html
<div class="logo-showcase" data-layout="carousel">
  <!-- Inline styles (same pattern) -->
  <style>
    .ls-carousel {
      position: relative;
      overflow: hidden;
    }

    .ls-carousel-viewport {
      overflow: hidden;
    }

    .ls-carousel-track {
      display: flex;
      gap: var(--ls-spacing);
      transition: transform 0.3s ease;
    }

    .ls-nav-prev,
    .ls-nav-next {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(0,0,0,0.5);
      color: white;
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      font-size: 24px;
      cursor: pointer;
      z-index: 10;
    }

    .ls-nav-prev { left: 10px; }
    .ls-nav-next { right: 10px; }
  </style>

  <!-- Header (same as ticker) -->

  <!-- Carousel Container -->
  <div class="ls-carousel" data-widget-element="carousel">
    <button class="ls-nav-prev" aria-label="Previous" data-carousel-prev>‹</button>

    <div class="ls-carousel-viewport">
      <div class="ls-carousel-track" data-carousel-track>
        <div class="ls-logo-item"><img src="/cdn/logo1.png" alt="Logo 1" /></div>
        <div class="ls-logo-item"><img src="/cdn/logo2.png" alt="Logo 2" /></div>
        <!-- ... -->
      </div>
    </div>

    <button class="ls-nav-next" aria-label="Next" data-carousel-next>›</button>
  </div>

  <!-- Button (same as ticker) -->
</div>
```

### Grid Layout
```html
<div class="logo-showcase" data-layout="grid">
  <style>
    .ls-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(var(--ls-logo-size), 1fr));
      gap: var(--ls-spacing);
      justify-items: center;
    }
  </style>

  <!-- Header (same as ticker) -->

  <!-- Grid Container -->
  <div class="ls-grid" data-widget-element="grid">
    <div class="ls-logo-item"><img src="/cdn/logo1.png" alt="Logo 1" /></div>
    <div class="ls-logo-item"><img src="/cdn/logo2.png" alt="Logo 2" /></div>
    <!-- ... -->
  </div>

  <!-- Button (same as ticker) -->
</div>
```

---

## Performance Targets

| Metric | Elfsight | Clickeen | Improvement |
|--------|----------|----------|-------------|
| Initial HTML | ~2KB | ~6KB | Acceptable (SSR content) |
| JavaScript | 120KB | 2KB (carousel nav only) | 118KB smaller |
| First Paint | ~2s | ~300ms | 6.5x faster |
| Interactive | ~2.5s | Instant (ticker/grid), <500ms (carousel) | 5x faster |
| SEO | Delayed crawl | Immediate | 100% SSR |
| Logo count | 50 | 100 | 2x capacity |

---

## Implementation Phases

### Phase 1: Core Content & Upload (3-4 days)
- [ ] Schema implementation in Supabase
- [ ] Logo upload API endpoint (multipart/form-data to Paris)
- [ ] CDN storage integration (S3 or Cloudinary)
- [ ] Logo CRUD operations (create, read, update, delete, reorder)
- [ ] Drag & drop uploader UI in Bob (Content panel)
- [ ] Logo list display with thumbnails
- [ ] Logo reordering via drag handles
- [ ] Header content (title, caption, show/hide)
- [ ] CTA button configuration (text, link, show/hide)

### Phase 2: Layout Modes (4-5 days)
- [ ] Venice SSR renderer base structure (TBD; current Venice is debug shell in this repo snapshot)
- [ ] Ticker layout with CSS animation
  - Duplicate logo list for seamless loop
  - Speed control (animation-duration)
  - Pause on hover (animation-play-state)
- [ ] Carousel layout with navigation
  - Arrow buttons (minimal JS <2KB)
  - Items visible control
  - Smooth scroll/transform
- [ ] Grid layout (CSS Grid, responsive)
- [ ] Layout mode switcher in Bob (Layout panel)
- [ ] Width, logo size, spacing controls (sliders)
- [ ] Responsive settings (tablet/mobile separate controls)

### Phase 3: Styling & Polish (3-4 days)
- [ ] Background color picker (reusable component from FAQ)
- [ ] Logo color schemes (original, grayscale filter, custom color)
- [ ] Header styling (alignment, colors, fonts, sizes)
- [ ] Button styling (alignment, colors, border radius)
- [ ] Font size dropdowns (16-72px presets)
- [ ] Bold/Italic toggles for title
- [ ] Custom CSS textarea
- [ ] Color picker component (7x7 grid, HEX input, eyedropper)

### Phase 4: Advanced Features (2-3 days)
- [ ] Ticker speed slider (slow=60s, fast=10s)
- [ ] Pause on hover toggle
- [ ] Carousel items visible slider (1-10)
- [ ] Random order shuffle (server-side)
- [ ] Button icon picker (Dieter icons)
- [ ] Logo click-through links (optional per logo)
- [ ] Logo alt text for accessibility

### Phase 5: Preview & Testing (2 days)
- [ ] postMessage patches for all settings
  - CSS variables for colors, sizes, spacing
  - Layout mode switching (re-render)
  - Ticker speed (animation-duration update)
- [ ] Smooth preview updates (debounced)
- [ ] Layout mode switching (cross-fade transitions)
- [ ] Mobile responsive testing (tablet/mobile breakpoints)
- [ ] Edge case testing (1 logo, 100 logos, missing images)
- [ ] Accessibility review (WCAG AA compliance)

**Total: 14-18 days for 70%+ feature coverage**

---

## Success Criteria

### Core Features (70%+ Elfsight Parity)
✅ **Logo upload & management** (drag & drop, browse, reorder, delete, 100 logos)
✅ **3 layout modes** (Carousel, Ticker, Grid)
✅ **Full responsive controls** (desktop + separate tablet/mobile)
✅ **Ticker animation** (smooth infinite scroll, speed control, pause on hover)
✅ **Carousel navigation** (arrow buttons, items visible control)
✅ **Header customization** (title, caption, alignment, colors, font sizes, bold/italic)
✅ **CTA button** (text, link, icon, colors, border radius, alignment)
✅ **Logo styling** (size, spacing, color schemes: original/grayscale/custom)
✅ **Custom CSS** support
✅ **Random order** toggle
✅ **<8KB initial load** (vs 120KB+)
✅ **<500ms LCP** on mobile 3G
✅ **100% SSR** for SEO
✅ **Instant preview** via postMessage

---

## What We Match/Exceed vs Elfsight

### Match Elfsight (70%+ Core):
- ✅ Logo upload (drag & drop, browse, 100MB limit, 100 logos)
- ✅ Logo management (reorder, delete, click-through links)
- ✅ 3 layout modes (Carousel, Ticker, Grid)
- ✅ Width, logo size, spacing controls (sliders)
- ✅ Mobile responsive settings (separate tablet/mobile)
- ✅ Ticker speed & pause on hover
- ✅ Carousel navigation (arrows, items visible)
- ✅ Header (title, caption, alignment, colors, fonts, sizes, bold/italic)
- ✅ CTA button (text, link, icon, alignment, colors, border radius)
- ✅ Logo color schemes (original, grayscale, custom)
- ✅ Background color
- ✅ Random order
- ✅ Custom CSS

### Exceed Elfsight (Performance):
- ✨ **15x smaller** bundle (8KB vs 120KB)
- ✨ **6.5x faster** first paint (300ms vs 2s)
- ✨ **Works without JS** (ticker/grid are pure CSS)
- ✨ **Perfect SEO** (no client rendering delay)
- ✨ **No 3rd party scripts** (privacy by default)
- ✨ **Instant preview updates** (postMessage patches)
- ✨ **2x logo capacity** (100 vs 50)

### Skip for V1 (<30% Optional):
- ⚠️ Background gradient/image/video (color only)
- ⚠️ Font library (200+ fonts - use default/system)
- ⚠️ Logo background color
- ⚠️ Custom JS (CSS only for security)
- ⚠️ 6 pre-configured templates (can add later)
- ⚠️ Link settings (new tab, nofollow - can add later)

---

## For AIs Implementing This

**Critical references:**
Tokenization patterns
- `documentation/systems/bob.md` - Preview system architecture
- `documentation/widgets/FAQs/content.faq.md` - Similar widget PRD structure
- `dieter/components/expander.css` - Use for expandable sections

**Implementation Critical Points:**
- ✅ **Ticker animation:** Use CSS `@keyframes`, duplicate logo list for seamless loop
- ✅ **Carousel navigation:** Minimal JS (<2KB) for arrow buttons, use CSS transform
- ✅ **Grid layout:** CSS Grid with `auto-fit` and `minmax` for responsiveness
- ✅ **Color picker:** Reusable component (same as FAQ widget)
- ✅ **Logo upload:** Multipart/form-data to Paris API → CDN storage → save URLs
- ✅ **Drag & drop:** HTML5 Drag and Drop API for file upload and reordering
- ✅ **Responsive:** CSS media queries for tablet (1024px) and mobile (768px)
- ✅ **Random order:** Server-side array shuffle (not client-side)
- ✅ **Tokenization:** All colors/sizes as CSS variables in inline `<style>`
- ✅ **postMessage:** Patch CSS variables for instant preview updates
- ✅ **data-widget-element:** Add to all patchable elements

**File Upload Implementation:**
- ✅ Accept: image/* (PNG, JPG, SVG, WebP)
- ✅ Max 100MB per file
- ✅ Upload to CDN (S3/Cloudinary with unique filename)
- ✅ Generate thumbnail for Bob preview (optional, 200x200px)
- ✅ Return CDN URL + metadata (width, height, filename)
- ✅ Save in `config.content.logos` array

**Ticker Implementation:**
- ✅ CSS `@keyframes scroll-left { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`
- ✅ Duplicate entire logo list in DOM for seamless loop
- ✅ `animation-duration` based on speed config (1=60s, 10=10s)
- ✅ `animation-play-state: paused` on `:hover` if pauseOnHover=true
- ✅ No JavaScript required

**Carousel Implementation:**
- ✅ Flexbox container with overflow hidden
- ✅ Arrow buttons with minimal JS (addEventListener click, update transform)
- ✅ Calculate visible width based on itemsVisible config
- ✅ Smooth scroll: `scroll-behavior: smooth` or CSS transition on transform
- ✅ Total JS: <2KB minified

**Grid Implementation:**
- ✅ CSS Grid: `display: grid; grid-template-columns: repeat(auto-fit, minmax(var(--ls-logo-size), 1fr));`
- ✅ No JavaScript required
- ✅ Responsive by default (auto-wraps)

---

## Status

**Phase:** Detailed specification complete (70%+ feature coverage)
**Blockers:** None
**Next:** Begin Phase 1 implementation (logo upload & content management)
**Recommendation:**
- Start with Phases 1-3 (core features: ~10-12 days)
- Validate with users
- Add advanced features in Phase 4-5 (~4-6 days)
**Estimated completion:** 14-18 days for 70%+ feature coverage

**Implementation Benefits:** 15x smaller JavaScript, 6.5x faster, 100% SSR rendering, 2x logo capacity - all while matching 70%+ of Elfsight's feature set. These are outcomes of good engineering, not defensible competitive advantages.
