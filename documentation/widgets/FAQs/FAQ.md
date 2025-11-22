# content.faq — FAQ Widget PRD

STATUS: NORMATIVE — Complete Elfsight Feature Parity (70%+ Coverage) + SSR Performance

---

## Quick Reference

- **Type ID:** `content.faq`
- **Category:** Content Display / Customer Support
- **Competitive Target:** Complete Elfsight FAQ feature set (70%+ coverage)
- **Performance Target:** <8KB SSR (vs Elfsight 120KB+ client JS)
- **Renderer:** `venice/lib/renderers/faq.ts`
- **Dieter Components:** expander-faq.css, button.css, textfield.css, dropdown.css

### 🎯 Feature Coverage Goal: 70%+ of Elfsight

Based on comprehensive competitor analysis (**Elfsight FAQ widget**), this PRD targets the **core 70%** of features that deliver maximum user value while maintaining Clickeen's SSR performance advantage.

**What We MUST Implement (70% Core):**
- ✅ Question/answer pairs with rich text formatting (Bold, Italic, Links, Lists)
- ✅ Category organization with icons (20+ icon options)
- ✅ 3 layout modes (Accordion, List, Multicolumn)
- ✅ Complete category management (title, icon, reorder, delete)
- ✅ Complete question management (add, edit, delete, reorder)
- ✅ Accordion icon choice (Plus, Arrow)
- ✅ Behavior controls (open first by default, multiple active questions)
- ✅ Search functionality with keyword filtering
- ✅ Template presets (Clear, Background, Background & Shadow, Background & Border)
- ✅ Color customization (item background, question text, answer text, widget background)
- ✅ Font controls (family, sizes, weight)
- ✅ Show/hide category titles toggle
- ✅ Custom CSS support
- ✅ Schema.org FAQ markup for SEO

**What We Skip (<30% Optional):**
- ⚠️ Media preview in editor (YouTube/Vimeo thumbnails - content URLs supported, just no preview)
- ⚠️ Font library (200+ fonts - use default/system fonts only)
- ⚠️ Custom JavaScript execution
- ⚠️ Background gradient/image/video (solid color only)
- ⚠️ Multiple categories templates
- ⚠️ Analytics tracking

---

## Panel Structure (5 Tabs)

Clickeen uses a vertical icon menu with 5 tabs for FAQ widget:

1. **Content** (Pencil icon) - Questions, answers, categories, widget title
2. **Layout** (Grid icon) - Layout mode, columns, spacing, responsive behavior
3. **Style** (Palette icon) - Colors, fonts, templates, visual styling
4. **Advanced** (Sliders icon) - Accordion behavior, search, animations
5. **Settings** (Gear icon) - Custom CSS (skip: analytics, custom JS for V1)

---

# ✅ Panel 1: Content Tab Features (MUST IMPLEMENT)

## Widget Title
- **Control:** Text input
- **Default:** "Frequently Asked Questions"
- **Max length:** 100 characters
- **Used as:** `<h1>` heading in rendered output

## Display Category Titles Toggle
- **Label:** "Display Category Titles"
- **Type:** Toggle (on/off)
- **Default:** ON
- **Purpose:** Show or hide category header text above questions
- **Affects rendering:** Category `<h2>` elements visibility

## Categories Management Section

### Category List (Hierarchical Editor)
- **Structure:** Expandable/collapsible cards for each category
- **Actions per category:**
  - Edit category (opens inline editor)
  - Delete category (trash icon, with confirmation)
  - Reorder categories (drag handle ⋮⋮)
  - Expand/collapse to show/hide questions

### Add Category Button
- **Control:** "+ Add Category" button
- **Action:** Opens category creation form with:
  - Category Title (text input, max 50 chars)
  - Category Icon (dropdown selector)
  - Auto-adds empty category to list
  - Questions array initializes empty

### Category Editor (Per Category)
- **Category Title** - Text input
  - Max length: 50 characters
  - Required field
  - Used as `<h2>` in rendered output

- **Category Icon** - Icon picker dropdown
  - Dieter icon library (20+ options):
    - None (no icon)
    - Attention
    - Blank
    - Book
    - Calendar
    - Case
    - Chat
    - Checkmark
    - Clock
    - Cloud
    - Community
    - Creditcard
    - Delivery
    - (additional icons available)
  - Shows icon preview
  - Default: None (no icon)

### Questions List (Nested Under Each Category)
- **Structure:** Sub-list of question cards under category
- **Display:** Question text as list item
- **Actions per question:**
  - Edit question (opens inline editor)
  - Delete question (trash icon, with confirmation)
  - Reorder questions (drag handle ⋮⋮)

### Add Question Button (Per Category)
- **Control:** "+ Add Question" button (nested under category)
- **Action:** Appends new question to category's questions array
- **Form:** Opens question editor form

### Question Editor (Per Question)
- **Question Text** - Text input
  - Max length: 200 characters
  - Required field
  - Used as accordion trigger text

- **Answer** - Rich text editor
  - **Toolbar buttons:**
    - **Bold** (B) - `<strong>` tag
    - **Italic** (I) - `<em>` tag
    - **Link** (🔗) - Insert `<a href>` with URL
    - **Bullet list** (≡) - Unordered list `<ul><li>`
    - **Numbered list** (≡) - Ordered list `<ol><li>`
    - **More options** (⋯) - Additional formatting
    - **Code view** (<>) - Raw HTML editing (for power users)
    - **Fullscreen** (⛶) - Expand editor
  - **Supported content:**
    - Plain text
    - Formatted text (bold, italic, links, lists)
    - Media URLs (YouTube, Vimeo, image URLs)
    - HTML (escaped/sanitized)
  - **Max length:** 5000 characters
  - **Required field**
  - **Media support (URL-based):**
    - YouTube URLs: `https://youtube.com/watch?v=...`
    - Vimeo URLs: `https://vimeo.com/...`
    - Image URLs: `.jpg`, `.png`, `.webp`, `.gif`
    - Embedded as `<iframe>` or `<img>` tags in rendered output

---

# ✅ Panel 2: Layout Tab Features (MUST IMPLEMENT)

## Layout Mode Selector (3 Options)

Visual segmented control with icons:

### 1. Accordion (DEFAULT)
- **Icon:** Stacked collapsible items
- **Description:** Questions displayed as expandable accordion
- **Behavior:**
  - One question expanded at a time (by default)
  - Click to expand/collapse
  - Smooth animation on expand/collapse
  - Category headers above question groups

### 2. List
- **Icon:** Flat list
- **Description:** Questions displayed as flat list (all expanded)
- **Behavior:**
  - All content visible
  - No expand/collapse
  - Reduced visual hierarchy
  - Category headers above question groups

### 3. Multicolumn
- **Icon:** Grid layout
- **Description:** Questions arranged in columns
- **Behavior:**
  - Responsive grid layout
  - Configurable column count
  - Categories as column groups (optional)
  - Wrap to multiple rows

## General Layout Settings

### Widget Width
- **Control:** Text input with unit dropdown
- **Default:** 100%
- **Units:** px, %, vw
- **Range:** 200px - 2000px (for px), 10% - 100% (for %)
- **Applied to:** Container element max-width

### Item Spacing / Gap
- **Control:** Range slider
- **Default:** 16px
- **Range:** 0px - 48px
- **Purpose:** Space between question items
- **CSS:** gap property on container

### Column Count (Conditional: when mode=multicolumn)
- **Control:** Numeric slider
- **Default:** 2
- **Range:** 1-4 columns
- **Purpose:** Number of columns in multicolumn layout
- **Applied at:** Desktop viewport (>1024px)

## Mobile Responsive Behavior (Expandable Section)

### Mobile Layout Mode (Optional)
- **Control:** Dropdown selector
- **Options:** Same as layout, inherit from desktop
- **Purpose:** Different layout on mobile vs desktop
- **Applied at:** @media (max-width: 768px)

### Column Count for Tablets
- **Control:** Numeric slider
- **Range:** 1-3
- **Default:** 2
- **Applied at:** @media (max-width: 1024px)

### Column Count for Mobiles
- **Control:** Numeric slider
- **Range:** 1-2
- **Default:** 1
- **Applied at:** @media (max-width: 768px)

---

# ✅ Panel 3: Style Tab Features (MUST IMPLEMENT)

## Template Preset Selector
- **Control:** Dropdown or visual cards
- **Options:**
  1. **Clear** - Minimal styling, no background
  2. **Background** - Light background color
  3. **Background & Shadow** - Background with subtle shadow
  4. **Background & Border** - Background with border
- **Default:** Clear
- **Purpose:** Quick preset styling configuration

## Color Pickers

### Item Background Color
- **Control:** Color picker with palette grid
- **Default:** White (#ffffff) or light gray (#f5f5f5)
- **Features:**
  - 7x7 preset color grid (49 colors from Dieter tokens)
  - Custom HEX input field
  - Eyedropper tool (browser API)
  - Opacity slider (alpha channel)
  - "Clear" button to reset
- **Applied to:** Question item container background

### Question Text Color
- **Control:** Color picker with palette grid
- **Default:** Dark gray (#333333) or black (#000000)
- **Features:** Same as above
- **Applied to:** Question heading text color

### Answer Text Color
- **Control:** Color picker with palette grid
- **Default:** Dark gray (#666666)
- **Features:** Same as above
- **Applied to:** Answer body text color

### Widget Background Color (Optional)
- **Control:** Color picker with palette grid
- **Default:** Transparent or white
- **Features:** Same as above
- **Applied to:** Container background color

## Font Controls

### Font Family (⚠️ SIMPLIFIED for V1)
- **Control:** Font dropdown selector
- **V1 Options:** "Default (System Fonts)" only
- **Future:** Extensive font library
- **Note:** Skip custom font library for V1

### Question Font Size
- **Control:** Dropdown selector or slider
- **Options:** 14px, 16px, 18px, 20px, 24px
- **Default:** 16px
- **Applied to:** Question heading text size

### Answer Font Size
- **Control:** Dropdown selector or slider
- **Options:** 12px, 14px, 16px, 18px
- **Default:** 14px
- **Applied to:** Answer body text size

### Question Font Weight
- **Control:** Dropdown selector
- **Options:** Regular (400), Medium (500), Bold (700)
- **Default:** Medium (500)
- **Applied to:** Question heading font-weight

## Border and Spacing

### Item Border Radius
- **Control:** Range slider
- **Default:** 4px
- **Range:** 0px - 16px
- **Applied to:** Question item border-radius

### Item Padding
- **Control:** Range slider
- **Default:** 16px
- **Range:** 8px - 32px
- **Applied to:** Question item padding

---

# ✅ Panel 4: Advanced Tab Features (MUST IMPLEMENT)

## Accordion Settings (Conditional: when layout=accordion)

### Accordion Icon Selector
- **Control:** Segmented control with icon previews
- **Options:**
  - Plus icon (+) - DEFAULT
  - Arrow icon (→)
  - Chevron icon (⌄)
- **Default:** Plus icon
- **Purpose:** Icon shown next to expandable question

### Open First Question by Default
- **Control:** Toggle
- **Default:** OFF
- **Purpose:** Auto-expand first question on page load
- **Applied at:** Render time (aria-expanded attribute)

### Multiple Active Questions
- **Control:** Toggle
- **Default:** OFF
- **Purpose:** Allow multiple questions to be expanded simultaneously
- **Purpose:** If OFF, closing accordion to other items when one opens

## Search Settings

### Show Search Bar
- **Control:** Toggle
- **Default:** ON
- **Purpose:** Display search/filter input above questions
- **Visibility:** When ON, renders `<input type="search">` above questions

### Search Placeholder Text (Conditional: when show_search=true)
- **Control:** Text input
- **Default:** "Search questions..."
- **Max length:** 50 characters
- **Applied to:** `<input placeholder="">` attribute

## Animations

### Expand/Collapse Animation
- **Control:** Dropdown selector
- **Options:**
  - None - Instant (no animation)
  - Fade - Fade in/out effect
  - Slide - Slide down/up effect
  - Default: Slide
- **Applied at:** CSS transitions on accordion open/close

### Animation Speed
- **Control:** Range slider
- **Default:** 300ms
- **Range:** 100ms - 500ms
- **Applied at:** CSS transition-duration property

---

# ✅ Panel 5: Settings Tab Features

## Custom CSS
- **Control:** Expandable section with textarea
- **Label:** "Custom CSS"
- **Purpose:** Override default styles with custom CSS
- **Features:**
  - Syntax highlighting (basic)
  - Line numbers
  - Full-screen expand button
- **Supported selectors:**
  - `.ck-faq-widget` - Main container
  - `.ck-faq-category` - Category section
  - `.ck-faq-question` - Question item
  - `.ck-faq-answer` - Answer content
  - `.ck-faq-search` - Search input

## Custom JavaScript (⚠️ SKIP for V1)
- **Status:** Not implemented in V1
- **Future:** Allow custom event handlers and integrations

## Analytics Tracking (⚠️ SKIP for V1)
- **Status:** Not implemented in V1
- **Future:** Google Analytics event tracking

---

# instanceData Schema

Complete JSON structure for FAQ widget configuration:

```typescript
interface FAQInstanceData {
  // Content
  widgetTitle: string;              // "Frequently Asked Questions"
  displayCategoryTitles: boolean;   // true
  categories: FAQCategory[];

  // Layout
  layoutMode: "accordion" | "list" | "multicolumn";  // "accordion"
  columnCount: number;              // 2 (for multicolumn)
  columnCountTablet?: number;       // 2 (for multicolumn)
  columnCountMobile?: number;       // 1 (for multicolumn)
  widgetWidth: string;              // "100%" or "1200px"
  itemSpacing: number;              // 16 (px)
  mobileLayoutMode?: string;        // inherit from desktop or override

  // Style
  templatePreset: "clear" | "background" | "background-shadow" | "background-border";
  itemBackgroundColor: string;      // "#ffffff"
  questionTextColor: string;        // "#333333"
  answerTextColor: string;          // "#666666"
  widgetBackgroundColor?: string;   // "#ffffff" or transparent
  fontFamily: string;               // "system" (default)
  questionFontSize: number;         // 16 (px)
  answerFontSize: number;           // 14 (px)
  questionFontWeight: 400 | 500 | 700;  // 500
  itemBorderRadius: number;         // 4 (px)
  itemPadding: number;              // 16 (px)

  // Advanced
  accordionIcon: "plus" | "arrow" | "chevron";  // "plus"
  openFirstByDefault: boolean;      // false
  multipleActiveQuestions: boolean; // false
  showSearchBar: boolean;           // true
  searchPlaceholder: string;        // "Search questions..."
  animationType: "none" | "fade" | "slide";  // "slide"
  animationSpeed: number;           // 300 (ms)

  // Settings
  customCSS?: string;               // Custom CSS string (optional)

  // SEO
  schemaMarkup?: boolean;           // true (auto-generated, read-only)
}

interface FAQCategory {
  id: string;                       // UUID, auto-generated
  title: string;                    // "Getting Started"
  icon?: string;                    // Icon name or "none"
  questions: FAQQuestion[];
}

interface FAQQuestion {
  id: string;                       // UUID, auto-generated
  question: string;                 // "How do I get started?"
  answer: string;                   // Rich HTML: "<p>Follow our <strong>quick start</strong> guide.</p>"
  order?: number;                   // Sort order within category
}
```

---

# UI Schema for Bob (ToolDrawer Configuration)

The uiSchema defines how controls appear in Bob's 5 panels:

```typescript
interface UISchema {
  // Panel 1: Content
  content: {
    widgetTitle: ControlInput;
    displayCategoryTitles: ControlToggle;
    categories: ControlCategoryEditor;  // Complex hierarchical editor
  };

  // Panel 2: Layout
  layout: {
    layoutMode: ControlSegmented;       // 3 options: accordion, list, multicolumn
    columnCount: ControlSlider;         // Conditional: when mode=multicolumn
    columnCountTablet: ControlSlider;
    columnCountMobile: ControlSlider;
    widgetWidth: ControlTextWithUnits;
    itemSpacing: ControlSlider;
    mobileLayoutMode: ControlDropdown;  // Optional override
  };

  // Panel 3: Style
  style: {
    templatePreset: ControlDropdown;
    itemBackgroundColor: ControlColorPicker;
    questionTextColor: ControlColorPicker;
    answerTextColor: ControlColorPicker;
    widgetBackgroundColor: ControlColorPicker;
    fontFamily: ControlDropdown;
    questionFontSize: ControlDropdown;
    answerFontSize: ControlDropdown;
    questionFontWeight: ControlDropdown;
    itemBorderRadius: ControlSlider;
    itemPadding: ControlSlider;
  };

  // Panel 4: Advanced
  advanced: {
    // Accordion settings (visible when layoutMode=accordion)
    accordionIcon: ControlSegmented;
    openFirstByDefault: ControlToggle;
    multipleActiveQuestions: ControlToggle;

    // Search settings
    showSearchBar: ControlToggle;
    searchPlaceholder: ControlTextInput;  // Conditional: when showSearchBar=true

    // Animation settings
    animationType: ControlDropdown;
    animationSpeed: ControlSlider;
  };

  // Panel 5: Settings
  settings: {
    customCSS: ControlTextarea;
  };
}
```

---

# Rendering Specifications (Venice)

## Server-Side Rendering (SSR)

The FAQ widget is rendered completely server-side with no client JavaScript required for display. Search functionality uses minimal client-side logic.

### HTML Structure

```html
<div class="ck-faq-widget" data-widget-id="{{ instanceData.id }}">
  <h1 class="ck-faq-title">{{ widgetTitle }}</h1>

  <!-- Search bar (conditional) -->
  <div class="ck-faq-search-container" *ngIf="showSearchBar">
    <input
      type="search"
      class="ck-faq-search"
      placeholder="{{ searchPlaceholder }}"
      aria-label="Search questions"
    />
  </div>

  <!-- Categories loop -->
  <div class="ck-faq-category" *ngFor="let category of categories">
    <!-- Category header (conditional) -->
    <h2 class="ck-faq-category-title" *ngIf="displayCategoryTitles">
      <span class="ck-faq-category-icon" *ngIf="category.icon">
        <!-- Icon SVG from Dieter -->
      </span>
      {{ category.title }}
    </h2>

    <!-- Questions in this category -->
    <div class="ck-faq-questions">
      <details
        class="ck-faq-question"
        *ngFor="let question of category.questions; let i = index"
        [open]="openFirstByDefault && i === 0"
        [attr.data-question-id]="question.id"
      >
        <!-- Accordion trigger -->
        <summary class="ck-faq-question-trigger">
          <span class="ck-faq-icon">
            <!-- Plus/Arrow/Chevron icon -->
          </span>
          <span class="ck-faq-question-text">
            {{ question.question }}
          </span>
        </summary>

        <!-- Answer content -->
        <div class="ck-faq-answer">
          {{ sanitize(question.answer) }}
          <!-- HTML is escaped/sanitized -->
        </div>
      </details>
    </div>
  </div>

  <!-- "Made with Clickeen" footer -->
  <footer class="ckeen-backlink">
    <a href="https://clickeen.com/?ref=widget" target="_blank">Made with Clickeen</a>
  </footer>
</div>
```

### Dieter Component Integration

**Required Dieter components:**
- `expander-faq.css` - Accordion/details styling
- `button.css` - Search button (if included)
- `textfield.css` - Search input styling
- `tokens.css` - Design tokens (colors, spacing, typography)

**CSS classes from Dieter:**
- `.diet-details` - Accordion container styling
- `.diet-summary` - Accordion trigger styling
- `.diet-textfield` - Search input styling

---

# Feature Specifications

## Rich Text Editor Requirements

The answer field must support these formatting options:

### Supported Formatting
- **Bold:** `<strong>text</strong>` or `<b>text</b>`
- **Italic:** `<em>text</em>` or `<i>text</i>`
- **Links:** `<a href="url">text</a>`
- **Unordered lists:** `<ul><li>item</li></ul>`
- **Ordered lists:** `<ol><li>item</li></ol>`

### Media Support (URL-based)
- **YouTube:** `<iframe src="https://youtube.com/embed/..."></iframe>`
- **Vimeo:** `<iframe src="https://vimeo.com/..."></iframe>`
- **Images:** `<img src="url" alt="description">`

### Security
- **HTML Sanitization:** All user-provided content must be sanitized
- **Whitelist tags:** p, strong, em, a, ul, ol, li, br, iframe, img
- **Whitelist attributes:** href, src, alt, title, class, data-*
- **Dangerous removal:** script, style, onclick, onload, etc.

## Search Functionality

Search filters questions in real-time based on keyword matching:

### Implementation
- **Client-side JavaScript:** Minimal ~2KB
- **Search scope:** Question text + answer text
- **Case-insensitive:** "FAQ" matches "faq"
- **Partial match:** "getting" matches "Getting Started"

### Visual Feedback
- **No matches:** Show "No questions found" message
- **Highlight:** Optional highlighting of matched text
- **Performance:** No delay for 100-500 questions

## Category System

### Features
- **Unlimited categories:** No hard limit
- **Unlimited questions per category:** Scales to 500+ questions
- **Special category:** "All Questions" is NOT a real category; search across all
- **Icon support:** 20+ Dieter icons available
- **No icon option:** Display category title without icon

## Accordion Behavior

### Expand/Collapse
- **Single mode:** Only one question open at a time (default)
- **Multiple mode:** Multiple questions can be open simultaneously
- **Animation:** Smooth CSS transition (fade or slide)
- **Performance:** No animation lag even with 100+ questions

### Native HTML Support
- **Uses `<details>` element:** Native browser support, no JavaScript required
- **Keyboard support:** Tab to trigger, Enter to toggle, Space to toggle
- **ARIA attributes:** `aria-expanded`, `aria-label` for accessibility

---

# SEO Requirements

## Schema.org FAQ Markup

Auto-generate JSON-LD schema for FAQ structured data:

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I get started?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Follow our quick start guide..."
      }
    }
  ]
}
```

**Included in `<head>` of rendered HTML**

## SEO Benefits
- ✅ FAQ rich snippets in Google search results
- ✅ Improved search visibility
- ✅ Better CTR from search results
- ✅ Semantic HTML markup
- ✅ No JavaScript required for indexing

---

# Performance Requirements

## SSR Bundle Size Target
- **Preferred total (HTML/CSS/JS):** ≤80KB gzipped
- **Hard cap:** ≤200KB gzipped per widget
- **Comparison:** Elfsight ~120KB client JS (heavier than our preferred target)

## Load Performance Targets
- **Time to Interactive:** ≤1s on 4G networks
- **First Contentful Paint:** ≤1.5s
- **Cumulative Layout Shift:** ≤0.1
- **No render-blocking assets**

## Performance Optimizations
1. **100% SSR** - No client bundle required for display
2. **Native HTML** - Uses browser-native `<details>` element
3. **Minimal JS** - Only search requires JavaScript
4. **No animations on critical path** - Optional CSS animations
5. **Image optimization** - No images embedded by default

---

# Dieter Components Required

## New Component: `expander-faq.css`

FAQ-specific expander component for accordion styling:

```css
/* Semantic details/summary styling */
.diet-details-faq {
  /* Accordion item container */
}

.diet-summary-faq {
  /* Accordion trigger button */
  /* Includes icon spacing for plus/arrow */
}

.diet-details-faq[open] .diet-summary-faq {
  /* Active state styling */
}
```

## Existing Components
- `button.css` - Optional search button
- `textfield.css` - Search input field
- `dropdown.css` - Font/preset dropdowns
- `tokens.css` - Design tokens (colors, spacing, typography)

---

# Data Structure Examples

## Minimal FAQ (1 category, 2 questions)

```json
{
  "widgetTitle": "Frequently Asked Questions",
  "displayCategoryTitles": true,
  "categories": [
    {
      "id": "cat-1",
      "title": "Getting Started",
      "icon": "book",
      "questions": [
        {
          "id": "q-1",
          "question": "How do I get started?",
          "answer": "<p>Follow our <strong>quick start</strong> guide.</p>"
        },
        {
          "id": "q-2",
          "question": "What is the pricing?",
          "answer": "<p>We offer both <em>free</em> and <strong>paid plans</strong>.</p>"
        }
      ]
    }
  ],
  "layoutMode": "accordion",
  "templatePreset": "background",
  "itemBackgroundColor": "#ffffff",
  "questionTextColor": "#333333",
  "answerTextColor": "#666666",
  "accordionIcon": "plus",
  "openFirstByDefault": false,
  "multipleActiveQuestions": false,
  "showSearchBar": true,
  "searchPlaceholder": "Search questions...",
  "animationType": "slide",
  "animationSpeed": 300
}
```

## Complex FAQ (3 categories, multiple questions)

```json
{
  "widgetTitle": "Help Center",
  "displayCategoryTitles": true,
  "categories": [
    {
      "id": "cat-1",
      "title": "Getting Started",
      "icon": "book",
      "questions": [
        {
          "id": "q-1",
          "question": "How do I create an account?",
          "answer": "<p>Click <a href=\"/signup\">Sign up</a> and follow the steps.</p>"
        }
      ]
    },
    {
      "id": "cat-2",
      "title": "Billing",
      "icon": "creditcard",
      "questions": [
        {
          "id": "q-2",
          "question": "Do you offer refunds?",
          "answer": "<p>Yes, <strong>30-day money-back</strong> guarantee on all plans.</p>"
        }
      ]
    },
    {
      "id": "cat-3",
      "title": "Technical",
      "icon": "chat",
      "questions": [
        {
          "id": "q-3",
          "question": "What browsers do you support?",
          "answer": "<ul><li>Chrome (latest)</li><li>Firefox (latest)</li><li>Safari (latest)</li><li>Edge (latest)</li></ul>"
        }
      ]
    }
  ],
  "layoutMode": "multicolumn",
  "columnCount": 2,
  "columnCountTablet": 1,
  "columnCountMobile": 1,
  "widgetWidth": "100%",
  "itemSpacing": 20,
  "templatePreset": "background-border",
  "itemBackgroundColor": "#f9f9f9",
  "questionTextColor": "#222222",
  "answerTextColor": "#555555",
  "widgetBackgroundColor": "#ffffff",
  "questionFontSize": 18,
  "answerFontSize": 14,
  "questionFontWeight": 500,
  "itemBorderRadius": 8,
  "itemPadding": 20,
  "accordionIcon": "arrow",
  "openFirstByDefault": true,
  "multipleActiveQuestions": true,
  "showSearchBar": true,
  "searchPlaceholder": "Find your answer...",
  "animationType": "slide",
  "animationSpeed": 400,
  "customCSS": ".ck-faq-widget { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }"
}
```

---

# Phase-1 vs Future

## Phase-1 Scope (MVP - Immediate)
- ✅ All 5 panels fully functional
- ✅ Rich text editor (basic: Bold, Italic, Links, Lists)
- ✅ 3 layout modes (Accordion, List, Multicolumn)
- ✅ Search functionality
- ✅ Category system with icons
- ✅ Template presets
- ✅ Color customization
- ✅ Basic animations
- ✅ Schema.org FAQ markup
- ✅ Custom CSS override

## Future Enhancements (Post-Phase-1)
- ⚠️ Media preview in editor (YouTube/Vimeo thumbnails)
- ⚠️ Font library (200+ fonts)
- ⚠️ Custom JavaScript support
- ⚠️ Background gradient/image/video
- ⚠️ Advanced animations (spring, bounce, etc.)
- ⚠️ Analytics tracking
- ⚠️ Form integration
- ⚠️ Multiple templates library
- ⚠️ AI-generated FAQ suggestions

---

# Implementation Notes

## Widget JSON Location
- **File:** `/paris/lib/widgets/faq.json`
- **Format:** Normative widget definition (complete software for FAQ type)

## Renderer Location
- **File:** `/venice/lib/renderers/faq.ts`
- **Type:** Pure function: `render(widgetJSON, instanceData) => HTML string`

## Bob Builder Location
- **File:** `/bob/app/widgets/faq/page.tsx`
- **Integrates:** Uses generic ToolDrawer for all controls

## Design System Integration
- **Location:** `/dieter/components/`
- **New component:** `expander-faq/` directory with CSS + HTML + spec.json

## Testing Requirements
- Unit tests for rich text sanitization
- Integration tests for search functionality
- SSR rendering tests
- Performance tests (budget verification)
- Cross-browser tests (details/summary support)
- Accessibility tests (ARIA labels, keyboard navigation)

---

This completes the FAQ widget PRD specification.
