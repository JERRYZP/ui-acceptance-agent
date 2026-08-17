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

## 运行模式（Run Mode）

本 skill 有两种运行模式，**Phase 1 ~ Phase 6（资源闸门到问题诊断）两种模式完全相同**，差异在 Phase 6 之后：

| | Mode A：设计师协作版（默认） | Mode B：开发者自测版 |
|---|---|---|
| 定位 | 设计师验收前端实现，产出反馈给前端 | 开发者自验自修，验收-修复闭环 |
| Phase 6 之后 | 评分 → **总报告(HTML) + UI 验收表** | **输出 UI 验收表 → 暂停等用户确认 → 自动修复 → 自测闭环** |
| 是否改代码 | 否（只验收+反馈，除非用户额外授权） | 是（用户确认验收表后，按"修改prompt"逐条改代码） |
| 是否出总报告 | 是（HTML 总报告） | **否**（只输出修复总结 + 复验验收表） |
| 必要资源 | 设计稿 + 验收对象 | 设计稿 + 验收对象 + **前端源码**（修复必需） |

### 模式判定

- 用户提供**前端源码** 且 表明要"修复 / 自测 / 闭环 / 自己改"→ **Mode B**
- 否则 → **Mode A**（默认）
- 用户也可直接声明："用开发者自测版" / "只验收别改" 等

## Input Resources (Mandatory Gate)

> **铁律 / Hard Rule**: 必填资源齐全且校验可用前，禁止开工。资源缺失或不可用时，必须停下询问用户按格式补齐，**不得降级开工、不得用截图推断代替缺失的设计稿、不得自行猜测验收范围**。

### Required (必填，提供后须先校验可用性)

| 资源 | 接受形式 | 校验方式（提供后先检测，不可用则要求重新输入） |
|---|---|---|
| **设计稿 Design Spec** | UI 图片/截图 **或** Figma 链接（二选一，Figma 优先） | Figma 链接：尝试 API/HTTP 访问确认可达、非 403/404；图片：确认文件存在、可读、非空白损坏 |
| **验收对象 Acceptance Target** | **在线链接**（localhost/内网IP/公网）**或** **实现截图**（PNG/JPG，二选一） | 在线链接：curl/浏览器打开确认 HTTP 可达、非 4xx/5xx，重定向到登录视为不可用；实现截图：确认文件存在、可读、非空白损坏，并记录截图所示视口/设备 |

> **验收模式自动判定**：
> - 提供**在线链接** → **在线模式**：可取运行时 computed style（精确值）、可做交互实测、可切多视口（按设备范围）。
> - 提供**实现截图** → **截图模式**（适用于小程序/App/无法在线访问的项目）：只能做设计稿 vs 实现截图的视觉对照（置信度依赖截图推断，0.3-0.7），**无法取 computed style、无法交互实测、无法切视口**；交互验收降级为"按交互文档或行业规则推断，标注未实测"。
> - 两者都提供 → 走在线模式，截图作补充。

### Optional

- **设计规范文档 Design System Doc**: 设计令牌规范（色板/字号阶梯/间距/阴影/描边等）。**非必选**；有则作为令牌对照的优先依据（与 Figma 数据冲突时以更新的为准并询问用户），无则完全依赖设计稿提取。
- **交互说明文档 Interaction Spec**: 用户场景、业务流程、组件状态、交互行为说明。**有则交互验收以它为准；无则降级为行业通用规则做初级验收**（见 Phase 4）。
- **Figma API Token**: 用于自动化设计稿数据提取（推荐）
- **Tailwind Config**: 用于 token 解析
- **Frontend Project Source**: 源码（仅自动修复阶段需要）
- **Test Suite**: 修复后验证用

### Resource Validation Gate (开工前必做)

1. **盘点**：检查用户输入是否包含上述 2 项必填资源（设计稿 + 验收对象[在线链接 或 实现截图]）。
2. **校验可用性**：对每项必填资源按上表"校验方式"做一次可用性检测。
3. **不全或不可用 → 停下询问**：若必填资源缺失或校验失败，明确告知用户缺什么、要求按格式补充；给出资源清单模板，例如：
   > 缺少设计稿。请提供以下之一：① Figma 链接；或 ② 页面 UI 截图（PNG/JPG）。
   > 缺少验收对象。请提供以下之一：① 可访问的在线链接（localhost/内网/公网）；或 ② 实现截图（PNG/JPG，适用于小程序/App 等无法在线访问的项目）。
   > 验收链接不可达（HTTP 302 跳转到 /login）。请提供已登录链接，或改用实现截图。
4. **补齐后复检**：用户补齐后再次校验，直到 2 项必填资源全部可用，才进入 Phase 1。
5. **模糊输入处理**：若用户输入模糊（如只说"验收这个页面"但没给设计稿/验收对象），按第 3 步询问，不擅自降级为"无设计稿的启发式检查"。
6. **资源-对象一致性检查（Content Match Check）**：校验通过后，将设计稿内容与验收对象（在线页面或实现截图）做初步比对。**若两者明显不一致**（页面结构/模块构成/导航/核心组件对不上，明显是不同页面或不同版本），**必须先询问用户**：
   > 设计稿与验收对象内容明显不一致：设计稿是「X 页面/模块」，验收对象是「Y 页面/模块」。请确认：① 是否用错了设计稿节点？② 还是验收对象不对？③ 还是版本差异，按哪个为准？
   在用户确认前，不得开工验收。轻微不一致（数据内容、文案占位符不同）不算，直接继续。

### Scope Constraint (验收范围)

- **只验收当前对象**：默认只验收用户指定的单个验收对象（在线链接对应的页面，或单张实现截图对应的页面状态）。
- **禁止自动跳转**（在线模式）：不得自行导航到其他页面/路由去验收，除非用户明确说明验收范围包含多个页面。
- **重定向处理**（在线模式）：若页面因未登录等原因重定向到其他页面（如跳到 /login），视为"验收对象不可用"，按 Resource Validation Gate 第 3 步询问用户，不擅自验收重定向后的页面。
- **截图模式范围**：实现截图只代表该截图所示页面状态，不得推断截图外的其他页面/状态。

## Workflow Overview

```
Phase 1   -> Parse Design Resources          ┐
Phase 1.5 -> Extract Design from Figma/Shots │
Phase 1.6 -> Token Mapping & Normalization   │  两种模式
Phase 2   -> Launch Frontend Application     │  完全相同
Phase 3   -> Visual Validation               │
Phase 4   -> Interaction Validation          │
Phase 5   -> Responsive Validation           │
Phase 6   -> Issue Diagnosis                 ┘
        ├── Mode A（设计师协作版，默认）
        │   Phase 7   -> Acceptance Score
        │   Phase 10  -> 总报告(HTML) + UI 验收表        [结束]
        └── Mode B（开发者自测版）
            Phase 6.5 -> 输出 UI 验收表.md → 暂停等用户确认
            Phase 8   -> 自动修复（按验收表修改prompt逐条改代码）
            Phase 9   -> 自测（重新验收：视觉/交互/响应式）
            Phase 10B -> 修复总结 + 复验验收表（不出总报告） [闭环]
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

> **模式分支**：
> - **在线模式**（验收对象=链接）：执行本阶段，打开页面取 DOM / computed style / 截图 / 交互态。
> - **截图模式**（验收对象=实现截图）：**跳过本阶段**，无运行时环境可取。Runtime Schema 退化为"实现截图本身"，仅用于视觉对照（置信度 0.3-0.7），不得声称取得精确 computed 值。

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

> **验收依据 / Ground Truth**: 视觉验收**以设计稿为准**。设计稿（Figma 数据优先于截图推断）是期望值的唯一来源，运行时 computed style 是实际值；两者对照得出差异。不得脱离设计稿凭"行业惯例"或"美观感觉"判定视觉问题。

## 验收重点分层

验收分两层，**以局部样式为主**：

1. **全局性问题**（次要）：整页布局结构、模块排列、栅格、留白节奏是否与设计稿一致。
2. **局部样式**（**主要目标**）：逐组件对照设计稿精确值，重点维度：
   - **字体**：font-family / font-size / font-weight / line-height / letter-spacing
   - **颜色**：文字色、背景色、边框色（HEX 互转允许）
   - **阴影**：box-shadow（x/y/blur/spread/color 逐项比）
   - **描边**：border（width / style / color）、outline、分割线
   - **其他**：圆角、尺寸（宽高）、内外边距

## 视觉问题截图标注（必须）

> **铁律**：每个视觉问题必须配**截图并用红框/箭头标注**问题位置。纯文字描述的视觉问题不合格。

- 用浏览器截图（整页或局部元素），在图上用红框圈出问题元素，必要时加文字标注"设计值 → 实际值"。
- 多个问题时按问题编号逐个标注，或在图上编号对应验收表。
- 实现：截图后用图像处理（如 Python PIL 画红框 + 文字）生成标注图，保存并在报告/验收表中引用。

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

> **验收依据 / Ground Truth (优先级)**:
> 1. **优先**：用户提供了**交互说明文档**时，交互验收（点击/导航/弹层/状态流转/异常态等）以交互说明文档为准。
> 2. **降级**：用户未提供交互说明文档时，按**行业通用规则**做初级验收（如：按钮可点击且有反馈、表单提交后有 loading/success/error 态、弹层可关闭、必填项有校验提示等），并在报告中明确标注"本次交互验收基于行业通用规则，非设计稿定义，建议补充交互说明文档以提升验收精度"。

> **模式分支**：
> - **在线模式**：可对点击/导航/弹层/状态等做**交互实测**。
> - **截图模式**（验收对象=实现截图）：**无法实测交互**，只能按交互说明文档或行业规则**推断**，所有交互项标注"未实测（截图模式）"，不声称已验证。

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

> **设备范围铁律 / Device Scope Rule**: 响应式验收的设备范围**跟随设计稿的设备类型**，不做跨设备验收：
> - 设计稿是 **PC 端**（宽 ≥ 1200，如 1440/1920）→ 只做 **PC 端**视口验收（按设计稿宽度 + 1280/1920 两档检查即可）
> - 设计稿是 **移动端**（宽 ≤ 480，如 375/430）→ 只做 **移动端**视口验收（375 及设计稿宽度）
> - 只有用户**明确说明**要做跨设备/全端适配验收时，才扩展到其他设备类型。
> - 判定依据：设计稿 FRAME 的宽度（Figma absoluteBoundingBox.width 或截图宽度）。
> - **截图模式**（验收对象=实现截图）：实现截图只代表单一视口，**跳过多视口切换**，仅按截图所示视口记录，响应式验收标注"未做（截图模式）"。

## Test Viewports (按设计稿设备选择)

| 设计稿设备 | 测试视口 |
|---|---|
| PC 端（≥1200） | 设计稿宽度（如 1440）+ 1280 + 1920 |
| 移动端（≤480） | 375 + 设计稿宽度 |
| 跨设备（用户明确要求时） | 1920 / 768 / 375 全档 |

## Check

Overflow, Broken layout, Text wrapping, Fixed elements, Safe area（仅限选定设备范围内）。

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

# Phase 6.5: 验收表确认闸门（仅 Mode B 开发者自测版）

> **仅 Mode B 执行**。Mode A 跳过本阶段，直接进 Phase 7 评分。

## 输出 UI 验收表

完成 Phase 6 问题诊断后，**不出总报告**，只输出一张 **UI 验收表（Markdown，`UI验收表.md`）** 交付给用户，格式同 Phase 10 的 UI 验收表：

| # | 模块 | 问题类型(视觉/交互/文案) | 问题描述 | 截图 | 优先级 | 修改prompt（建议） |

- 修改prompt 必须含精确位置 + 精确参数（供 agent 自动修复直接使用）。
- 视觉问题配截图标注（红框）。

## 暂停等用户确认（硬闸门）

- 输出验收表后**必须暂停**，明确询问用户：
  > 已生成 UI 验收表（共 N 条问题）。请确认是否按此表进入自动修复？回复"确认"即开始修复；如需调整某条，请指出。
- **用户未确认前，不得进入 Phase 8 修复**。
- 用户可：① 全部确认 → 进入修复；② 调整某几条（删除/改优先级/改参数）→ 更新表后重新确认；③ 终止。

---

# Phase 7: Acceptance Score Calculation

> **仅 Mode A 执行**（设计师协作版需要评分出报告）。Mode B 跳过评分，走 Phase 6.5 确认 → Phase 8 修复。

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

> **仅 Mode B**。定义自动修复的安全边界（只改样式类，不动业务逻辑）。Mode A 跳过。

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

# Phase 8: Auto Fix Mode (Mode B 自动修复)

> **仅 Mode B**，且必须在 **Phase 6.5 用户确认验收表后**执行。Mode A 不执行。

## 修复执行依据

按用户确认的 **UI 验收表"修改prompt（建议）"列逐条执行**——每条 prompt 已含精确位置 + 精确参数，agent 直接据此定位文件/选择器并修改样式值。遵守 Phase 7.5 的 Sandbox 边界（只改 CSS 属性值/Tailwind 类/内联样式/设计令牌变量/颜色/圆角/字号，禁动 JSX 结构/事件/状态/逻辑）。

## Execution Flow

```
用户确认 UI 验收表
   |
按验收表逐条执行修改prompt
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

# Phase 9: 自测闭环（仅 Mode B）

> Phase 8 修复完成后，**重新执行 Phase 3/4/5 验收**（自测），形成闭环。

## Loop

```
修复完成 -> 重新验收(Phase3/4/5) -> 仍有问题?
   ├── 是 -> 输出剩余问题验收表 -> 用户确认 -> 回 Phase 8 再修
   └── 否 -> 进 Phase 10B 修复总结
```

## 自测要求

- **在线模式**：重新取 computed style 对照设计稿，确认修改生效；交互实测复验。
- **截图模式**：需用户重新提供修复后的实现截图，再对照（agent 无法自行刷新截图）。
- 每轮自测后更新验收表状态（已修复/未通过/新增）。

## Stop Condition

- 验收表所有条目状态 = 已修复（通过）
- OR: 剩余问题均不可自动修复（需人工）→ 输出剩余清单交用户
- OR: 用户主动停止
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

> **模式分支**：
> - **Mode A**：出总报告（HTML，含标注截图）+ UI 验收表（见下格式）。
> - **Mode B**：**不出总报告**，只输出"修复总结 + 复验验收表"（见 Phase 10B）。

## Mode A 总报告格式 (Report Format)

> **呈现铁律**：视觉问题**必须**配截图标注（红框圈出位置 + 设计值→实际值）；交互/文案问题文字描述即可。报告 = 总报告（HTML）+ UI 验收表（给前端执行用）。

## 总报告格式 (Report Format)

```markdown
# UI Acceptance Report

**Project**: [Project Name]
**Date**: [Date]
**Pages**: [Pages tested]
**设计稿设备**: [PC / 移动端（响应式验收范围依据）]
**Iterations**: [Number of iterations]

---

## Scores

| Category | Score |
|----------|-------|
| Visual Fidelity | xx/100 |
| Interaction | xx/100 |
| Engineering | xx/100 |
| **Final Score** | **xx.x** |

**Status**: PASS / FAIL

---

## 全局性问题

（整页布局/结构层面的差异，文字描述 + 整页对照截图）

---

## 局部样式问题（主要部分）

逐条列出，每条必须包含：
- 模块/组件位置
- 维度（字体/颜色/阴影/描边/圆角/间距/尺寸）
- 设计值 vs 实际值（精确值）
- **截图标注图**（红框圈出问题位置）

---

## 交互问题

文字描述即可（操作路径、预期行为、实际行为）。

## 文案问题

文字描述（设计稿文案 vs 实际文案，错别字/大小写/术语不统一等）。

---

**Report generated by**: UI Acceptance Agent
```

## UI 验收表 (Acceptance Table，必须输出)

除总报告外，**必须**输出一张 UI 验收表（Markdown 表格），给前端同事直接执行。格式：

| # | 模块 | 问题类型 | 问题描述 | 截图 | 优先级 | 修改prompt（建议） |
|---|---|---|---|---|---|---|
| 1 | [页面区域/组件] | 视觉 | [设计值 → 实际值，精确参数] | @image#1:image.png | P1 | 将 XX 组件的 border-radius 从 8px 改为 10px |
| 2 | [页面区域/组件] | 交互 | [操作路径 + 预期 vs 实际] | （交互问题可无截图） | P2 | 点击 XX 按钮后应显示 loading 态直至请求完成 |
| 3 | [页面区域/组件] | 文案 | [设计文案 vs 实际文案] | （文案问题可无截图） | P3 | 将按钮文案"提交"改为"Submit" |

### 表格字段规则

- **问题类型**：只允许三类——`视觉` / `交互` / `文案`。
- **截图**：视觉问题必填，格式 `@image#N:<标注图文件名>`（N 为报告中标注图编号）；交互/文案问题可留空。
- **优先级**：P0（Critical，功能/布局破坏）/ P1（High，明显视觉偏差）/ P2（Medium，次要偏差）/ P3（Low，细微问题）。
- **修改prompt（建议）**：**核心列**。写给前端同事在 AI agent（或编码助手）中直接复制使用的修改指令，必须：
  1. 写明**精确位置**（组件名/选择器/页面区域）
  2. 写明**精确参数**：`把 [属性] 从 [实际值] 改为 [设计值]`
  3. 涉及多个属性逐条列出；涉及设计令牌的注明 token 名
  4. 示例：`将「Financial Statement」卡片的 border-radius 从 8px 改为 10px，并添加 box-shadow: 0 1px 3px rgba(0,0,0,0.05)（依据设计稿 node 24:15557）`

---

# Phase 10B: 修复总结（仅 Mode B）

> Mode B 闭环结束时的输出。**不出 HTML 总报告**，只输出 Markdown 修复总结 + 复验验收表。

## 修复总结格式

```markdown
# UI 自测修复总结

**项目**: [Project]  **日期**: [Date]  **轮次**: [N 轮修复]

## 修复统计
- 验收表问题总数：N
- 已修复（复验通过）：X
- 未通过 / 需人工：Y

## 复验验收表（更新版）
| # | 模块 | 问题类型 | 问题描述 | 优先级 | 修改prompt | 状态 |
|---|---|---|---|---|---|---|
| 1 | ... | 视觉 | ... | P2 | 将 border-radius 8px→10px | ✅已修复 |
| 2 | ... | 交互 | ... | P3 | 补 loading 态 | ⚠️需人工 |

## 未通过项说明
（列出未自动修复的项及原因，建议人工处理方式）
```

---

# Rules

- Never judge only by screenshot difference
- Always understand design intention
- Prioritize user experience over pixel matching
- Never modify code without confirmation
- Every failure must include actionable fix
- Keep validating until acceptance criteria is reached

## 运行模式约束（铁律）

- **双模式**：Mode A 设计师协作版（默认，验收→总报告+验收表，不改代码）；Mode B 开发者自测版（验收→验收表确认→自动修复→自测闭环，不出总报告）。Phase 1~6 两模式相同。
- **Mode B 确认闸门**：Phase 6.5 输出 UI 验收表后**必须暂停**等用户确认，未确认不得进入 Phase 8 修复。
- **Mode B 修复依据**：按用户确认的验收表"修改prompt"逐条改，遵守 Sandbox 边界（只改样式类，禁动业务逻辑）。
- **Mode B 自测**：修复后重新验收（Phase 3/4/5），未通过则更新验收表再确认再修，直至通过或人工。
- **Mode B 输出**：不出 HTML 总报告，只出修复总结 + 复验验收表（Phase 10B）。

## 资源与范围约束（铁律，优先级最高）

- **必填资源闸门**：设计稿（UI 图片或 Figma 链接）+ 验收对象（在线链接 **或** 实现截图，二选一），二者缺一不可。缺失或不可用时停下询问用户补齐，提供后先校验可用性，不可用则再次要求输入，**不得降级开工**。
- **验收模式**：验收对象为在线链接 → 在线模式（可取 computed style / 交互实测 / 多视口）；为实现截图 → 截图模式（仅视觉对照，置信度 0.3-0.7，无法实测交互/取精确值/切视口，相关项标注"未实测"）。
- **可选资源**：设计规范文档（有则作为令牌对照优先依据）、交互说明文档（有则交互验收以它为准，无则按行业通用规则降级并标注）。
- **资源-对象一致性**：设计稿与验收对象内容明显不一致（不同页面/版本）时，必须先询问用户确认，不得擅自开工。
- **验收范围**：只验收用户指定的当前验收对象，**禁止自动跳转**到其他页面验收，除非用户明确扩大验收范围。
- **设备范围**：响应式验收跟随设计稿设备类型（PC 稿只验 PC 端、移动稿只验移动端），**不做跨设备验收**，除非用户明确要求（截图模式无多视口，跳过）。
- **视觉验收依据**：以设计稿为准（Figma 优先于截图）；重点验局部样式（字体/颜色/阴影/描边/圆角/间距），**视觉问题必须配截图标注**。
- **交互/文案验收依据**：交互优先以交互说明文档为准，无文档按行业通用规则初级验收并标注降级；文案对照设计稿，错别字/术语不统一列为文案问题。
- **输出要求**：总报告（HTML，含标注截图）+ **UI 验收表**（问题类型分视觉/交互/文案，含"修改prompt（建议）"列，写明精确位置与参数，供前端在 agent 中直接使用）。

# Tools Preference

| Tool | Usage |
|------|-------|
| agent-browser | Browser automation, screenshots, interaction testing, viewport/responsive checks（本环境实际可用的浏览器工具；命令如 `agent-browser open/snapshot/screenshot/eval/set viewport`）|
| Playwright | 备选浏览器自动化与交互测试（若 agent-browser 不可用时）|
| Figma API | Design extraction and comparison（需 FIGMA_TOKEN，优先于截图推断）|
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

Version: 2.4 | Last Updated: 2026-08-17
- v2.4: 新增 Mode B 开发者自测版（验收→验收表确认→自动修复→自测闭环，不出总报告）；Phase 1~6 双模式共用；新增 Phase 6.5 确认闸门、Phase 10B 修复总结
- v2.3: 验收对象新增"实现截图"选项（小程序/App场景）；在线模式 vs 截图模式
- v2.2: 设备范围跟随设计稿；视觉问题截图标注必须；UI 验收表（视觉/交互/文案 + 修改prompt）
- v2.1: mandatory resource gate + scope constraint + validation-source rules
- v2.0: initial
