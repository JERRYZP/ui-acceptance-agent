# Auto-Fix Sandbox Reference

## Purpose

Define strict boundaries for AI-driven code modification to prevent:
- Breaking unrelated styles
- Introducing syntax errors
- Modifying business logic
- Making changes outside the validated component

## Allowed Modifications

| Category | Examples | File Types |
|----------|----------|------------|
| CSS property values | `padding: 20px -> 16px` | `.css`, `.scss`, `.module.css` |
| Tailwind class names | `p-5 -> p-4` | `.tsx`, `.jsx`, `.html` |
| Inline style values | `style={{ padding: '20px' }} -> '16px'` | `.tsx`, `.jsx` |
| Design token variables | `var(--spacing-5) -> var(--spacing-4)` | `.css`, `.tsx` |
| Color values | `#F37262 -> #C0472A` | `.css`, `.tsx` |
| Border radius | `rounded-lg -> rounded-xl` | `.tsx`, `.css` |
| Font size | `text-lg -> text-xl` | `.tsx`, `.css` |

## Forbidden Modifications

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

## Modification Boundary Example

```typescript
// Target file: components/Button.tsx

// Original code
const Button = styled.button<ButtonProps>`
  height: 40px;           // <- ALLOWED: CSS property value
  padding: 0 20px;        // <- ALLOWED: CSS property value
  background: #F37262;    // <- ALLOWED: CSS property value
  border-radius: 12px;    // <- ALLOWED: CSS property value
  font-size: 16px;        // <- ALLOWED: CSS property value

  &:hover {
    background: #EF4330;  // <- ALLOWED: CSS property value
  }
`;

// Proposed fix
const Button = styled.button<ButtonProps>`
  height: 48px;           // Fix applied
  padding: 0 16px;        // Fix applied
  background: #C0472A;    // Fix applied (primary color)
  border-radius: 16px;    // Fix applied
  font-size: 16px;        // Unchanged (already correct)

  &:hover {
    background: #9A3922;  // Fix applied (darken primary)
  }
`;

// NOT ALLOWED changes:
// - Adding `disabled` prop logic
// - Changing onClick handler
// - Adding new styled components
// - Removing `:hover` pseudo-class
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

## Post-Fix Validation Checklist

1. **Syntax Check**: `npx tsc --noEmit` or `npm run lint`
2. **Build Check**: `npm run build`
3. **Test Check**: `npm run test -- --grep="ComponentName"`
4. **Runtime Check**: Re-launch browser and re-validate
5. **Regression Check**: Verify unaffected components

## Rollback Mechanism

If any post-fix validation fails:
1. Revert all fixes in the affected file
2. Report the failure with root cause
3. Suggest applying fixes individually with syntax validation after each
