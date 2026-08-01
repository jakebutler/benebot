# BeneBot Design Direction B: Vibrant Application System

## Overview

Direction B is a warm, editorial system built around the core insight that older patients navigating medical bills should be positioned as heroes of their own story, not victims. The same language now carries from the public landing page into Jane's bill, the web voice session, and the staff proof view. The design combines:

- **Bilingual-first layout** with Spanish as primary text (full-size, heavy typography) and English as secondary (smaller, supporting)
- **Vibrant, saturated palette** with poster-style energy: deep plum ink, vermilion, teal, gold, hot pink, bright sky blue
- **Inline SVG hero illustration** of an older Latina woman in a confident cape, holding the bill without fear, radiating empowerment
- **Heavy Archivo Grotesque type** (900 weight) for display headlines, paired with system sans for body
- **Poster-style dimensionality** via solid offset box shadows (4–6px), sharp borders, and full-bleed color sections

## Visual Principles

### Palette

All colors are CSS custom properties at the `:root` level for tuning in round 2. Current values:

```css
--ink: oklch(24% .065 312);
--paper: oklch(96.5% .035 78);
--flame: oklch(65% .22 38);
--teal: oklch(75% .155 173);
--gold: oklch(84% .17 86);
--pink: oklch(68% .22 352);
--sky: oklch(62% .22 262);
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

1. **Header**: Logo (BeneBot in navy + orange), language toggle (ESPAÑOL · ENGLISH in gold pill)
2. **Hero section**: SVG illustration on left (responsive width), bilingual headline on right
   - Spanish: "Nadie debería necesitar a su hijo para traducir una factura médica." (heavy Archivo 900, flame red)
   - English: "Nobody should need their kid to translate a medical bill." (smaller, secondary color)
3. **Problem statement**: Dark plum background, full-bleed, three statistics cards with colored numbers (gold, teal, pink)
4. **Two-audience section**: Four cards (pink, teal, gold, magenta backgrounds) with emoji icons and body copy
5. **Accuracy section**: Explains three-source discipline with small illustrations
6. **Provider value prop**: Full-bleed teal section highlighting the structured case workflow
7. **Tech stack / Footer**: Medplum, Deepgram, Stedi logos

### Spacing & Dimensionality

- **Gutters:** Responsive padding via `clamp()`, tighter on mobile
- **Box shadows:** Solid 4–6px offset in deep plum (e.g., `box-shadow: 6px 4px solid var(--ink)`)
- **Borders:** 2.5px solid plum on cards and buttons
- **Separators:** 4px solid rule lines between sections
- **Cards:** Pastel-tinted backgrounds (#FFE0D7, #CFF6EF, #FFEFC2, #FFD9E7) with rounded corners

## Application integration

The standalone `landing-b.html` remains the visual source artifact. The Next.js application now uses it through:

1. **Bilingual hierarchy**: Spanish is primary in the hero and demo route, with concise English support.
2. **Global tokens**: the OKLCH palette in `app/globals.css` drives marketing and product surfaces.
3. **Reusable illustration**: `components/landing/hero-illustration.tsx` adapts the approved SVG hero.
4. **Product patterns**: strong outlines, solid offset shadows, warm paper, source-color separation, and familiar accessible controls continue through the bill and voice panel.

The voice experience stays a conventional product interface. Poster styling identifies the brand, while standard language selection, transcript, text input, microphone, speaker, activity, source, success, and failure affordances remain easy to recognize.

## Color-tuning checklist

Palette changes remain one-line edits in `app/globals.css`. Preserve contrast and keep the source/status meaning intact when tuning.

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

## Primary implementation files

```
app/globals.css
app/page.tsx
components/landing/hero-illustration.tsx
components/bill/
components/voice/
design/landing-b.html
```

The HTML is self-contained (no external assets or CDN dependencies except system fonts) so it can be opened locally, shared for review, or deployed as a static page.
