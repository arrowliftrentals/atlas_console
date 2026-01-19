'use client';

import React, { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export default function ThemeSelector() {
  const { currentTheme, availableThemes, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1 hover:bg-gray-700/50 rounded transition-colors"
        title="Change theme"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
        <span className="text-xs">Theme</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute bottom-full right-0 mb-2 w-48 bg-[#252526] border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-700">
              <span className="text-xs font-semibold text-gray-400">SELECT THEME</span>
            </div>
            <div className="py-1">
              {availableThemes.map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => {
                    setTheme(theme.name);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                    currentTheme === theme.name
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{theme.label}</span>
                    {currentTheme === theme.name && (
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  {/* Color preview */}
                  <div className="flex gap-1 mt-1.5">
                    <div 
                      className="w-3 h-3 rounded border border-gray-600" 
                      style={{ backgroundColor: theme.colors.background }}
                      title="Background"
                    />
                    <div 
                      className="w-3 h-3 rounded border border-gray-600" 
                      style={{ backgroundColor: theme.colors.accent }}
                      title="Accent"
                    />
                    <div 
                      className="w-3 h-3 rounded border border-gray-600" 
                      style={{ backgroundColor: theme.colors.success }}
                      title="Success"
                    />
                    <div 
                      className="w-3 h-3 rounded border border-gray-600" 
                      style={{ backgroundColor: theme.colors.warning }}
                      title="Warning"
                    />
                    <div 
                      className="w-3 h-3 rounded border border-gray-600" 
                      style={{ backgroundColor: theme.colors.error }}
                      title="Error"
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
