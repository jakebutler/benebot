# BeneBot Design Direction B — Vibrant Hero Landing

## Overview

Direction B is a warm, editorial landing page built around the core insight that elderly patients navigating medical bills should be positioned as heroes of their own story, not victims. The design combines:

- **Bilingual-first layout** with Spanish as primary text (full-size, heavy typography) and English as secondary (smaller, supporting)
- **Vibrant, saturated palette** with poster-style energy — deep plum ink, vermilion, teal, gold, hot pink, bright sky blue
- **Inline SVG hero illustration** of an older Latina woman in a confident cape, holding the bill without fear, radiating empowerment
- **Heavy Archivo Grotesque type** (900 weight) for display headlines, paired with system sans for body
- **Poster-style dimensionality** via solid offset box shadows (4–6px), sharp borders, and full-bleed color sections

## Visual Principles

### Palette

All colors are CSS custom properties at the `:root` level for tuning in round 2. Current values:

```css
--flame: #FF4A22       /* Vermilion primary */
--teal: #00C4A7       /* Teal accent */
--gold: #FFC62E       /* Bright gold */
--pink: #FF3D8B       /* Hot pink */
--sky: #3D7BFF        /* Bright sky blue */
--ink: #241533        /* Deep plum, text and shadows */
--paper: #FFF3E2      /* Bright warm cream, background */
```

Rationale: The palette is intentionally loud and energetic to match the confidence/empowerment tone. Dull or muted tones undermine the message.

### Typography

- **Display headlines:** Archivo Grotesque 900, sized responsively via `clamp()`. Spanish headlines in `--flame` red for emphasis.
- **Body copy:** System sans (`.system-font`), regular weight, charcoal on cream.
- **Eyebrow/labels:** Archivo Medium or Regular, all-caps, tracking, muted color.

### Illustration

The hero illustration is an inline SVG portrait featuring:

- **Subject:** An older Latina woman (face #A76B41, dark hair #2A1836, glasses #241533, grey temple streaks #CFC4DC)
- **Confidence markers:** Genuine smile, laugh lines, rounded cheeks, steady eye contact through glasses
- **Hero costume:** Vermilion cape flowing behind shoulders, gold torso, gold "B" emblem on chest
- **Prop:** Holding the $620 bill with a checkmark (teal circle)
- **Background:** Radiating sunburst of gold (95% opacity, 12 large rays) and pink (55% opacity, 6 medium rays) on a bright sky-blue medallion
- **Visual contrast:** Dark hair silhouettes properly against bright sky background; grey streaks signal maturity without caricature; glasses add personality and accessibility representation

**File marker:** The SVG is wrapped in a comment block to allow easy replacement:

```html
<!-- SVG HERO ILLUSTRATION SWAP TARGET
     To replace with generated or commissioned art, drop a square image (320px+)
     here and adjust the wrapper height. -->
```

This preserves the ability to upgrade to a richer illustration (painted, photographic, comic-book style) without refactoring the layout.

### Layout Structure

1. **Header** — Logo (BeneBot in navy + orange), language toggle (ESPAÑOL · ENGLISH in gold pill)
2. **Hero section** — SVG illustration on left (responsive width), bilingual headline on right
   - Spanish: "Nadie debería necesitar a su hijo para traducir una factura médica." (heavy Archivo 900, flame red)
   - English: "Nobody should need their kid to translate a medical bill." (smaller, secondary color)
3. **Problem statement** — Dark plum background, full-bleed, three statistics cards with colored numbers (gold, teal, pink)
4. **Two-audience section** — Four cards (pink, teal, gold, magenta backgrounds) with emoji icons and body copy
5. **Accuracy section** — Explains three-source discipline with small illustrations
6. **Provider value prop** — Full-bleed teal section highlighting the structured case workflow
7. **Tech stack / Footer** — Medplum, Deepgram, Stedi logos

### Spacing & Dimensionality

- **Gutters:** Responsive padding via `clamp()`, tighter on mobile
- **Box shadows:** Solid 4–6px offset in deep plum (e.g., `box-shadow: 6px 4px solid var(--ink)`)
- **Borders:** 2.5px solid plum on cards and buttons
- **Separators:** 4px solid rule lines between sections
- **Cards:** Pastel-tinted backgrounds (#FFE0D7, #CFF6EF, #FFEFC2, #FFD9E7) with rounded corners

## Integration into `app/page.tsx`

The standalone landing-b.html can serve as:

1. **Copy/typography reference** — The bilingual hierarchy, headline scales, and body copy structure are directly applicable to the Next.js landing page.
2. **Palette source** — Lift the CSS custom properties and apply them throughout the main app layout.
3. **Illustration inspiration** — Adapt the SVG hero or commission an equivalent for the app's hero section.
4. **Component patterns** — The offset-shadow cards, full-bleed sections, and stat cards are modular and can be extracted as React components.

Key adaptation points:

- Move the `:root` color palette to a global CSS file or Tailwind config
- Extract card and section components to `components/` for reuse
- Adapt the SVG illustration to be a React component or imported asset
- Update responsive breakpoints to match the app's breakpoint strategy
- Wire the language toggle to the app's session-language state

## Color-tuning checklist for round 2

If the user requests palette changes, these are one-line edits:

- Warmer gold? Change `--gold: #FFC62E` to a more orange-leaning value (e.g., `#FFD700`)
- Less hot pink? Desaturate `--pink: #FF3D8B` (e.g., `#FF6BB8`)
- Deeper plum for better contrast? Adjust `--ink: #241533`
- Brighter or softer cream? Tune `--paper: #FFF3E2`

## Accessibility notes

- High contrast between text and background (tested on all color blocks)
- All interactive elements are keyboard-navigable
- Illustration uses `aria-hidden` (decorative); text content carries semantic meaning
- Language toggle is a proper button with clear state
- Emoji icons on cards have fallback text via `title` attributes

## File structure

```
design/
├── landing-b.html          # Standalone HTML with inline CSS and SVG
└── DESIGN.md               # This file
```

The HTML is self-contained (no external assets or CDN dependencies except system fonts) so it can be opened locally, shared for review, or deployed as a static page.
