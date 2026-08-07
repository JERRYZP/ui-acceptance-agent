# Token Mapping Engine Reference

## Purpose

Transform design tokens from Figma/screenshot into CSS-compatible values that can be compared against runtime `getComputedStyle`.

## The Mapping Problem

| Design Source | Format | Runtime Source | Format |
|---------------|--------|----------------|--------|
| Figma | `16px` | CSS Custom Property | `var(--spacing-4)` |
| Figma | `#C0472A` | Tailwind Class | `text-primary-600` |
| Figma | `font-weight: 600` | CSS Modules | `fontWeight: 'semibold'` |
| Screenshot | `48px` (inferred) | Inline Style | `height: '3rem'` |

**Rule**: Never compare raw values. Always map to a normalized intermediate representation first.

## Mapping Pipeline

```
Design Token (Figma/Screenshot)
          |
   [Step 1] Parse raw value
          |
   [Step 2] Normalize unit
          |
   [Step 3] Resolve alias
          |
   [Step 4] Convert to CSS equivalent
          |
Normalized Token (Canonical Form)
```

## Step 1: Parse Raw Value

| Raw Value | Parsed Result |
|-----------|---------------|
| `16px` | `{ value: 16, unit: 'px', type: 'length' }` |
| `1rem` | `{ value: 1, unit: 'rem', type: 'length' }` |
| `var(--spacing-4)` | `{ alias: '--spacing-4', type: 'css-var' }` |
| `#C0472A` | `{ r: 192, g: 71, b: 42, type: 'hex' }` |
| `rgba(192,71,42,1)` | `{ r: 192, g: 71, b: 42, a: 1, type: 'rgba' }` |
| `text-primary-600` | `{ alias: 'primary-600', type: 'tailwind' }` |

## Step 2: Normalize Unit

### Unit Resolution Order

1. **px** -> Keep as-is
2. **rem** -> Multiply by root font size (default: 16px)
3. **em** -> Multiply by parent font size (detected from DOM)
4. **%** -> Multiply by parent container size
5. **vw/vh** -> Multiply by viewport size
6. **CSS Custom Property (`var(--x)`)** -> Resolve from runtime `getComputedStyle`
7. **Tailwind class** -> Resolve from `tailwind.config.js` or runtime computed style

### Normalization Algorithm

```typescript
function normalizeLength(raw: string, context: StyleContext): number {
  const parsed = parseRaw(raw);

  switch (parsed.unit) {
    case 'px': return parsed.value;
    case 'rem': return parsed.value * context.rootFontSize;
    case 'em': return parsed.value * context.parentFontSize;
    case '%': return (parsed.value / 100) * context.parentSize;
    case 'vw': return (parsed.value / 100) * context.viewportWidth;
    case 'vh': return (parsed.value / 100) * context.viewportHeight;
    case 'css-var': return resolveCSSVar(parsed.alias, context);
    case 'tailwind': return resolveTailwindClass(parsed.alias, context);
    default: return parsed.value;
  }
}
```

### Normalization Examples

| Design Value | Runtime Value | Normalized Design | Normalized Runtime | Match? |
|--------------|---------------|-------------------|--------------------|----|
| `16px` | `1rem` (16px root) | 16px | 16px | PASS |
| `48px` | `3rem` (16px root) | 48px | 48px | PASS |
| `var(--spacing-4)` | `16px` | 16px | 16px | PASS |
| `text-primary-600` | `#C0472A` | #C0472A | #C0472A | PASS |
| `12px` | `0.75rem` (14px root) | 12px | 10.5px | FAIL |

## Step 3: Resolve Aliases

### Token Registry Schema

```json
{
  "spacing": {
    "spacing-0": "0px",
    "spacing-1": "4px",
    "spacing-2": "8px",
    "spacing-3": "12px",
    "spacing-4": "16px",
    "spacing-5": "20px",
    "spacing-6": "24px",
    "spacing-8": "32px"
  },
  "colors": {
    "primary-50": "#FDE8E3",
    "primary-100": "#FBD0C7",
    "primary-200": "#F7A194",
    "primary-300": "#F37262",
    "primary-400": "#EF4330",
    "primary-500": "#C0472A",
    "primary-600": "#9A3922"
  },
  "typography": {
    "text-xs": "12px",
    "text-sm": "14px",
    "text-base": "16px",
    "text-lg": "18px",
    "text-xl": "20px",
    "text-2xl": "24px"
  },
  "radius": {
    "radius-sm": "4px",
    "radius-md": "8px",
    "radius-lg": "12px",
    "radius-xl": "16px",
    "radius-2xl": "20px"
  }
}
```

## Step 4: Color Normalization

```typescript
function normalizeColor(raw: string): { r: number; g: number; b: number; a: number } {
  if (raw.startsWith('#')) {
    const hex = raw.replace('#', '');
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
      a: hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1
    };
  }

  if (raw.startsWith('rgb')) {
    const matches = raw.match(/\d+/g);
    if (matches) {
      return {
        r: parseInt(matches[0]),
        g: parseInt(matches[1]),
        b: parseInt(matches[2]),
        a: matches[3] ? parseFloat(matches[3]) : 1
      };
    }
  }

  if (raw.startsWith('hsl')) {
    return hslToRgb(parseHsl(raw));
  }

  if (raw.startsWith('var(--')) {
    return resolveRuntimeColor(raw);
  }

  if (namedColors[raw]) {
    return namedColors[raw];
  }

  throw new Error(`Unsupported color format: ${raw}`);
}
```

### Color Comparison Tolerance (Delta-E)

| Delta-E | Result |
|---------|--------|
| < 2 | PASS (imperceptible) |
| 2-5 | WARN (noticeable but acceptable) |
| > 5 | FAIL (visually different) |

## Step 5: Confidence-Weighted Normalization

| Confidence | Tolerance (Length) | Tolerance (Color Delta-E) |
|------------|--------------------|---------------------------|
| >= 0.9 | +/- 2px | Delta-E < 2 |
| 0.7 - 0.89 | +/- 4px or +/-10% | Delta-E < 4 |
| 0.5 - 0.69 | +/- 8px or +/-20% | Delta-E < 6 |
| < 0.5 | Skip comparison | Skip comparison |

## Token Mapping Output

```json
{
  "mapped_tokens": {
    "button_height": {
      "design": {
        "raw": "48px",
        "source": "figma",
        "normalized": 48,
        "confidence": 1.0
      },
      "runtime": {
        "raw": "3rem",
        "source": "computed_style",
        "normalized": 48,
        "confidence": 1.0
      },
      "match": true,
      "diff": 0
    },
    "button_padding": {
      "design": {
        "raw": "var(--spacing-4)",
        "source": "design.md",
        "normalized": 16,
        "confidence": 0.9
      },
      "runtime": {
        "raw": "20px",
        "source": "computed_style",
        "normalized": 20,
        "confidence": 1.0
      },
      "match": false,
      "diff": 4,
      "severity": "medium"
    }
  },
  "unresolved_tokens": [
    {
      "name": "card_radius",
      "reason": "Design value from screenshot confidence 0.45 below threshold",
      "action": "manual_verification_required"
    }
  ]
}
```

## Quick Reference: Figma API to Screenshot Fallback Mapping

| Figma API Path | Design Schema Field | Screenshot Fallback |
|----------------|--------------------|--------------------|
| `node.style.fontSize` | `typography.fontSize` | OCR + box height * 0.7 |
| `node.style.fontWeight` | `typography.fontWeight` | Cannot reliably infer -> use design.md only |
| `node.fills[0].color` | `color.hex` | Pixel clustering + nearest neighbor match |
| `node.layoutMode` | `layout.flexDirection` | Infer from element arrangement |
| `node.paddingTop` | `layout.paddingTop` | Box boundary vs content boundary delta |
| `node.itemSpacing` | `layout.gap` | Average distance between child elements |
| `node.cornerRadius` | `border.radius` | Corner detection + curvature estimation |
| `node.absoluteBoundingBox` | `layout.width/height` | Direct from detection box |
| `node.componentProperties` | `variants` | Compare multiple screenshots to identify states |
