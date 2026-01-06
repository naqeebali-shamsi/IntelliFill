# IntelliFill Color System

**Last Updated:** 2026-01-06
**Version:** 1.0.0

## Overview

IntelliFill uses a comprehensive color system built on OKLCH color space for perceptual uniformity. The system supports both light and dark modes with AAA contrast compliance.

## Brand Foundation

### Primary Colors

| Name        | OKLCH                        | Hex       | Usage                        |
| ----------- | ---------------------------- | --------- | ---------------------------- |
| Brand Teal  | `oklch(72.87% 0.156 166.11)` | `#02C39A` | Primary CTA, links, accents  |
| Brand Black | `oklch(19.42% 0.012 145.28)` | `#222823` | Logo, high-contrast text     |
| Hero Blue   | `oklch(24.09% 0.050 232.82)` | -         | Hero section background only |

### Why OKLCH?

OKLCH provides:

- **Perceptual uniformity**: Equal lightness steps appear equal to human eyes
- **Better color manipulation**: Adjust lightness without hue shift
- **Wider gamut support**: Ready for P3 displays
- **Predictable contrast**: Easier to maintain accessibility

---

## Interactive States

### Primary Button States

```css
/* Light Mode */
--interactive-primary-default: oklch(72.87% 0.156 166.11); /* Base teal */
--interactive-primary-hover: oklch(65.87% 0.156 166.11); /* 7% darker */
--interactive-primary-active: oklch(58.87% 0.156 166.11); /* 14% darker */
--interactive-primary-focus-ring: oklch(72.87% 0.156 166.11 / 0.4);
--interactive-primary-disabled: oklch(72.87% 0.06 166.11); /* Desaturated */

/* Dark Mode - Same hue, adjusted lightness */
--interactive-primary-hover: oklch(78% 0.156 166.11); /* 5% lighter */
--interactive-primary-active: oklch(68% 0.156 166.11); /* 5% darker */
```

### Usage in Components

```tsx
// Button component
<Button className="bg-[--interactive-primary-default] hover:bg-[--interactive-primary-hover] active:bg-[--interactive-primary-active]">
  Submit
</Button>

// Or use the utility class
<Button className="btn-primary">Submit</Button>
```

### Secondary Button States

| State    | Light Mode             | Dark Mode              |
| -------- | ---------------------- | ---------------------- |
| Default  | `oklch(96% 0.005 240)` | `oklch(25% 0.015 240)` |
| Hover    | `oklch(93% 0.008 240)` | `oklch(30% 0.018 240)` |
| Active   | `oklch(90% 0.010 240)` | `oklch(22% 0.012 240)` |
| Disabled | `oklch(96% 0.003 240)` | `oklch(22% 0.010 240)` |

---

## Surface Hierarchy

The surface system creates visual depth through progressive elevation.

### Light Mode Surfaces

| Surface        | OKLCH                     | Purpose               | Example             |
| -------------- | ------------------------- | --------------------- | ------------------- |
| Background     | `oklch(98.5% 0.003 240)`  | Page background       | Main app container  |
| Surface-1      | `oklch(100% 0 0)`         | Cards, panels         | Document cards      |
| Surface-2      | `oklch(100% 0 0)`         | Elevated elements     | Modals              |
| Surface-3      | `oklch(100% 0 0)`         | Highest elevation     | Dropdowns, popovers |
| Surface-Muted  | `oklch(96.5% 0.005 240)`  | Subtle backgrounds    | Empty states        |
| Surface-Accent | `oklch(96% 0.025 166.11)` | Teal-tinted highlight | Selected items      |

### Dark Mode Surfaces

| Surface        | OKLCH                    | Purpose        |
| -------------- | ------------------------ | -------------- |
| Background     | `oklch(12% 0.015 240)`   | Deep space     |
| Surface-1      | `oklch(18% 0.018 240)`   | Cards          |
| Surface-2      | `oklch(22% 0.020 240)`   | Modals         |
| Surface-3      | `oklch(25% 0.022 240)`   | Popovers       |
| Surface-Muted  | `oklch(18% 0.015 240)`   | Subtle bg      |
| Surface-Accent | `oklch(20% 0.04 166.11)` | Teal highlight |

### Usage

```tsx
// Using CSS variables
<div className="bg-[--surface-1]">Card content</div>

// Using utility classes
<div className="surface-1">Card content</div>
<div className="surface-accent">Highlighted section</div>
```

---

## Text Hierarchy

### Light Mode Text

| Type        | OKLCH                     | Contrast | Usage                      |
| ----------- | ------------------------- | -------- | -------------------------- |
| Heading     | `oklch(15% 0.015 240)`    | 14:1+    | Page titles, card headers  |
| Body        | `oklch(25% 0.015 240)`    | 10:1+    | Primary content            |
| Muted       | `oklch(50% 0.015 240)`    | 4.5:1+   | Secondary info, timestamps |
| Placeholder | `oklch(62% 0.010 240)`    | 3:1+     | Input placeholders         |
| Link        | `oklch(65% 0.156 166.11)` | 4.5:1+   | Interactive links          |

### Dark Mode Text

| Type        | OKLCH                     | Contrast |
| ----------- | ------------------------- | -------- |
| Heading     | `oklch(98% 0.005 240)`    | 15:1+    |
| Body        | `oklch(88% 0.008 240)`    | 11:1+    |
| Muted       | `oklch(65% 0.010 240)`    | 5:1+     |
| Placeholder | `oklch(50% 0.008 240)`    | 3.5:1+   |
| Link        | `oklch(75% 0.140 166.11)` | 6.8:1+   |

### Usage

```tsx
<h1 className="text-[--text-heading]">Dashboard</h1>
<p className="text-[--text-body]">Primary content here</p>
<span className="text-[--text-muted]">Last updated 2 hours ago</span>
<a className="text-[--text-link] hover:text-[--text-link-hover]">View details</a>
```

---

## Border System

### Border Types

| Type        | Light Mode             | Dark Mode              | Usage        |
| ----------- | ---------------------- | ---------------------- | ------------ |
| Default     | `oklch(88% 0.008 240)` | `oklch(28% 0.012 240)` | Card borders |
| Subtle      | `oklch(93% 0.005 240)` | `oklch(22% 0.008 240)` | Dividers     |
| Strong      | `oklch(75% 0.010 240)` | `oklch(40% 0.015 240)` | Emphasis     |
| Focus       | Brand Teal             | Brand Teal             | Focus states |
| Input       | `oklch(85% 0.008 240)` | `oklch(30% 0.012 240)` | Form inputs  |
| Input Hover | `oklch(75% 0.012 240)` | `oklch(40% 0.015 240)` | Input hover  |
| Input Focus | Brand Teal             | Brand Teal             | Input focus  |

### Focus Ring

```css
/* Focus ring for interactive elements */
--border-focus-ring: oklch(72.87% 0.156 166.11 / 0.35); /* Light */
--border-focus-ring: oklch(72.87% 0.156 166.11 / 0.45); /* Dark */
```

### Usage

```tsx
<div className="border border-[--border-default] focus-within:border-[--border-focus]">
  <input className="border-[--border-input] hover:border-[--border-input-hover]" />
</div>
```

---

## Feedback Colors

### Success (Emerald - Hue 145)

Deliberately distinct from brand teal (hue 166) with 21-degree separation.

| Variant  | Light Mode             | Dark Mode              |
| -------- | ---------------------- | ---------------------- |
| Base     | `oklch(55% 0.155 145)` | `oklch(65% 0.155 145)` |
| Light BG | `oklch(92% 0.045 145)` | `oklch(25% 0.045 145)` |
| Text     | `oklch(30% 0.080 145)` | `oklch(80% 0.100 145)` |
| Border   | `oklch(75% 0.100 145)` | `oklch(45% 0.100 145)` |

### Warning (Amber/Gold - Hue 75)

| Variant  | Light Mode            | Dark Mode             |
| -------- | --------------------- | --------------------- |
| Base     | `oklch(75% 0.160 75)` | `oklch(80% 0.160 75)` |
| Light BG | `oklch(94% 0.055 75)` | `oklch(25% 0.040 75)` |
| Text     | `oklch(35% 0.090 75)` | `oklch(85% 0.100 75)` |
| Border   | `oklch(80% 0.120 75)` | `oklch(50% 0.100 75)` |

### Error (Rose Red - Hue 15)

Using rose-red rather than pure red for UAE cultural sensitivity.

| Variant  | Light Mode            | Dark Mode             |
| -------- | --------------------- | --------------------- |
| Base     | `oklch(55% 0.180 15)` | `oklch(65% 0.180 15)` |
| Light BG | `oklch(94% 0.035 15)` | `oklch(22% 0.035 15)` |
| Text     | `oklch(35% 0.100 15)` | `oklch(85% 0.080 15)` |
| Border   | `oklch(70% 0.120 15)` | `oklch(45% 0.120 15)` |

### Info (Blue - Hue 250)

| Variant  | Light Mode             | Dark Mode              |
| -------- | ---------------------- | ---------------------- |
| Base     | `oklch(55% 0.180 250)` | `oklch(65% 0.180 250)` |
| Light BG | `oklch(94% 0.035 250)` | `oklch(22% 0.035 250)` |
| Text     | `oklch(30% 0.100 250)` | `oklch(85% 0.080 250)` |
| Border   | `oklch(75% 0.100 250)` | `oklch(45% 0.100 250)` |

### Usage

```tsx
// Alert components
<Alert className="alert-success">Document processed successfully</Alert>
<Alert className="alert-warning">Low confidence score</Alert>
<Alert className="alert-error">Processing failed</Alert>
<Alert className="alert-info">Upload in progress</Alert>

// Or with CSS variables
<div className="bg-[--feedback-success-light] text-[--feedback-success-text] border-[--feedback-success-border]">
  Success message
</div>
```

---

## Status Badges

For document processing states:

### Pending (Blue)

```css
--status-pending-bg: oklch(92% 0.04 250);
--status-pending-text: oklch(40% 0.12 250);
--status-pending-border: oklch(80% 0.08 250);
--status-pending-dot: oklch(55% 0.18 250);
```

### Processing (Brand Teal)

```css
--status-processing-bg: oklch(94% 0.04 166.11);
--status-processing-text: oklch(40% 0.1 166.11);
--status-processing-border: oklch(80% 0.08 166.11);
--status-processing-dot: oklch(72.87% 0.156 166.11);
```

### Done (Green)

```css
--status-done-bg: oklch(92% 0.045 145);
--status-done-text: oklch(35% 0.1 145);
--status-done-border: oklch(75% 0.08 145);
--status-done-dot: oklch(55% 0.155 145);
```

### Failed (Rose)

```css
--status-failed-bg: oklch(94% 0.03 15);
--status-failed-text: oklch(40% 0.12 15);
--status-failed-border: oklch(80% 0.06 15);
--status-failed-dot: oklch(55% 0.18 15);
```

### Cancelled (Gray)

```css
--status-cancelled-bg: oklch(94% 0.005 240);
--status-cancelled-text: oklch(45% 0.015 240);
--status-cancelled-border: oklch(85% 0.008 240);
--status-cancelled-dot: oklch(60% 0.01 240);
```

### Usage

```tsx
// Using utility classes
<span className="badge-pending">Pending</span>
<span className="badge-processing">Processing</span>
<span className="badge-done">Complete</span>
<span className="badge-failed">Failed</span>
<span className="badge-cancelled">Cancelled</span>

// With status dot
<span className="badge-processing flex items-center gap-2">
  <span className="w-2 h-2 rounded-full bg-[--status-processing-dot] animate-pulse" />
  Processing
</span>
```

---

## Document Cards

### Card Styles

```css
/* Base card */
--doc-card-bg: oklch(100% 0 0);
--doc-card-border: oklch(90% 0.008 240);

/* Hover state */
--doc-card-bg-hover: oklch(98.5% 0.005 166.11);
--doc-card-border-hover: oklch(72.87% 0.08 166.11);

/* Selected state */
--doc-card-selected-bg: oklch(96% 0.03 166.11);
--doc-card-selected-border: oklch(72.87% 0.156 166.11);
```

### Usage

```tsx
<div className="doc-card rounded-lg border p-4">
  <h3>Document Name</h3>
  <p>Document details...</p>
</div>

<div className="doc-card selected rounded-lg border p-4">
  <h3>Selected Document</h3>
</div>
```

---

## Upload Zone

### States

```css
/* Default */
--upload-zone-bg: oklch(98% 0.008 166.11);
--upload-zone-border: oklch(85% 0.03 166.11);

/* Active (dragging) */
--upload-zone-active-bg: oklch(95% 0.04 166.11);
--upload-zone-active-border: oklch(72.87% 0.156 166.11);
```

### Usage

```tsx
<div className="upload-zone rounded-xl p-8 text-center">
  <p>Drop files here or click to upload</p>
</div>

<div className="upload-zone active rounded-xl p-8 text-center">
  <p>Release to upload</p>
</div>
```

---

## Progress Bars

### Track and Fill Colors

```css
--progress-track: oklch(92% 0.005 240);
--progress-fill: oklch(72.87% 0.156 166.11); /* Brand teal */
--progress-fill-success: oklch(55% 0.155 145);
--progress-fill-warning: oklch(75% 0.16 75);
--progress-fill-error: oklch(55% 0.18 15);
```

### Usage

```tsx
<div className="progress-track h-2 rounded-full overflow-hidden">
  <div className="progress-fill h-full transition-all" style={{ width: '75%' }} />
</div>

// Success variant
<div className="progress-track h-2 rounded-full overflow-hidden">
  <div className="progress-fill-success h-full" style={{ width: '100%' }} />
</div>
```

---

## Shadows

### Elevation Levels

| Level | Light Mode                             | Dark Mode                       | Usage         |
| ----- | -------------------------------------- | ------------------------------- | ------------- |
| XS    | `0 1px 2px oklch(20% 0.02 240 / 0.05)` | `0 1px 2px oklch(0% 0 0 / 0.3)` | Subtle        |
| SM    | `0 1px 3px ...`                        | `0 1px 3px ...`                 | Cards         |
| MD    | `0 4px 6px ...`                        | `0 4px 6px ...`                 | Dropdowns     |
| LG    | `0 10px 15px ...`                      | `0 10px 15px ...`               | Modals        |
| XL    | `0 20px 25px ...`                      | `0 20px 25px ...`               | Hero elements |

### Colored Shadows (Brand)

```css
--shadow-primary: 0 4px 14px oklch(72.87% 0.156 166.11 / 0.25);
--shadow-primary-lg: 0 10px 25px oklch(72.87% 0.156 166.11 / 0.3);
```

### Usage

```tsx
<Card className="shadow-[--shadow-md]">Normal card</Card>
<Card className="shadow-[--shadow-primary]">Highlighted card</Card>
<Button className="hover:shadow-[--shadow-primary]">CTA Button</Button>
```

---

## Data Tables

### Table Colors

```css
/* Header */
--table-header-bg: oklch(97% 0.005 240);

/* Rows */
--table-row-hover: oklch(98% 0.008 166.11);
--table-row-selected: oklch(95% 0.025 166.11);
--table-row-stripe: oklch(98.5% 0.003 240);

/* Borders */
--table-border: oklch(92% 0.005 240);
```

### Usage

```tsx
<table>
  <thead className="bg-[--table-header-bg]">
    <tr>
      <th>Name</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <tr className="hover:bg-[--table-row-hover]">
      <td>Document 1</td>
      <td>Complete</td>
    </tr>
  </tbody>
</table>
```

---

## Quick Reference

### CSS Variable Naming Convention

```
--{category}-{element}-{variant}

Examples:
--interactive-primary-hover
--surface-accent
--text-muted
--border-focus
--feedback-success-light
--status-pending-bg
--doc-card-selected-border
```

### File Locations

- Theme CSS: `quikadmin-web/src/styles/theme.css`
- Main CSS: `quikadmin-web/src/index.css`
- Tailwind Config: `quikadmin-web/tailwind.config.js`

### Adding New Colors

1. Add CSS variable in `theme.css` under both `:root` and `.dark`
2. Follow the naming convention
3. Document in this file
4. Create utility class if frequently used

---

## Accessibility Notes

- All text colors meet WCAG 2.1 AA contrast requirements (4.5:1 minimum)
- Heading text achieves AAA compliance (7:1+)
- Focus states use visible 3px rings with brand teal
- Color is never the only indicator (always paired with icons/text)
- Error states use rose-red (not pure red) for cultural sensitivity
