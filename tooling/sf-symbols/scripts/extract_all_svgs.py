import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
symbol_file = REPO_ROOT / "dieter" / "icons" / "icons.json"

# Load the JSON
with open(symbol_file, "r", encoding="utf-8") as f:
    data = json.load(f)

font_size = data.get("fontSize", 28)
symbols = data["symbols"]

# Output folder
output_dir = REPO_ROOT / "dieter" / "icons" / "svg"
output_dir.mkdir(parents=True, exist_ok=True)

# Remove any previously generated SVGs to avoid stale duplicates
for stale in output_dir.glob('*.svg'):
    stale.unlink()

count = 0

def fmt(value: float) -> str:
    return f"{value:.2f}".rstrip("0").rstrip(".")

for name, styles in symbols.items():
    for style, style_data in styles.items():
        path_data = style_data.get("path")
        if not path_data:
            continue

        geometry = style_data.get("geometry", {})
        bounds = geometry.get("bounds") or {}
        min_x = bounds.get("x1", 0.0)
        min_y = bounds.get("y1", 0.0)
        max_x = bounds.get("x2", font_size)
        max_y = bounds.get("y2", font_size)
        width = max_x - min_x
        height = max_y - min_y

        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="{fmt(min_x)} {fmt(min_y)} {fmt(width)} {fmt(height)}" '
            f'width="{fmt(width)}" height="{fmt(height)}">\n'
            f'  <path d="{path_data}" />\n'
            f'</svg>'
        )

        # If only one weight is emitted, keep the original name for stability.
        filename = f"{name}.svg"
        if len(styles) > 1:
            filename = f"{name}--{style}.svg"
        filepath = output_dir / filename

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(svg)
            count += 1

print(f"✅ Done! Extracted {count} SVGs to: {output_dir}")
