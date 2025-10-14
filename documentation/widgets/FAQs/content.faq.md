# content.faq — FAQ/Accordion Widget PRD

STATUS: NORMATIVE — Complete Elfsight Feature Parity + SSR Performance

---

## Quick Reference

- **Type ID:** `content.faq`
- **Category:** Content Display
- **Competitive Target:** Complete Elfsight FAQ feature set
- **Performance Target:** <10KB SSR (vs Elfsight 150KB+ client JS)
- **Renderer:** `venice/lib/renderers/faq.ts`
- **Dieter Component:** `expander.css` (already built)

### 🚀 Killer Feature: AI-Powered FAQ Generation

**What Elfsight Doesn't Have:**
- ❌ No AI assistance (users write everything manually = 2-3 hours per widget)
- ❌ No website analysis
- ❌ No bulk generation
- ❌ No SEO optimization

**What Clickeen Has:**
- ✅ **Free tier:** DeepSeek AI generates basic answers (10 per widget, loss leader)
- ✅ **Pro tier:** Claude 4.5 analyzes your website and generates 20+ SEO-optimized FAQs in 30 seconds
- ✅ **Smart suggestions:** AI detects missing questions, short answers, SEO opportunities
- ✅ **Brand voice matching:** Learns your tone from your website
- ✅ **60x time savings:** 2-hour task → 2-minute task

**Business Model:**
- Free tier: Demonstrate value, drive upgrades (15-20% conversion goal)
- Pro tier: $10-20/month, ~$2 AI cost per widget → profitable
- 5 upgrade touchpoints throughout the UX

**Implementation Timeline:**
- Core FAQ (Elfsight parity): 11-14 days
- AI features (differentiation): +12-16 days
- **Total: 23-30 days for complete FAQ widget**

---

## Complete Feature Inventory (From Elfsight Screenshots)

### Template Selection (6 Templates)
From screenshot 1, Elfsight offers 6 starting templates:
1. **Search in FAQ** - With search bar at top
2. **Accordion FAQ** - Classic expand/collapse
3. **Categories** - Multiple category sections
4. **Simple FAQ** - Clean, no categories
5. **Multicolumn FAQ** - 2+ columns layout
6. **FAQ Dropdown** - Alternative icon style

**Clickeen Implementation:** Match all 6 + add our own variations

---

### Content Tab Features

#### Widget Title
- **Field:** "Widget Title" text input
- **Default:** "Frequently Asked Questions"
- **Editable:** Yes
- **Max length:** 100 chars

#### Display Category Titles
- **Control:** Toggle switch
- **Purpose:** Show/hide category headers
- **Default:** ON

#### Question Categories
- **"All Questions"** - Default uncategorized bucket
- **"NEW CATEGORY"** - Add unlimited categories
- **Each category has:**
  - Title (editable text field)
  - Icon (Dieter Dropdown with icon previews)
  - Questions list (nested)
  - Context menu (⋯) - likely reorder/delete
  - **"+ Add Category"** button

**Icon Picker Specification:**
- **Component:** Reusable Dieter `Dropdown` component.
- **Display:** Each option in the dropdown should show the icon glyph followed by its name (e.g., "📅 Calendar").
- **Library:** Should include a searchable list of icons from the Dieter registry, including but not limited to: `None`, `Attention`, `Blank`, `Book`, `Calendar`, `Case`, `Chat`, `Checkmark`, `Clock`, `Cloud`, `Community`, `Creditcard`, `Delivery`.


#### Questions Management
- **Per question fields:**
  - Question text (5-300 chars)
  - Answer rich text editor with toolbar:
    - **B** - Bold
    - **I** - Italic
    - **Link icon** - Insert link
    - **Bullet list** - Unordered list
    - **Numbered list** - Ordered list
    - **⋯** - More options menu
    - **<>** - View HTML source
    - **⛶** - Fullscreen editor
  - Note: "You can add YouTube, Vimeo and images URLs to be displayed as media content"
- **+ Add Question** button
- Context menu (⋯) on each question - reorder/delete
- **Done** button when editing

**Rich Text Editor Specification:**
- **"⋯ More options" menu:** Should contain `Strikethrough`, `Code Block`, and `Blockquote`.
- **Media Embedding:** Pasting a valid YouTube or Vimeo URL on its own line will automatically detect and render it as an embedded video player in the widget preview. Image URLs will render as `<img>` tags.

---

### Layout Tab Features

#### Layout Selector (3 Options)
Visual cards with icons showing:
1. **Accordion** - Stacked expandable items (selected by default)
2. **List** - All content visible
3. **Multicolumn** - Side-by-side grid

#### Accordion Icon
Segmented control:
- **Plus** - Plus/minus icon
- **Arrow** - Chevron/arrow icon (selected)

#### Open First Question by Default
- **Control:** Toggle switch
- **Purpose:** Auto-expand first item on load
- **Default:** OFF (from screenshot showing ON)

#### Multiple Active Questions
- **Control:** Toggle switch
- **Purpose:** Allow multiple items expanded simultaneously
- **Default:** OFF (from screenshot showing ON)

#### Show Search Bar
- **Control:** Toggle switch
- **Purpose:** Display search field at top
- **Default:** ON

---

### Appearance Tab Features

#### Template Dropdown
Options visible in screenshot:
- **Clear** - No background
- **Background** - With background color (selected)
- **Background & Shadow** - Background + drop shadow
- **Background & Border** - Background + border

#### Item Background Color
- **Control:** Color picker
- **Shows:** Full color palette grid (7x7 colors)
- **Features:**
  - Eyedropper tool
  - Custom HEX input
  - Transparency slider (implied)
  - Eraser/Clear tool to reset to default

**Color Picker Specification:**
- **Component:** This should be a reusable Dieter Color Picker component, matching the features above. The 49 default colors should be sourced from the Dieter token palette.

#### Question Text Color
- **Control:** Color picker (same as above)

#### Answer Text Color
- **Control:** Color picker (same as above)
- **Shown in screenshot:** Magenta/pink color selected

#### Custom CSS
- **Control:** Expandable section with arrow (►)
- **Purpose:** Advanced styling overrides
- **For:** Power users who need fine-grained control

#### Settings Tab Features (from competitor screenshots)
- **Display Videos** toggle
- **Display Images** toggle
- **Custom JS** expandable field
---

### Settings Tab
(Not shown in screenshots but implied from interface structure)
- Widget dimensions
- Responsive behavior
- Animation speed
- SEO settings

---

## Complete Schema (All Features)

```json
{
  "title": {
    "type": "string",
    "maxLength": 100,
    "default": "Frequently Asked Questions"
  },
  "showTitle": {
    "type": "boolean",
    "default": true
  },
  "showCategoryTitles": {
    "type": "boolean",
    "default": true,
    "description": "Display Category Titles toggle"
  },
  "layout": {
    "type": "string",
    "enum": ["accordion", "list", "multicolumn"],
    "default": "accordion"
  },
  "columns": {
    "type": "number",
    "minimum": 1,
    "maximum": 3,
    "default": 2,
    "description": "For multicolumn layout"
  },
  "accordionIcon": {
    "type": "string",
    "enum": ["plus", "arrow"],
    "default": "arrow"
  },
  "openFirstByDefault": {
    "type": "boolean",
    "default": false
  },
  "multipleActive": {
    "type": "boolean",
    "default": false,
    "description": "Allow multiple questions expanded"
  },
  "showSearchBar": {
    "type": "boolean",
    "default": true
  },
  "searchPlaceholder": {
    "type": "string",
    "maxLength": 50,
    "default": "Search..."
  },
  "categories": {
    "type": "array",
    "maxItems": 20,
    "items": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "UUID"
        },
        "title": {
          "type": "string",
          "minLength": 1,
          "maxLength": 100,
          "default": "NEW CATEGORY"
        },
        "icon": {
          "type": "string",
          "description": "Icon identifier or 'blank'",
          "default": "blank"
        },
        "items": {
          "type": "array",
          "maxItems": 100,
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "question": {
                "type": "string",
                "minLength": 5,
                "maxLength": 300
              },
              "answer": {
                "type": "string",
                "minLength": 1,
                "maxLength": 5000,
                "description": "HTML content with rich formatting"
              },
              "aiGenerated": {
                "type": "boolean",
                "default": false,
                "description": "Whether this answer was AI-generated"
              },
              "aiPrompt": {
                "type": "string",
                "description": "Saved prompt for regeneration"
              }
            },
            "required": ["question", "answer"]
          }
        }
      },
      "required": ["title", "items"]
    }
  },
  "aiSettings": {
    "type": "object",
    "description": "AI-powered content generation settings",
    "properties": {
      "websiteUrl": {
        "type": "string",
        "format": "uri",
        "description": "User's website for context analysis"
      },
      "businessDescription": {
        "type": "string",
        "maxLength": 500,
        "description": "User-provided context about their business"
      },
      "lastAnalyzed": {
        "type": "string",
        "format": "date-time",
        "description": "Last time website was scraped"
      },
      "tier": {
        "type": "string",
        "enum": ["free", "pro"],
        "description": "AI tier based on user's plan"
      },
      "provider": {
        "type": "string",
        "enum": ["deepseek", "claude", "gpt4"],
        "description": "AI model provider"
      },
      "freeUsageCount": {
        "type": "number",
        "default": 0,
        "description": "Number of AI generations used on free tier"
      },
      "maxFreeGenerations": {
        "type": "number",
        "default": 10,
        "description": "Free tier limit"
      }
    }
  },
  "appearance": {
    "type": "object",
    "properties": {
      "template": {
        "type": "string",
        "enum": ["clear", "background", "background-shadow", "background-border"],
        "default": "background"
      },
      "itemBackgroundColor": {
        "type": "string",
        "pattern": "^#[0-9A-Fa-f]{6}$",
        "default": "#ffffff"
      },
      "questionTextColor": {
        "type": "string",
        "pattern": "^#[0-9A-Fa-f]{6}$",
        "default": "#000000"
      },
      "answerTextColor": {
        "type": "string",
        "pattern": "^#[0-9A-Fa-f]{6}$",
        "default": "#666666"
      },
      "categoryTitleColor": {
        "type": "string",
        "pattern": "^#[0-9A-Fa-f]{6}$",
        "default": "#000000"
      },
      "borderColor": {
        "type": "string",
        "pattern": "^#[0-9A-Fa-f]{6}$",
        "default": "#e0e0e0"
      },
      "customCSS": {
        "type": "string",
        "maxLength": 10000,
        "description": "Advanced CSS overrides"
      }
    }
  },
  "settings": {
    "type": "object",
    "properties": {
      "displayVideos": {
        "type": "boolean",
        "default": true
      },
      "displayImages": {
        "type": "boolean",
        "default": true
      },
      "customJS": {
        "type": "string"
      }
    }
  }
}
```

---

## Bob Controls Specification (Clickeen Architecture)

### TopDrawer (Header)
- **Widget Title** - Editable text field (e.g., "Untitled widget" → "My FAQ Widget")
- **Save** button (right side)
- **Publish** button (right side)

### ToolDrawer (Left Sidebar)

The `ToolDrawer` is composed of two parts as per `bob.md`: a `tdmenu` (vertical icon bar) and a `tdmenucontent` (the control panel that changes).

#### `tdmenu` (Icon Bar)
A vertical stack of four Dieter icon buttons (`diet-btn`, `data-size="lg"`). The active button will have `data-variant="primary"`.

| Icon | `activeMenu` value | Purpose |
| :--- | :--- | :--- |
| `pencil` | `content` | Edit widget title, categories, and questions. |
| `square.grid.2x2` | `layout` | Control layout, columns, and accordion behavior. |
| `paintpalette` | `appearance` | Manage colors, templates, and custom CSS. |
| `gear` | `settings` | Configure search, titles, and other toggles. |

---

### `tdmenucontent` Panels

#### Content Panel (`activeMenu === 'content'`)
```tsx
<>
  <div className="heading-3" style={{...}}>Content</div>
  <div className="stack" style={{...}}>
    {/* Widget Title */}
    <label className="diet-input" data-size="lg">
      <span className="diet-input__label">Widget Title</span>
      <div className="diet-input__inner">
        <input className="diet-input__field" type="text" value={config.title} ... />
      </div>
    </label>

    {/* Categories Repeater */}
    {/* This is a custom component composed of Dieter primitives */}
    <div className="repeater">
      <div className="repeater-header">
        <span className="label">Categories</span>
      </div>
      <div className="repeater-list">
        {config.categories.map(cat => (
          <div className="repeater-item">
            <span>{cat.title}</span>
            {/* Context menu button (reorder/delete) */}
          </div>
        ))}
      </div>
      <button className="diet-btn" data-variant="neutral" data-size="md">
        <span className="diet-btn__label">+ Add Category</span>
      </button>
    </div>
  </div>
</>
```
**Note:** The categories and questions will require a sub-panel navigation flow within the `tdmenucontent` area. Clicking a category item will replace the current view with the question editor for that category.

#### Layout Panel (`activeMenu === 'layout'`)
```tsx
<>
  <div className="heading-3" style={{...}}>Layout</div>
  <div className="stack" style={{...}}>
    {/* Layout Style */}
    <div className="diet-segmented" data-size="lg" role="group">
      <label className="diet-segment">
        <input type="radio" name="faq-layout" value="accordion" checked={config.layout === 'accordion'} ... />
        <span className="diet-segment__surface" />
        <span className="diet-segment__label">Accordion</span>
      </label>
      <label className="diet-segment">
        <input type="radio" name="faq-layout" value="list" checked={config.layout === 'list'} ... />
        <span className="diet-segment__surface" />
        <span className="diet-segment__label">List</span>
      </label>
      <label className="diet-segment">
        <input type="radio" name="faq-layout" value="multicolumn" checked={config.layout === 'multicolumn'} ... />
        <span className="diet-segment__surface" />
        <span className="diet-segment__label">Multicolumn</span>
      </label>
    </div>

    {/* Accordion Icon */}
    <div className="diet-segmented" data-size="lg" role="group">
      <label className="diet-segment">
        <input type="radio" name="faq-icon" value="plus" checked={config.accordionIcon === 'plus'} ... />
        <span className="diet-segment__surface" />
        <span className="diet-segment__label">Plus</span>
      </label>
      <label className="diet-segment">
        <input type="radio" name="faq-icon" value="arrow" checked={config.accordionIcon === 'arrow'} ... />
        <span className="diet-segment__surface" />
        <span className="diet-segment__label">Arrow</span>
      </label>
    </div>

    {/* Show Search Bar */}
    <div className="diet-toggle" data-size="lg">
      <input type="checkbox" className="diet-toggle__input" id="show-search" checked={config.showSearchBar} ... />
      <label className="diet-toggle__track" htmlFor="show-search"></label>
      <label className="diet-toggle__label" htmlFor="show-search">Show Search Bar</label>
    </div>

    {/* Open First Question by Default */}
    <div className="diet-toggle" data-size="lg">
      <input type="checkbox" className="diet-toggle__input" id="open-first" checked={config.openFirstByDefault} ... />
      <label className="diet-toggle__track" htmlFor="open-first"></label>
      <label className="diet-toggle__label" htmlFor="open-first">Open First Question by Default</label>
    </div>

    {/* Allow Multiple Active Questions */}
    <div className="diet-toggle" data-size="lg">
      <input type="checkbox" className="diet-toggle__input" id="multiple-active" checked={config.multipleActive} ... />
      <label className="diet-toggle__track" htmlFor="multiple-active"></label>
      <label className="diet-toggle__label" htmlFor="multiple-active">Allow Multiple Active Questions</label>
    </div>

    {/* Search Placeholder (conditionally rendered) */}
    {config.showSearchBar && (
      <label className="diet-input" data-size="lg">
        <span className="diet-input__label">Search Placeholder</span>
        <div className="diet-input__inner">
          <input className="diet-input__field" type="text" value={config.searchPlaceholder} ... />
        </div>
      </label>
    )}

  </div>
</>
```

#### Appearance Panel (`activeMenu === 'appearance'`)
```tsx
<>
  <div className="heading-3" style={{...}}>Appearance</div>
  <div className="stack" style={{...}}>
    {/* Template Dropdown */}
    <div>
      <label style={{...}}>Template</label>
      <div className="diet-dropdown" data-size="lg">
        {/* Dieter Dropdown for config.appearance.template */}
        {/* Options: Clear, Background, Background & Shadow, Background & Border */}
      </div>
    </div>

    {/* Item Background Color */}
    <div>
      <label style={{...}}>Item Background Color</label>
      {/* Reusable Color Picker component, bound to config.appearance.itemBackgroundColor */}
    </div>

    {/* Question Text Color */}
    <div>
      <label style={{...}}>Question Text Color</label>
      {/* Reusable Color Picker component, bound to config.appearance.questionTextColor */}
    </div>

    {/* Answer Text Color */}
    <div>
      <label style={{...}}>Answer Text Color</label>
      {/* Reusable Color Picker component, bound to config.appearance.answerTextColor */}
    </div>

    {/* Custom CSS Expander */}
    <div className="diet-expander" data-size="lg">
      <input type="checkbox" className="diet-expander__input" id="custom-css-expander" />
      <label className="diet-expander__trigger diet-btn" htmlFor="custom-css-expander">
        <span className="diet-btn__label">Custom CSS</span>
        <span className="diet-btn__icon" aria-hidden="true">{/* Chevron Icon */}</span>
      </label>
      <div className="diet-expander__content">
        <textarea value={config.appearance.customCSS} ... />
      </div>
    </div>
  </div>
</>
```

#### Settings Panel (`activeMenu === 'settings'`)
```tsx
<>
  <div className="heading-3" style={{...}}>Settings</div>
  <div className="stack" style={{...}}>
    {/* Show Search Bar */}
    <div className="diet-toggle" data-size="lg">
      <input type="checkbox" className="diet-toggle__input" id="show-search" checked={config.showSearchBar} ... />
      <label className="diet-toggle__track" htmlFor="show-search"></label>
      <label className="diet-toggle__label" htmlFor="show-search">Show Search Bar</label>
    </div>

    {/* Search Placeholder (conditionally rendered) */}
    {config.showSearchBar && (
      <label className="diet-input" data-size="lg">
        <span className="diet-input__label">Search Placeholder</span>
        <div className="diet-input__inner">
          <input className="diet-input__field" type="text" value={config.searchPlaceholder} ... />
        </div>
      </label>
    )}

    {/* Open First Question by Default */}
    <div className="diet-toggle" data-size="lg">
      <input type="checkbox" className="diet-toggle__input" id="open-first" checked={config.openFirstByDefault} ... />
      <label className="diet-toggle__track" htmlFor="open-first"></label>
      <label className="diet-toggle__label" htmlFor="open-first">Open First Question by Default</label>
    </div>

    {/* Allow Multiple Active Questions */}
    <div className="diet-toggle" data-size="lg">
      <input type="checkbox" className="diet-toggle__input" id="multiple-active" checked={config.multipleActive} ... />
      <label className="diet-toggle__track" htmlFor="multiple-active"></label>
      <label className="diet-toggle__label" htmlFor="multiple-active">Allow Multiple Active Questions</label>
    </div>
  </div>
</>
```

---

## How This Widget is Built (V0 Implementation)

This section outlines the V0 implementation plan, focusing on achieving ~70-80% of the competitor's core functionality without AI features. The goal is to establish a solid, clean foundation.

### 1. Implement the Schema
- Create a new Supabase migration to add the `content.faq` schema to the `widget_schemas` table.
- The schema will be based on the "Complete Schema" section of this PRD, but will omit the `aiSettings` object for V0.

### 2. Create the Venice Renderer
- Create a new renderer file at `venice/lib/renderers/faq.ts`.
- This function will take the widget's `config` and render the HTML structure for the FAQ, using the Dieter `expander` component as a base.
- All configurable styles (colors, etc.) **must** be implemented as CSS variables to support Bob's live preview, as specified in the "Tokenization for Preview" section.
- Add `data-widget-element` attributes to patchable elements.

### 3. Build the Bob Controls
- Modify `bob/app/bob/bob.tsx` to add the editor UI for the `content.faq` widget.
- When `widgetTypeState` is `content.faq`, render the `tdmenu` with the four specified icons (Content, Layout, Appearance, Settings).
- Implement the corresponding `tdmenucontent` panels for each icon, using the Dieter components as detailed in the "Bob Controls Specification" section.
- For V0, the "Content" and "Appearance" panels can be placeholders, while "Layout" and "Settings" are fully implemented with `diet-segmented` and `diet-toggle` controls.
- The state for these controls will be managed in React and will eventually be wired up to the Paris API and the `postMessage` patching system.

This phased approach provides a solid working base that matches the competitor's core functionality and can be iterated upon to add the more complex features and AI capabilities later.

---

## AI-Powered Content Generation (Clickeen's Killer Feature)

### Overview
FAQs are the perfect use case for AI differentiation. Writing 10-20 quality FAQ answers manually takes 2-3 hours. Clickeen turns this into a 2-minute task using tiered AI capabilities.

**Competitive Advantage:** Elfsight has no AI. Users do all the work manually. Clickeen's FAQ "writes itself."

---

### Free Tier (DeepSeek R1)

**Purpose:** Loss leader to demonstrate value and drive upgrades

**Capabilities:**
- Per-question answer generation (basic quality)
- Short answers (2-3 sentences, 50-100 words)
- Manual context input required
- Simple, straightforward responses
- Limit: **10 AI-generated answers per widget**

**Cost:** ~$0.000014 per question (negligible at scale)

**User Experience:**

```
Manual Mode - Question Editor:
┌─────────────────────────────────────┐
│ Question                            │
│ What's your return policy?          │
├─────────────────────────────────────┤
│ Answer                              │
│ [Rich text editor - empty]          │
│                                     │
│ ✨ Generate answer with AI          │
│                                     │
└─────────────────────────────────────┘

[User clicks Generate]

→ First time: Modal opens
┌─────────────────────────────────────┐
│ Help AI understand your business    │
│                                     │
│ Website URL (optional):             │
│ [___________________________]       │
│                                     │
│ Business context (optional):        │
│ [We sell organic dog food for...]  │
│                                     │
│ Note: Free tier uses basic AI      │
│ Upgrade for website analysis +     │
│ smarter answers                    │
│                                     │
│ [Cancel]  [Generate Answer]        │
└─────────────────────────────────────┘

→ DeepSeek generates:
"You can return items within 30 days.
Contact customer service for assistance.
Refunds are processed within 5-7 business days."

Below answer:
┌─────────────────────────────────────┐
│ 💡 Upgrade to Pro for:              │
│ ✓ 5x longer, SEO-optimized answers │
│ ✓ Website analysis                 │
│ ✓ Bulk FAQ generation              │
│ [See Plans]                        │
└─────────────────────────────────────┘

Free uses: 3/10 remaining
```

**When limit reached:**
```
❌ Free plan limit reached (10 AI-generated answers)

You've used all your free AI generations for this widget.

Upgrade to Pro for:
✓ Unlimited AI answer generation
✓ Advanced AI (Claude 4.5) for 3-5x better quality
✓ Website analysis & bulk generation
✓ SEO optimization with keyword targeting

[Upgrade Now]  [Edit Manually]
```

---

### Pro Tier (Claude Sonnet 4.5 or GPT-4)

**Purpose:** Premium feature that justifies paid plan

**Capabilities:**
- **Website analysis** - Scrapes 5-10 pages to understand business
- **Bulk generation** - "Create 20 FAQs from my website"
- **SEO optimization** - 150-250 word answers with natural keywords
- **Context awareness** - References specific products/pages
- **Smart suggestions** - Identifies missing common questions
- **Brand voice matching** - Learns tone from website
- **Unlimited generations**

**Cost:** ~$2 per widget (website analysis + bulk generation)
**Revenue:** $10-20/month subscription → profitable after 5-10 widgets

**User Experience:**

#### Copilot Mode - Initial Setup
```
AI Copilot activated

Let's create your FAQ! Choose how to start:

○ Option 1: Analyze my website (Recommended)
  I'll scan your site and draft 15-20 common questions
  Website URL: [https://acmecorp.com_____]

○ Option 2: I'll describe my business
  Tell me about your product/service and I'll suggest FAQs

○ Option 3: Manual
  You write everything, I'll assist where needed

[Continue]
```

**Option 1 selected:**
```
Analyzing https://acmecorp.com...

✓ Scanned homepage
✓ Scanned /products
✓ Scanned /about
✓ Scanned /pricing
✓ Extracted key business info

Found these topics:
- Product features & specs (8 potential questions)
- Pricing & plans (4 questions)
- Shipping & returns (5 questions)
- Technical support (3 questions)

[Generate 20 FAQs]  [Customize Topics]
```

**After generation:**
```
✓ Created 20 FAQ questions with detailed answers

Categories created:
📦 Product Questions (8)
💳 Pricing & Billing (4)
🚚 Shipping & Returns (5)
🛠️ Technical Support (3)

[Review in Content Tab]  [Regenerate]
```

#### Copilot Mode - Smart Suggestions
```
User adds question manually:
"Do you ship internationally?"

Copilot detects and suggests:
┌─────────────────────────────────────┐
│ 💡 I noticed you added a shipping   │
│ question. Want me to generate the  │
│ answer based on your site?         │
│                                     │
│ I found shipping info on:          │
│ • acmecorp.com/shipping            │
│ • acmecorp.com/faq                 │
│                                     │
│ [Generate Answer]  [No Thanks]     │
└─────────────────────────────────────┘
```

**When user has partial FAQs:**
```
Copilot analysis:

Your FAQ looks good! I noticed some improvements:

⚠️ 3 answers are under 50 words (Google prefers 150+)
   Questions 2, 5, 8

💡 You're missing common questions about:
   - Return policy details
   - International shipping
   - Warranty information
   - Bulk order discounts

🔗 Question 7 could link to your pricing page

Want me to:
[ ] Expand short answers for SEO
[ ] Add missing questions
[ ] Enhance with relevant links

[Apply Improvements]  [Dismiss]
```

---

### AI Context Modal (First Use)

**Free Tier:**
```
┌─────────────────────────────────────────┐
│ Help AI understand your business        │
│                                         │
│ Website URL (optional):                 │
│ [________________________________]      │
│                                         │
│ Business description:                   │
│ [_____________________________]         │
│ [_____________________________]         │
│ [_____________________________]         │
│                                         │
│ This context will be saved for future  │
│ AI generations in this widget.         │
│                                         │
│ Note: Free tier uses basic AI          │
│ (short, simple answers)                │
│                                         │
│ [Cancel]  [Generate Answer]            │
└─────────────────────────────────────────┘
```

**Pro Tier:**
```
┌─────────────────────────────────────────┐
│ AI Context Setup                        │
│                                         │
│ Website URL:                            │
│ [https://acmecorp.com___________]       │
│                                         │
│ I'll analyze your website to:          │
│ ✓ Extract business/product info        │
│ ✓ Learn your brand voice               │
│ ✓ Find relevant content to reference   │
│                                         │
│ Additional context (optional):          │
│ [_____________________________]         │
│                                         │
│ □ Use formal tone                      │
│ □ Include technical details            │
│ □ Focus on SEO keywords: [_______]     │
│                                         │
│ [Cancel]  [Analyze & Generate]         │
└─────────────────────────────────────────┘
```

---

### AI Prompts (Internal)

#### DeepSeek Prompt (Free Tier)
```typescript
const freePrompt = `Answer this FAQ question briefly and clearly.

Question: ${question}

${userContext ? `Context: ${userContext}` : ''}

Requirements:
- 2-3 sentences maximum
- Direct and simple language
- Factual and helpful
- 50-100 words

Answer:`;
```

**Example output:**
> "You can return items within 30 days of purchase. Contact customer service at support@example.com for return authorization. Refunds are processed within 5-7 business days."

#### Claude Prompt (Pro Tier - Single Question)
```typescript
const proPrompt = `You are an SEO expert writing FAQ answers for ${businessName}.

Website Analysis:
${scrapedContent}  // 5-10 pages of content

Question: ${question}

Write a comprehensive, SEO-optimized answer (150-250 words) that:
- Directly answers the question in the first sentence
- Includes relevant details from the website context
- Uses natural keywords (avoid keyword stuffing)
- Maintains the brand voice from the website
- Adds helpful links if appropriate (e.g., [pricing page](/pricing))
- Uses simple, scannable language (short paragraphs)
- Ends with a subtle call-to-action if relevant

Format: HTML with <p>, <strong>, <a>, <ul> tags as needed.`;
```

**Example output:**
> "<p>Yes, we offer international shipping to over 50 countries worldwide. Shipping costs vary by destination and are calculated at checkout based on your order weight and delivery address.</p>
>
> <p>International orders typically arrive within 7-14 business days, though customs processing may add 2-5 days depending on your country. All orders include tracking, and you'll receive updates via email.</p>
>
> <p>For large international orders (10+ items), contact our team at <a href='mailto:orders@acmecorp.com'>orders@acmecorp.com</a> for discounted shipping rates.</p>"

#### Claude Prompt (Pro Tier - Bulk Generation)
```typescript
const bulkPrompt = `You are an SEO expert creating a comprehensive FAQ for ${businessName}.

Website Analysis:
${scrapedContent}  // Full site scrape

Existing Content:
${existingFAQs.length > 0 ? existingFAQs : 'None'}

Task: Generate ${count} commonly asked questions with detailed, SEO-optimized answers.

Requirements:
- Cover the main topics: products/services, pricing, shipping, support, technical details
- Each answer: 150-250 words
- Include natural keywords from the website content
- Match the brand voice and tone from the website
- Add internal links where relevant
- Organize into logical categories
- Avoid duplicating existing questions
- Focus on questions customers actually ask (based on industry standards)

Output format: JSON array of objects with structure:
{
  "category": "Category Name",
  "question": "The question text",
  "answer": "HTML formatted answer with <p>, <strong>, <a> tags"
}`;
```

---

### Conversion Funnel Strategy

#### Touchpoint 1: First AI Use
```
Free user generates first answer
↓
Shows upgrade prompt below answer
"Upgrade for 3-5x better answers"
```

#### Touchpoint 2: Quality Comparison
```
Free answer: 2-3 sentences, basic
Pro preview: "Here's what Pro would generate..."
[Show 150-word detailed answer]
[Upgrade to use this answer]
```

#### Touchpoint 3: Limit Wall
```
10th generation → hard stop
"Upgrade for unlimited + better AI"
```

#### Touchpoint 4: Bulk Generation Tease
```
Copilot suggests: "I could generate 20 FAQs from your site"
Free user: Feature locked
[Upgrade to unlock bulk generation]
```

#### Touchpoint 5: SEO Insights
```
After 5+ manual answers:
"Your answers average 45 words. Google ranks FAQs
with 150+ words higher. Upgrade to AI-optimize these."
```

---

### Implementation Architecture

#### Bob Frontend (Content Tab)
```typescript
// In question editor component
interface QuestionEditorProps {
  question: string;
  answer: string;
  userTier: 'free' | 'pro';
  aiSettings: AISettings;
  onAIGenerate: () => void;
}

function AIGenerateButton({ userTier, freeUsageCount }) {
  const canUse = userTier === 'pro' || freeUsageCount < 10;
  const label = userTier === 'free'
    ? `✨ Generate with AI (${10 - freeUsageCount} left)`
    : '✨ Generate answer with AI';

  return (
    <button
      onClick={handleGenerate}
      disabled={!canUse}
    >
      {label}
    </button>
  );
}
```

#### Bob Backend (AI Service)
```typescript
// paris/lib/ai/faq-generator.ts
export async function generateFAQAnswer({
  question,
  context,
  tier,
  widgetId
}: GenerateFAQParams) {
  // Check tier limits
  if (tier === 'free') {
    const usage = await getFreeUsageCount(widgetId);
    if (usage >= 10) {
      throw new Error('FREE_TIER_LIMIT_REACHED');
    }
  }

  // Select provider
  const provider = tier === 'free' ? 'deepseek' : 'claude';
  const prompt = tier === 'free'
    ? buildFreePrompt(question, context)
    : buildProPrompt(question, context);

  // Generate
  const answer = await callAI(provider, prompt);

  // Track usage
  if (tier === 'free') {
    await incrementFreeUsage(widgetId);
  }

  return {
    answer,
    aiGenerated: true,
    provider,
    tokens: answer.length / 4
  };
}
```

#### Website Scraper (Pro Only)
```typescript
// paris/lib/ai/website-scraper.ts
export async function analyzeWebsite(url: string) {
  // Fetch key pages
  const pages = await scrapePages(url, {
    maxPages: 10,
    priority: ['/', '/about', '/pricing', '/products', '/faq', '/contact']
  });

  // Extract content
  const content = pages.map(extractMainContent);

  // Summarize for AI context (keep under 50K tokens)
  const summary = await summarizeContent(content);

  return {
    url,
    scrapedAt: new Date(),
    summary,
    tone: detectTone(content),
    keywords: extractKeywords(content)
  };
}
```

---

### UI Component Specifications

#### AI Context Modal Component
```tsx
// bob/app/components/AIContextModal.tsx
interface AIContextModalProps {
  tier: 'free' | 'pro';
  existingContext?: AISettings;
  onSave: (context: AISettings) => void;
}

function AIContextModal({ tier, existingContext, onSave }) {
  return (
    <Modal>
      <h2>Help AI understand your business</h2>

      <TextField
        label="Website URL"
        placeholder="https://yoursite.com"
        value={websiteUrl}
      />

      {tier === 'pro' && (
        <>
          <Button onClick={analyzeWebsite}>
            Analyze Website
          </Button>
          <Checkbox>Use formal tone</Checkbox>
          <Checkbox>Include technical details</Checkbox>
        </>
      )}

      <TextArea
        label="Business description"
        placeholder="Tell me about your business..."
        rows={4}
      />

      {tier === 'free' && (
        <Alert type="info">
          Free tier uses basic AI. Upgrade for website
          analysis and better quality.
        </Alert>
      )}

      <Button onClick={() => onSave({ websiteUrl, description })}>
        {tier === 'free' ? 'Generate Answer' : 'Analyze & Generate'}
      </Button>
    </Modal>
  );
}
```

#### Upgrade Prompt Component
```tsx
// bob/app/components/AIUpgradePrompt.tsx
function AIUpgradePrompt({ trigger }: { trigger: string }) {
  const benefits = {
    quality: ['5x longer answers', 'SEO optimized', 'Better accuracy'],
    limit: ['Unlimited generations', 'Advanced AI', 'Bulk generation'],
    features: ['Website analysis', 'Smart suggestions', 'Brand voice matching']
  };

  return (
    <Card className="upgrade-prompt">
      <Icon name="sparkles" />
      <h3>Upgrade to Pro for:</h3>
      <ul>
        {benefits[trigger].map(b => <li>✓ {b}</li>)}
      </ul>
      <Button variant="primary">See Plans</Button>
    </Card>
  );
}
```

---

### Success Metrics

**Free to Paid Conversion Goals:**
- 15-20% of users who use AI upgrade within 30 days
- 40% of users who hit the 10-question limit upgrade
- Average time to upgrade: 2-3 widget builds

**Usage Tracking:**
- % of FAQs using AI vs manual
- Average answer length (free vs pro)
- Time saved per widget (manual = 2hr, AI = 2min)

**Quality Metrics:**
- Pro answers average 200 words (vs Free 60 words)
- Pro answers include 2-3 internal links
- Pro FAQs rank higher in search (track SEO performance)

---

## Bob Implementation Details

### Repeater Pattern for Categories
```tsx
<div className="category-list">
  {categories.map((cat, idx) => (
    <div key={cat.id} className="category-item">
      <div className="category-header">
        <span>{cat.title}</span>
        <button className="context-menu">⋯</button>
      </div>
      {/* Nested questions repeater */}
    </div>
  ))}
  <button className="add-category">+ Add Category</button>
</div>
```

### Rich Text Editor
Use existing markdown editor or implement WYSIWYG:
- Toolbar with B, I, Link, Lists, HTML, Fullscreen
- Support for YouTube/Vimeo embed URLs
- Image URL embedding
- HTML source view

### Color Picker Component
Build reusable Dieter color picker:
- 7x7 preset color grid
- Custom HEX input
- Eyedropper tool (browser API)
- Recent colors
- Transparency slider

---

## Tokenization for Preview

```css
.faq-widget {
  /* Layout */
  --faq-columns: 1;
  --faq-max-width: 100%;

  /* Colors (patchable via postMessage) */
  --faq-item-bg: #ffffff;
  --faq-question-color: #000000;
  --faq-answer-color: #666666;
  --faq-category-color: #000000;
  --faq-border-color: #e0e0e0;

  /* Template style */
  --faq-shadow: none; /* or var(--shadow-md) */
  --faq-border-width: 0; /* or 1px */
}
```

**Patchable Fields:**
- All colors (instant preview)
- Template style (shadow/border)
- Icon type (plus/arrow)
- Layout mode (accordion/list/multicolumn)
- Toggle states (search, multiple active, etc.)

---

## Templates (6 Matching Elfsight)

1. **Search in FAQ**
   - Search bar prominent at top
   - Accordion layout
   - Background style
   - Arrow icons

2. **Accordion FAQ**
   - Classic accordion
   - Plus icons
   - Background & shadow
   - No search

3. **Categories**
   - Multiple category sections
   - Category titles with icons
   - Background & border
   - Search enabled

4. **Simple FAQ**
   - Single uncategorized list
   - Clear template (no background)
   - Minimal styling
   - Arrow icons

5. **Multicolumn FAQ**
   - 2-column grid
   - Compact spacing
   - Background style
   - No search

6. **FAQ Dropdown**
   - Alternative presentation
   - Plus icons
   - Background & shadow
   - Search enabled

---

## SSR Rendering Strategy

### Base HTML Structure
```html
<div class="faq-widget" data-layout="accordion" data-template="background">
  <!-- Search bar (if enabled) -->
  <div class="faq-search" data-widget-element="search">
    <input type="search" placeholder="Search..." />
  </div>

  <!-- Widget title -->
  <h2 class="faq-title">Frequently Asked Questions</h2>

  <!-- Category 1 -->
  <div class="faq-category" data-category-id="cat1">
    <h3 class="faq-category-title">
      <span class="category-icon">📦</span>
      All Questions
    </h3>

    <!-- Question 1 - Dieter Expander -->
    <div class="diet-expander" data-widget-element="question">
      <input class="diet-expander__input sr-only" type="checkbox" id="q1" />
      <label class="diet-expander__trigger diet-btn" for="q1">
        <span class="diet-btn__label">Can I cancel my subscription at anytime?</span>
        <span class="diet-btn__icon" aria-hidden="true">
          <!-- SVG arrow/plus based on config -->
        </span>
      </label>
      <div class="diet-expander__content">
        <div class="faq-answer" data-widget-element="answer">
          <p>Sure. Your paid subscription can be cancelled anytime by shifting to Lite plan.</p>
        </div>
      </div>
    </div>

    <!-- More questions... -->
  </div>

  <!-- More categories... -->
</div>
```

### CSS Variables Applied
```html
<div class="faq-widget" style="
  --faq-item-bg: #ffffff;
  --faq-question-color: #000000;
  --faq-answer-color: #ff00ff;
  --faq-shadow: var(--shadow-md);
">
```

---

## Search Implementation (Client Enhancement)

**SSR Base:** Search input rendered, non-functional
**JS Enhancement (preview=1 only):**

```javascript
// Injected only when ?preview=1
const searchInput = document.querySelector('[data-widget-element="search"] input');
const questions = document.querySelectorAll('[data-widget-element="question"]');

searchInput?.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  questions.forEach(q => {
    const label = q.querySelector('.diet-btn__label')?.textContent.toLowerCase();
    const match = !query || label?.includes(query);
    q.style.display = match ? '' : 'none';
  });
});
```

---

## Performance Targets

| Metric | Elfsight | Clickeen | Improvement |
|--------|----------|----------|-------------|
| Initial HTML | ~2KB | ~8KB | -4KB (more content SSR) |
| JavaScript | 150KB | 0KB (2KB for search) | 148KB smaller |
| First Paint | ~2s | ~200ms | 10x faster |
| Interactive | ~2.5s | Instant | No hydration |
| SEO | Delayed crawl | Immediate | 100% SSR |

---

## Implementation Phases

### Phase 1: Core Content & Layout (3-4 days)
- [ ] Schema implementation in database (including aiSettings fields)
- [ ] Venice renderer with Dieter expander
- [ ] Basic category/question structure
- [ ] 3 layout modes (accordion/list/multicolumn)
- [ ] Icon switching (plus/arrow)

### Phase 2: Bob Builder (4-5 days)
- [ ] Content tab with category repeater
- [ ] Nested question repeater
- [ ] Rich text editor for answers
- [ ] Context menus (reorder/delete)
- [ ] Layout tab controls
- [ ] Appearance tab with color pickers

### Phase 3: Advanced Features (2-3 days)
- [ ] Search functionality (client enhancement)
- [ ] Template presets (6 matching Elfsight)
- [ ] Custom CSS support
- [ ] Icon picker component
- [ ] Media URL embedding (YouTube/Vimeo)

### Phase 4: Preview & Polish (2 days)
- [ ] postMessage patches for all settings
- [ ] Smooth preview updates
- [ ] Template switching
- [ ] Cross-fade on Save
- [ ] Testing & edge cases

**Subtotal: 11-14 days for complete feature parity with Elfsight**

---

### Phase 5: AI Integration - Free Tier (3-4 days)
- [ ] DeepSeek API integration
- [ ] AI context modal component (website URL + business description)
- [ ] "Generate answer with AI" button in question editor
- [ ] Free tier usage tracking (10 generation limit per widget)
- [ ] Basic prompt engineering for DeepSeek
- [ ] Upgrade prompt component (shown after generation)
- [ ] Error handling and loading states

### Phase 6: AI Integration - Pro Tier (4-5 days)
- [ ] Claude/GPT-4 API integration
- [ ] Website scraper service (fetch + parse 5-10 pages)
- [ ] Content extraction and summarization
- [ ] Pro-tier prompt engineering (SEO optimization, 150-250 words)
- [ ] Bulk FAQ generation endpoint
- [ ] Copilot mode initial setup flow
- [ ] Smart suggestions system (detect empty answers, short content)
- [ ] Brand voice detection
- [ ] Internal link injection

### Phase 7: AI Copilot Features (3-4 days)
- [ ] Copilot mode UI in ToolDrawer
- [ ] Website analysis progress indicators
- [ ] Bulk generation preview interface
- [ ] Smart suggestion cards (missing questions, short answers, SEO tips)
- [ ] Category auto-organization from bulk generation
- [ ] Regenerate functionality (edit prompt + regenerate)
- [ ] A/B comparison (show free vs pro quality)

### Phase 8: Conversion Funnel & Polish (2-3 days)
- [ ] Upgrade prompts at all touchpoints (first use, limit, quality comparison)
- [ ] Usage analytics tracking (AI vs manual, answer length, conversions)
- [ ] Tier-based feature gating in UI
- [ ] Cost tracking and monitoring
- [ ] AI generation history (for debugging)
- [ ] User feedback mechanism ("Was this answer helpful?")
- [ ] Rate limiting and abuse prevention

**AI Features Total: 12-16 days**

**Grand Total: 23-30 days for complete FAQ widget with AI**

---

## Success Criteria

### Core Features (Feature Parity with Elfsight)
✅ **All 6 Elfsight templates** matched
✅ **All Content tab features** (categories, icons, rich text)
✅ **All Layout tab features** (3 layouts, icon styles, toggles)
✅ **All Appearance tab features** (4 templates, 4+ color controls, custom CSS)
✅ **Search functionality** (live filtering)
✅ **<10KB initial load** (vs 150KB+)
✅ **<1s LCP** on mobile 3G
✅ **100% SSR** for SEO
✅ **Instant preview** via postMessage
✅ **WCAG AA** accessibility

### AI Features (Competitive Advantage)
✅ **Free tier AI** (DeepSeek, 10 generations per widget)
✅ **Pro tier AI** (Claude/GPT-4, unlimited, SEO-optimized)
✅ **Website analysis** (scrape + context extraction)
✅ **Bulk generation** (20+ FAQs from website)
✅ **Smart suggestions** (missing questions, short answers, SEO tips)
✅ **Conversion funnel** (5+ upgrade touchpoints)
✅ **Usage tracking** (analytics, cost monitoring)

### Business Metrics
✅ **15-20% free-to-paid conversion** within 30 days
✅ **40% upgrade rate** when hitting free tier limit
✅ **<$2 AI cost per widget** (Pro tier)
✅ **2 hours → 2 minutes** (time saved vs manual)

---

## What We Match/Exceed vs Elfsight

### Match Elfsight:
- ✅ 6 starting templates
- ✅ Unlimited categories with icons
- ✅ Rich text answers (bold, italic, lists, links, media)
- ✅ 3 layout modes
- ✅ 2 icon styles (plus/arrow)
- ✅ 4 appearance templates
- ✅ 4+ color controls
- ✅ Search with live filtering
- ✅ Multiple/single expand modes
- ✅ Custom CSS support

### Exceed Elfsight (Performance):
- ✨ **15-20x smaller** bundle (8KB vs 150KB)
- ✨ **10x faster** first paint (200ms vs 2s)
- ✨ **Works without JS** (SSR-first)
- ✨ **Perfect SEO** (no client rendering delay)
- ✨ **No 3rd party scripts** (privacy by default)
- ✨ **Instant preview updates** (no reload lag)
- ✨ **Better accessibility** (keyboard nav, no hydration)

### Exceed Elfsight (AI Features - **KILLER DIFFERENTIATOR**):
- 🚀 **AI-powered answer generation** (Elfsight: none)
- 🚀 **Website analysis** (auto-extract business context)
- 🚀 **Bulk FAQ generation** (20+ questions in 30 seconds)
- 🚀 **SEO optimization** (150-250 word answers vs manual 50 words)
- 🚀 **Smart suggestions** (detect missing content, improve answers)
- 🚀 **Brand voice matching** (learns from your site)
- 🚀 **2-hour task → 2-minute task** (60x time savings)

**Bottom line:** Clickeen's FAQ widget is faster, smaller, more accessible AND writes itself with AI. No competitor offers this combination.

---

## For AIs Implementing This

**Critical references:**
- `dieter/components/expander.css` - Use this component
- `dieter/dieteradmin/src/html/dieter-showcase/expander.html` - Example markup
- `documentation/widgets/testbutton.md` - Tokenization patterns
- `documentation/systems/bob.md` - Preview system architecture

**Don't repeat GPT's mistakes (Core Features):**
- ✅ Use CSS-only Dieter expanders (no JS required)
- ✅ Tokenize all colors/styles as CSS variables
- ✅ Set variables in inline style attributes
- ✅ Include data-widget-element for postMessage
- ✅ Rich text editor outputs HTML (not markdown)
- ✅ Color picker is a reusable component
- ✅ Context menus for reorder/delete actions
- ✅ Categories are a repeater, questions are nested repeater

**AI Implementation Critical Points:**
- ✅ **Check user tier** before every AI call (free vs pro)
- ✅ **Track usage** for free tier (10 generation limit per widget, not per user)
- ✅ **Never call Claude/GPT for free tier** (only DeepSeek)
- ✅ **Cache website analysis** (save scraped content, don't re-scrape on every question)
- ✅ **Prompt engineering matters** (free = 2-3 sentences, pro = 150-250 words)
- ✅ **Show upgrade prompts** at all touchpoints (after generation, at limit, on quality comparison)
- ✅ **Store aiGenerated flag** on each answer (for analytics)
- ✅ **Save prompts** for regeneration (aiPrompt field)
- ✅ **Rate limit** to prevent abuse (max 50 generations per hour per user)
- ✅ **Error handling** for API failures (show fallback, don't block user)
- ✅ **Cost tracking** (log every API call with token count)
- ✅ **Streaming responses** for better UX (show answer as it generates)

**Copilot Mode Behavior:**
- ✅ Copilot is **proactive** (suggests improvements, detects issues)
- ✅ Free tier: Copilot suggests but shows upgrade for advanced features
- ✅ Pro tier: Copilot can execute bulk operations
- ✅ Always ask before bulk changes (don't auto-apply)
- ✅ Show diff/preview before applying AI suggestions

**Website Scraper Notes:**
- ✅ Respect robots.txt
- ✅ Max 10 pages per domain
- ✅ Timeout after 30 seconds
- ✅ Cache results for 7 days (keyed by domain)
- ✅ Strip navigation, footer, ads (extract main content only)
- ✅ Handle SPAs (wait for JS to render, or use SSR URLs if available)

**Security & Abuse Prevention:**
- ✅ Validate website URLs (must be http/https, no localhost/internal IPs)
- ✅ Sanitize AI output (strip `<script>`, dangerous HTML)
- ✅ Don't pass user PII to AI APIs (scrub emails, phone numbers from context)
- ✅ Rate limit by IP and user ID
- ✅ Log all generations for abuse monitoring

---

## Status

**Phase:** Detailed specification complete (including AI features)
**Blockers:** None
**Next:**
- **Option A:** Begin Phase 1 implementation (core FAQ without AI, 11-14 days)
- **Option B:** Implement in full with AI features (23-30 days)
**Recommendation:** Start with core FAQ (Phase 1-4), validate with users, then add AI (Phase 5-8)
**Estimated completion:**
- Core FAQ: 11-14 days
- With AI: 23-30 days total
