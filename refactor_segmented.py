#!/usr/bin/env python3
import re

# Read the file
with open('/Users/piero_macpro/code/VS/clickeen/dieter/dieteradmin/src/html/dieter-showcase/segmented.html', 'r') as f:
    content = f.read()

# Pattern to match the entire preview-specs block
# We need to find blocks that start with <div class="preview-specs"> and end with </div>
# Then extract all the title+detail pairs

def refactor_preview_specs(match):
    """Extract and restructure preview-specs content"""
    indent = match.group(1)
    specs_content = match.group(2)

    # Find all title+detail pairs (skip the first title which is the size info)
    # Pattern: <span class="preview-specs__title">TITLE</span><span class="preview-specs__detail">DETAIL</span>
    pair_pattern = r'<span class="preview-specs__title">([^<]+)</span><span class="preview-specs__detail">([^<]+)</span>'
    pairs = re.findall(pair_pattern, specs_content)

    if not pairs:
        return match.group(0)  # No pairs found, return unchanged

    # Build new structure with rows
    rows = []
    for title, detail in pairs:
        row = f'{indent}  <div class="preview-specs__row">\n{indent}    <span class="preview-specs__title">{title}</span>\n{indent}    <span class="preview-specs__detail">{detail}</span>\n{indent}  </div>'
        rows.append(row)

    new_content = '\n'.join(rows)

    return f'{indent}<div class="preview-specs">\n{new_content}\n{indent}</div>'

# Pattern to match entire preview-specs blocks
pattern = r'(\s*)<div class="preview-specs">(.*?)</div>'

new_content = re.sub(pattern, refactor_preview_specs, content, flags=re.DOTALL)

# Write back
with open('/Users/piero_macpro/code/VS/clickeen/dieter/dieteradmin/src/html/dieter-showcase/segmented.html', 'w') as f:
    f.write(new_content)

print("Segmented page refactored successfully")
