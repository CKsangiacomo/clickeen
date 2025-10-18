# Countdown Timer Widget

## Overview

The Countdown Timer widget creates urgency by displaying a countdown to a specific date or event. It's perfect for product launches, sales, events, or any time-sensitive content.

## Features

- **Multiple layouts**: Horizontal, vertical, and circular layouts
- **Customizable display formats**: Show any combination of days, hours, minutes, and seconds
- **Animation options**: Flip, slide, fade, or no animation
- **Label customization**: Show/hide labels, position them, and customize text
- **Expired message**: Display a custom message when the countdown ends
- **Call-to-action button**: Add a customizable button with URL
- **Advanced settings**: User-specific countdowns, recurring countdowns
- **Fully customizable appearance**: Colors, backgrounds, templates

## Templates

1. **Standard Countdown**: Horizontal layout with flip animation
2. **Compact Countdown**: Horizontal layout showing only hours, minutes, seconds
3. **Circular Countdown**: Circular progress indicators (premium)
4. **Vertical Countdown**: Stacked units with slide animation
5. **Event Countdown**: Includes a "Register Now" button (premium)
6. **Sale Countdown**: Sales-focused with "Shop Now" button (premium)

## Widget JSON Structure

The widget is defined in `/paris/lib/widgets/countdown.json` with the following sections:

### Metadata
Basic widget information: name, category, description, schema version

### Defaults
Default configuration for new instances:
- Title: "Coming Soon"
- End date: Dec 31, 2025
- Display format: Days, hours, minutes, seconds
- Layout: Horizontal
- Animation: Flip
- Labels: Shown below digits

### Templates
Pre-configured visual styles with different layouts, animations, and appearance settings

### UI Schema
Defines Bob's control panels for editing the widget:
- **Content**: Title, end date, timezone, display format, expired message, button settings
- **Layout**: Layout type, animation, label settings
- **Appearance**: Template, colors for all elements
- **Settings**: User-specific countdown, recurring countdown options

## Renderer

The renderer in `/venice/lib/renderers/countdown.ts` handles:

1. Extracting configuration from the instance
2. Generating HTML based on layout (horizontal, vertical, circular)
3. Applying template styles and appearance settings
4. Implementing JavaScript for countdown functionality:
   - Real-time updates
   - Animations for changing digits
   - Handling expired state
   - User-specific and recurring countdown logic

## Usage

### Creating a Countdown Timer

```bash
# Create a new instance from template
./scripts/create-countdown-test.sh
```

### Embedding

```html
<!-- Embed in any website -->
<iframe src="https://clickeen.com/e/wgt_abc123" width="100%" height="200" frameborder="0"></iframe>
```

### Customization in Bob

1. Open Bob with the instance ID: `http://localhost:3000/bob?publicId=wgt_abc123`
2. Use the control panels to customize:
   - Content: Set end date, title, expired message
   - Layout: Choose layout type, animation, label position
   - Appearance: Select template, customize colors
   - Settings: Configure advanced options

## Implementation Notes

- The countdown is calculated client-side using JavaScript for accuracy
- All animations are CSS-based for performance
- The circular layout uses SVG for progress indicators
- Responsive design adapts to mobile and desktop views
- Accessibility features include proper ARIA attributes and keyboard navigation