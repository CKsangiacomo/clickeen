#!/usr/bin/env python3
import re

# Read the file
with open('/Users/piero_macpro/code/VS/clickeen/dieter/dieteradmin/src/html/dieter-showcase/colors.html', 'r') as f:
    content = f.read()

# Pattern to match:
#       <div class="color-chip-label">LABEL</div>
#       <div class="color-rgb">RGB VALUE</div>

pattern = r'(\s+)<div class="color-chip-label">([^<]+)</div>\s+<div class="color-rgb">([^<]+)</div>'

replacement = r'\1<div class="preview-specs">\n\1  <div class="preview-specs__row">\n\1    <span class="preview-specs__title">\2</span>\n\1    <span class="preview-specs__detail">\3</span>\n\1  </div>\n\1</div>'

new_content = re.sub(pattern, replacement, content)

# Write back
with open('/Users/piero_macpro/code/VS/clickeen/dieter/dieteradmin/src/html/dieter-showcase/colors.html', 'w') as f:
    f.write(new_content)

# Count replacements
count = len(re.findall(pattern, content))
print(f"Replaced {count} color-chip-label + color-rgb pairs")
