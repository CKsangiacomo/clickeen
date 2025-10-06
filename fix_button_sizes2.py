#!/usr/bin/env python3
import re

# Read the file
with open('/Users/piero_macpro/code/VS/clickeen/dieter/dieteradmin/src/html/dieter-showcase/button.html', 'r') as f:
    lines = f.readlines()

new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    new_lines.append(line)

    # Check if this line opens a preview-specs block
    if '<div class="preview-specs button-matrix__meta">' in line:
        # Look ahead to find data-size
        lookahead = ''.join(lines[i:i+15])
        size_match = re.search(r'data-size="(\w+)"', lookahead)

        if size_match:
            size = size_match.group(1).upper()
            # Get the indentation from the current line
            indent = re.match(r'(\s*)', line).group(1)
            # Add the title as the next line
            new_lines.append(f'{indent}  <span class="preview-specs__title">{size}</span>\n')

    i += 1

# Write back
with open('/Users/piero_macpro/code/VS/clickeen/dieter/dieteradmin/src/html/dieter-showcase/button.html', 'w') as f:
    f.writelines(new_lines)

print("Button page updated with size titles")
