---
name: ui-acceptance-agent
description: >-
  AI-powered UI quality assurance agent that validates frontend implementation
  against design specifications. Compares Figma design, design.md, product
  requirements, UI screenshots, and frontend runtime to perform visual fidelity
  validation, interaction testing, component state verification, responsive
  validation, automatic issue diagnosis, and code modification with iterative
  validation until score >= 95. This skill should be used when performing UI
  acceptance testing, design-to-code comparison, visual regression testing,
  or automated UI fix workflows.
agent_created: true
---

# UI Acceptance Agent

## Role

Act as a senior UI designer, frontend engineer, and QA engineer.

Responsibilities:

- Ensure frontend implementation matches design intent
- Identify visual and interaction differences
- Propose precise, actionable fixes
- Never modify code without user confirmation
- Continue validation after fixes until acceptance criteria met

## Input Resources

The user may provide:

### Required

- **design.md**: Design tokens, colors, typography, components, layout rules, interaction specifications
- **Product Documentation**: User scenarios, business logic, user flows, page states
- **Figma Design** (preferred) OR **UI Screenshots** (fallback): Frames, components, variants, auto layout, prototype interactions
- **Frontend Project**: React/Vue/HTML source, CSS/Tailwind, assets, runtime environment

### Optional

- **Figma API Token**: For automated design extraction (recommended)
- **Tailwind Config**: For token resolution
- **Test Suite**: For post-fix validation

## Workflow Overview

```
Phase 1   -> Parse Design Resources
Phase 1.5 -> Extract Design from Figma/Screenshots
Phase 1.6 -> Token Mapping & Normalization
Phase 2   -> Launch Frontend Application
Phase 3   -> Visual Validation
Phase 4   -> Interaction Validation
Phase 5   -> Responsive Validation
Phase 6   -> Issue Diagnosis
Phase 7   -> Acceptance Score Calculation
Phase 7.5 -> Auto-Fix Sandbox Definition
Phase 8   -> Auto Fix Mode (User-Confirmed)
Phase 9   -> Iterative Loop Until Score >= 95
Phase 10  -> Final Report
```

---

# Phase 1: Parse Design Resources

## Input Parsing

Parse all provided resources:

1. **design.md** -> Extract tokens, components, layout rules
2. **Product Documentation** -> Extract user flows, business logic
3. **Figma Link** -> Store for Phase 1.5 extraction
4. **UI Screenshots** -> Store for Phase 1.5 fallback

## Generate Design Schema (Initial)

```json
{
  "version": "1.0",
  "source_priority": ["figma", "screenshot", "design.md"],
  "tokens": {
    "colors": {},
    "spacing": {},
    "typography": {},
    "radius": {}
  },
  "components": {},
  "pages": [],
  "user_flows": [],
  "unresolved_values": [],
  "requires_manual_review": false
}
```

---

# Phase 1.5: Design Source Resolution

## Priority Strategy

**Figma API First, UI Screenshots Fallback**

The agent MUST attempt Figma API extraction first.

If Figma API is unavailable (no token, no file access, network restriction):

- Fallback to **UI screenshot + design.md** cross-reference.
- Mark all extracted values with `source: "screenshot_inference"` for confidence tracking.

## Mode A: Figma API Extraction (Preferred)

### Prerequisites

```bash
# Environment variables
FIGMA_TOKEN=figd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FIGMA_FILE_ID=abc123def456  # From Figma URL: figma.com/file/abc123def456/...
```

### API Endpoints

| Endpoint | Purpose | Rate Limit |
|----------|---------|------------|
| `GET /v1/files/{file_key}` | Get file metadata + document tree | 1 req/sec |
| `GET /v1/files/{file_key}/nodes?ids={node_ids}` | Get specific nodes with full data | 2 req/sec |
| `GET /v1/files/{file_key}/variables/local` | Get design tokens (Local Variables) | 2 req/sec |
| `GET /v1/files/{file_key}/styles` | Get text/color/grid styles | 2 req/sec |
| `GET /v1/images/{file_key}?ids={node_ids}&format=png&scale=2` | Export node as PNG | 1 req/sec |

### Extraction Mapping

| Figma API Field | Design Schema Field | Notes |
|-----------------|---------------------|-------|
| `node.style.fontSize` | `typography.size` | Convert pt -> px (1pt = 1.333px) |
| `node.style.fontWeight` | `typography.weight` | Direct mapping |
| `node.style.lineHeightPx` | `typography.lineHeight` | If missing, calculate from `lineHeightPercent * fontSize` |
| `node.fills[0].color` | `color.hex` | Convert RGBA {r,g,b,a} -> #HEX or rgba() |
| `node.layoutMode` | `layout.display` | "HORIZONTAL" -> flex-row, "VERTICAL" -> flex-col |
| `node.paddingLeft` | `layout.paddingLeft` | Direct px |
| `node.itemSpacing` | `layout.gap` | Direct px |
| `node.absoluteBoundingBox` | `layout.width/height` | For fixed-size components |
| `node.componentProperties` | `variants` | Map variant names -> allowed values |
| `node.parent.children` | `componentChildren` | For nesting structure |

### Confidence Scoring

| Source | Confidence |
|--------|------------|
| Figma API with Local Variables | `1.0` |
| Figma API with inferred values | `0.85` |
| design.md explicit value | `0.9` |
| design.md inferred from description | `0.6` |
| Screenshot inference | `0.3 - 0.7` |

> **Rule**: When a value is extracted from both Figma and design.md, **Figma overrides** design.md (design.md is a human-authored approximation). If design.md is newer than Figma (based on file modified date), user MUST manually confirm override.

### Figma Client Implementation

The complete Figma API client implementation is in `scripts/figma-client.ts`. Key features:

- Full document tree traversal with recursive component extraction
- Auto Layout property extraction (gap, padding, alignment)
- Typography extraction from TEXT nodes
- Color extraction with RGBA to HEX conversion
- Component variant extraction from Component Properties
- Design token extraction from Local Variables
- Batch node fetching (100 nodes per request)
- Error handling with specific status code messages
- Automatic fallback to screenshot mode on failure

### Error Handling

| Error Code | Meaning | Action |
|------------|---------|--------|
| 400 | Bad Request | Check file key format |
| 403 | Forbidden | Token invalid/expired -> Regenerate |
| 404 | Not Found | File key incorrect -> Check URL |
| 429 | Rate Limited | Wait 60 seconds and retry |
| 500 | Figma Internal | Retry 3 times, fallback to screenshot |

### Performance Optimization

| Scenario | Strategy |
|----------|----------|
| Large file (>1000 nodes) | Use `nodes?ids=` to extract target components only |
| Multiple components | Batch get (100 nodes/request) |
| Image export | On-demand only for components compared with runtime |
| Caching | Cache design schema for 24 hours |

### Figma Token Setup

1. Login to Figma -> Click avatar -> **Settings**
2. Scroll to **Personal Access Tokens** section
3. Click **Create new token**
4. Enter name (e.g., `UI-Acceptance-Agent`)
5. Click **Create token** -> **Copy token** (only shown once)
6. Set environment variable:

```bash
export FIGMA_TOKEN=figd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### File Key Extraction

From Figma URL:
```
https://www.figma.com/file/abc123def456/My-Design-File
                              ^
                         File Key = abc123def456
```

## Mode B: UI Screenshot Fallback

### When Fallback Triggers

- `FIGMA_TOKEN` environment variable is not set
- Figma API returns 403/404 (no access)
- Figma API times out (>10s)
- User explicitly provides screenshots instead of Figma link
- Network restrictions block Figma API

### Screenshot Processing Pipeline

```
Input Screenshot
       |
Step 1: Image Preprocessing
       -> Crop, rotate, scale normalization (target: 1920x1080)
       |
Step 2: Computer Vision Extraction
       -> Detect UI elements using YOLO/Florence-2
       -> Identify: Buttons, Cards, Inputs, Text blocks, Icons
       |
Step 3: Layout Inference
       -> For each detected element:
         - bounding box (x, y, width, height)
         - relative positioning
         - visual hierarchy (z-index from overlap analysis)
       |
Step 4: Color Extraction
       -> Cluster dominant colors using k-means
       -> Match to design.md token names (e.g., "primary": find closest #hex)
       |
Step 5: Typography Inference
       -> OCR (Tesseract/PaddleOCR) to read text
       -> Estimate font size from bounding box height (size ~= height * 0.7)
       -> Estimate weight from stroke width analysis
       |
Step 6: Cross-Reference with design.md
       -> If design.md contains explicit token values, use them as ground truth
       -> Screenshot values are ONLY used for layout/positioning, NOT for exact token matching
       |
Step 7: Confidence Annotation
       -> Each inferred value gets source="screenshot" + confidence (0.3-0.7 based on detection quality)
       -> High-confidence detection: Button bounding box (0.7)
       -> Low-confidence: Exact font weight (0.3)
```

### Screenshot Extraction Confidence Rules

| Detection Type | Baseline Confidence | Boost Condition | Max Confidence |
|----------------|--------------------|-----------------|----|
| Button presence | 0.65 | design.md confirms | 0.75 |
| Card padding | 0.50 | design.md provides token | 0.70 |
| Font size | 0.40 | Matches design.md value | 0.65 |
| Exact color | 0.35 | design.md provides HEX | 0.70 |
| Component state (hover/active) | 0.25 | Multiple screenshots provided | 0.50 |
| Responsive breakpoint | 0.30 | design.md provides breakpoints | 0.55 |

### Fallback Output Schema

```json
{
  "tokens": {
    "primary": {
      "value": "#C0472A",
      "source": "design.md",
      "confidence": 0.9
    },
    "padding": {
      "value": "16px",
      "source": "screenshot_inference",
      "confidence": 0.55,
      "inference_method": "bounding_box_analysis"
    }
  },
  "components": {
    "Button": {
      "height": {
        "value": 48,
        "source": "screenshot_inference",
        "confidence": 0.65,
        "bounding_box": {"x": 100, "y": 200, "w": 120, "h": 48}
      },
      "detected_count": 3,
      "detected_states": ["default", "hover"]
    }
  },
  "warning": "4 values inferred from screenshot with confidence < 0.6. Manual verification recommended."
}
```

### Fallback User Prompt

When falling back to screenshot mode, the agent outputs:

```
WARNING: Figma API unavailable. Falling back to screenshot + design.md inference.

Extracted from screenshot:
- 3 Button components detected (avg height: 48px, confidence: 0.65)
- Primary color inferred: #C0472A (confirmed by design.md, confidence: 0.7)
- Card padding: ~16px (low confidence: 0.5, manual check recommended)

Recommendation: Provide Figma API token for higher accuracy, or confirm these inferred values.

Continue with screenshot-based validation? [Y/n]
```

## Comparison Mode: Both Figma AND Screenshots Available

If both sources are provided, the agent should:

1. Extract from Figma as primary source -> `design_schema_figma`
2. Extract from screenshots as secondary source -> `design_schema_screenshot`
3. Cross-validate:
   - If diff > 10% for any value, flag as "Design Source Mismatch"
   - Ask user: "Figma shows padding:16px, screenshot shows padding:20px. Which source is correct?"
4. Merge:
   - Use Figma for exact tokens (higher confidence)
   - Use screenshot for layout composition (actual rendered context)

## Final Design Schema (Unified)

Regardless of source, the final `design_schema.json` MUST include:

```json
{
  "version": "1.0",
  "source_priority": ["figma", "screenshot", "design.md"],
  "tokens": {
    "primary": {
      "value": "#C0472A",
      "source": "figma",
      "confidence": 1.0
    }
  },
  "components": {
    "Button": {
      "height": {
        "value": 48,
        "source": "figma",
        "confidence": 1.0
      }
    }
  },
  "unresolved_values": [],
  "requires_manual_review": false,
  "fallback_warnings": []
}
```

---

# Phase 1.6: Token Mapping Engine

## Purpose

Transform design tokens from Figma/screenshot into **CSS-compatible values** that can be compared against runtime `getComputedStyle`.

## The Mapping Problem

| Design Source | Format | Runtime Source | Format |
|---------------|--------|----------------|--------|
| Figma | `16px` | CSS Custom Property | `var(--spacing-4)` |
| Figma | `#C0472A` | Tailwind Class | `text-primary-600` |
| Figma | `font-weight: 600` | CSS Modules | `fontWeight: 'semibold'` |
| Screenshot | `48px` (inferred) | Inline Style | `height: '3rem'` |

**Rule**: Never compare raw values. Always map to a **normalized intermediate representation** first.

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

Detect format and extract base value + unit.

| Raw Value | Parsed Result |
|-----------|---------------|
| `16px` | `{ value: 16, unit: 'px', type: 'length' }` |
| `1rem` | `{ value: 1, unit: 'rem', type: 'length' }` |
| `var(--spacing-4)` | `{ alias: '--spacing-4', type: 'css-var' }` |
| `#C0472A` | `{ r: 192, g: 71, b: 42, type: 'hex' }` |
| `rgba(192,71,42,1)` | `{ r: 192, g: 71, b: 42, a: 1, type: 'rgba' }` |
| `text-primary-600` | `{ alias: 'primary-600', type: 'tailwind' }` |

## Step 2: Normalize Unit

Convert all length values to a **canonical unit** (px) for comparison.

### Unit Resolution Order

1. **If value is `px`** -> Keep as-is
2. **If value is `rem`** -> Multiply by root font size (default: 16px unless `:root { font-size }` is detected)
3. **If value is `em`** -> Multiply by parent font size (detected from DOM)
4. **If value is `%`** -> Multiply by parent container size
5. **If value is `vw/vh`** -> Multiply by viewport size
6. **If value is CSS Custom Property (`var(--x)`)** -> Resolve from runtime `getComputedStyle`
7. **If value is Tailwind class** -> Resolve from `tailwind.config.js` or runtime computed style

### Normalization Algorithm

```typescript
function normalizeLength(raw: string, context: StyleContext): number {
  const parsed = parseRaw(raw);

  switch (parsed.unit) {
    case 'px': return parsed.value;
    case 'rem': return parsed.value * context.rootFontSize; // default 16px
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
| `16px` | `1rem` (with 16px root) | 16px | 16px | PASS |
| `48px` | `3rem` (with 16px root) | 48px | 48px | PASS |
| `var(--spacing-4)` | `16px` | Resolve to 16px | 16px | PASS |
| `text-primary-600` | `#C0472A` | Resolve to #C0472A | #C0472A | PASS |
| `12px` | `0.75rem` (with 14px root) | 12px | 10.5px | FAIL (diff: -1.5px) |

## Step 3: Resolve Aliases

Maintain a Token Registry that maps design token names to their resolved values.

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

Convert all color values to a canonical RGB representation.

```typescript
function normalizeColor(raw: string): { r: number; g: number; b: number; a: number } {
  // Hex -> RGB
  if (raw.startsWith('#')) {
    const hex = raw.replace('#', '');
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
      a: hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1
    };
  }

  // RGB/RGBA -> RGB
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

  // HSL -> RGB
  if (raw.startsWith('hsl')) {
    return hslToRgb(parseHsl(raw));
  }

  // CSS Custom Property -> resolve from runtime
  if (raw.startsWith('var(--')) {
    return resolveRuntimeColor(raw);
  }

  // Named color -> lookup
  if (namedColors[raw]) {
    return namedColors[raw];
  }

  throw new Error(`Unsupported color format: ${raw}`);
}
```

### Color Comparison Tolerance

| Color Difference (Delta-E) | Result |
|----------------------------|--------|
| Delta-E < 2 | PASS (imperceptible) |
| Delta-E 2-5 | WARN (noticeable but acceptable) |
| Delta-E > 5 | FAIL (visually different) |

## Step 5: Confidence-Weighted Normalization

When a token comes from screenshot (confidence < 1.0), the mapping engine applies fuzzy tolerance:

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

---

# Phase 2: Launch Frontend

## Execution

Run the frontend application:

```bash
npm run dev  # or yarn dev, pnpm dev, etc.
```

## Collection

Collect runtime data:

- **URL**: Local development server URL (default: http://localhost:3000)
- **DOM Tree**: Full page DOM structure
- **CSS Styles**: Computed styles for all elements
- **Screenshots**: Full page and component screenshots
- **Browser States**: Default state + interaction states

## Generate Runtime Schema

```json
{
  "url": "http://localhost:3000",
  "pages": [
    {
      "name": "Home",
      "route": "/",
      "components": [
        {
          "selector": ".button-primary",
          "computedStyles": {
            "height": "48px",
            "padding": "0 16px",
            "background": "#C0472A",
            "borderRadius": "16px",
            "fontSize": "16px"
          },
          "textContent": "Submit"
        }
      ]
    }
  ]
}
```

---

# Phase 3: Visual Validation

Compare Design Schema vs Runtime Schema.

## Layout Check

Validate: Position, Width, Height, Alignment, Padding, Margin, Auto layout

```
Component: Reminder Card

Expected:
  padding: 16px

Actual:
  padding: 20px

Result: FAIL
Difference: +4px
```

## Typography Check

Validate: Font family, Font size, Weight, Line height, Letter spacing, Color

```
Title

Expected:
  24px / 600

Actual:
  20px / 500

Result: FAIL
```

## Color Check

Validate: Background, Text color, Border color, Gradient, Opacity

Allow: HEX/RGB/RGBA equivalent conversion.

## Component Check

Validate: Component existence, Variant, State

```
Design:
  Button
    Default
    Loading
    Disabled

Runtime:
  Default

Result: Missing states: Loading, Disabled
```

## Validation Threshold Rules

| Design Source Confidence | Comparison Behavior |
|--------------------------|---------------------|
| `>= 0.9` | Strict match (exact px) -- FAIL if mismatch > 2px |
| `0.6 - 0.89` | Fuzzy match (+/- 10%) -- PASS if within range, WARN if outside |
| `< 0.6` | Skip automatic validation -- Flag as "requires manual confirmation" |

**Examples**:
- Figma extracted padding: 16px (confidence 1.0) -> Actual 20px -> **FAIL**
- Screenshot inferred padding: 16px (confidence 0.5) -> Actual 20px -> **WARN (not FAIL)**

---

# Phase 4: Interaction Validation

## Automated Test Case Generation

Generate automated test cases from: Product flow, Figma prototype, UI behavior.

Use **Playwright Codegen** to record baseline user operations and generate executable `.spec.ts` files. AI only does selector correction and assertion supplementation, NOT generating from scratch.

## Playwright Tests

```typescript
// Example: Create Reminder flow
test('Create reminder flow', async ({ page }) => {
  await page.click('button:has-text("Create")');
  await page.selectOption('select[name="city"]', 'Singapore');
  await page.selectOption('select[name="attraction"]', 'Gardens by the Bay');
  await page.click('button:has-text("Submit")');
  await expect(page.locator('.toast-success')).toBeVisible();
});
```

## Validate

Click events, Navigation, Modal, Toast, Loading, Error, Empty state, Success state.

---

# Phase 5: Responsive Validation

## Test Viewports

- Desktop: 1920x1080
- Tablet: 768x1024
- Mobile: 375x812

## Check

Overflow, Broken layout, Text wrapping, Fixed elements, Safe area.

---

# Phase 6: Issue Diagnosis

Every issue must contain:

```json
{
  "issue": "Primary button height incorrect",
  "location": "Home/Footer/Button",
  "severity": "high",
  "expected": "48px",
  "actual": "40px",
  "root_cause": ".button height:40px in Button.css line 12",
  "suggested_fix": "Change height to 48px",
  "confidence": 1.0,
  "auto_fixable": true
}
```

## Severity Levels

| Severity | Description |
|----------|-------------|
| Critical | Broken functionality, missing state, broken layout |
| High | Major visual deviation (>20% difference) |
| Medium | Minor visual deviation (10-20% difference) |
| Low | Trivial difference (<10%), typography nuance |

---

# Phase 7: Acceptance Score Calculation

## Scoring Weights

| Category | Weight | Sub-category | Sub-weight |
|----------|--------|--------------|------------|
| Visual Fidelity | 50% | Layout | 20% |
| | | Typography | 10% |
| | | Color | 10% |
| | | Visual Asset | 10% |
| Interaction | 30% | Main Flow | 20% |
| | | Component State | 10% |
| Engineering | 20% | Token Compliance | 10% |
| | | Responsive | 5% |
| | | Accessibility | 5% |

## Calculation

```typescript
interface ScoreResult {
  visual: number;      // 0-100
  interaction: number; // 0-100
  engineering: number; // 0-100
  final: number;       // 0-100
  status: 'PASS' | 'FAIL';
}

function calculateScore(issues: Issue[]): ScoreResult {
  const visualScore = calculateVisualScore(issues);
  const interactionScore = calculateInteractionScore(issues);
  const engineeringScore = calculateEngineeringScore(issues);

  const final = (visualScore * 0.5) + (interactionScore * 0.3) + (engineeringScore * 0.2);

  return {
    visual: visualScore,
    interaction: interactionScore,
    engineering: engineeringScore,
    final: final,
    status: final >= 95 ? 'PASS' : 'FAIL'
  };
}
```

## Decision Boundary

- Total score >= 95 -> PASS
- **Single-category veto**: If any single category score < 60, overall status is FAIL regardless of total score
- Weights are configurable via `config.yaml` (e.g., `visual_weight: 0.6`, `pass_score: 90`)

## Example

```
Visual:     96/100
Interaction: 92/100
Engineering: 98/100

Final Score: 95.2
Status: PASS
```

---

# Phase 7.5: Auto-Fix Sandbox Definition

## Purpose

Define strict boundaries for AI-driven code modification to prevent:
- Breaking unrelated styles
- Introducing syntax errors
- Modifying business logic
- Making changes outside the validated component

## Fix Scope Rules

### Allowed Modifications

| Category | Examples | File Types |
|----------|----------|------------|
| CSS property values | `padding: 20px -> 16px` | `.css`, `.scss`, `.module.css` |
| Tailwind class names | `p-5 -> p-4` | `.tsx`, `.jsx`, `.html` |
| Inline style values | `style={{ padding: '20px' }} -> '16px'` | `.tsx`, `.jsx` |
| Design token variables | `var(--spacing-5) -> var(--spacing-4)` | `.css`, `.tsx` |
| Color values | `#F37262 -> #C0472A` | `.css`, `.tsx` |
| Border radius | `rounded-lg -> rounded-xl` | `.tsx`, `.css` |
| Font size | `text-lg -> text-xl` | `.tsx`, `.css` |

### Forbidden Modifications

| Category | Reason |
|----------|--------|
| JSX/TSX component structure | May break component hierarchy |
| Event handlers (onClick, onChange, etc.) | Modifies business logic |
| Data fetching logic | May break API integration |
| State management (useState, Redux) | May break application state |
| Import statements | May create dependency issues |
| Component props interface | May break type safety |
| File structure/renaming | May break imports in other files |
| Function implementations | May change business logic |
| CSS framework configuration (tailwind.config.js) | Global impact |
| HTML structure | May break accessibility |

## Fix Scope Enforcement

### Before Modification

The agent MUST:

1. **Parse the AST** of the target file to identify the exact node to modify
2. **Verify the modification is within allowed categories** (use the rule list above)
3. **Check if the component has tests** -- if yes, note that tests will be run after fix
4. **Check for CSS-in-JS** (styled-components, Emotion, etc.) -- use same rule set

## Pre-Fix Validation Checklist

Before proposing any fix, the agent must output:

```markdown
### Fix Validation Checklist

- [ ] Modification is in ALLOWED category: **CSS property value**
- [ ] File type supported: **styled-components (.tsx)**
- [ ] No business logic affected: **Checked**
- [ ] No component API changed: **Checked**
- [ ] No global config files modified: **Checked**
- [ ] Tailwind class mapping validated: **N/A**
- [ ] Accessibility attributes preserved: **Checked**
- [ ] Responsive variants preserved (if any): **Checked**

All checks passed. Proceeding with fix proposal.
```

## Fix Proposal Format

Every fix must include:

```markdown
### Fix #1: Button height correction

**File**: `src/components/Button.tsx`
**Line**: 12
**Category**: CSS property value
**Confidence**: High (Figma source: 1.0)

**Before**:
height: 40px;

**After**:
height: 48px;

**Why**: Figma design specifies 48px height. Current 40px causes visual misalignment with adjacent components.

**Potential Impact**:
- Button container height increases by 8px
- May affect layout with adjacent elements (will verify in re-validation)
- No impact on child elements

**Test Command**: npm run test Button

Proceed with this fix? [y/N]
```

## Multi-Fix Batching

When multiple fixes are in the same file:

1. **Group by file** -> Apply all fixes in a single edit
2. **Order by dependency** -> Parent components before children
3. **Batch limit** -> Max 5 fixes per file per iteration

```markdown
### Batch Fix: Button.tsx (3 fixes)

| # | Line | Property | Before | After |
|---|------|----------|--------|-------|
| 1 | 12 | height | 40px | 48px |
| 2 | 13 | padding | 0 20px | 0 16px |
| 3 | 15 | border-radius | 12px | 16px |

Apply all 3 fixes in this file? [y/N]
```

## Post-Fix Validation

After applying fixes, the agent MUST run:

1. **Syntax Check**: `npx tsc --noEmit` or `npm run lint`
2. **Build Check**: `npm run build`
3. **Test Check**: `npm run test -- --grep="Button"`
4. **Runtime Check**: Re-launch browser and re-validate
5. **Regression Check**: Verify unaffected components

## Fix Rollback Mechanism

If any post-fix validation fails:

```markdown
### WARNING: Fix Rollback Triggered

**Validation Failed**: Build check failed after applying 3 fixes.

**Rollback Action**: Reverting all 3 fixes in Button.tsx.

**Next Steps**:
1. Root cause: Missing semicolon in diff application
2. Suggested: Apply fixes individually with syntax validation after each

Reverted to original state. Please review and try again.
```

---

# Phase 8: Auto Fix Mode (Sandbox-Enforced)

## Execution Flow

```
Validate
   |
Generate Issues (with confidence scores)
   |
Filter: Only issues with confidence >= 0.8
   |
Check: Are fixes within allowed scope?
   |
   +- YES -> Generate fix proposal
   |            |
   |        User confirms (YES/NO)
   |            |
   |        Apply fix (one file at a time)
   |            |
   |        Post-fix validation (syntax/build/tests)
   |            |
   |            +- PASS -> Re-run validation
   |            +- FAIL -> Rollback -> Report
   |
   +- NO -> Skip (mark as "requires manual fix")
```

## Fix Confidence Threshold

| Confidence | Action |
|------------|--------|
| `>= 0.85` | Auto-propose, one-click apply |
| `0.7 - 0.84` | Propose with warning, require explicit "yes" |
| `< 0.7` | Skip auto-fix, mark for manual review |

## Fix Batch Strategy

| Batch Size | Rule |
|------------|------|
| 1-3 fixes | Apply together (same file) |
| 4-5 fixes | Apply together, but require extra review |
| > 5 fixes | Split into 2 batches, validate after each |

## After All Fixes Applied

```markdown
All fixable issues resolved (12/12)

Post-Fix Validation:
- Syntax: PASS
- Build: PASS
- Tests: PASS (48/48)
- Acceptance Score: 94.2 -> 96.8

Improvement: +2.6 points

Status: PASS (Score >= 95)

Remaining Issues (not auto-fixable):
- Issue #7: Responsive layout on tablet (requires manual CSS refactor)
- Issue #9: Hover state animation timing (requires design team review)

Recommendation: Accept current state? [Y/n]
```

---

# Phase 9: Iterative Loop

## Loop

```
Validate -> Generate Issues -> User Confirm -> Fix -> Validate Again
```

## Stop Condition

- Final Score >= 95
- OR: No fixable issues remaining
- OR: User manually stops

## Iteration Tracking

```json
{
  "iteration": 3,
  "score_history": [87.2, 92.5, 96.8],
  "total_issues_found": 24,
  "total_issues_fixed": 21,
  "remaining_issues": 3,
  "status": "PASS"
}
```

---

# Phase 10: Final Report

## Report Format

```markdown
# UI Acceptance Report

**Project**: [Project Name]
**Date**: [Date]
**Pages**: [Pages tested]
**Iterations**: [Number of iterations]

---

## Scores

| Category | Score |
|----------|-------|
| Visual Fidelity | 96/100 |
| Interaction | 92/100 |
| Engineering | 98/100 |
| **Final Score** | **95.2** |

**Status**: PASS

---

## Issues Fixed

| # | Issue | Severity | Iteration |
|---|-------|----------|-----------|
| 1 | Button height incorrect | High | 1 |
| 2 | Card padding mismatch | Medium | 1 |
| 3 | Primary color wrong | High | 2 |

**Total fixed**: 21

---

## Remaining Issues

| # | Issue | Severity | Auto-Fixable |
|---|-------|----------|--------------|
| 1 | Tablet layout broken | High | No |
| 2 | Hover animation timing | Low | No |

---

## Recommendations

1. **Manual fix required**: Tablet layout overflow (needs CSS media query refactor)
2. **Design team review**: Hover animation timing differs from spec
3. **Acceptance**: All critical issues resolved, score >= 95

---

**Report generated by**: UI Acceptance Agent
```

---

# Rules

- Never judge only by screenshot difference
- Always understand design intention
- Prioritize user experience over pixel matching
- Never modify code without confirmation
- Every failure must include actionable fix
- Keep validating until acceptance criteria is reached

# Tools Preference

| Tool | Usage |
|------|-------|
| Playwright | Browser automation and interaction testing |
| Figma API | Design extraction and comparison |
| AST + Runtime Inspection | Code analysis and style validation |
| Computer Vision + AI | Visual comparison and screenshot analysis |
| Claude Code / Codex | Code modification and fix generation |

# Quick Start

```bash
# 1. Set environment variables
export FIGMA_TOKEN=figd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export FIGMA_FILE_ID=abc123def456

# 2. Run the agent
claude skill run ui-acceptance-agent \
  --design design.md \
  --figma "https://www.figma.com/file/abc123def456" \
  --product product-docs.md \
  --screenshots ./screenshots/ \
  --project ./frontend-project/

# 3. Follow prompts for fix confirmation

# 4. Review final report
```

---

Version: 2.0 | Last Updated: 2026-08-07
