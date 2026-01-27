# LovSigil Project Guidelines

## Design System: Mystic Rune Theme

LovSigil uses a unified "Mystic Rune" design language - dark mystical backgrounds with golden rune accents.

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--color-gold` | #D4AF37 | Primary accent (Rune Gold) |
| `--color-copper` | #CC785C | Secondary accent (Rune Copper) |
| `--color-bg-deep` | #0A0A0B | Deepest backgrounds |
| `--color-bg-dark` | #121214 | Primary dark background |
| `--color-bg-card` | #1A1A1E | Cards, elevated surfaces |
| `--color-bg-elevated` | #242428 | Interactive elements |

### Semantic Classes (Use These!)

```css
/* Backgrounds */
bg-background    /* Main page background */
bg-card          /* Cards, dialogs */

/* Text */
text-primary     /* Gold accent text */
text-secondary   /* Copper accent text */
text-foreground  /* Main content */
text-muted-foreground /* Secondary text */

/* Borders */
border-primary   /* Gold borders */
border-secondary /* Copper borders */

/* Utility Classes */
.gradient-gold-copper  /* Primary gradient buttons */
.text-gold            /* Gold text */
.text-copper          /* Copper text */
```

### Rules

1. **NEVER hardcode hex colors** - Always use semantic classes
2. **Dark mode is default** - No light mode needed
3. **No cyan (#00D4FF)** - Removed from design system
4. **Gradients** - Use `gradient-gold-copper` for primary actions

### Examples

```tsx
// Good
<Button className="gradient-gold-copper">Generate</Button>
<div className="bg-card border-primary/30">...</div>
<span className="text-primary">Gold text</span>

// Bad - DON'T DO THIS
<Button className="bg-[#D4AF37]">Generate</Button>
<div className="bg-[#1a1a2e] border-[#D4AF37]/30">...</div>
```

## Tech Stack

- Next.js 15 + App Router
- Tailwind CSS 4
- shadcn/ui (New York style)
- Supabase (Auth + DB + Storage)
- ZenMux (AI image generation)
