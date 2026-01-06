# PRD: OKLCH Color System Migration

## Overview

Migrate IntelliFill's frontend color system from HSL to OKLCH format for perceptual uniformity, better dark mode support, and design system scalability.

## Background

The design panel has created a comprehensive OKLCH-based color system in `theme.css`. The current `index.css` uses HSL format which doesn't provide perceptual uniformity across color manipulations.

### Current State

- `index.css` uses HSL format (e.g., `--primary: 163 98% 39%`)
- `theme.css` created with full OKLCH token system
- Hero background already migrated to OKLCH
- Components use Tailwind classes referencing HSL variables

### Target State

- All colors in OKLCH format
- Three-tier token architecture
- Semantic tokens for all UI states
- No hardcoded colors in components

## Requirements

### 1. Index.css Migration

- Convert all HSL color variables to OKLCH format
- Maintain backwards compatibility during transition
- Update both light and dark mode variables
- Keep `--hero-bg` as already implemented

### 2. Tailwind Config Update

- Update `tailwind.config.js` to use new OKLCH variables
- Add new semantic color mappings (success, warning, error, info)
- Add component-specific color variants
- Ensure all existing Tailwind classes continue working

### 3. Component Updates - Buttons

- Update `button.tsx` to use semantic tokens
- Add status variant buttons (success, warning, info)
- Ensure hover/active/disabled states use token system
- Test all button variants visually

### 4. Component Updates - Badges

- Update `badge.tsx` with status variants
- Add success, warning, error, info badge variants
- Add both muted and solid variants for each status
- Ensure proper contrast in light and dark modes

### 5. Component Updates - Alerts

- Update `alert.tsx` to use semantic status tokens
- Ensure destructive variant uses new error tokens
- Add success, warning, info alert variants if not present
- Verify accessibility contrast ratios

### 6. Component Updates - Inputs

- Update `input.tsx` for error state styling
- Add focus ring using new token system
- Ensure placeholder colors use semantic tokens
- Add validation state classes

### 7. Component Updates - Cards

- Update `card.tsx` to use surface tokens
- Ensure border colors use new token system
- Add hover states if applicable
- Verify shadow tokens are applied

### 8. Find and Replace Hardcoded Colors

- Search codebase for hardcoded hex colors
- Search for inline style color definitions
- Search for direct oklch/hsl usage in components
- Replace all with CSS variable references

### 9. Status Indicator Components

- Create or update document status badges
- Implement processing/pending/done/failed states
- Use animation tokens for processing state
- Ensure colorblind-safe distinctions

### 10. Form Validation Styling

- Update form components for error states
- Add success state styling for validated fields
- Ensure error messages use semantic tokens
- Add focus-visible states with proper colors

### 11. Dark Mode Verification

- Test all components in dark mode
- Verify contrast ratios meet WCAG AA
- Check status colors are visible
- Ensure no color collisions between states

### 12. Documentation

- Document new color token system
- Create usage examples for developers
- Document migration patterns
- Add color palette reference

## Success Criteria

1. All HSL variables converted to OKLCH
2. Zero hardcoded colors in component files
3. All status states (success/warning/error/info) consistently styled
4. Dark mode fully functional with proper contrast
5. No visual regressions from current design
6. Tailwind classes work identically to before

## Technical Notes

- Use `oklch()` format: `oklch(lightness% chroma hue)`
- Lightness: 0-100%, Chroma: 0-0.4, Hue: 0-360
- Browser support: Chrome 111+, Firefox 113+, Safari 15.4+
- Fallback not needed for IntelliFill's target browsers

## Files to Modify

- `quikadmin-web/src/index.css`
- `quikadmin-web/tailwind.config.js`
- `quikadmin-web/src/styles/theme.css`
- `quikadmin-web/src/components/ui/button.tsx`
- `quikadmin-web/src/components/ui/badge.tsx`
- `quikadmin-web/src/components/ui/alert.tsx`
- `quikadmin-web/src/components/ui/input.tsx`
- `quikadmin-web/src/components/ui/card.tsx`
- Any other components with color references
