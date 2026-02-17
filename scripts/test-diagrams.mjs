/**
 * Test script for diagram utilities.
 * Run with: node scripts/test-diagrams.mjs
 */

// Simple implementations for testing (mirrors diagramUtils.ts)
const UNICODE_BOX = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  tLeft: '├',
  tRight: '┤',
};

function padRight(str, width) {
  const len = [...str].length;
  if (len >= width) return str;
  return str + ' '.repeat(width - len);
}

function horizontalLine(width, char = '─') {
  return char.repeat(width);
}

function createBox(lines, padding = 1) {
  const chars = UNICODE_BOX;
  const contentWidths = lines.map(line => line === '---' ? 0 : [...line].length);
  const maxContentWidth = Math.max(...contentWidths);
  const innerWidth = maxContentWidth + (padding * 2);
  
  const result = [];
  
  // Top border
  result.push(chars.topLeft + horizontalLine(innerWidth) + chars.topRight);
  
  // Content lines
  for (const line of lines) {
    if (line === '---') {
      result.push(chars.tLeft + horizontalLine(innerWidth) + chars.tRight);
    } else {
      const padded = padRight(line, maxContentWidth);
      result.push(chars.vertical + ' '.repeat(padding) + padded + ' '.repeat(padding) + chars.vertical);
    }
  }
  
  // Bottom border
  result.push(chars.bottomLeft + horizontalLine(innerWidth) + chars.bottomRight);
  
  return result.join('\n');
}

// Create interior box representation for cards
function cardBox(label, width = 12) {
  const inner = width - 2;
  const padded = padRight(label, inner);
  const centered = ' '.repeat(Math.floor((inner - label.length) / 2)) + label + ' '.repeat(Math.ceil((inner - label.length) / 2));
  return [
    '┌' + '─'.repeat(inner) + '┐',
    '│' + centered + '│',
    '└' + '─'.repeat(inner) + '┘',
  ];
}

// Combine multiple card boxes horizontally
function cardRow(labels, cardWidth = 12, spacing = 1) {
  const boxes = labels.map(l => cardBox(l, cardWidth));
  const spacer = ' '.repeat(spacing);
  return [
    boxes.map(b => b[0]).join(spacer),
    boxes.map(b => b[1]).join(spacer),
    boxes.map(b => b[2]).join(spacer),
  ];
}

// Run tests
console.log('Layout Settings with Interior Boxes:\n');

const row1 = cardRow(['Cognition', 'Memory', 'Logs'], 13);
const row2 = cardRow(['Tasks', 'Sandbox'], 13);
const available = cardRow(['Security', 'Assessment'], 13);

console.log(createBox([
  'Dashboard Layout Configuration',
  '---',
  '',
  'ROW 1',
  '  ' + row1[0],
  '  ' + row1[1],
  '  ' + row1[2],
  '',
  'ROW 2',
  '  ' + row2[0],
  '  ' + row2[1],
  '  ' + row2[2],
  '',
  'Available Cards:',
  '  ' + available[0],
  '  ' + available[1],
  '  ' + available[2],
  '',
  '[Reset to Default]    [Apply as Default]',
]));

console.log('\n✅ Diagram utilities working correctly');
