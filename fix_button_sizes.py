#!/usr/bin/env python3
import re

# Read the file
with open('/Users/piero_macpro/code/VS/clickeen/dieter/dieteradmin/src/html/dieter-showcase/button.html', 'r') as f:
    content = f.read()

# Function to add size title at top of preview-specs blocks
def add_size_title(match):
    indent = match.group(1)
    specs_content = match.group(2)

    # Extract size from data-size="xx" detail
    size_match = re.search(r'data-size="(\w+)"', specs_content)
    if not size_match:
        # No data-size means it's default (small), check if it's the first block
        return match.group(0)

    size = size_match.group(1).upper()  # xs -> XS, sm -> SM, etc.

    # Add title at the beginning
    new_specs = f'{indent}<div class="preview-specs button-matrix__meta">\n{indent}  <span class="preview-specs__title">{size}</span>\n{specs_content}{indent}</div>'

    return new_specs

# Pattern to match preview-specs blocks
pattern = r'(\s*)<div class="preview-specs button-matrix__meta">\n(.*?)\n(\s*)</div>'

new_content = re.sub(pattern, add_size_title, content, flags=re.DOTALL)

# Write back
with open('/Users/piero_macpro/code/VS/clickeen/dieter/dieteradmin/src/html/dieter-showcase/button.html', 'w') as f:
    f.write(new_content)

print("Button page updated with size titles")
