# Diagram Style Guide

Standards for generating ASCII/Unicode diagrams in documentation and code comments.

## Box Drawing Characters

Use Unicode box-drawing characters for clean, connected borders:

| Purpose       | Character | Unicode   |
|---------------|-----------|-----------|
| Top-left      | ┌         | U+250C    |
| Top-right     | ┐         | U+2510    |
| Bottom-left   | └         | U+2514    |
| Bottom-right  | ┘         | U+2518    |
| Horizontal    | ─         | U+2500    |
| Vertical      | │         | U+2502    |
| T-left        | ├         | U+251C    |
| T-right       | ┤         | U+2524    |
| T-top         | ┬         | U+252C    |
| T-bottom      | ┴         | U+2534    |
| Cross         | ┼         | U+253C    |

## Alignment Rules

1. **Calculate max content width** across all lines first
2. **Pad every line** to that exact width with spaces
3. **Add borders** after padding
4. **Use consistent inner margins** (1-2 spaces from border)

## Example: Correct Method

```
┌────────────────────────────────────────────────────┐
│ Dashboard Layout Configuration                     │
├────────────────────────────────────────────────────┤
│                                                    │
│ ROW 1  [Cognition] [Memory] [Logs]                 │
│                                                    │
│ ROW 2  [Tasks] [Sandbox]                           │
│                                                    │
│ Available: [Security] [Assessment]                 │
│                                                    │
│ [Reset to Default]    [Apply as Default]           │
└────────────────────────────────────────────────────┘
```

## Common Mistakes

❌ **Wrong**: Variable-length lines with borders added naively
```
│ Short line│
│ Much longer content line│
```

✅ **Correct**: All lines padded to same width
```
│ Short line                    │
│ Much longer content line      │
```

## Fallback

If Unicode rendering is unavailable, use ASCII:
- `+` for corners
- `-` for horizontal
- `|` for vertical

```
+--------------------+
| Content            |
+--------------------+
```

## Implementation

Use `lib/diagramUtils.ts` for programmatic diagram generation.
