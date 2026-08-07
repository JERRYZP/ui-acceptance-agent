# UI Acceptance Agent Skill

AI-powered UI quality assurance agent that validates frontend implementation against design specifications. Compares Figma design, design.md, product requirements, UI screenshots, and frontend runtime to perform visual fidelity validation, interaction testing, component state verification, responsive validation, automatic issue diagnosis, and code modification with iterative validation until score >= 95.

## Features

- **Dual-track design source resolution**: Figma API first, UI screenshot + design.md fallback
- **Token Mapping Engine**: Normalizes design tokens (px, rem, CSS variables, Tailwind classes) for accurate comparison with runtime `getComputedStyle`
- **Confidence-weighted validation**: Strict matching for high-confidence sources, fuzzy matching for low-confidence
- **Sandbox-enforced auto-fix**: Only modifies CSS property values, Tailwind classes, and inline styles; never touches business logic
- **Iterative validation loop**: Continues until acceptance score >= 95 or no fixable issues remain
- **Configurable scoring**: Adjustable weights and thresholds via `config.yaml`

## Skill Structure

```
ui-acceptance-agent/
├── SKILL.md                          # Main skill file (10 phases)
├── scripts/
│   └── figma-client.ts               # Figma API client implementation
├── references/
│   ├── token-mapping-engine.md       # Token normalization algorithm
│   ├── auto-fix-sandbox.md           # Fix scope rules and boundaries
│   └── config-example.yaml           # Configuration template
└── README.md
```

## Workflow Phases

| Phase | Description |
|-------|-------------|
| Phase 1 | Parse Design Resources |
| Phase 1.5 | Extract Design from Figma/Screenshots |
| Phase 1.6 | Token Mapping & Normalization |
| Phase 2 | Launch Frontend Application |
| Phase 3 | Visual Validation |
| Phase 4 | Interaction Validation |
| Phase 5 | Responsive Validation |
| Phase 6 | Issue Diagnosis |
| Phase 7 | Acceptance Score Calculation |
| Phase 7.5 | Auto-Fix Sandbox Definition |
| Phase 8 | Auto Fix Mode (User-Confirmed) |
| Phase 9 | Iterative Loop Until Score >= 95 |
| Phase 10 | Final Report |

## Quick Start

### 1. Set environment variables

```bash
export FIGMA_TOKEN=figd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export FIGMA_FILE_ID=abc123def456
```

### 2. Get Figma Token

1. Login to Figma -> Click avatar -> **Settings**
2. Scroll to **Personal Access Tokens**
3. Click **Create new token**
4. Copy the token (only shown once)

### 3. Get File Key

From Figma URL:
```
https://www.figma.com/file/abc123def456/My-Design-File
                              ^
                         File Key = abc123def456
```

### 4. Run the agent

```bash
claude skill run ui-acceptance-agent \
  --design design.md \
  --figma "https://www.figma.com/file/abc123def456" \
  --product product-docs.md \
  --screenshots ./screenshots/ \
  --project ./frontend-project/
```

## Scoring Model

| Category | Weight |
|----------|--------|
| Visual Fidelity | 50% |
| Interaction | 30% |
| Engineering | 20% |

- **Pass threshold**: Total score >= 95
- **Single-category veto**: If any category < 60, overall FAIL
- Weights are configurable via `config.yaml`

## Design Source Priority

1. **Figma API** (confidence: 0.85-1.0) - Preferred, extracts exact design tokens
2. **design.md** (confidence: 0.6-0.9) - Human-authored design specification
3. **UI Screenshots** (confidence: 0.3-0.7) - Fallback when Figma unavailable

When both Figma and screenshots are available, cross-validation is performed. If diff > 10% for any value, it's flagged as "Design Source Mismatch" and user is asked to confirm.

## Auto-Fix Scope

### Allowed
- CSS property values (padding, margin, height, width, etc.)
- Tailwind class names
- Inline style values
- Design token variables
- Color values
- Border radius
- Font size

### Forbidden
- Component structure (JSX/TSX)
- Event handlers
- Data fetching logic
- State management
- Import statements
- Component props interface
- File structure/renaming
- Function implementations
- CSS framework configuration

## Requirements

- Node.js 18+ (for Figma client)
- Playwright (for browser automation)
- Figma Personal Access Token (for design extraction)
- Frontend project with dev server

## License

MIT

## Version

2.0 | Last Updated: 2026-08-07
