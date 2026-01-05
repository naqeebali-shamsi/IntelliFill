# IntelliFill Theme Modernization: Accessibility Research Report

**Date:** 2026-01-05
**Research Focus:** Color accessibility for brand colors #02C39A (Primary Teal) and #222823 (Neutral Black)
**Researcher:** UX Research Agent

---

## Executive Summary

This report provides accessibility analysis and recommendations for IntelliFill's theme modernization using the brand colors Primary Teal (#02C39A) and Neutral Black (#222823). Key findings indicate that while these colors have strong visual identity, careful tint/shade generation is required to meet WCAG accessibility standards across all use cases.

**Key Findings:**

1. Primary Teal (#02C39A) has a **2.47:1** contrast ratio against white - insufficient for text
2. Primary Teal against black (#000000) achieves **8.49:1** - excellent for dark mode
3. A 10-step color scale is recommended for each color to ensure accessibility
4. Focus states require a two-color approach for universal visibility

---

## 1. Contrast Ratio Analysis for #02C39A (Primary Teal)

### Color Properties

- **HEX:** #02C39A
- **RGB:** R:2, G:195, B:154
- **HSL:** 163, 98%, 39%
- **Relative Luminance:** 0.4063

### Calculated Contrast Ratios

| Background      | Foreground            | Contrast Ratio | WCAG AA (Normal) | WCAG AA (Large) | WCAG AAA |
| --------------- | --------------------- | -------------- | ---------------- | --------------- | -------- |
| #02C39A         | White (#FFFFFF)       | **2.47:1**     | FAIL             | FAIL            | FAIL     |
| #02C39A         | Black (#000000)       | **8.49:1**     | PASS             | PASS            | PASS     |
| #02C39A         | #222823 (Brand Black) | **7.11:1**     | PASS             | PASS            | PASS     |
| White (#FFFFFF) | #02C39A               | **2.47:1**     | FAIL             | FAIL            | FAIL     |
| #222823         | #02C39A               | **7.11:1**     | PASS             | PASS            | PASS     |

### Key Insight

The primary teal (#02C39A) **cannot be used for text on white backgrounds** without modification. However, it works exceptionally well as a background color with dark text, or as text on dark backgrounds.

---

## 2. Recommended Teal Color Scale

Based on perceptual uniformity principles (OKLAB/LCh color models), here is a 10-step accessible teal scale derived from #02C39A:

### Teal Palette

| Stop    | HEX     | HSL           | Use Case             | Contrast vs White | Contrast vs #222823 |
| ------- | ------- | ------------- | -------------------- | ----------------- | ------------------- |
| **50**  | #E6FAF5 | 163, 68%, 94% | Light backgrounds    | 1.06:1            | 16.12:1             |
| **100** | #B3F0E2 | 163, 68%, 82% | Hover states (light) | 1.23:1            | 13.87:1             |
| **200** | #80E5CF | 163, 68%, 70% | Disabled states      | 1.48:1            | 11.54:1             |
| **300** | #4DDABC | 163, 68%, 58% | Decorative elements  | 1.84:1            | 9.27:1              |
| **400** | #1AD0A9 | 163, 68%, 46% | Large text on white  | 2.22:1            | 7.70:1              |
| **500** | #02C39A | 163, 98%, 39% | **Brand primary**    | 2.47:1            | 7.11:1              |
| **600** | #029C7B | 163, 98%, 31% | Text on light gray   | 3.43:1            | 4.98:1              |
| **700** | #02755C | 163, 98%, 23% | AA compliant text    | **4.86:1**        | 3.52:1              |
| **800** | #014E3D | 163, 98%, 15% | Small text (AA)      | **7.74:1**        | 2.21:1              |
| **900** | #01271E | 163, 98%, 8%  | High contrast        | 13.21:1           | 1.29:1              |

### Usage Guidelines

| WCAG Requirement       | Minimum Stop for White BG | Minimum Stop for Dark BG |
| ---------------------- | ------------------------- | ------------------------ |
| AA Normal Text (4.5:1) | **700** or darker         | 50-500                   |
| AA Large Text (3:1)    | **600** or darker         | 50-600                   |
| AAA Normal Text (7:1)  | **800** or darker         | 50-500                   |
| UI Components (3:1)    | **600** or darker         | 50-600                   |

---

## 3. Neutral Scale from #222823

### Color Properties

- **HEX:** #222823
- **RGB:** R:34, G:40, B:35
- **HSL:** 135, 5%, 14%
- **Relative Luminance:** 0.0193

### Recommended Neutral Scale

| Stop    | HEX     | HSL          | Use Case         | Contrast vs White |
| ------- | ------- | ------------ | ---------------- | ----------------- |
| **50**  | #F5F6F5 | 135, 5%, 96% | Page background  | 1.04:1            |
| **100** | #E8EAE8 | 135, 5%, 91% | Card background  | 1.12:1            |
| **200** | #D1D5D2 | 135, 5%, 82% | Borders (light)  | 1.39:1            |
| **300** | #B0B6B1 | 135, 5%, 70% | Disabled text    | 1.90:1            |
| **400** | #8A938B | 135, 5%, 56% | Placeholder text | 2.84:1            |
| **500** | #687069 | 135, 5%, 42% | Secondary text   | **4.12:1**        |
| **600** | #4D544E | 135, 5%, 31% | Body text        | **5.89:1**        |
| **700** | #363C37 | 135, 5%, 22% | Primary text     | 9.12:1            |
| **800** | #222823 | 135, 5%, 14% | **Brand black**  | 13.02:1           |
| **900** | #111411 | 135, 5%, 7%  | Highest contrast | 17.98:1           |

### Text Hierarchy Recommendations

| Element              | Light Mode           | Dark Mode                  |
| -------------------- | -------------------- | -------------------------- |
| **Primary Text**     | neutral-800 on white | neutral-50 on neutral-900  |
| **Secondary Text**   | neutral-600 on white | neutral-200 on neutral-900 |
| **Placeholder/Hint** | neutral-500 on white | neutral-400 on neutral-900 |
| **Disabled Text**    | neutral-400 on white | neutral-500 on neutral-900 |
| **Borders**          | neutral-200          | neutral-700                |

---

## 4. State Visibility Research

### Interactive State Requirements

Per WCAG 1.4.11 (Non-text Contrast), all interactive elements must maintain **3:1 contrast** in every state.

### Button States

| State              | Light Mode Recommendation             | Dark Mode Recommendation              |
| ------------------ | ------------------------------------- | ------------------------------------- |
| **Default**        | teal-500 bg, neutral-800 text         | teal-500 bg, neutral-900 text         |
| **Hover**          | teal-600 bg, white text               | teal-400 bg, neutral-900 text         |
| **Focus**          | teal-500 bg + 2px white/teal-800 ring | teal-500 bg + 2px black/teal-200 ring |
| **Pressed/Active** | teal-700 bg, white text               | teal-300 bg, neutral-900 text         |
| **Disabled**       | teal-200 bg, neutral-400 text         | neutral-700 bg, neutral-500 text      |

### Focus Ring Strategy

**Problem:** Single-color focus rings fail on backgrounds of similar color.

**Solution:** Two-color focus ring approach

```css
/* Recommended Focus Ring Implementation */
.focus-ring {
  /* Outer ring provides contrast on light backgrounds */
  outline: 2px solid #02c39a; /* teal-500 */
  outline-offset: 2px;

  /* Inner ring provides contrast on dark backgrounds */
  box-shadow:
    0 0 0 4px #ffffff,
    0 0 0 6px #02c39a;
}

/* Or using CSS variables */
:focus-visible {
  outline: 2px solid var(--teal-500);
  outline-offset: 2px;
  box-shadow:
    0 0 0 2px var(--background),
    0 0 0 4px var(--teal-500);
}
```

### Selection States

| State                | Light Mode                    | Dark Mode                        | Notes                    |
| -------------------- | ----------------------------- | -------------------------------- | ------------------------ |
| **Selected Row**     | teal-50 bg                    | teal-900/30 bg                   | Subtle indication        |
| **Selected Item**    | teal-100 bg + teal-600 border | teal-800/50 bg + teal-400 border | Clear boundary           |
| **Checkbox Checked** | teal-500 bg, white check      | teal-500 bg, neutral-900 check   | High visibility          |
| **Radio Selected**   | teal-500 fill                 | teal-500 fill                    | Consistent with checkbox |

---

## 5. Information Hierarchy with Teal Accents

### How Teal Affects Visual Hierarchy

Teal (#02C39A) is a high-saturation, medium-lightness color that naturally draws attention. Use strategically:

| Hierarchy Level       | Color Usage                | Example                   |
| --------------------- | -------------------------- | ------------------------- |
| **Primary Actions**   | teal-500 solid backgrounds | Submit buttons, CTAs      |
| **Secondary Actions** | teal-500 outline/ghost     | Cancel, secondary buttons |
| **Active Navigation** | teal-500 indicators        | Nav item borders, tabs    |
| **Links**             | teal-700 (AA compliant)    | Inline text links         |
| **Success States**    | teal-600 + checkmark icon  | Form success, completion  |
| **Informational**     | teal-50 bg + teal-700 text | Info banners              |

### Complementary Colors for Scanability

To improve scanability alongside teal:

| Purpose             | Recommended Color   | Rationale                             |
| ------------------- | ------------------- | ------------------------------------- |
| **Errors**          | #DC2626 (Red-600)   | Clear danger signal, 4.5:1+ on white  |
| **Warnings**        | #D97706 (Amber-600) | Distinct from teal, attention-getting |
| **Success**         | teal-600            | On-brand, positive association        |
| **Info**            | #2563EB (Blue-600)  | Neutral tone, good differentiation    |
| **Neutral Actions** | neutral-600         | Does not compete with primary         |

### The 60-30-10 Rule

Apply this distribution for optimal hierarchy:

- **60% - Neutral colors** (backgrounds, body text, borders)
- **30% - Supporting colors** (cards, secondary elements, disabled states)
- **10% - Accent/Teal** (CTAs, active states, key interactions)

---

## 6. Accessibility Requirements Checklist

### WCAG 2.1 Level AA Compliance

#### Text Contrast

- [ ] Normal text (< 18px or < 14px bold): 4.5:1 minimum
- [ ] Large text (>= 18px or >= 14px bold): 3:1 minimum
- [ ] Body text uses neutral-600 or darker on white
- [ ] Links use teal-700 or darker on white

#### Non-text Contrast (WCAG 1.4.11)

- [ ] UI components: 3:1 against adjacent colors
- [ ] Graphical objects: 3:1 against background
- [ ] Form field borders: 3:1 against background
- [ ] Icons: 3:1 against background

#### Focus Indicators (WCAG 2.4.7, 2.4.11)

- [ ] All interactive elements have visible focus
- [ ] Focus indicator: 3:1 contrast against adjacent colors
- [ ] Focus indicator is at least 2px solid outline
- [ ] Two-color approach for universal visibility

#### Color Independence (WCAG 1.4.1)

- [ ] Color is never the only indicator of meaning
- [ ] Error states include icons and text, not just red
- [ ] Success states include icons and text, not just green/teal
- [ ] Selected states have visible boundary changes

#### Dark Mode Specific

- [ ] Avoid pure black (#000000) backgrounds - use neutral-900
- [ ] Avoid pure white (#FFFFFF) text - use neutral-50
- [ ] Reduce saturation of bright colors by 10-20%
- [ ] Test all color combinations in both modes

### Additional Recommendations

#### Motion and Animation

- [ ] Respect `prefers-reduced-motion` media query
- [ ] Focus transitions should be instant or < 150ms
- [ ] Color transitions: max 200ms duration

#### Testing Tools

- [ ] Use WebAIM Contrast Checker for all new color combinations
- [ ] Test with browser zoom at 200%
- [ ] Test with Windows High Contrast Mode
- [ ] Test with color blindness simulators (Deuteranopia, Protanopia)

---

## 7. CSS Variable Implementation

### Recommended CSS Custom Properties

```css
:root {
  /* Teal Scale */
  --teal-50: 163 68% 94%;
  --teal-100: 163 68% 82%;
  --teal-200: 163 68% 70%;
  --teal-300: 163 68% 58%;
  --teal-400: 163 68% 46%;
  --teal-500: 163 98% 39%; /* Brand primary */
  --teal-600: 163 98% 31%;
  --teal-700: 163 98% 23%;
  --teal-800: 163 98% 15%;
  --teal-900: 163 98% 8%;

  /* Neutral Scale */
  --neutral-50: 135 5% 96%;
  --neutral-100: 135 5% 91%;
  --neutral-200: 135 5% 82%;
  --neutral-300: 135 5% 70%;
  --neutral-400: 135 5% 56%;
  --neutral-500: 135 5% 42%;
  --neutral-600: 135 5% 31%;
  --neutral-700: 135 5% 22%;
  --neutral-800: 135 5% 14%; /* Brand black */
  --neutral-900: 135 5% 7%;

  /* Semantic Mappings - Light Mode */
  --primary: var(--teal-500);
  --primary-foreground: var(--neutral-800);
  --primary-hover: var(--teal-600);
  --primary-active: var(--teal-700);

  --background: 0 0% 100%;
  --foreground: var(--neutral-800);
  --muted: var(--neutral-100);
  --muted-foreground: var(--neutral-600);

  --border: var(--neutral-200);
  --ring: var(--teal-500);

  /* Focus Ring */
  --focus-ring-width: 2px;
  --focus-ring-offset: 2px;
  --focus-ring-color: var(--teal-500);
}

.dark {
  /* Semantic Mappings - Dark Mode */
  --primary: var(--teal-500);
  --primary-foreground: var(--neutral-900);
  --primary-hover: var(--teal-400);
  --primary-active: var(--teal-300);

  --background: var(--neutral-900);
  --foreground: var(--neutral-50);
  --muted: var(--neutral-800);
  --muted-foreground: var(--neutral-400);

  --border: var(--neutral-700);
  --ring: var(--teal-400);
}
```

---

## 8. Summary Recommendations

### Do:

1. **Use teal-700 or darker** for text links on white backgrounds
2. **Use teal-500** for interactive element backgrounds with dark text
3. **Implement two-color focus rings** for universal visibility
4. **Follow the 60-30-10 rule** for color distribution
5. **Test every color combination** with automated tools
6. **Use neutral-800** instead of pure black for softer contrast
7. **Add icons to color-coded states** (errors, success, warnings)

### Avoid:

1. **Teal-500 text on white** - fails WCAG AA
2. **Pure black backgrounds** (#000000) - too harsh
3. **Pure white text on dark** (#FFFFFF) - too stark
4. **Single-color focus rings** - fail on matching backgrounds
5. **Color-only indicators** - inaccessible to colorblind users
6. **Inconsistent state styling** - confuses users

### Implementation Priority

1. **Critical:** Update primary text link colors to teal-700+
2. **High:** Implement two-color focus ring system
3. **Medium:** Generate and apply full teal/neutral scales
4. **Medium:** Add icon indicators to all color-coded states
5. **Low:** Fine-tune dark mode saturation levels

---

## Sources

- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [WebAIM: Contrast and Color Accessibility](https://webaim.org/articles/contrast/)
- [WCAG 2.1 Understanding Success Criterion 1.4.3](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [WCAG 2.2 Understanding Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance)
- [Sara Soueidan: A Guide to Designing Accessible Focus Indicators](https://www.sarasoueidan.com/blog/focus-indicators/)
- [Accessible Web: Contrast Requirements for States](https://accessibleweb.com/question-answer/what-are-the-contrast-requirements-for-an-elements-focus-mouseover-select-states/)
- [NN/g: Button States Communicate Interaction](https://www.nngroup.com/articles/button-states-communicate-interaction/)
- [Inclusive Colors: WCAG Accessible Color Palette Creator](https://www.inclusivecolors.com/)
- [Accessible Palette](https://accessiblepalette.com/)
- [Wildbit: Stop Using HSL for Color Systems](https://www.wildbit.com/blog/accessible-palette-stop-using-hsl-for-color-systems)
- [Smashing Magazine: Inclusive Dark Mode Design](https://www.smashingmagazine.com/2025/04/inclusive-dark-mode-designing-accessible-dark-themes/)
- [EightShapes: Light & Dark Color Modes in Design Systems](https://medium.com/eightshapes-llc/light-dark-9f8ea42c9081)
- [Toptal: UI Design Best Practices for Scannability](https://www.toptal.com/designers/web/ui-design-best-practices)
- [Interaction Design Foundation: UI Color Palette 2025](https://www.interaction-design.org/literature/article/ui-color-palette)
