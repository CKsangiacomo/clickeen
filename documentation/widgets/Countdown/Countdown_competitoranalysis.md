# content.countdown — Countdown competitor analysis

STATUS: REFERENCE — Competitor inventory (Elfsight) + key takeaways

This doc captures competitor behavior and editor surface area for countdown widgets (primarily Elfsight), based on the assets in `documentation/widgets/Countdown/CompetitorAnalysis/`.

Canonical Clickeen PRD (what we will build): `documentation/widgets/Countdown/Countdown_PRD.md`.

---

## Quick Reference

- **Type ID:** `content.countdown`
- **Category:** Content Display / Marketing / Urgency
- **Competitive Target:** Complete Elfsight Countdown Timer feature set (70%+ coverage)
- **Performance Target:** <6KB SSR (vs Elfsight 80KB+ client JS)
- **Renderer:** Planned Venice SSR renderer (this repo snapshot has no `venice/lib/renderers/*`; Venice currently serves a safe debug shell)
- **Dieter Components:** Custom timer display (new component needed)

### 🎯 Feature Coverage Goal: 70%+ of Elfsight

Based on comprehensive competitor analysis (**26 screenshots from Elfsight**), this PRD targets the **core 70%** of features that deliver maximum user value while maintaining Clickeen's SSR performance advantage.

**What We MUST Implement (70% Core):**
- ✅ 3 timer modes (Countdown to Date, Personal Countdown, Number Counter)
- ✅ Complete timer configuration (date/time, duration, time units, repeat)
- ✅ Heading with rich text formatting
- ✅ CTA button with actions (Link, Form, Hide Timer)
- ✅ 5 position layouts (Inline, Full-width Section, Top/Bottom Bar, Static Top Bar)
- ✅ 4 theme presets (Custom, Light, Dark, Gradient) + 10 holiday themes
- ✅ 2 timer styles (Separated boxes, Inline)
- ✅ Complete customization (colors, fonts, sizes, animations, separators)
- ✅ Time format control (show/hide days, hours, minutes, seconds, labels)
- ✅ Content width, alignment controls
- ✅ Custom CSS support

**What We Skip (<30% Optional):**
- ⚠️ Form action (open form modal - can add later)
- ⚠️ Google Analytics events tracking
- ⚠️ Custom JS (CSS only)
- ⚠️ Advanced animations beyond fade
- ⚠️ Holiday theme library (can add 2-3 initially, expand later)

---

## Complete Feature Inventory (From Elfsight Screenshots)

### Panel Structure (4 Main Tabs)
Elfsight uses a vertical icon menu with 4 tabs:
1. **Timer** (⏱️ icon) - Timer mode, configuration, heading, repeat
2. **Actions** (🔗 icon) - Button/link actions during countdown and after it ends
3. **Position** (📐 icon) - Widget positioning and layout on page
4. **Theme** (🎨 icon) - Visual styling, colors, fonts, animations
5. **Settings** (⚙️ icon) - Google Analytics, Custom CSS (skip GA for V1)

---

## ✅ Timer Tab Features (MUST IMPLEMENT)

### Timer Mode Selector (3 Modes)

Visual cards with icons showing 3 timer types:

#### 1. Countdown to Date
- **Icon:** Calendar with clock
- **Description:** "Count down to a specific date"
- **Use case:** Event launches, sales deadlines, product releases
- **Configuration:**
  - **Target Date** - Date picker (MM/DD/YYYY)
  - **Target Time** - Time picker (HH:MM AM/PM)
  - **Timezone** - Dropdown with all timezones
    - Default: User's browser timezone
    - Options: GMT-12 through GMT+14
    - Named zones (EST, PST, UTC, etc.)

#### 2. Personal Countdown (MOST POPULAR)
- **Icon:** User icon with clock
- **Description:** "Starts for each visitor when they first open the page"
- **Use case:** Limited-time offers, flash sales, FOMO urgency
- **Selected in screenshot:** "Personal Countdown" with green checkmark
- **Configuration:**
  - **Time Amount** - Numeric input
    - Default: 1
    - Range: 1-999
  - **Time Unit** - Dropdown
    - Options: Hours, Minutes, Days, Weeks, Months
    - Default: Hours
  - **Repeat** - Expandable section
    - **Every** - Dropdown
      - Options: 1 minute, 5 minutes, 1 hour, 1 day, 1 week, Never
      - Default: Never
    - Description: "Reset the countdown after it finishes"

#### 3. Number Counter
- **Icon:** Numbers ascending
- **Description:** "Count up to a target number"
- **Use case:** Fundraising goals, user counts, milestones
- **Configuration:**
  - **Target Number** - Numeric input
    - Range: 0-9999999
  - **Starting Number** - Numeric input
    - Default: 0
  - **Count Duration** - Numeric input (seconds)
    - How long the count-up animation takes
    - Default: 5 seconds

### Heading Section
- **Label:** "Heading"
- **Rich text editor** with toolbar:
  - **Bold** (B button)
  - **Italic** (I button)
  - **Link** (🔗 button) - Insert hyperlinks
  - **Bullet list** (≡ button)
  - **Numbered list** (≡ button)
  - **More options** (⋯ button)
  - **Code view** (<> button) - Raw HTML editing
  - **Fullscreen** (⛶ button) - Expand editor
- **Default text:** "Get 50% off before it's too late 🎯"
- **Max length:** 500 chars
- **Supports:** HTML, emojis, inline styles

---

## ✅ Actions Tab Features (MUST IMPLEMENT)

### Actions Structure
Two separate action sections with expandable cards:

#### DURING COUNTDOWN
Actions that appear **while the timer is counting down**

**Action Type Selector** - Modal with 2 options:
1. **Link** (🔗 icon)
   - "Redirect visitors to a chosen URL"
   - **Most common use case**

2. **Form** (📋 icon)
   - "Open a form to collect user data"
   - ⚠️ **Skip for V1** (requires form builder integration)

**Link Configuration** (when Link selected):
- **Button Link** - URL input
  - Text field: "https://elfsight.com/"
  - Supports internal (/pricing) and external (https://)
  - Gear icon (⚙️) opens advanced settings

- **Button Text** - Text input
  - Default: "Purchase now"
  - Max length: 50 chars

- **Button Style** - Dropdown
  - Options: Primary, Secondary
  - Primary = filled button (default)
  - Secondary = outline button

- **Advanced Link Settings** (gear icon modal):
  - **URL type tabs:** URL, Email, Phone
  - **URL input field**
  - **Open Link in a New Tab** - Toggle
    - Default: ON
    - Opens link in new browser tab (target="_blank")

#### AFTER COUNTDOWN ENDS
Actions that appear **after the timer reaches 00:00:00**

**Action Type Selector** - Modal with 2 options:
1. **Hide Timer** (👁️‍🗨️ icon)
   - "Remove the timer after it finishes"
   - **Most common for time-limited offers**
   - Selected in screenshot

2. **Link** (🔗 icon)
   - "Redirect visitors to a chosen URL"
   - Same configuration as "During Countdown" link

**Hide Timer** - No additional configuration needed
- Simply removes widget from page when countdown reaches 0
- No JavaScript required (CSS display: none)

### "+ Add Action" Button
- Allows adding multiple actions per section
- Each action shows as a card with:
  - Action icon and type
  - Action description
  - Options menu (⋯) - Edit or Delete
  - Reorder handle (⋮⋮)

---

## ✅ Position Tab Features (MUST IMPLEMENT)

### Position Layout Selector (5 Options)

Visual cards showing different widget placements:

#### 1. Inline
- **Visual:** Small widget icon in content area
- **Description:** Embedded within page content
- **CSS:** `position: relative` (normal flow)
- **Use case:** Inside blog posts, product pages

#### 2. Full-width Section (SELECTED IN SCREENSHOT)
- **Visual:** Wide bar spanning full width with content
- **Description:** Full-width section with contained content
- **CSS:** `width: 100vw; max-width: 100%;`
- **Blue border in screenshot** indicates selection
- **Use case:** Hero sections, page headers

#### 3. Top Bar
- **Visual:** Thin bar at top of viewport
- **Description:** Sticky bar at top of page
- **CSS:** `position: fixed; top: 0;`
- **Use case:** Urgent announcements, sales banners

#### 4. Bottom Bar
- **Visual:** Thin bar at bottom of viewport
- **Description:** Sticky bar at bottom of page
- **CSS:** `position: fixed; bottom: 0;`
- **Use case:** Non-intrusive CTAs, cookie notices

#### 5. Static Top Bar
- **Visual:** Bar at top (non-sticky)
- **Description:** Top bar that scrolls with page
- **CSS:** `position: absolute; top: 0;` or normal flow at top
- **Use case:** Page headers without sticky behavior

### Position Settings

#### Content Width
- **Label:** "Content Width"
- **Slider control** with numeric value display
  - Default: 800px
  - Range: 200px - 2000px (or 100%)
  - Blue handle on gray track
  - Live preview updates

#### Alignment
- **Label:** "Alignment"
- **Segmented control** with 3 icon buttons:
  - **Left align** (⊣ icon)
  - **Center align** (≡ icon) - selected (blue)
  - **Right align** (⊢ icon)
- Applies to content within the width constraint

---

## ✅ Theme Tab Features (MUST IMPLEMENT)

### Theme Presets (4 Base + 10 Holiday)

#### Base Themes (First Row)
Visual cards with preview timers:

1. **Custom** (SELECTED)
   - Preview: Purple background with white timer (00:59:21)
   - Blue border indicates selection
   - Allows full customization below

2. **Light**
   - Preview: White/light background with blue timer
   - Click to apply preset

3. **Dark**
   - Preview: Dark gray/black background with white timer
   - Click to apply preset

4. **Gradient**
   - Preview: Blue-to-purple gradient background
   - Click to apply preset

#### Holiday Themes (Expandable - "See All" link)
Grid of themed presets (2 columns × 5 rows = 10 themes):

1. **Pastel** - Soft colors (light blue timer on white)
2. **Halloween** - Orange/black (00:00:00 in orange)
3. **Thanksgiving** - Warm autumn colors
4. **Black Friday** - Black/yellow high contrast (00:00:00 in yellow on black)
5. **Cyber Monday** - Purple theme
6. **Christmas** - Red/green festive
7. **New Year** - Red/white celebration
8. **Valentine's Day** - Pink/red romantic

**Implementation Note:** Start with 2-3 holiday themes in V1, expand later

### "Customize Theme" Button
Opens detailed customization panel (modal or expandable section)

---

### Theme Customization Panel

#### Color Settings
All use **color picker** component (same as LogoShowcase):

- **Background** - Color picker
  - Default: #7c3aed (purple)
  - Full color palette with HEX input

- **Heading Color** - Color picker
  - Default: #ffffff (white)
  - Applied to heading text

- **Timer Color** - Color picker
  - Default: #ffffff (white)
  - Applied to timer digits

- **Labels Color** - Color picker
  - Default: #ffffff (white)
  - Applied to "Hours", "Minutes", "Seconds" labels

- **Primary Button Color** - Color picker
  - Default: #22c55e (green)
  - Background color of CTA button

- **Primary Button Text Color** - Color picker
  - Default: #000000 (black)
  - Text color on CTA button

#### Corner Radius Settings
Visual segmented selector with 4 preset shapes:

- **Sharp corners** (□ icon) - 0px
- **Slightly rounded** (▢ icon) - 4px
- **Rounded** (▢ icon) - 8px (default, selected with curved icon)
- **Very rounded** (◯ icon) - 20px (pill shape)

Applied to: Timer boxes, buttons, container

#### Font Settings

- **Font** - Dropdown
  - Default: "Default"
  - Options: System fonts
  - ⚠️ **V1: Default only** (skip font library)

- **Heading Font Size** - Slider or numeric input
  - Default: 20px
  - Range: 12px - 72px

#### Size Settings

- **Timer Size** - Slider control
  - Visual slider with blue handle
  - Default: Medium (implied by position)
  - Range: Small (50%) - Large (150%)
  - Scales timer digits proportionally

- **Button Size** - Slider control
  - Similar slider interface
  - Default: Medium
  - Range: Small (80%) - Large (120%)

---

### Timer Style Selector (2 Options)

Visual cards showing timer display styles:

#### 1. Separated (Default - Left Card)
```
┌──┐ ┌──┐ ┌──┐
│00│ │00│ │00│
└──┘ └──┘ └──┘
```
- Individual boxes for each time unit
- Clear visual separation
- Padding/margin between boxes

#### 2. Inline (Right Card - SELECTED)
```
00 : 00 : 00
```
- Continuous horizontal layout
- Colon separators between units
- More compact appearance
- **Selected in screenshot** (blue border)

### Timer Display Settings

#### Animation
- **Dropdown selector**
  - Default: "None"
  - Options: None, Fade, Slide (⚠️ V1: None + Fade only)
  - Applied to digit changes

#### Separator
- **Dropdown selector**
  - Default: "None"
  - Options: None, Colon (:), Dash (-), Dot (·), Slash (/)
  - Only visible in Inline timer style

#### Time Format
- **Dropdown selector**
  - Default: "H:M:S" (Hours:Minutes:Seconds)
  - Options:
    - D:H:M (Days:Hours:Minutes)
    - D:H:M:S (Days:Hours:Minutes:Seconds) - **shown in screenshot**
    - H:M:S (Hours:Minutes:Seconds)
    - H:M (Hours:Minutes)
    - M:S (Minutes:Seconds)
  - Determines which units are displayed

#### Show Labels
- **Toggle switch**
  - Default: ON (blue toggle)
  - When ON: Shows "Hours", "Minutes", "Seconds" text below numbers
  - When OFF: Only shows numbers
  - **Shown as ON in screenshot**

---

## ✅ Settings Tab Features (PARTIAL)

### Google Analytics
- **Heading:** "Google Analytics"
- **"+ Add Event" button**
- **Description text:**
  - "Events let you track how visitors interact with your timer."
  - "Google Analytics or Google Tag Manager must be installed on your site."
  - "If both are present, events will be sent to each."
  - "For example, you can see how many visitors clicked the button or submitted the form."
- ⚠️ **Skip for V1** (analytics integration is <30% priority)

### Custom CSS
- **Heading:** "Custom CSS"
- **Code editor textarea**
  - Line numbers (1, 2, 3...)
  - Placeholder: "Enter your CSS Code..."
  - Syntax highlighting (implied)
- **Help text:** "Tip: It is recommended to use the CSS classes with the 'es' prefix..."
- **Footer:** "Missing the settings you need?" + "Request a Feature" link
- **Max length:** 10,000 chars
- ✅ **MUST IMPLEMENT**

---

## Complete Schema (All Core Features - 70%+)

```json
{
  "timer": {
    "type": "object",
    "properties": {
      "mode": {
        "type": "string",
        "enum": ["countdown_to_date", "personal_countdown", "number_counter"],
        "default": "personal_countdown",
        "description": "Timer mode"
      },
      "countdown_to_date": {
        "type": "object",
        "description": "Settings when mode=countdown_to_date",
        "properties": {
          "targetDate": {
            "type": "string",
            "format": "date",
            "description": "Target date (YYYY-MM-DD)"
          },
          "targetTime": {
            "type": "string",
            "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$",
            "description": "Target time (HH:MM in 24-hour format)"
          },
          "timezone": {
            "type": "string",
            "default": "browser",
            "description": "Timezone (IANA format or 'browser')"
          }
        },
        "required": ["targetDate", "targetTime"]
      },
      "personal_countdown": {
        "type": "object",
        "description": "Settings when mode=personal_countdown",
        "properties": {
          "timeAmount": {
            "type": "number",
            "minimum": 1,
            "maximum": 999,
            "default": 1
          },
          "timeUnit": {
            "type": "string",
            "enum": ["hours", "minutes", "days", "weeks", "months"],
            "default": "hours"
          },
          "repeat": {
            "type": "string",
            "enum": ["never", "1min", "5min", "1hour", "1day", "1week"],
            "default": "never",
            "description": "Repeat interval after countdown ends"
          }
        }
      },
      "number_counter": {
        "type": "object",
        "description": "Settings when mode=number_counter",
        "properties": {
          "targetNumber": {
            "type": "number",
            "minimum": 0,
            "maximum": 9999999,
            "default": 1000
          },
          "startingNumber": {
            "type": "number",
            "minimum": 0,
            "default": 0
          },
          "duration": {
            "type": "number",
            "minimum": 1,
            "maximum": 60,
            "default": 5,
            "description": "Animation duration in seconds"
          }
        }
      },
      "heading": {
        "type": "string",
        "maxLength": 500,
        "default": "Get 50% off before it's too late 🎯",
        "description": "Rich text heading (supports HTML)"
      }
    }
  },
  "actions": {
    "type": "object",
    "properties": {
      "duringCountdown": {
        "type": "array",
        "maxItems": 5,
        "items": {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "enum": ["link"],
              "description": "V1: link only. Future: form"
            },
            "buttonText": {
              "type": "string",
              "maxLength": 50,
              "default": "Purchase now"
            },
            "buttonLink": {
              "type": "string",
              "format": "uri",
              "default": ""
            },
            "buttonStyle": {
              "type": "string",
              "enum": ["primary", "secondary"],
              "default": "primary"
            },
            "openInNewTab": {
              "type": "boolean",
              "default": true
            }
          },
          "required": ["type", "buttonText"]
        }
      },
      "afterCountdownEnds": {
        "type": "array",
        "maxItems": 5,
        "items": {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "enum": ["hide_timer", "link"],
              "description": "Action type"
            },
            "buttonText": {
              "type": "string",
              "maxLength": 50,
              "description": "Only for type=link"
            },
            "buttonLink": {
              "type": "string",
              "format": "uri",
              "description": "Only for type=link"
            },
            "buttonStyle": {
              "type": "string",
              "enum": ["primary", "secondary"],
              "default": "primary",
              "description": "Only for type=link"
            },
            "openInNewTab": {
              "type": "boolean",
              "default": true,
              "description": "Only for type=link"
            }
          },
          "required": ["type"]
        }
      }
    }
  },
  "position": {
    "type": "object",
    "properties": {
      "layout": {
        "type": "string",
        "enum": ["inline", "full_width_section", "top_bar", "bottom_bar", "static_top_bar"],
        "default": "full_width_section"
      },
      "contentWidth": {
        "type": "number",
        "minimum": 200,
        "maximum": 2000,
        "default": 800,
        "description": "Content width in pixels"
      },
      "alignment": {
        "type": "string",
        "enum": ["left", "center", "right"],
        "default": "center"
      }
    }
  },
  "theme": {
    "type": "object",
    "properties": {
      "preset": {
        "type": "string",
        "enum": ["custom", "light", "dark", "gradient", "pastel", "halloween", "thanksgiving", "black_friday", "cyber_monday", "christmas", "new_year", "valentines"],
        "default": "custom",
        "description": "Theme preset (custom allows full customization)"
      },
      "colors": {
        "type": "object",
        "properties": {
          "background": {
            "type": "string",
            "pattern": "^#[0-9A-Fa-f]{6}$",
            "default": "#7c3aed"
          },
          "heading": {
            "type": "string",
            "pattern": "^#[0-9A-Fa-f]{6}$",
            "default": "#ffffff"
          },
          "timer": {
            "type": "string",
            "pattern": "^#[0-9A-Fa-f]{6}$",
            "default": "#ffffff"
          },
          "labels": {
            "type": "string",
            "pattern": "^#[0-9A-Fa-f]{6}$",
            "default": "#ffffff"
          },
          "primaryButton": {
            "type": "string",
            "pattern": "^#[0-9A-Fa-f]{6}$",
            "default": "#22c55e"
          },
          "primaryButtonText": {
            "type": "string",
            "pattern": "^#[0-9A-Fa-f]{6}$",
            "default": "#000000"
          }
        }
      },
      "cornerRadius": {
        "type": "number",
        "enum": [0, 4, 8, 20],
        "default": 8,
        "description": "Corner radius in pixels (0=sharp, 4=slight, 8=rounded, 20=pill)"
      },
      "font": {
        "type": "string",
        "default": "default",
        "description": "V1: default only. Future: font library"
      },
      "headingFontSize": {
        "type": "number",
        "minimum": 12,
        "maximum": 72,
        "default": 20
      },
      "timerSize": {
        "type": "number",
        "minimum": 50,
        "maximum": 150,
        "default": 100,
        "description": "Timer size as percentage of base"
      },
      "buttonSize": {
        "type": "number",
        "minimum": 80,
        "maximum": 120,
        "default": 100,
        "description": "Button size as percentage of base"
      },
      "timerStyle": {
        "type": "string",
        "enum": ["separated", "inline"],
        "default": "separated",
        "description": "Timer display style"
      },
      "animation": {
        "type": "string",
        "enum": ["none", "fade"],
        "default": "none",
        "description": "V1: none + fade only. Future: slide"
      },
      "separator": {
        "type": "string",
        "enum": ["none", "colon", "dash", "dot", "slash"],
        "default": "none",
        "description": "Only visible when timerStyle=inline"
      },
      "timeFormat": {
        "type": "string",
        "enum": ["D:H:M", "D:H:M:S", "H:M:S", "H:M", "M:S"],
        "default": "H:M:S",
        "description": "Which time units to display"
      },
      "showLabels": {
        "type": "boolean",
        "default": true,
        "description": "Show 'Hours', 'Minutes', 'Seconds' labels"
      }
    }
  },
  "settings": {
    "type": "object",
    "properties": {
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
Vertical stack of four Dieter icon buttons:

| Icon | `activeMenu` value | Purpose |
| :--- | :--- | :--- |
| `clock` | `timer` | Timer mode, date/time, heading |
| `link` | `actions` | Button actions (during/after countdown) |
| `square.grid.2x2` | `position` | Layout position, width, alignment |
| `paintpalette` | `theme` | Colors, fonts, timer style, animations |
| `gear` | `settings` | Custom CSS (skip Analytics for V1) |

---

### `tdmenucontent` Panels (Detailed TSX Examples)

#### Timer Panel (`activeMenu === 'timer'`)
```tsx
<>
  <div className="heading-3">Timer</div>
  <div className="stack">
    {/* Timer Mode Selector */}
    <div className="mode-grid">
      <button
        className={`mode-card ${instanceData.timer.mode === 'countdown_to_date' ? 'selected' : ''}`}
        onClick={() => setMode('countdown_to_date')}
      >
        <div className="mode-icon">📅</div>
        <div className="mode-label">Countdown to Date</div>
        <div className="mode-desc">Count down to a specific date</div>
      </button>

      <button
        className={`mode-card ${instanceData.timer.mode === 'personal_countdown' ? 'selected' : ''}`}
        onClick={() => setMode('personal_countdown')}
      >
        <div className="mode-icon">👤</div>
        <div className="mode-label">Personal Countdown</div>
        <div className="mode-desc">Starts for each visitor</div>
        {instanceData.timer.mode === 'personal_countdown' && <div className="checkmark">✓</div>}
      </button>

      <button
        className={`mode-card ${instanceData.timer.mode === 'number_counter' ? 'selected' : ''}`}
        onClick={() => setMode('number_counter')}
      >
        <div className="mode-icon">🔢</div>
        <div className="mode-label">Number Counter</div>
        <div className="mode-desc">Count up to a target number</div>
      </button>
    </div>

    {/* Countdown to Date Settings */}
    {instanceData.timer.mode === 'countdown_to_date' && (
      <>
        <label className="diet-input" data-size="lg">
          <span className="diet-input__label">Target Date</span>
          <div className="diet-input__inner">
            <input
              type="date"
              className="diet-input__field"
              value={instanceData.timer.countdown_to_date.targetDate}
              ...
            />
          </div>
        </label>

        <label className="diet-input" data-size="lg">
          <span className="diet-input__label">Target Time</span>
          <div className="diet-input__inner">
            <input
              type="time"
              className="diet-input__field"
              value={instanceData.timer.countdown_to_date.targetTime}
              ...
            />
          </div>
        </label>

        <label className="diet-input" data-size="lg">
          <span className="diet-input__label">Timezone</span>
          <select className="diet-dropdown" value={instanceData.timer.countdown_to_date.timezone} ...>
            <option value="browser">User's Browser Timezone</option>
            <option value="America/New_York">EST (New York)</option>
            <option value="America/Los_Angeles">PST (Los Angeles)</option>
            <option value="UTC">UTC</option>
            {/* ... more timezones */}
          </select>
        </label>
      </>
    )}

    {/* Personal Countdown Settings */}
    {instanceData.timer.mode === 'personal_countdown' && (
      <>
        <label className="diet-input" data-size="lg">
          <span className="diet-input__label">Time Amount</span>
          <div className="diet-input__inner">
            <input
              type="number"
              className="diet-input__field"
              min="1"
              max="999"
              value={instanceData.timer.personal_countdown.timeAmount}
              ...
            />
          </div>
        </label>

        <label className="diet-input" data-size="lg">
          <span className="diet-input__label">Time Unit</span>
          <select className="diet-dropdown" value={instanceData.timer.personal_countdown.timeUnit} ...>
            <option value="hours">Hours</option>
            <option value="minutes">Minutes</option>
            <option value="days">Days</option>
            <option value="weeks">Weeks</option>
            <option value="months">Months</option>
          </select>
        </label>

        {/* Repeat Expander */}
        <div className="diet-expander" data-size="lg">
          <input type="checkbox" className="diet-expander__input" id="repeat-settings" />
          <label className="diet-expander__trigger diet-btn" htmlFor="repeat-settings">
            <span className="diet-btn__label">Repeat</span>
            <span className="diet-btn__icon">›</span>
          </label>
          <div className="diet-expander__content">
            <label className="diet-input" data-size="lg">
              <span className="diet-input__label">Every</span>
              <select className="diet-dropdown" value={instanceData.timer.personal_countdown.repeat} ...>
                <option value="never">Never</option>
                <option value="1min">1 minute</option>
                <option value="5min">5 minutes</option>
                <option value="1hour">1 hour</option>
                <option value="1day">1 day</option>
                <option value="1week">1 week</option>
              </select>
            </label>
            <p className="text-sm text-muted">Reset the countdown after it finishes</p>
          </div>
        </div>
      </>
    )}

    {/* Number Counter Settings */}
    {instanceData.timer.mode === 'number_counter' && (
      <>
        <label className="diet-input" data-size="lg">
          <span className="diet-input__label">Target Number</span>
          <div className="diet-input__inner">
            <input
              type="number"
              className="diet-input__field"
              min="0"
              max="9999999"
              value={instanceData.timer.number_counter.targetNumber}
              ...
            />
          </div>
        </label>

        <label className="diet-input" data-size="lg">
          <span className="diet-input__label">Starting Number</span>
          <div className="diet-input__inner">
            <input
              type="number"
              className="diet-input__field"
              min="0"
              value={instanceData.timer.number_counter.startingNumber}
              ...
            />
          </div>
        </label>

        <label className="diet-input" data-size="lg">
          <span className="diet-input__label">Count Duration (seconds)</span>
          <div className="diet-input__inner">
            <input
              type="number"
              className="diet-input__field"
              min="1"
              max="60"
              value={instanceData.timer.number_counter.duration}
              ...
            />
          </div>
        </label>
      </>
    )}

    {/* Heading Rich Text Editor */}
    <div>
      <label className="diet-input__label">Heading</label>
      <div className="rich-text-editor">
        <div className="toolbar">
          <button className="toolbar-btn" title="Bold"><strong>B</strong></button>
          <button className="toolbar-btn" title="Italic"><em>I</em></button>
          <button className="toolbar-btn" title="Link">🔗</button>
          <button className="toolbar-btn" title="Bullet List">≡</button>
          <button className="toolbar-btn" title="Numbered List">≡</button>
          <button className="toolbar-btn" title="More">⋯</button>
          <button className="toolbar-btn" title="Code View">&lt;&gt;</button>
          <button className="toolbar-btn" title="Fullscreen">⛶</button>
        </div>
        <div
          className="editor-content"
          contentEditable
          dangerouslySetInnerHTML={{ __html: instanceData.timer.heading }}
          onInput={handleHeadingChange}
        />
      </div>
    </div>
  </div>
</>
```

#### Actions Panel (`activeMenu === 'actions'`)
```tsx
<>
  <div className="heading-3">Actions</div>
  <div className="stack">
    {/* DURING COUNTDOWN Section */}
    <div className="action-section">
      <h4 className="heading-4">DURING COUNTDOWN</h4>

      {instanceData.actions.duringCountdown.map((action, idx) => (
        <div key={idx} className="action-card">
          <div className="action-header">
            <span className="action-icon">🔗</span>
            <span className="action-type">Link</span>
            <button className="action-menu">⋯</button>
          </div>
          <div className="action-details">
            <a href={action.buttonLink} className="action-link">{action.buttonLink}</a>
          </div>
        </div>
      ))}

      <button className="diet-btn" data-variant="neutral" onClick={openActionModal('during')}>
        <span className="diet-btn__label">+ Add Action</span>
      </button>
    </div>

    {/* AFTER COUNTDOWN ENDS Section */}
    <div className="action-section">
      <h4 className="heading-4">AFTER COUNTDOWN ENDS</h4>

      {instanceData.actions.afterCountdownEnds.map((action, idx) => (
        <div key={idx} className="action-card">
          <div className="action-header">
            <span className="action-icon">{action.type === 'hide_timer' ? '👁️‍🗨️' : '🔗'}</span>
            <span className="action-type">{action.type === 'hide_timer' ? 'Hide Timer' : 'Link'}</span>
            <button className="action-menu">⋯</button>
          </div>
          {action.type === 'hide_timer' && (
            <p className="action-desc">Remove the timer after it finishes</p>
          )}
          {action.type === 'link' && (
            <div className="action-details">
              <a href={action.buttonLink} className="action-link">{action.buttonLink}</a>
            </div>
          )}
        </div>
      ))}

      <button className="diet-btn" data-variant="neutral" onClick={openActionModal('after')}>
        <span className="diet-btn__label">+ Add Action</span>
      </button>
    </div>
  </div>

  {/* Action Modal (shown when adding action) */}
  {showActionModal && (
    <div className="modal">
      <div className="modal-header">
        <button onClick={() => setShowActionModal(false)}>Cancel</button>
        <h3>Choose Action</h3>
        <button onClick={saveAction}>Done</button>
      </div>
      <div className="modal-content">
        <button className="action-choice-card" onClick={() => selectActionType('link')}>
          <span className="action-choice-icon">🔗</span>
          <span className="action-choice-label">Link</span>
          <p className="action-choice-desc">Redirect visitors to a chosen URL</p>
        </button>
        {/* Form action - disabled for V1 */}
        <button className="action-choice-card disabled" title="Coming in V2">
          <span className="action-choice-icon">📋</span>
          <span className="action-choice-label">Form</span>
          <p className="action-choice-desc">Open a form to collect user data</p>
        </button>
      </div>
    </div>
  )}

  {/* Link Configuration (when editing link action) */}
  {editingAction && editingAction.type === 'link' && (
    <div className="action-config">
      <label className="diet-input" data-size="lg">
        <span className="diet-input__label">Button Link</span>
        <div className="diet-input__inner">
          <input
            className="diet-input__field"
            type="url"
            value={editingAction.buttonLink}
            ...
          />
          <button className="input-icon-btn" onClick={openAdvancedLinkSettings}>⚙️</button>
        </div>
      </label>

      <label className="diet-input" data-size="lg">
        <span className="diet-input__label">Button Text</span>
        <div className="diet-input__inner">
          <input
            className="diet-input__field"
            type="text"
            value={editingAction.buttonText}
            ...
          />
        </div>
      </label>

      <label className="diet-input" data-size="lg">
        <span className="diet-input__label">Button Style</span>
        <select className="diet-dropdown" value={editingAction.buttonStyle} ...>
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
        </select>
      </label>
    </div>
  )}
</>
```

#### Position Panel (`activeMenu === 'position'`)
```tsx
<>
  <div className="heading-3">Position</div>
  <div className="stack">
    {/* Position Layout Selector */}
    <div className="position-grid">
      <button
        className={`position-card ${instanceData.position.layout === 'inline' ? 'selected' : ''}`}
        onClick={() => setLayout('inline')}
      >
        <div className="position-preview">
          {/* SVG preview of inline layout */}
        </div>
        <span className="position-label">Inline</span>
      </button>

      <button
        className={`position-card ${instanceData.position.layout === 'full_width_section' ? 'selected' : ''}`}
        onClick={() => setLayout('full_width_section')}
      >
        <div className="position-preview">
          {/* SVG preview of full-width section */}
        </div>
        <span className="position-label">Full-width Section</span>
      </button>

      <button
        className={`position-card ${instanceData.position.layout === 'top_bar' ? 'selected' : ''}`}
        onClick={() => setLayout('top_bar')}
      >
        <div className="position-preview">
          {/* SVG preview of top bar */}
        </div>
        <span className="position-label">Top Bar</span>
      </button>

      <button
        className={`position-card ${instanceData.position.layout === 'bottom_bar' ? 'selected' : ''}`}
        onClick={() => setLayout('bottom_bar')}
      >
        <div className="position-preview">
          {/* SVG preview of bottom bar */}
        </div>
        <span className="position-label">Bottom Bar</span>
      </button>

      <button
        className={`position-card ${instanceData.position.layout === 'static_top_bar' ? 'selected' : ''}`}
        onClick={() => setLayout('static_top_bar')}
      >
        <div className="position-preview">
          {/* SVG preview of static top bar */}
        </div>
        <span className="position-label">Static Top Bar</span>
      </button>
    </div>

    {/* Content Width */}
    <label className="diet-input" data-size="lg">
      <span className="diet-input__label">Content Width: {instanceData.position.contentWidth}px</span>
      <input
        type="range"
        min="200"
        max="2000"
        value={instanceData.position.contentWidth}
        ...
      />
    </label>

    {/* Alignment */}
    <label className="diet-input" data-size="lg">
      <span className="diet-input__label">Alignment</span>
      <div className="diet-segmented" data-size="md" role="group">
        <label className="diet-segment">
          <input type="radio" name="alignment" value="left" checked={instanceData.position.alignment === 'left'} ... />
          <span className="diet-segment__surface" />
          <span className="diet-segment__label">⊣</span>
        </label>
        <label className="diet-segment">
          <input type="radio" name="alignment" value="center" checked={instanceData.position.alignment === 'center'} ... />
          <span className="diet-segment__surface" />
          <span className="diet-segment__label">≡</span>
        </label>
        <label className="diet-segment">
          <input type="radio" name="alignment" value="right" checked={instanceData.position.alignment === 'right'} ... />
          <span className="diet-segment__surface" />
          <span className="diet-segment__label">⊢</span>
        </label>
      </div>
    </label>
  </div>
</>
```

#### Theme Panel (`activeMenu === 'theme'`)
```tsx
<>
  <div className="heading-3">Theme</div>
  <div className="stack">
    {/* Theme Presets */}
    <div>
      <div className="section-header">
        <span className="diet-input__label">Theme</span>
        <button className="link-btn" onClick={showAllThemes}>See All</button>
      </div>

      <div className="theme-grid">
        <button
          className={`theme-card ${instanceData.theme.preset === 'custom' ? 'selected' : ''}`}
          onClick={() => setThemePreset('custom')}
        >
          <div className="theme-preview" style={{ background: '#7c3aed' }}>
            <div className="timer-preview">00:59:21</div>
          </div>
          <span className="theme-label">Custom</span>
        </button>

        <button
          className={`theme-card ${instanceData.theme.preset === 'light' ? 'selected' : ''}`}
          onClick={() => setThemePreset('light')}
        >
          <div className="theme-preview" style={{ background: '#ffffff' }}>
            <div className="timer-preview" style={{ color: '#3b82f6' }}>00:00:00</div>
          </div>
          <span className="theme-label">Light</span>
        </button>

        <button
          className={`theme-card ${instanceData.theme.preset === 'dark' ? 'selected' : ''}`}
          onClick={() => setThemePreset('dark')}
        >
          <div className="theme-preview" style={{ background: '#1f2937' }}>
            <div className="timer-preview" style={{ color: '#ffffff' }}>00:00:00</div>
          </div>
          <span className="theme-label">Dark</span>
        </button>

        <button
          className={`theme-card ${instanceData.theme.preset === 'gradient' ? 'selected' : ''}`}
          onClick={() => setThemePreset('gradient')}
        >
          <div className="theme-preview" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <div className="timer-preview" style={{ color: '#ffffff' }}>00:00:00</div>
          </div>
          <span className="theme-label">Gradient</span>
        </button>
      </div>
    </div>

    {/* Customize Theme Button */}
    <button className="diet-btn" data-variant="neutral" data-size="lg" onClick={openThemeCustomizer}>
      <span className="diet-btn__label">Customize Theme</span>
    </button>

    {/* Theme Customization (expandable) */}
    {showThemeCustomizer && (
      <>
        {/* Colors */}
        <div className="theme-section">
          <h4 className="heading-4">COLORS</h4>

          <div>
            <label className="diet-input__label">Background</label>
            <ColorPicker value={instanceData.theme.colors.background} onChange={...} />
          </div>

          <div>
            <label className="diet-input__label">Heading Color</label>
            <ColorPicker value={instanceData.theme.colors.heading} onChange={...} />
          </div>

          <div>
            <label className="diet-input__label">Timer Color</label>
            <ColorPicker value={instanceData.theme.colors.timer} onChange={...} />
          </div>

          <div>
            <label className="diet-input__label">Labels Color</label>
            <ColorPicker value={instanceData.theme.colors.labels} onChange={...} />
          </div>

          <div>
            <label className="diet-input__label">Primary Button Color</label>
            <ColorPicker value={instanceData.theme.colors.primaryButton} onChange={...} />
          </div>

          <div>
            <label className="diet-input__label">Primary Button Text Color</label>
            <ColorPicker value={instanceData.theme.colors.primaryButtonText} onChange={...} />
          </div>
        </div>

        {/* Corner Radius */}
        <div className="theme-section">
          <label className="diet-input__label">Corner Radius</label>
          <div className="corner-radius-selector">
            <button
              className={`corner-btn ${instanceData.theme.cornerRadius === 0 ? 'selected' : ''}`}
              onClick={() => setCornerRadius(0)}
            >
              <span className="corner-icon">□</span>
            </button>
            <button
              className={`corner-btn ${instanceData.theme.cornerRadius === 4 ? 'selected' : ''}`}
              onClick={() => setCornerRadius(4)}
            >
              <span className="corner-icon">▢</span>
            </button>
            <button
              className={`corner-btn ${instanceData.theme.cornerRadius === 8 ? 'selected' : ''}`}
              onClick={() => setCornerRadius(8)}
            >
              <span className="corner-icon curved">▢</span>
            </button>
            <button
              className={`corner-btn ${instanceData.theme.cornerRadius === 20 ? 'selected' : ''}`}
              onClick={() => setCornerRadius(20)}
            >
              <span className="corner-icon">◯</span>
            </button>
          </div>
        </div>

        {/* Font & Sizes */}
        <label className="diet-input" data-size="lg">
          <span className="diet-input__label">Font</span>
          <select className="diet-dropdown" disabled>
            <option value="default">Default</option>
          </select>
          <p className="text-sm text-muted">Font library coming in V2</p>
        </label>

        <label className="diet-input" data-size="lg">
          <span className="diet-input__label">Heading Font Size: {instanceData.theme.headingFontSize}px</span>
          <input type="range" min="12" max="72" value={instanceData.theme.headingFontSize} ... />
        </label>

        <label className="diet-input" data-size="lg">
          <span className="diet-input__label">Timer Size</span>
          <input type="range" min="50" max="150" value={instanceData.theme.timerSize} ... />
        </label>

        <label className="diet-input" data-size="lg">
          <span className="diet-input__label">Button Size</span>
          <input type="range" min="80" max="120" value={instanceData.theme.buttonSize} ... />
        </label>
      </>
    )}

    {/* Timer Style */}
    <div>
      <label className="diet-input__label">Timer Style</label>
      <div className="timer-style-grid">
        <button
          className={`timer-style-card ${instanceData.theme.timerStyle === 'separated' ? 'selected' : ''}`}
          onClick={() => setTimerStyle('separated')}
        >
          <div className="timer-style-preview">
            <div className="box">00</div>
            <div className="box">00</div>
            <div className="box">00</div>
          </div>
        </button>

        <button
          className={`timer-style-card ${instanceData.theme.timerStyle === 'inline' ? 'selected' : ''}`}
          onClick={() => setTimerStyle('inline')}
        >
          <div className="timer-style-preview inline">
            00 : 00 : 00
          </div>
        </button>
      </div>
    </div>

    {/* Timer Settings */}
    <label className="diet-input" data-size="lg">
      <span className="diet-input__label">Animation</span>
      <select className="diet-dropdown" value={instanceData.theme.animation} ...>
        <option value="none">None</option>
        <option value="fade">Fade</option>
      </select>
    </label>

    <label className="diet-input" data-size="lg">
      <span className="diet-input__label">Separator</span>
      <select className="diet-dropdown" value={instanceData.theme.separator} ...>
        <option value="none">None</option>
        <option value="colon">Colon (:)</option>
        <option value="dash">Dash (-)</option>
        <option value="dot">Dot (·)</option>
        <option value="slash">Slash (/)</option>
      </select>
    </label>

    <label className="diet-input" data-size="lg">
      <span className="diet-input__label">Time Format</span>
      <select className="diet-dropdown" value={instanceData.theme.timeFormat} ...>
        <option value="D:H:M">D:H:M (Days:Hours:Minutes)</option>
        <option value="D:H:M:S">D:H:M:S (Days:Hours:Minutes:Seconds)</option>
        <option value="H:M:S">H:M:S (Hours:Minutes:Seconds)</option>
        <option value="H:M">H:M (Hours:Minutes)</option>
        <option value="M:S">M:S (Minutes:Seconds)</option>
      </select>
    </label>

    <label className="diet-toggle" data-size="lg">
      <input type="checkbox" className="diet-toggle__input" checked={instanceData.theme.showLabels} ... />
      <span className="diet-toggle__track" />
      <span className="diet-toggle__label">Show Labels</span>
    </label>
  </div>
</>
```

#### Settings Panel (`activeMenu === 'settings'`)
```tsx
<>
  <div className="heading-3">Settings</div>
  <div className="stack">
    {/* Google Analytics - Skip for V1 */}
    <div className="settings-section disabled">
      <h4 className="heading-4">Google Analytics</h4>
      <button className="diet-btn" data-variant="neutral" disabled>
        <span className="diet-btn__label">+ Add Event</span>
      </button>
      <p className="text-sm text-muted">Coming in V2</p>
    </div>

    {/* Custom CSS */}
    <div className="settings-section">
      <h4 className="heading-4">Custom CSS</h4>
      <textarea
        className="code-editor"
        value={instanceData.settings.customCSS}
        placeholder="Enter your CSS Code..."
        rows={15}
        ...
      />
      <p className="text-sm text-muted">
        Tip: It is recommended to use the CSS classes with the 'es' prefix,
        as these are specially designed for stable customization.
      </p>
    </div>

    {/* Footer */}
    <div className="settings-footer">
      <p className="text-sm">Missing the settings you need?</p>
      <button className="link-btn">Request a Feature</button>
    </div>
  </div>
</>
```

---

## SSR Rendering Strategy

### Personal Countdown Timer (Default - Full-width Section)
```html
<div class="countdown-timer" data-layout="full_width_section" data-widget-type="countdown">
  <style>
    .countdown-timer {
      --ct-bg-color: #7c3aed;
      --ct-heading-color: #ffffff;
      --ct-timer-color: #ffffff;
      --ct-labels-color: #ffffff;
      --ct-button-bg: #22c55e;
      --ct-button-text: #000000;
      --ct-corner-radius: 8px;
      --ct-heading-size: 20px;
      --ct-timer-size: 100%;
      --ct-button-size: 100%;
      --ct-content-width: 800px;
      --ct-alignment: center;
    }

    .countdown-timer {
      background-color: var(--ct-bg-color);
      padding: 40px 20px;
      width: 100%;
    }

    .ct-container {
      max-width: var(--ct-content-width);
      margin: 0 auto;
      text-align: var(--ct-alignment);
    }

    .ct-heading {
      font-size: var(--ct-heading-size);
      color: var(--ct-heading-color);
      margin: 0 0 24px 0;
    }

    .ct-timer {
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-bottom: 24px;
      font-size: calc(48px * var(--ct-timer-size) / 100);
    }

    .ct-timer-unit {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .ct-timer-box {
      background: rgba(255, 255, 255, 0.1);
      border-radius: var(--ct-corner-radius);
      padding: 16px 20px;
      min-width: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .ct-timer-digits {
      color: var(--ct-timer-color);
      font-weight: bold;
      font-size: 1em;
      line-height: 1;
    }

    .ct-timer-label {
      color: var(--ct-labels-color);
      font-size: 0.3em;
      margin-top: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .ct-button {
      display: inline-block;
      padding: calc(12px * var(--ct-button-size) / 100) calc(24px * var(--ct-button-size) / 100);
      background-color: var(--ct-button-bg);
      color: var(--ct-button-text);
      text-decoration: none;
      border-radius: var(--ct-corner-radius);
      font-weight: 600;
      transition: opacity 0.2s;
    }

    .ct-button:hover {
      opacity: 0.9;
    }

    /* Full-width section specific */
    .countdown-timer[data-layout="full_width_section"] {
      width: 100vw;
      position: relative;
      left: 50%;
      right: 50%;
      margin-left: -50vw;
      margin-right: -50vw;
    }

    /* Top bar specific */
    .countdown-timer[data-layout="top_bar"] {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 9999;
      padding: 12px 20px;
    }

    /* Bottom bar specific */
    .countdown-timer[data-layout="bottom_bar"] {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 9999;
      padding: 12px 20px;
    }

    /* Inline timer style */
    .ct-timer.inline {
      font-size: calc(48px * var(--ct-timer-size) / 100);
    }

    .ct-timer.inline .ct-timer-digits::after {
      content: ':';
      margin: 0 8px;
    }

    .ct-timer.inline .ct-timer-unit:last-child .ct-timer-digits::after {
      content: '';
    }

    /* Fade animation */
    @keyframes fade-digit {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    .ct-timer-digits.animating {
      animation: fade-digit 0.3s ease-in-out;
    }
  </style>

  <div class="ct-container" data-widget-element="container">
    <!-- Heading -->
    <h2 class="ct-heading" data-widget-element="heading">
      Get 50% off before it's too late 🎯
    </h2>

    <!-- Timer (Separated Style) -->
    <div class="ct-timer" data-widget-element="timer" data-timer-style="separated">
      <div class="ct-timer-unit">
        <div class="ct-timer-box">
          <span class="ct-timer-digits" data-timer-hours>00</span>
        </div>
        <span class="ct-timer-label">Hours</span>
      </div>

      <div class="ct-timer-unit">
        <div class="ct-timer-box">
          <span class="ct-timer-digits" data-timer-minutes>59</span>
        </div>
        <span class="ct-timer-label">Minutes</span>
      </div>

      <div class="ct-timer-unit">
        <div class="ct-timer-box">
          <span class="ct-timer-digits" data-timer-seconds>21</span>
        </div>
        <span class="ct-timer-label">Seconds</span>
      </div>
    </div>

    <!-- CTA Button -->
    <a href="https://example.com" class="ct-button" data-widget-element="button" target="_blank">
      Purchase now
    </a>
  </div>

  <!-- Timer JavaScript (minimal - ~2KB) -->
  <script>
    (function() {
      const timerEl = document.querySelector('[data-widget-element="timer"]');
      const hoursEl = timerEl.querySelector('[data-timer-hours]');
      const minutesEl = timerEl.querySelector('[data-timer-minutes]');
      const secondsEl = timerEl.querySelector('[data-timer-seconds]');

      // Personal countdown: starts when page loads
      // Store start time in localStorage for persistence
      const storageKey = 'countdown_start_' + 'INSTANCE_ID';
      let startTime = localStorage.getItem(storageKey);

      if (!startTime) {
        startTime = Date.now();
        localStorage.setItem(storageKey, startTime);
      }

      const duration = 1 * 60 * 60 * 1000; // 1 hour in ms
      const endTime = parseInt(startTime) + duration;

      function updateTimer() {
        const now = Date.now();
        const remaining = Math.max(0, endTime - now);

        if (remaining === 0) {
          // Countdown ended - trigger "after countdown ends" action
          const containerEl = document.querySelector('[data-widget-element="container"]');
          containerEl.style.display = 'none'; // Hide timer action
          return;
        }

        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

        hoursEl.textContent = String(hours).padStart(2, '0');
        minutesEl.textContent = String(minutes).padStart(2, '0');
        secondsEl.textContent = String(seconds).padStart(2, '0');

        requestAnimationFrame(updateTimer);
      }

      updateTimer();
    })();
  </script>
</div>
```

### Inline Timer Style Variant
```html
<!-- Timer (Inline Style with Colon Separator) -->
<div class="ct-timer inline" data-widget-element="timer" data-timer-style="inline">
  <span class="ct-timer-digits" data-timer-hours>00</span>
  <span class="ct-separator">:</span>
  <span class="ct-timer-digits" data-timer-minutes>59</span>
  <span class="ct-separator">:</span>
  <span class="ct-timer-digits" data-timer-seconds>21</span>
</div>

<!-- Labels below (if showLabels=true) -->
<div class="ct-timer-labels">
  <span class="ct-timer-label">Hours</span>
  <span class="ct-timer-label">Minutes</span>
  <span class="ct-timer-label">Seconds</span>
</div>
```

---

## Performance Targets

| Metric | Elfsight | Clickeen | Improvement |
|--------|----------|----------|-------------|
| Initial HTML | ~2KB | ~5KB | Acceptable (SSR timer) |
| JavaScript | 80KB | 2KB (timer logic only) | 78KB smaller |
| First Paint | ~1.5s | ~200ms | 7.5x faster |
| Interactive | ~2s | Instant | No hydration needed |
| SEO | Delayed crawl | Immediate | 100% SSR |
| Timer accuracy | ±500ms | ±16ms (RAF) | More precise |

---

## Implementation Phases

### Phase 1: Timer Core & Modes (4-5 days)
- [ ] Schema implementation in Supabase
- [ ] Venice SSR renderer base structure (TBD; current Venice is debug shell in this repo snapshot)
- [ ] Personal Countdown mode (localStorage persistence)
- [ ] Countdown to Date mode (timezone support)
- [ ] Number Counter mode (count-up animation)
- [ ] Timer JavaScript (<2KB) with requestAnimationFrame
- [ ] Heading rich text editor in Bob
- [ ] Timer configuration UI (Timer panel)

### Phase 2: Actions & Position (3-4 days)
- [ ] Actions panel UI (during/after sections)
- [ ] Link action configuration
- [ ] "Hide Timer" action (after countdown ends)
- [ ] Advanced link settings (new tab toggle)
- [ ] Position layout selector (5 options)
- [ ] Position CSS for each layout (inline, bars, sections)
- [ ] Content width & alignment controls

### Phase 3: Theme & Styling (4-5 days)
- [ ] Theme preset selector (4 base themes)
- [ ] Holiday theme library (2-3 initial themes)
- [ ] Theme customizer panel (colors, sizes, fonts)
- [ ] Color pickers (reuse from LogoShowcase)
- [ ] Corner radius selector (4 options)
- [ ] Timer style selector (separated vs inline)
- [ ] Animation dropdown (none, fade)
- [ ] Separator dropdown (colon, dash, etc.)
- [ ] Time format dropdown (D:H:M:S variations)
- [ ] Show labels toggle

### Phase 4: Polish & Advanced (2-3 days)
- [ ] Repeat countdown functionality
- [ ] Timer size & button size sliders
- [ ] Heading font size control
- [ ] Custom CSS textarea
- [ ] Button style selector (primary/secondary)
- [ ] Multiple actions support (reorder, delete)
- [ ] Fade animation implementation

### Phase 5: Preview & Testing (2 days)
- [ ] postMessage patches for all settings
  - CSS variables for colors, sizes
  - Timer mode switching (re-render)
  - Position layout switching
- [ ] Smooth preview updates (debounced)
- [ ] Timer accuracy testing (RAF precision)
- [ ] Timezone handling (edge cases)
- [ ] localStorage persistence testing
- [ ] Accessibility review (WCAG AA)

**Total: 15-19 days for 70%+ feature coverage**

---

## Success Criteria

### Core Features (70%+ Elfsight Parity)
✅ **3 timer modes** (Countdown to Date, Personal, Number Counter)
✅ **Complete timer config** (date/time, duration, units, repeat)
✅ **Rich text heading** (HTML formatting, emojis)
✅ **CTA button actions** (Link during/after, Hide Timer)
✅ **5 position layouts** (Inline, Full-width, Top/Bottom/Static bars)
✅ **4 base themes + holiday themes** (Custom, Light, Dark, Gradient)
✅ **2 timer styles** (Separated boxes, Inline with separators)
✅ **Complete customization** (colors, fonts, sizes, corner radius)
✅ **Time format control** (show/hide days/hours/minutes/seconds, labels)
✅ **Custom CSS** support
✅ **<6KB initial load** (vs 80KB+)
✅ **<200ms LCP** on mobile 3G
✅ **100% SSR** for SEO
✅ **Instant preview** via postMessage

---

## What We Match/Exceed vs Elfsight

### Match Elfsight (70%+ Core):
- ✅ 3 timer modes (Countdown to Date, Personal, Number Counter)
- ✅ Date/time picker with timezone support
- ✅ Duration config (amount + unit)
- ✅ Repeat countdown functionality
- ✅ Rich text heading editor
- ✅ Button actions (Link during/after, Hide Timer)
- ✅ Advanced link settings (new tab)
- ✅ 5 position layouts
- ✅ Content width & alignment controls
- ✅ 4 base themes + holiday themes
- ✅ Full color customization (6 color pickers)
- ✅ Corner radius presets (4 options)
- ✅ Timer styles (separated/inline)
- ✅ Animations (fade)
- ✅ Separators (colon, dash, dot, slash)
- ✅ Time format (D:H:M:S variations)
- ✅ Show/hide labels
- ✅ Timer/button/heading size controls
- ✅ Custom CSS

### Exceed Elfsight (Performance):
- ✨ **40x smaller** bundle (2KB vs 80KB)
- ✨ **7.5x faster** first paint (200ms vs 1.5s)
- ✨ **Works without JS** (static timer at load)
- ✨ **Perfect SEO** (no client rendering delay)
- ✨ **No 3rd party scripts** (privacy by default)
- ✨ **More precise** timer (RAF vs setInterval)
- ✨ **Instant preview updates** (postMessage patches)

### Skip for V1 (<30% Optional):
- ⚠️ Form action (open form modal)
- ⚠️ Google Analytics events tracking
- ⚠️ Custom JS (CSS only)
- ⚠️ Advanced animations (slide, bounce)
- ⚠️ Full holiday theme library (start with 2-3)
- ⚠️ Font library (use default only)

---

## For AIs Implementing This

**Critical references:**
Tokenization patterns
- `documentation/systems/bob.md` - Preview system architecture
- `documentation/widgets/WidgetArchitecture.md` - Canonical widget + editor contracts
- `tokyo/widgets/faq/spec.json` - Reference widget definition patterns (repeaters, clusters, strict controls)
- `documentation/widgets/LogoShowcase/LogoShowcase.md` - Color picker, themes

**Implementation Critical Points:**
- ✅ **Timer JavaScript:** Use `requestAnimationFrame` for 60fps accuracy (not setInterval)
- ✅ **Personal countdown:** Store start time in localStorage with unique key per instance
- ✅ **Countdown to date:** Handle timezone conversions properly (IANA format)
- ✅ **Number counter:** Use easing function for smooth count-up animation
- ✅ **Position layouts:** Use CSS position (fixed for bars, relative for inline)
- ✅ **Theme presets:** Store complete color sets, apply all at once
- ✅ **Timer styles:** Separated=flexbox with gaps, Inline=inline-block with separators
- ✅ **Tokenization:** All colors/sizes as CSS variables in inline `<style>`
- ✅ **postMessage:** Patch CSS variables for instant preview updates
- ✅ **data-widget-element:** Add to all patchable elements
- ✅ **Rich text editor:** Use contentEditable with toolbar, sanitize HTML output
- ✅ **Actions:** Support multiple actions per section (array in schema)
- ✅ **Hide timer action:** CSS display:none when countdown ends

**Timer Logic Implementation:**
```javascript
// Personal countdown - store in localStorage
const storageKey = 'countdown_' + instanceId;
let startTime = localStorage.getItem(storageKey);
if (!startTime) {
  startTime = Date.now();
  localStorage.setItem(storageKey, startTime);
}

// Calculate end time
const duration = timeAmount * timeUnitMultiplier; // ms
const endTime = parseInt(startTime) + duration;

// Update timer (60fps)
function updateTimer() {
  const now = Date.now();
  const remaining = Math.max(0, endTime - now);

  if (remaining === 0) {
    // Trigger "after countdown ends" actions
    executeAfterActions();
    return;
  }

  // Calculate time units
  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

  // Update DOM
  updateTimerDisplay(days, hours, minutes, seconds);

  // Continue loop
  requestAnimationFrame(updateTimer);
}

updateTimer();
```

**Timezone Handling:**
```javascript
// Countdown to Date mode
const targetDate = new Date(config.targetDate + 'T' + config.targetTime);

// Apply timezone
if (config.timezone !== 'browser') {
  // Convert to specified timezone using Intl or library
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // Get target time in specified timezone
  const targetTime = formatter.format(targetDate);
  // ... calculate countdown
}
```

**Number Counter Animation:**
```javascript
// Count-up with easing
function animateCounter(start, end, duration) {
  const startTime = Date.now();

  function update() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease out quad
    const eased = 1 - (1 - progress) * (1 - progress);

    const current = Math.floor(start + (end - start) * eased);
    counterEl.textContent = current.toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  update();
}
```

---

## Status

**Phase:** Detailed specification complete (70%+ feature coverage)
**Blockers:** None
**Next:** Begin Phase 1 implementation (timer core & modes)
**Recommendation:**
- Start with Phases 1-3 (core timer + actions + themes: ~11-14 days)
- Validate with users
- Add polish in Phase 4-5 (~4-5 days)
**Estimated completion:** 15-19 days for 70%+ feature coverage

**Implementation Benefits:** 40x smaller JavaScript, 7.5x faster, 100% SSR rendering, more precise timer - all while matching 70%+ of Elfsight's feature set. These are outcomes of good engineering, not defensible competitive advantages.
