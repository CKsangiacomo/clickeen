#!/usr/bin/env python3
import re

# Read the file
with open('/Users/piero_macpro/code/VS/clickeen/dieter/dieteradmin/src/html/dieter-showcase/typography.html', 'r') as f:
    content = f.read()

# Pattern to match preview-specs blocks with title and detail divs
# Replace with detail-only rows

def refactor_preview_specs(match):
    """Convert preview-specs to detail-only rows"""
    indent = match.group(1)
    specs_content = match.group(2)

    # Find all detail values (ignore titles)
    detail_pattern = r'<div class="button-attr preview-specs__detail">([^<]+)</div>'
    details = re.findall(detail_pattern, specs_content)

    if not details:
        return match.group(0)  # No details found, return unchanged

    # Build rows with detail-only
    rows = []
    for detail in details:
        # Remove "class:" prefix if present
        detail = detail.replace('class:', '')
        row = f'{indent}  <div class="preview-specs__row">\n{indent}    <span class="preview-specs__detail">{detail}</span>\n{indent}  </div>'
        rows.append(row)

    new_content = '\n'.join(rows)

    return f'{indent}<div class="preview-specs">\n{new_content}\n{indent}</div>'

# Pattern to match entire preview-specs blocks
pattern = r'(\s*)<div class="button-copy preview-specs">(.*?)</div>'

new_content = re.sub(pattern, refactor_preview_specs, content, flags=re.DOTALL)

# Write back
with open('/Users/piero_macpro/code/VS/clickeen/dieter/dieteradmin/src/html/dieter-showcase/typography.html', 'w') as f:
    f.write(new_content)

print("Typography page refactored successfully")
