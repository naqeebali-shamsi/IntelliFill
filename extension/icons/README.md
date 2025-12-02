# IntelliFill Extension Icons

## Icon Requirements

The extension requires three icon sizes:
- **16x16** - Browser toolbar icon (small)
- **48x48** - Extension management page
- **128x128** - Chrome Web Store listing

## Current Status

Placeholder SVG icon is provided in `icon.svg`. To generate PNG icons:

### Option 1: Using ImageMagick (if installed)
```bash
convert icon.svg -resize 16x16 icon16.png
convert icon.svg -resize 48x48 icon48.png
convert icon.svg -resize 128x128 icon128.png
```

### Option 2: Using Online Converter
1. Open the SVG file in a browser
2. Take screenshots or use an online SVG to PNG converter
3. Save as `icon16.png`, `icon48.png`, `icon128.png`

### Option 3: Using Design Software
1. Open `icon.svg` in Figma, Sketch, or Illustrator
2. Export at required sizes
3. Save as PNG with transparent background

## Icon Design

The icon features:
- Gradient background (purple to violet)
- Star/sparkle symbol representing intelligence and automation
- Small accent stars for visual interest
- Rounded corners for modern look

## Temporary Workaround

For testing, you can use the SVG directly or create simple colored squares as placeholders. The extension will work without proper icons, but they are required for Chrome Web Store submission.
