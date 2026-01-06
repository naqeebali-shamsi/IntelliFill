# IntelliFill Color System Documentation

**Version**: 2.0 (OKLCH Migration)
**Last Updated**: 2026-01-06
**Status**: Production Ready

## Overview

IntelliFill uses a comprehensive OKLCH-based color system that provides perceptual uniformity, accessibility compliance, and seamless dark mode support. This three-tier token architecture ensures consistent visual design while maintaining brand identity.

## Why OKLCH?

### Advantages Over HSL

| Feature               | HSL                                                   | OKLCH                                                |
| --------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| Perceptual uniformity | No - same lightness values look different across hues | Yes - 50% lightness looks equally bright in all hues |
| Gamut coverage        | sRGB only (~35% of visible colors)                    | Display P3 (~50% of visible colors)                  |
| Color consistency     | Brightness varies by hue                              | Consistent brightness across hue spectrum            |
| Accessibility         | Requires manual tuning for contrast                   | Predictable contrast from lightness values           |

**Example**: In HSL, `hsl(240 100% 50%)` (blue) appears darker than `hsl(60 100% 50%)` (yellow) despite identical lightness. In OKLCH, `oklch(50% 0.15 240)` and `oklch(50% 0.15 60)` have perceptually identical brightness.

### OKLCH Components

```
oklch(L% C H / alpha)
```

- **L (Lightness)**: 0-100% - Perceptually uniform brightness
- **C (Chroma)**: 0-0.4 - Color intensity/saturation (higher = more vibrant)
- **H (Hue)**: 0-360 - Color angle (0=red, 120=green, 240=blue, etc.)
- **alpha**: 0-1 - Opacity (optional)

## Token Architecture

### Three-Tier System

```
Brand Colors → Interactive States → Component-Specific
     ↓                ↓                    ↓
   Base          Hover/Focus          Badge Colors
   Colors         Disabled            Card Styles
                                      Progress Bars
```

### 1. Brand Foundation

These tokens define IntelliFill's visual identity:

```css
/* Primary Brand Teal - The hero color */
--color-brand-primary: oklch(72.87% 0.156 166.11); /* #02C39A */
--color-brand-primary-hover: oklch(65.87% 0.156 166.11);
--color-brand-primary-active: oklch(58.87% 0.156 166.11);

/* Brand Black - For high contrast text on teal */
--color-brand-black: oklch(19.42% 0.012 145.28); /* #222823 */

/* Hero Background - Deep space blue (login page only) */
--color-hero-bg: oklch(24.09% 0.05 232.82);
```

**Usage**: These are the source of truth. All interactive and component colors derive from these values.

### 2. Interactive States

Tokens for buttons, links, and interactive elements:

```css
/* Primary Interactive (Teal Buttons) */
--interactive-primary-default: oklch(72.87% 0.156 166.11);
--interactive-primary-hover: oklch(65.87% 0.156 166.11); /* Darker */
--interactive-primary-active: oklch(58.87% 0.156 166.11); /* Even darker */
--interactive-primary-focus: oklch(72.87% 0.156 166.11);
--interactive-primary-focus-ring: oklch(72.87% 0.156 166.11 / 0.4);
--interactive-primary-disabled: oklch(72.87% 0.06 166.11); /* Desaturated */

/* Secondary Interactive (Gray Buttons) */
--interactive-secondary-default: oklch(96% 0.005 240); /* Light mode */
--interactive-secondary-hover: oklch(93% 0.008 240);
--interactive-secondary-text: oklch(25% 0.02 240);

/* Dark mode overrides */
.dark {
  --interactive-secondary-default: oklch(25% 0.015 240); /* Dark gray */
  --interactive-secondary-hover: oklch(30% 0.018 240); /* Lighter on hover */
  --interactive-secondary-text: oklch(90% 0.01 240); /* Light text */
}
```

### 3. Component-Specific Tokens

Purpose-built tokens for specific UI components:

```css
/* Status Badges */
--status-pending-bg: oklch(92% 0.04 250); /* Blue background */
--status-pending-text: oklch(40% 0.12 250); /* Dark blue text */
--status-done-bg: oklch(92% 0.045 145); /* Green background */
--status-done-text: oklch(35% 0.1 145); /* Dark green text */

/* Document Cards */
--doc-card-bg: oklch(100% 0 0); /* White */
--doc-card-bg-hover: oklch(98.5% 0.005 166.11); /* Slight teal tint */
--doc-card-selected-bg: oklch(96% 0.03 166.11); /* Strong teal tint */
--doc-card-selected-border: oklch(72.87% 0.156 166.11); /* Teal border */

/* Progress Bars */
--progress-track: oklch(92% 0.005 240); /* Light gray track */
--progress-fill: oklch(72.87% 0.156 166.11); /* Teal fill */
--progress-fill-success: oklch(55% 0.155 145); /* Green variant */
--progress-fill-error: oklch(55% 0.18 15); /* Red variant */
```

## Usage Examples

### Tailwind CSS with Semantic Tokens

```tsx
// GOOD - Using semantic tokens
<Button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Confirm
</Button>

<Badge variant="success">
  Completed
</Badge>

<div className="bg-status-pending text-status-pending-foreground">
  Processing...
</div>

<Alert className="alert-error">
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>Something went wrong</AlertDescription>
</Alert>
```

```tsx
// BAD - Hardcoded Tailwind colors
<Button className="bg-teal-500 text-white hover:bg-teal-600">
  Don't do this
</Button>

<Badge className="bg-green-100 text-green-800">
  Avoid this
</Badge>
```

### CSS Variables Directly

```css
/* Component styling */
.custom-card {
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  color: var(--text-body);
}

.custom-card:hover {
  background: var(--surface-1-hover);
  border-color: var(--border-strong);
}

.custom-card.selected {
  background: var(--doc-card-selected-bg);
  border-color: var(--doc-card-selected-border);
}
```

### React Components

```tsx
import { cn } from '@/lib/utils';

// Badge component using semantic tokens
interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error';
  children: React.ReactNode;
}

export function Badge({ variant = 'default', children }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border',
      {
        'bg-muted text-muted-foreground border-border': variant === 'default',
        'badge-done': variant === 'success',        // Uses --status-done-* tokens
        'badge-failed': variant === 'error',        // Uses --status-failed-* tokens
        'bg-status-warning text-status-warning-foreground': variant === 'warning',
      }
    )}>
      {children}
    </span>
  );
}

// Usage
<Badge variant="success">Approved</Badge>
<Badge variant="error">Failed</Badge>
```

## Migration Guide (HSL → OKLCH)

### Before (Old HSL System)

```css
:root {
  --primary: 200 95% 40%; /* Stored as HSL triplet */
  --success: 145 65% 45%;
}

.button {
  background: hsl(var(--primary)); /* Needed hsl() wrapper */
  color: white;
}

.button-light {
  background: hsl(var(--primary) / 20%); /* Alpha manipulation */
}
```

### After (New OKLCH System)

```css
:root {
  --primary: oklch(72.87% 0.156 166.11); /* Complete color */
  --status-success: oklch(55% 0.155 145);
}

.button {
  background: var(--primary); /* Direct usage */
  color: white;
}

.button-light {
  background: oklch(from var(--primary) l c h / 20%); /* CSS relative colors */
}
```

### Component Migration Checklist

- [ ] Replace `bg-blue-500` → `bg-info` or `bg-status-pending`
- [ ] Replace `bg-green-500` → `bg-status-success`
- [ ] Replace `bg-red-500` → `bg-status-error` or `bg-destructive`
- [ ] Replace `bg-yellow-500` → `bg-status-warning`
- [ ] Replace `text-gray-500` → `text-muted-foreground`
- [ ] Replace `border-gray-300` → `border-border`
- [ ] Replace custom hex colors → appropriate semantic tokens
- [ ] Test in both light and dark modes
- [ ] Verify contrast ratios meet WCAG AA (4.5:1 for text)

## Color Palette Reference

### Brand Colors (Light & Dark Identical)

| Token                   | Value                        | Preview                                                           | Usage                                |
| ----------------------- | ---------------------------- | ----------------------------------------------------------------- | ------------------------------------ |
| `--color-brand-primary` | `oklch(72.87% 0.156 166.11)` | ![#02C39A](https://via.placeholder.com/60x30/02C39A/02C39A.png)   | Primary actions, links, focus states |
| `--color-brand-black`   | `oklch(19.42% 0.012 145.28)` | ![#222823](https://via.placeholder.com/60x30/222823/222823.png)   | Logo, high-contrast text on teal     |
| `--color-hero-bg`       | `oklch(24.09% 0.050 232.82)` | ![Deep Blue](https://via.placeholder.com/60x30/1a2332/1a2332.png) | Login page hero section only         |

### Surface Hierarchy (Light Mode)

| Token                  | Value                     | Usage                         |
| ---------------------- | ------------------------- | ----------------------------- |
| `--surface-background` | `oklch(98.5% 0.003 240)`  | Page background               |
| `--surface-1`          | `oklch(100% 0 0)`         | Cards, panels (elevation 1)   |
| `--surface-2`          | `oklch(100% 0 0)`         | Modals, elevated cards        |
| `--surface-3`          | `oklch(100% 0 0)`         | Dropdowns, tooltips (highest) |
| `--surface-muted`      | `oklch(96.5% 0.005 240)`  | Subtle backgrounds            |
| `--surface-accent`     | `oklch(96% 0.025 166.11)` | Teal-highlighted areas        |

### Surface Hierarchy (Dark Mode)

| Token                  | Value                  | Usage           |
| ---------------------- | ---------------------- | --------------- |
| `--surface-background` | `oklch(12% 0.015 240)` | Page background |
| `--surface-1`          | `oklch(18% 0.018 240)` | Cards, panels   |
| `--surface-2`          | `oklch(22% 0.020 240)` | Modals          |
| `--surface-3`          | `oklch(25% 0.022 240)` | Dropdowns       |

**Note**: Dark mode uses stepped lightness (12% → 18% → 22% → 25%) for clear elevation hierarchy.

### Text Hierarchy

| Light Mode             | Dark Mode              | Usage                    |
| ---------------------- | ---------------------- | ------------------------ |
| `oklch(15% 0.015 240)` | `oklch(98% 0.005 240)` | Headings (AAA contrast)  |
| `oklch(25% 0.015 240)` | `oklch(88% 0.008 240)` | Body text (AAA contrast) |
| `oklch(50% 0.015 240)` | `oklch(65% 0.010 240)` | Muted text (AA contrast) |
| `oklch(62% 0.010 240)` | `oklch(50% 0.008 240)` | Placeholder (3:1 min)    |

### Status Colors Comparison

| Status     | Light Mode BG            | Dark Mode BG             | Text (Light)             | Text (Dark)              |
| ---------- | ------------------------ | ------------------------ | ------------------------ | ------------------------ |
| Pending    | `oklch(92% 0.04 250)`    | `oklch(22% 0.04 250)`    | `oklch(40% 0.12 250)`    | `oklch(80% 0.10 250)`    |
| Processing | `oklch(94% 0.04 166.11)` | `oklch(20% 0.04 166.11)` | `oklch(40% 0.10 166.11)` | `oklch(80% 0.10 166.11)` |
| Done       | `oklch(92% 0.045 145)`   | `oklch(22% 0.045 145)`   | `oklch(35% 0.10 145)`    | `oklch(80% 0.10 145)`    |
| Failed     | `oklch(94% 0.03 15)`     | `oklch(20% 0.03 15)`     | `oklch(40% 0.12 15)`     | `oklch(85% 0.08 15)`     |
| Cancelled  | `oklch(94% 0.005 240)`   | `oklch(20% 0.005 240)`   | `oklch(45% 0.015 240)`   | `oklch(70% 0.010 240)`   |

**Pattern**: Dark mode uses darker backgrounds (20-22% lightness) with brighter text (70-85% lightness) for accessibility.

### Feedback/Alert Colors

| Type    | Hue            | Usage                           | Light BG               | Dark BG                |
| ------- | -------------- | ------------------------------- | ---------------------- | ---------------------- |
| Success | 145° (Emerald) | Positive actions, confirmations | `oklch(92% 0.045 145)` | `oklch(25% 0.045 145)` |
| Warning | 75° (Amber)    | Cautions, important notices     | `oklch(94% 0.055 75)`  | `oklch(25% 0.040 75)`  |
| Error   | 15° (Rose)     | Errors, destructive actions     | `oklch(94% 0.035 15)`  | `oklch(22% 0.035 15)`  |
| Info    | 250° (Blue)    | Information, neutral notices    | `oklch(94% 0.035 250)` | `oklch(22% 0.035 250)` |

**Note**: Success (145°) is distinct from brand primary (166.11°) - 21° separation prevents confusion.

## Contrast Requirements

### WCAG AA Standards

| Content Type       | Minimum Ratio | IntelliFill Implementation |
| ------------------ | ------------- | -------------------------- |
| Normal text (body) | 4.5:1         | 7-10:1 (exceeds)           |
| Large text (18pt+) | 3:1           | 7-10:1 (exceeds)           |
| UI components      | 3:1           | 4-8:1 (exceeds)            |
| Graphical objects  | 3:1           | 4-8:1 (exceeds)            |

### Verification

All contrast ratios have been verified and documented in:

- `docs/reference/design-system/dark-mode-verification.md`

**Tools**:

- Chrome DevTools: Inspect element → Contrast ratio in color picker
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- Axe DevTools: Automated accessibility scanning

## Best Practices

### DO ✓

```tsx
// Use semantic tokens
<div className="bg-background text-foreground">
<Button className="bg-primary text-primary-foreground">
<Badge className="badge-done">Success</Badge>
<Alert className="alert-error">Error message</Alert>

// Use status tokens for states
<div className="bg-status-success text-status-success-foreground">
<span className="text-status-error">Failed</span>

// Use CSS variables for custom components
const styles = {
  background: 'var(--surface-1)',
  color: 'var(--text-body)',
  borderColor: 'var(--border-default)',
};
```

### DON'T ✗

```tsx
// DON'T use hardcoded Tailwind colors
<div className="bg-slate-50 text-slate-900">           // Wrong
<Button className="bg-teal-500 hover:bg-teal-600">    // Wrong
<Badge className="bg-green-100 text-green-800">       // Wrong

// DON'T use hex colors
<div style={{ background: '#02C39A' }}>               // Wrong
<span style={{ color: '#ef4444' }}>                   // Wrong

// DON'T use non-semantic tokens
<div className="bg-blue-500 dark:bg-blue-600">        // Wrong
```

### Guidelines

1. **Always use semantic tokens** - Never hardcode colors
2. **Test in both modes** - Verify light and dark mode appearance
3. **Check contrast** - Ensure WCAG AA compliance (4.5:1 minimum)
4. **Use status colors correctly**:
   - Success: Completed actions, confirmations
   - Warning: Cautions, non-critical issues
   - Error: Failures, destructive actions
   - Info: Neutral information, processing states
5. **Respect elevation** - Use surface-1/2/3 for proper z-index hierarchy
6. **Don't override system** - Let tokens handle dark mode automatically

## Developer Workflow

### Adding a New Component

1. **Identify color needs**: Background, text, border, interactive states
2. **Check if tokens exist**: Review `theme.css` for matching tokens
3. **Use existing tokens**: Prefer semantic over creating new ones
4. **If new token needed**:

   ```css
   /* Add to theme.css under appropriate section */
   --component-new-bg: oklch(95% 0.01 240);
   --component-new-text: oklch(30% 0.02 240);

   .dark {
     --component-new-bg: oklch(20% 0.01 240);
     --component-new-text: oklch(85% 0.01 240);
   }
   ```

5. **Test both modes**: Verify appearance and contrast
6. **Document usage**: Add examples to this file

### Modifying Existing Colors

1. **Find token in `theme.css`**: Search by name or value
2. **Understand impact**: Check where token is used
3. **Modify both modes**: Update `:root` and `.dark` if needed
4. **Verify contrast**: Use DevTools contrast checker
5. **Test thoroughly**: Check all affected components
6. **Update docs**: Document changes

## File Locations

| File                                                     | Purpose                                         |
| -------------------------------------------------------- | ----------------------------------------------- |
| `quikadmin-web/src/styles/theme.css`                     | Complete color token definitions (676 lines)    |
| `quikadmin-web/src/index.css`                            | Base theme setup and utilities                  |
| `quikadmin-web/tailwind.config.js`                       | Tailwind integration (maps tokens to utilities) |
| `docs/reference/design-system/dark-mode-verification.md` | Contrast verification report                    |
| `docs/reference/design-system/colors.md`                 | This file                                       |

## Browser Support

OKLCH is supported in:

- **Chrome/Edge**: 111+ (March 2023)
- **Safari**: 15.4+ (March 2022)
- **Firefox**: 113+ (May 2023)

**Target**: All modern browsers (2024+) support OKLCH natively. No fallbacks needed.

## Troubleshooting

### Colors look wrong in old browsers

**Solution**: Update browser. OKLCH requires Chrome 111+, Safari 15.4+, Firefox 113+.

### Dark mode not applying

**Solution**: Check `<html>` element has `class="dark"`. Verify theme toggle component is working.

### Contrast too low

**Solution**: Use DevTools to check ratio. Minimum 4.5:1 for text, 3:1 for UI elements. Adjust lightness values.

### Brand color not showing

**Solution**: Verify you're using `var(--primary)` or `bg-primary`, not hardcoded values. Check theme.css loaded.

### Status colors look the same

**Solution**: Each status uses different hue (145°, 75°, 15°, 250°). If colors appear identical, check display color profile or browser color management.

## Resources

- **OKLCH Color Picker**: https://oklch.com/
- **OKLCH vs HSL**: https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl
- **Color Contrast Checker**: https://webaim.org/resources/contrastchecker/
- **WCAG Guidelines**: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
- **Tailwind CSS v4 Docs**: https://tailwindcss.com/docs/v4-alpha

## Support

For questions about the color system:

1. Review this documentation
2. Check `theme.css` for token definitions
3. See component examples in `quikadmin-web/src/components/`
4. Refer to dark mode verification report

---

**Maintained by**: IntelliFill Design System Team
**Version**: 2.0
**Last Verified**: 2026-01-06
