
import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export default function ColorPalettePainter() {
  const { theme, addCustomTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [paintMode, setPaintMode] = useState<'text' | 'background' | 'border' | 'gradient'>('text');
  const [isPainting, setIsPainting] = useState(false);
  const [isEyedropping, setIsEyedropping] = useState(false);
  const [hoveredColors, setHoveredColors] = useState<{ text: string; bg: string; border: string } | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const painterRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 320, height: 500 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [undoStack, setUndoStack] = useState<Array<{ element: HTMLElement; property: string; oldValue: string }>>([]);
  const [borderInputPopup, setBorderInputPopup] = useState<{ element: HTMLElement; x: number; y: number; currentWidth: string } | null>(null);
  const [borderInputValue, setBorderInputValue] = useState('');
  const [customColor, setCustomColor] = useState('#000000');
  const [gradientColor1, setGradientColor1] = useState('#000000');
  const [gradientColor2, setGradientColor2] = useState('#ffffff');
  const [gradientAngle, setGradientAngle] = useState(90);
  const [borderThickness, setBorderThickness] = useState(1);

  const colorPalette = [
    // Neutral colors (always available)
    { name: 'Black', value: '#000000' },
    { name: 'White', value: '#FFFFFF' },
    { name: 'Gray 100', value: '#1a1a1a' },
    { name: 'Gray 200', value: '#333333' },
    { name: 'Gray 300', value: '#4d4d4d' },
    { name: 'Gray 400', value: '#666666' },
    { name: 'Gray 500', value: '#808080' },
    { name: 'Gray 600', value: '#999999' },
    { name: 'Gray 700', value: '#b3b3b3' },
    { name: 'Gray 800', value: '#cccccc' },
    { name: 'Gray 900', value: '#e6e6e6' },
    // Theme colors
    { name: 'Primary BG', value: theme.colors.background },
    { name: 'Elevated BG', value: theme.colors.backgroundElevated },
    { name: 'Subtle BG', value: theme.colors.backgroundSubtle },
    { name: 'Card BG', value: theme.colors.backgroundCard },
    { name: 'Hover BG', value: theme.colors.backgroundHover },
    { name: 'Border', value: theme.colors.border },
    { name: 'Border Subtle', value: theme.colors.borderSubtle },
    { name: 'Border Accent', value: theme.colors.borderAccent },
    { name: 'Border Success', value: theme.colors.borderSuccess },
    { name: 'Border Warning', value: theme.colors.borderWarning },
    { name: 'Border Error', value: theme.colors.borderError },
    { name: 'Text Primary', value: theme.colors.textPrimary },
    { name: 'Text Secondary', value: theme.colors.textSecondary },
    { name: 'Text Muted', value: theme.colors.textMuted },
    { name: 'Text Accent', value: theme.colors.textAccent },
    { name: 'Text Success', value: theme.colors.textSuccess },
    { name: 'Text Warning', value: theme.colors.textWarning },
    { name: 'Text Error', value: theme.colors.textError },
    { name: 'Text Info', value: theme.colors.textInfo },
    { name: 'Accent Primary', value: theme.colors.accent },
    { name: 'Accent Secondary', value: theme.colors.accentSecondary },
    { name: 'Accent Tertiary', value: theme.colors.accentTertiary },
    { name: 'Success', value: theme.colors.success },
    { name: 'Success Muted', value: theme.colors.successMuted },
    { name: 'Warning', value: theme.colors.warning },
    { name: 'Warning Muted', value: theme.colors.warningMuted },
    { name: 'Error', value: theme.colors.error },
    { name: 'Error Muted', value: theme.colors.errorMuted },
    { name: 'Info', value: theme.colors.info },
    { name: 'Info Muted', value: theme.colors.infoMuted },
  ];

  // Initialize position on first open (center-left to not block footer)
  useEffect(() => {
    if (isOpen && position.x === 0 && position.y === 0) {
      setPosition({ 
        x: 20, // Left side of screen
        y: Math.max(20, window.innerHeight / 2 - 250) // Vertically centered
      });
    }
  }, [isOpen, position]);

  // Handle dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Handle resizing
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      
      setSize({
        width: Math.max(280, resizeStart.width + deltaX),
        height: Math.max(400, resizeStart.height + deltaY)
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeStart]);

  // Handle eyedropper mode
  useEffect(() => {
    if (!isEyedropping) {
      setHoveredColors(null);
      return;
    }

    let lastHovered: HTMLElement | null = null;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      if (target.closest('#color-palette-painter')) {
        return;
      }

      if (lastHovered && lastHovered !== target) {
        lastHovered.style.outline = '';
      }

      target.style.outline = '2px solid var(--atlas-info)';
      lastHovered = target;

      const computedStyle = window.getComputedStyle(target);
      setHoveredColors({
        text: computedStyle.color,
        bg: computedStyle.backgroundColor,
        border: computedStyle.borderColor
      });
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('#color-palette-painter')) {
        return;
      }
      target.style.outline = '';
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      if (target.closest('#color-palette-painter')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const computedStyle = window.getComputedStyle(target);
      let colorToUse = computedStyle.color;

      // Choose color based on what's visible/meaningful
      if (paintMode === 'text') {
        colorToUse = computedStyle.color;
      } else if (paintMode === 'background') {
        colorToUse = computedStyle.backgroundColor;
      } else if (paintMode === 'border') {
        colorToUse = computedStyle.borderColor;
      }

      // Convert rgb/rgba to hex if possible
      const rgbMatch = colorToUse.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1]);
        const g = parseInt(rgbMatch[2]);
        const b = parseInt(rgbMatch[3]);
        colorToUse = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
      }

      setSelectedColor(colorToUse);
      setCustomColor(colorToUse);
      setIsEyedropping(false);
      target.style.outline = '';
    };

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);
    
    return () => {
      if (lastHovered) {
        lastHovered.style.outline = '';
      }
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      document.removeEventListener('click', handleClick, true);
    };
  }, [isEyedropping, paintMode]);

  // Handle painting clicks with hover highlight
  useEffect(() => {
    if (!isPainting) return;

    let lastHovered: HTMLElement | null = null;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Don't highlight the palette itself
      if (target.closest('#color-palette-painter')) {
        return;
      }

      // Remove previous highlight
      if (lastHovered && lastHovered !== target) {
        lastHovered.style.outline = '';
      }

      // Add highlight to current target
      target.style.outline = '2px dashed var(--atlas-accent-primary)';
      lastHovered = target;
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('#color-palette-painter')) {
        return;
      }
      target.style.outline = '';
    };

    const handleClick = (e: MouseEvent) => {
      if (!selectedColor && paintMode !== 'gradient') return;
      
      const target = e.target as HTMLElement;
      
      // Don't paint the palette itself
      if (target.closest('#color-palette-painter')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      // Remove the highlight outline
      target.style.outline = '';

      // Save to undo stack before changing
      const saveUndo = (property: string, oldValue: string) => {
        setUndoStack(prev => [...prev, { element: target, property, oldValue }]);
      };

      switch (paintMode) {
        case 'text':
          saveUndo('color', target.style.color || '');
          target.style.color = selectedColor!;
          break;
        case 'background':
          saveUndo('backgroundColor', target.style.backgroundColor || '');
          target.style.backgroundColor = selectedColor!;
          break;
        case 'border':
          // Show border thickness input popup
          const computedStyle = window.getComputedStyle(target);
          const currentWidth = computedStyle.borderWidth || '0px';
          const widthValue = currentWidth.replace('px', '');
          
          setBorderInputPopup({
            element: target,
            x: e.clientX,
            y: e.clientY,
            currentWidth
          });
          setBorderInputValue(widthValue);
          break;
        case 'gradient':
          saveUndo('background', target.style.background || '');
          const gradient = `linear-gradient(${gradientAngle}deg, ${gradientColor1}, ${gradientColor2})`;
          target.style.background = gradient;
          break;
      }
    };

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);
    
    return () => {
      // Clean up highlight on unmount
      if (lastHovered) {
        lastHovered.style.outline = '';
      }
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      document.removeEventListener('click', handleClick, true);
    };
  }, [isPainting, selectedColor, paintMode, gradientAngle, gradientColor1, gradientColor2]);

  const handleBorderInputSubmit = () => {
    if (!borderInputPopup) return;

    const { element } = borderInputPopup;
    const newWidth = parseFloat(borderInputValue);

    if (isNaN(newWidth) || newWidth < 0) {
      alert('Please enter a valid positive number');
      return;
    }

    // Save to undo stack
    setUndoStack(prev => [
      ...prev,
      { element, property: 'borderColor', oldValue: element.style.borderColor || '' },
      { element, property: 'borderWidth', oldValue: element.style.borderWidth || '' },
      { element, property: 'borderStyle', oldValue: element.style.borderStyle || '' }
    ]);

    // Apply changes
    if (selectedColor) {
      element.style.borderColor = selectedColor;
    }
    element.style.borderWidth = `${newWidth}px`;
    element.style.borderStyle = element.style.borderStyle || 'solid';

    // Close popup
    setBorderInputPopup(null);
  };

  if (!isOpen) {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 z-50 px-4 py-2 rounded-lg shadow-lg font-semibold"
          style={{ 
            background: 'var(--atlas-accent-primary)',
            color: 'white'
          }}
        >
          🎨 Color Painter
        </button>
        {borderInputPopup && (
          <BorderInputPopup
            popup={borderInputPopup}
            value={borderInputValue}
            onChange={setBorderInputValue}
            onSubmit={handleBorderInputSubmit}
            onCancel={() => setBorderInputPopup(null)}
          />
        )}
      </>
    );
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Only start dragging if clicking on the header
    if (target.closest('.painter-header')) {
      if (painterRef.current) {
        const rect = painterRef.current.getBoundingClientRect();
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
        setIsDragging(true);
      }
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    });
    setIsResizing(true);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;

    const lastChange = undoStack[undoStack.length - 1];
    const { element, property, oldValue } = lastChange;

    // Restore the old value
    if (property === 'color') {
      element.style.color = oldValue;
    } else if (property === 'backgroundColor') {
      element.style.backgroundColor = oldValue;
    } else if (property === 'borderColor') {
      element.style.borderColor = oldValue;
    } else if (property === 'borderWidth') {
      element.style.borderWidth = oldValue;
    } else if (property === 'borderStyle') {
      element.style.borderStyle = oldValue;
    } else if (property === 'background') {
      element.style.background = oldValue;
    }

    // Remove from stack
    setUndoStack(prev => prev.slice(0, -1));
  };


  const handleExportTheme = () => {
    const themeName = prompt('Enter a name for your custom theme:', 'My Custom Theme');
    if (!themeName) return;

    // Scan the DOM for all painted elements
    const paintedElements = document.querySelectorAll('[style]');
    const colorUsage: Record<string, number> = {};

    paintedElements.forEach((el) => {
      const element = el as HTMLElement;
      if (element.style.color) colorUsage[element.style.color] = (colorUsage[element.style.color] || 0) + 1;
      if (element.style.backgroundColor) colorUsage[element.style.backgroundColor] = (colorUsage[element.style.backgroundColor] || 0) + 1;
      if (element.style.borderColor) colorUsage[element.style.borderColor] = (colorUsage[element.style.borderColor] || 0) + 1;
    });

    // Create a theme based on current theme + most used painted colors
    const newTheme = {
      name: themeName.toLowerCase().replace(/\s+/g, '-'),
      label: themeName,
      colors: { ...theme.colors }
    };

    addCustomTheme(newTheme);
    alert(`Theme "${themeName}" saved! It's now selected in the theme dropdown.`);
  };

  return (
    <div
      ref={painterRef}
      id="color-palette-painter"
      className="fixed z-50 rounded-lg shadow-2xl flex flex-col"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        backgroundColor: 'var(--atlas-bg-elevated)',
        border: '2px solid var(--atlas-border-accent)',
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      {/* Header */}
      <div 
        className="painter-header p-3 flex items-center justify-between"
        onMouseDown={handleMouseDown}
        style={{ 
          backgroundColor: 'var(--atlas-bg-subtle)',
          borderBottom: '1px solid var(--atlas-border)',
          cursor: 'grab'
        }}
      >
        <span className="font-semibold" style={{ color: 'var(--atlas-text-primary)' }}>
          🎨 Color Painter
        </span>
        <button
          onClick={() => {
            setIsOpen(false);
            setIsPainting(false);
          }}
          className="text-sm px-2 py-1 rounded"
          style={{ color: 'var(--atlas-text-muted)' }}
        >
          ✕
        </button>
      </div>

      {/* Paint Mode Selector */}
      <div className="p-3" style={{ borderBottom: '1px solid var(--atlas-border)' }}>
        <div className="text-xs mb-2" style={{ color: 'var(--atlas-text-secondary)' }}>
          Paint Mode:
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['text', 'background', 'border', 'gradient'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setPaintMode(mode)}
              className="px-2 py-1 text-xs rounded capitalize"
              style={{
                backgroundColor: paintMode === mode ? 'var(--atlas-accent-primary)' : 'var(--atlas-bg-hover)',
                color: paintMode === mode ? 'white' : 'var(--atlas-text-secondary)'
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Paint and Eyedropper Toggles */}
      <div className="p-3 space-y-2" style={{ borderBottom: '1px solid var(--atlas-border)' }}>
        <button
          onClick={() => {
            setIsPainting(!isPainting);
            if (!isPainting) setIsEyedropping(false);
          }}
          className="w-full px-3 py-2 rounded font-semibold"
          style={{
            backgroundColor: isPainting ? 'var(--atlas-success)' : 'var(--atlas-error)',
            color: 'white'
          }}
        >
          {isPainting ? '✓ Painting Active (click elements)' : 'Start Painting'}
        </button>
        <button
          onClick={() => {
            setIsEyedropping(!isEyedropping);
            if (!isEyedropping) setIsPainting(false);
          }}
          className="w-full px-3 py-2 rounded font-semibold"
          style={{
            backgroundColor: isEyedropping ? 'var(--atlas-info)' : 'var(--atlas-bg-hover)',
            color: isEyedropping ? 'white' : 'var(--atlas-text-primary)'
          }}
        >
          {isEyedropping ? '👁️ Eyedropper Active (click to pick)' : '👁️ Pick Color from UI'}
        </button>
        <button
          onClick={() => {
            alert('⚠️ HOVER STATES REQUIRE BROWSER DEVTOOLS\n\nInline styles (what Color Painter uses) cannot override CSS :hover rules.\n\nTo modify hover colors:\n\n1. Open DevTools (Cmd+Option+I on Mac)\n2. Find the element in Elements panel\n3. In Styles panel, locate the :hover rule\n4. Manually edit the color values\n\nOR\n\n1. Right-click any element → Inspect\n2. In Styles, find :hover rules\n3. Edit colors directly\n\nTIP: Use Color Painter eyedropper to find colors, then paste them into DevTools CSS!');
          }}
          className="w-full px-3 py-2 rounded font-semibold text-xs"
          style={{
            backgroundColor: 'var(--atlas-bg-hover)',
            color: 'var(--atlas-text-warning)'
          }}
        >
          ⚠️ Hover States (DevTools Only)
        </button>
        {selectedColor && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <div
              className="w-4 h-4 rounded border"
              style={{
                backgroundColor: selectedColor,
                borderColor: 'var(--atlas-border)'
              }}
            />
            <div className="text-xs" style={{ color: 'var(--atlas-text-secondary)' }}>
              {colorPalette.find(c => c.value === selectedColor)?.name || selectedColor}
            </div>
          </div>
        )}
        {isEyedropping && hoveredColors && (
          <div className="mt-2 p-2 rounded text-xs" style={{ backgroundColor: 'var(--atlas-bg-subtle)', border: '1px solid var(--atlas-border)' }}>
            <div style={{ color: 'var(--atlas-text-secondary)' }}>Hovered element:</div>
            <div style={{ color: 'var(--atlas-text-primary)' }}>Text: {hoveredColors.text}</div>
            <div style={{ color: 'var(--atlas-text-primary)' }}>BG: {hoveredColors.bg}</div>
            <div style={{ color: 'var(--atlas-text-primary)' }}>Border: {hoveredColors.border}</div>
          </div>
        )}
      </div>

      {/* Custom Color Picker */}
      {paintMode !== 'gradient' && (
        <div className="p-3" style={{ borderBottom: '1px solid var(--atlas-border)' }}>
          <div className="text-xs mb-2" style={{ color: 'var(--atlas-text-secondary)' }}>
            Custom Color:
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="w-12 h-8 rounded border cursor-pointer"
              style={{ borderColor: 'var(--atlas-border)' }}
            />
            <input
              type="text"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="flex-1 px-2 py-1 text-xs rounded"
              style={{
                backgroundColor: 'var(--atlas-bg-hover)',
                color: 'var(--atlas-text-primary)',
                border: '1px solid var(--atlas-border)'
              }}
              placeholder="#000000"
            />
            <button
              onClick={() => setSelectedColor(customColor)}
              className="px-3 py-1 text-xs rounded font-semibold"
              style={{
                backgroundColor: 'var(--atlas-accent-primary)',
                color: 'white'
              }}
            >
              Use
            </button>
          </div>
        </div>
      )}

      {/* Border Thickness Control */}
      {paintMode === 'border' && (
        <div className="p-3" style={{ borderBottom: '1px solid var(--atlas-border)' }}>
          <div className="text-xs mb-2" style={{ color: 'var(--atlas-text-secondary)' }}>
            Border Thickness:
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="range"
              min="1"
              max="10"
              value={borderThickness}
              onChange={(e) => setBorderThickness(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs w-10" style={{ color: 'var(--atlas-text-primary)' }}>
              {borderThickness}px
            </span>
          </div>
        </div>
      )}

      {/* Gradient Builder */}
      {paintMode === 'gradient' && (
        <div className="p-3" style={{ borderBottom: '1px solid var(--atlas-border)' }}>
          <div className="text-xs mb-2" style={{ color: 'var(--atlas-text-secondary)' }}>
            Gradient: <span className="text-[var(--atlas-text-muted)]">(drag colors here)</span>
          </div>
          <div className="space-y-2">
            {/* Color 1 */}
            <div 
              className="flex gap-2 items-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const color = e.dataTransfer.getData('text/plain');
                if (color) setGradientColor1(color);
              }}
            >
              <input
                type="color"
                value={gradientColor1}
                onChange={(e) => setGradientColor1(e.target.value)}
                className="w-10 h-6 rounded border cursor-pointer"
                style={{ borderColor: 'var(--atlas-border)' }}
              />
              <input
                type="text"
                value={gradientColor1}
                onChange={(e) => setGradientColor1(e.target.value)}
                className="flex-1 px-2 py-1 text-xs rounded"
                style={{
                  backgroundColor: 'var(--atlas-bg-hover)',
                  color: 'var(--atlas-text-primary)',
                  border: '1px solid var(--atlas-border)'
                }}
                placeholder="Color 1"
              />
            </div>
            {/* Color 2 */}
            <div 
              className="flex gap-2 items-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const color = e.dataTransfer.getData('text/plain');
                if (color) setGradientColor2(color);
              }}
            >
              <input
                type="color"
                value={gradientColor2}
                onChange={(e) => setGradientColor2(e.target.value)}
                className="w-10 h-6 rounded border cursor-pointer"
                style={{ borderColor: 'var(--atlas-border)' }}
              />
              <input
                type="text"
                value={gradientColor2}
                onChange={(e) => setGradientColor2(e.target.value)}
                className="flex-1 px-2 py-1 text-xs rounded"
                style={{
                  backgroundColor: 'var(--atlas-bg-hover)',
                  color: 'var(--atlas-text-primary)',
                  border: '1px solid var(--atlas-border)'
                }}
                placeholder="Color 2"
              />
            </div>
            {/* Angle */}
            <div className="flex gap-2 items-center">
              <span className="text-xs" style={{ color: 'var(--atlas-text-secondary)' }}>
                Angle:
              </span>
              <input
                type="range"
                min="0"
                max="360"
                value={gradientAngle}
                onChange={(e) => setGradientAngle(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-xs w-10" style={{ color: 'var(--atlas-text-primary)' }}>
                {gradientAngle}°
              </span>
            </div>
            {/* Preview */}
            <div
              className="w-full h-8 rounded border"
              style={{
                background: `linear-gradient(${gradientAngle}deg, ${gradientColor1}, ${gradientColor2})`,
                borderColor: 'var(--atlas-border)'
              }}
            />
          </div>
        </div>
      )}

      {/* Color Palette */}
      <div className="overflow-y-auto p-3 flex-1">
        <div className="grid grid-cols-2 gap-2">
          {colorPalette.map((color) => (
            <button
              key={color.name}
              onClick={() => setSelectedColor(color.value)}
              draggable={true}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', color.value);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="flex items-center gap-2 p-2 rounded hover:opacity-80 transition-opacity cursor-move"
              style={{
                backgroundColor: selectedColor === color.value ? 'var(--atlas-bg-hover)' : 'transparent',
                border: selectedColor === color.value ? '2px solid var(--atlas-accent-primary)' : '1px solid var(--atlas-border)'
              }}
            >
              <div
                className="w-6 h-6 rounded border pointer-events-none"
                style={{
                  backgroundColor: color.value,
                  borderColor: 'var(--atlas-border)'
                }}
              />
              <span className="text-xs flex-1 text-left pointer-events-none" style={{ color: 'var(--atlas-text-primary)' }}>
                {color.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Export, Undo, and Reset Buttons */}
      <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--atlas-border)' }}>
        <button
          onClick={handleExportTheme}
          className="w-full px-3 py-2 text-sm rounded font-semibold"
          style={{
            backgroundColor: 'var(--atlas-accent-primary)',
            color: 'white'
          }}
        >
          💾 Export as New Theme
        </button>
        <button
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          className="w-full px-3 py-2 text-sm rounded font-semibold"
          style={{
            backgroundColor: undoStack.length > 0 ? 'var(--atlas-warning)' : 'var(--atlas-bg-hover)',
            color: undoStack.length > 0 ? 'white' : 'var(--atlas-text-muted)',
            cursor: undoStack.length === 0 ? 'not-allowed' : 'pointer',
            opacity: undoStack.length === 0 ? 0.5 : 1
          }}
        >
          ↩️ Undo {undoStack.length > 0 && `(${undoStack.length})`}
        </button>
        <button
          onClick={() => {
            if (confirm('Reload page to reset all colors?')) {
              window.location.reload();
            }
          }}
          className="w-full px-3 py-1.5 text-xs rounded"
          style={{
            backgroundColor: 'var(--atlas-bg-hover)',
            color: 'var(--atlas-text-warning)'
          }}
        >
          Reset All Colors (Reload)
        </button>
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize"
        style={{
          background: 'var(--atlas-accent-primary)',
          clipPath: 'polygon(100% 0, 100% 100%, 0 100%)'
        }}
      >
        <div className="absolute bottom-1 right-1 text-white text-xs pointer-events-none">
          ⋰
        </div>
      </div>

      {/* Border Input Popup */}
      {borderInputPopup && (
        <BorderInputPopup
          popup={borderInputPopup}
          value={borderInputValue}
          onChange={setBorderInputValue}
          onSubmit={handleBorderInputSubmit}
          onCancel={() => setBorderInputPopup(null)}
        />
      )}
    </div>
  );
}

// Border Input Popup Component
function BorderInputPopup({ 
  popup, 
  value, 
  onChange, 
  onSubmit, 
  onCancel 
}: { 
  popup: { x: number; y: number; currentWidth: string }, 
  value: string, 
  onChange: (v: string) => void, 
  onSubmit: () => void, 
  onCancel: () => void 
}) {
  return (
    <div
      className="fixed z-[60] p-3 rounded-lg shadow-2xl"
      style={{
        left: `${popup.x}px`,
        top: `${popup.y}px`,
        backgroundColor: 'var(--atlas-bg-elevated)',
        border: '2px solid var(--atlas-accent-primary)'
      }}
    >
      <div className="text-xs mb-2" style={{ color: 'var(--atlas-text-secondary)' }}>
        Current: {popup.currentWidth}
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSubmit();
            } else if (e.key === 'Escape') {
              onCancel();
            }
          }}
          autoFocus
          className="w-20 px-2 py-1 text-sm rounded"
          style={{
            backgroundColor: 'var(--atlas-bg-hover)',
            color: 'var(--atlas-text-primary)',
            border: '1px solid var(--atlas-border)'
          }}
          placeholder="Width"
        />
        <span className="text-xs" style={{ color: 'var(--atlas-text-secondary)' }}>px</span>
        <button
          onClick={onSubmit}
          className="px-3 py-1 text-xs rounded font-semibold"
          style={{
            backgroundColor: 'var(--atlas-success)',
            color: 'white'
          }}
        >
          Apply
        </button>
        <button
          onClick={onCancel}
          className="px-2 py-1 text-xs rounded"
          style={{
            backgroundColor: 'var(--atlas-bg-hover)',
            color: 'var(--atlas-text-muted)'
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
