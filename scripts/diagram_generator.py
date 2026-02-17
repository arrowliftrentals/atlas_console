#!/usr/bin/env python3
"""ASCII Box Diagram Generator.

Generates properly aligned box diagrams using Unicode box-drawing characters
that render correctly in Warp terminal.

Usage:
    python scripts/diagram_generator.py

Examples:
    # Single box
    box("Hello World")
    
    # Multiple boxes in a row
    row_of_boxes(["pytest", "CI/CD", "Voice", "Plugins"])
    
    # Flow diagram
    flow([
        row_of_boxes(["pytest", "CI/CD", "Voice"]),
        box("Validation Layer"),
        box("Output"),
    ])
"""

from typing import List, Union


# Box-drawing characters
TL = "┌"  # top-left
TR = "┐"  # top-right
BL = "└"  # bottom-left
BR = "┘"  # bottom-right
H = "─"   # horizontal
V = "│"   # vertical
VL = "┤"  # vertical-left
VR = "├"  # vertical-right
HT = "┴"  # horizontal-top
HB = "┬"  # horizontal-bottom
CROSS = "┼"  # cross
ARROW = "▼"


def box(text: Union[str, List[str]], min_width: int = 0, padding: int = 1) -> List[str]:
    """Generate a single box with text inside.
    
    Args:
        text: Single string or list of strings for multi-line content
        min_width: Minimum interior width (excluding borders)
        padding: Spaces on each side of text
    
    Returns:
        List of strings representing the box lines
    """
    if isinstance(text, str):
        lines = [text]
    else:
        lines = text
    
    # Calculate width
    max_text_width = max(len(line) for line in lines)
    interior_width = max(max_text_width + padding * 2, min_width)
    
    result = []
    # Top border
    result.append(TL + H * interior_width + TR)
    
    # Content lines
    for line in lines:
        padded = f"{' ' * padding}{line}{' ' * padding}"
        padded = padded.ljust(interior_width)
        result.append(V + padded + V)
    
    # Bottom border
    result.append(BL + H * interior_width + BR)
    
    return result


def row_of_boxes(labels: List[str], spacing: int = 2, min_box_width: int = 8) -> List[str]:
    """Generate a row of boxes with equal widths.
    
    Args:
        labels: List of text labels for each box
        spacing: Spaces between boxes
        min_box_width: Minimum interior width for each box
    
    Returns:
        List of strings representing the row
    """
    # Find max width needed
    max_width = max(max(len(label) for label in labels) + 2, min_box_width)
    
    # Generate each box
    boxes = [box(label, min_width=max_width) for label in labels]
    
    # Combine horizontally
    spacer = " " * spacing
    result = []
    for row_idx in range(len(boxes[0])):
        row_parts = [b[row_idx] for b in boxes]
        result.append(spacer.join(row_parts))
    
    return result


def connector_down(width: int, position: int = None) -> List[str]:
    """Generate a vertical connector with arrow.
    
    Args:
        width: Total width to center within
        position: Horizontal position (default: center)
    
    Returns:
        List of strings for the connector
    """
    if position is None:
        position = width // 2
    
    result = []
    result.append(" " * position + V)
    result.append(" " * position + ARROW)
    return result


def merge_lines(width: int, positions: List[int]) -> List[str]:
    """Generate merge lines from multiple positions to center.
    
    Args:
        width: Total width
        positions: List of x positions to merge from
    
    Returns:
        List of strings for the merge pattern
    """
    if len(positions) < 2:
        return connector_down(width, positions[0] if positions else width // 2)
    
    center = width // 2
    min_pos = min(positions)
    max_pos = max(positions)
    
    result = []
    
    # Line with vertical drops from each position
    line1 = [" "] * width
    for pos in positions:
        if pos < len(line1):
            line1[pos] = V
    result.append("".join(line1))
    
    # Horizontal merge line
    line2 = [" "] * width
    for i in range(min_pos, max_pos + 1):
        line2[i] = H
    # Add corners/tees
    for pos in positions:
        if pos < len(line2):
            if pos == min_pos:
                line2[pos] = BL
            elif pos == max_pos:
                line2[pos] = BR
            else:
                line2[pos] = HT
    # Center point
    if min_pos < center < max_pos:
        line2[center] = HT
    result.append("".join(line2))
    
    # Down to center
    result.extend(connector_down(width, center))
    
    return result


def split_lines(width: int, positions: List[int]) -> List[str]:
    """Generate split lines from center to multiple positions.
    
    Args:
        width: Total width
        positions: List of x positions to split to
    
    Returns:
        List of strings for the split pattern
    """
    if len(positions) < 2:
        return connector_down(width, positions[0] if positions else width // 2)
    
    center = width // 2
    min_pos = min(positions)
    max_pos = max(positions)
    
    result = []
    
    # Down from center
    line1 = [" "] * width
    line1[center] = V
    result.append("".join(line1))
    
    # Horizontal split line
    line2 = [" "] * width
    for i in range(min_pos, max_pos + 1):
        line2[i] = H
    # Add corners/tees
    for pos in positions:
        if pos < len(line2):
            if pos == min_pos:
                line2[pos] = TL
            elif pos == max_pos:
                line2[pos] = TR
            else:
                line2[pos] = HB
    # Center point
    if min_pos < center < max_pos:
        line2[center] = HT
    result.append("".join(line2))
    
    # Arrows at each position
    line3 = [" "] * width
    for pos in positions:
        if pos < len(line3):
            line3[pos] = ARROW
    result.append("".join(line3))
    
    return result


def center_lines(lines: List[str], width: int) -> List[str]:
    """Center a block of lines within a given width."""
    if not lines:
        return lines
    
    block_width = max(len(line) for line in lines)
    if block_width >= width:
        return lines
    
    padding = (width - block_width) // 2
    return [" " * padding + line for line in lines]


def print_diagram(lines: List[str]) -> None:
    """Print a diagram to stdout."""
    for line in lines:
        print(line)


# === Example/Demo ===

if __name__ == "__main__":
    print("=== Single Box ===")
    print_diagram(box("Hello World"))
    print()
    
    print("=== Multi-line Box ===")
    print_diagram(box(["POST /v1/telemetry/inject", "WS   /v1/telemetry/inject/stream"]))
    print()
    
    print("=== Row of Boxes ===")
    print_diagram(row_of_boxes(["pytest", "CI/CD", "Voice", "Plugins"]))
    print()
    
    print("=== Full Flow Diagram ===")
    width = 48
    
    # Sources
    sources = row_of_boxes(["pytest", "CI/CD", "Voice", "Plugins"])
    print_diagram(sources)
    
    # Merge down
    # Calculate positions (center of each box)
    box_width = 10  # approximate
    spacing = 2
    positions = [5, 17, 29, 41]  # centers of each box
    print_diagram(merge_lines(width, positions))
    
    # Endpoints box
    endpoints = box(["POST /v1/telemetry/inject", "WS   /v1/telemetry/inject/stream"], min_width=44)
    print_diagram(endpoints)
    
    # Connector
    print_diagram(connector_down(width))
    
    # Validation box
    validation = box(["Pydantic Validation", "TelemetryInjectEvent schema"], min_width=44)
    print_diagram(validation)
    
    # Split to two
    print_diagram(split_lines(width, [12, 36]))
    
    # Two boxes side by side
    tracker = box(["TelemetryTracker", ".record_event()"])
    audit = box(["L4 Audit Log", "(persistence)"])
    combined = []
    for i in range(len(tracker)):
        combined.append(tracker[i] + "  " + audit[i])
    print_diagram(combined)
    
    # Continue from left box
    print("         " + V)
    print("         " + ARROW)
    
    # Broadcast box
    broadcast = box(["WebSocket Broadcast", "/v1/telemetry/stream clients"], min_width=44)
    print_diagram(broadcast)
    
    # Final connector
    print_diagram(connector_down(width))
    
    # Output box
    output = box("Console 3D Neural Visualization", min_width=44)
    print_diagram(output)
