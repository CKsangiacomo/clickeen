#!/usr/bin/env python3
import re

def refactor_preview_specs(html_content):
    """
    Refactor .preview-specs blocks to wrap title+detail pairs in .preview-specs__row divs
    """
    count = 0
    lines = html_content.split('\n')
    result_lines = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # Check if this is a line with both title and detail on the same line
        if 'preview-specs__title' in line and 'preview-specs__detail' in line and '<span' in line:
            # Use regex to wrap the spans in a row div
            pattern = r'(<span class="preview-specs__title">.*?</span>)(<span class="preview-specs__detail">.*?</span>)'

            def replacer(match):
                return f'<div class="preview-specs__row">{match.group(1)}{match.group(2)}</div>'

            new_line = re.sub(pattern, replacer, line)
            result_lines.append(new_line)
            count += 1
            i += 1
            continue

        # Check if this is a line with preview-specs__title (multi-line case)
        if 'preview-specs__title' in line and '<span' in line:
            # Look for the corresponding detail line
            # It should be the next line with preview-specs__detail
            if i + 1 < len(lines) and 'preview-specs__detail' in lines[i + 1] and '<span' in lines[i + 1]:
                # Get the indentation from the title line
                indent = len(line) - len(line.lstrip())
                indent_str = ' ' * indent

                # Create the wrapped version
                result_lines.append(f'{indent_str}<div class="preview-specs__row">')
                result_lines.append(line)
                result_lines.append(lines[i + 1])
                result_lines.append(f'{indent_str}</div>')

                count += 1
                i += 2  # Skip both title and detail lines
                continue

        result_lines.append(line)
        i += 1

    return '\n'.join(result_lines), count

# Read the file
with open('/Users/piero_macpro/code/VS/clickeen/dieter/dieteradmin/src/html/dieter-showcase/colors.html', 'r') as f:
    content = f.read()

# Refactor
new_content, blocks_updated = refactor_preview_specs(content)

# Write back
with open('/Users/piero_macpro/code/VS/clickeen/dieter/dieteradmin/src/html/dieter-showcase/colors.html', 'w') as f:
    f.write(new_content)

print(f"Refactoring complete! Updated {blocks_updated} .preview-specs blocks")
