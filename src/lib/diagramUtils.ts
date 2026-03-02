/**
 * Diagram Utilities - Generate properly aligned ASCII/Unicode box diagrams.
 * 
 * See docs/development/diagram-style-guide.md for standards.
 */

export interface BoxChars {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  vertical: string;
  tLeft: string;
  tRight: string;
  tTop: string;
  tBottom: string;
  cross: string;
}

export const UNICODE_BOX: BoxChars = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  tLeft: '├',
  tRight: '┤',
  tTop: '┬',
  tBottom: '┴',
  cross: '┼',
};

export const ASCII_BOX: BoxChars = {
  topLeft: '+',
  topRight: '+',
  bottomLeft: '+',
  bottomRight: '+',
  horizontal: '-',
  vertical: '|',
  tLeft: '+',
  tRight: '+',
  tTop: '+',
  tBottom: '+',
  cross: '+',
};

/**
 * Pad a string to a specific width with trailing spaces.
 */
export function padRight(str: string, width: number): string {
  const len = [...str].length; // Handle Unicode correctly
  if (len >= width) return str;
  return str + ' '.repeat(width - len);
}

/**
 * Calculate the display width of a string (handles Unicode).
 */
export function displayWidth(str: string): number {
  // Simple implementation - counts characters
  // For full Unicode support, use a library like string-width
  return [...str].length;
}

/**
 * Generate a horizontal line of a specific width.
 */
export function horizontalLine(width: number, chars: BoxChars = UNICODE_BOX): string {
  return chars.horizontal.repeat(width);
}

/**
 * Create a boxed diagram from lines of content.
 * 
 * @param lines - Array of content lines (no borders)
 * @param options - Rendering options
 * @returns Complete box diagram as string
 * 
 * @example
 * ```ts
 * const box = createBox([
 *   'Title',
 *   '---', // Will become a separator line
 *   'Content line 1',
 *   'Content line 2',
 * ]);
 * ```
 */
export function createBox(
  lines: string[],
  options: {
    chars?: BoxChars;
    padding?: number;
    minWidth?: number;
  } = {}
): string {
  const { chars = UNICODE_BOX, padding = 1, minWidth = 0 } = options;
  
  // Calculate max content width
  const contentWidths = lines.map(line => 
    line === '---' ? 0 : displayWidth(line)
  );
  const maxContentWidth = Math.max(minWidth, ...contentWidths);
  const innerWidth = maxContentWidth + (padding * 2);
  
  const result: string[] = [];
  
  // Top border
  result.push(
    chars.topLeft + 
    horizontalLine(innerWidth, chars) + 
    chars.topRight
  );
  
  // Content lines
  for (const line of lines) {
    if (line === '---') {
      // Separator line
      result.push(
        chars.tLeft + 
        horizontalLine(innerWidth, chars) + 
        chars.tRight
      );
    } else {
      // Content line with padding
      const padded = padRight(line, maxContentWidth);
      result.push(
        chars.vertical + 
        ' '.repeat(padding) + 
        padded + 
        ' '.repeat(padding) + 
        chars.vertical
      );
    }
  }
  
  // Bottom border
  result.push(
    chars.bottomLeft + 
    horizontalLine(innerWidth, chars) + 
    chars.bottomRight
  );
  
  return result.join('\n');
}

/**
 * Create a simple table with aligned columns.
 * 
 * @param headers - Column headers
 * @param rows - Array of row data
 * @param chars - Box characters to use
 * @returns Formatted table string
 */
export function createTable(
  headers: string[],
  rows: string[][],
  chars: BoxChars = UNICODE_BOX
): string {
  // Calculate column widths
  const colWidths = headers.map((h, i) => {
    const cellWidths = [displayWidth(h), ...rows.map(r => displayWidth(r[i] || ''))];
    return Math.max(...cellWidths);
  });
  
  const totalWidth = colWidths.reduce((a, b) => a + b, 0) + (colWidths.length * 3) - 1;
  
  const result: string[] = [];
  
  // Top border
  result.push(chars.topLeft + horizontalLine(totalWidth, chars) + chars.topRight);
  
  // Header row
  const headerCells = headers.map((h, i) => ' ' + padRight(h, colWidths[i]) + ' ');
  result.push(chars.vertical + headerCells.join(chars.vertical) + chars.vertical);
  
  // Header separator
  result.push(chars.tLeft + horizontalLine(totalWidth, chars) + chars.tRight);
  
  // Data rows
  for (const row of rows) {
    const cells = row.map((cell, i) => ' ' + padRight(cell || '', colWidths[i]) + ' ');
    result.push(chars.vertical + cells.join(chars.vertical) + chars.vertical);
  }
  
  // Bottom border
  result.push(chars.bottomLeft + horizontalLine(totalWidth, chars) + chars.bottomRight);
  
  return result.join('\n');
}

/**
 * Self-test function - can be called directly to verify output.
 */
export function runDiagramTests(): void {
  console.log('Box example:');
  console.log(createBox([
    'Dashboard Layout Configuration',
    '---',
    '',
    'ROW 1  [Cognition] [Memory] [Logs]',
    '',
    'ROW 2  [Tasks] [Sandbox]',
    '',
    'Available: [Security] [Assessment]',
    '',
    '[Reset to Default]    [Apply as Default]',
  ]));
  
  console.log('\nTable example:');
  console.log(createTable(
    ['Feature', 'Status', 'Notes'],
    [
      ['Read-only mode', '✅', 'ATLAS_MEMORY_READONLY'],
      ['Pre-write backup', '✅', 'Automatic'],
      ['Integrity check', '✅', 'Post-write'],
    ]
  ));
}
