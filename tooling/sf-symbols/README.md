# Clickeen SF Symbols Tool

This human-operated tool converts the selected SF Symbols font glyphs into the
canonical Dieter icon source. It has one SVG output path:

```text
dieter/icons/icons.json
dieter/icons/svg/{name}.svg
```

The regular monochrome glyph is the current Clickeen source. SVGs keep the SF
font's optical coordinate scale on one centered canvas and use
`fill="currentColor"`.

## Usage

1. Install dependencies when needed.

```bash
pnpm i
```

2. Generate `icons.json`, TypeScript source types, and every Dieter SVG.

```bash
pnpm run make
```

When `icons.json` is already current and only the SVG files need regeneration:

```bash
python3 scripts/extract_all_svgs.py
```

## Creating a new version

### Place the char and name files into `/sources`
1. Download the latest SF Symbols version from [Apple's website](https://developer.apple.com/sf-symbols/).
2. Go to `Edit` > `Select All`
3. Right click on the selection, and press `Copy all {x} symbols`
4. Paste symbols into a file in `sources/{version}/chars.txt`
5. Right click again on the selection, this time press `Copy all {x} names`
6. Paste names into a file in `sources/{version}/names.txt`
### Place the font files into `/sources`
7. Download SF Pro font from [Apple's website](https://developer.apple.com/fonts/).
8. Install the font, and open Font Book app.
9. Find SF Pro, and right click on it. Press `Show in Finder`.
10. Copy `SF-Pro-Text-Ultralight.otf` through `SF-Pro-Text-Black.otf` file into `sources/{version}/` folder.
11. Run `pnpm run make`.

### Geometry

Do not crop an SVG viewport to its path bounds. Tight cropping makes every
symbol expand to fill the consumer's icon slot and destroys the relative scale
and spacing carried by the SF font. `extract_all_svgs.py` is the only Clickeen
SVG exporter and applies the same optical-canvas formula to every selected
symbol.

### Note on License
I do not own nor claim to own SF Symbols. This repo is simply a tool to convert the SF Symbols font into SVGs.
