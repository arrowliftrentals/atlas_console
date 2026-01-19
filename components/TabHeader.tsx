'use client';

import React from 'react';

interface TabHeaderProps {
  title: string;
  subtitle?: string;
  statusConnected?: boolean;
  statusLabel?: string;
  children?: React.ReactNode;
}

/**
 * Consistent tab header component for all console views.
 * 
 * Layout: [Status Indicator] Title
 *         Subtitle
 *         [Additional Controls on Right]
 */
export default function TabHeader({
  title,
  subtitle,
  statusConnected,
  statusLabel,
  children,
}: TabHeaderProps) {
  return (
    <div className="px-4 py-3 bg-[#252526] border-b border-gray-700 flex-shrink-0">
      <div className="flex items-start justify-between">
        <div className="flex gap-2 items-start">
          {/* Status Indicator - consistent position and style across all tabs */}
          {statusConnected !== undefined && (
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                statusConnected ? 'bg-green-500' : 'bg-gray-600'
              }`}
              style={{
                marginTop: '0.5rem',
                boxShadow: statusConnected
                  ? '0 0 6px rgba(34, 197, 94, 0.8)'
                  : 'none',
                border: statusConnected
                  ? '1.5px solid rgba(34, 197, 94, 0.9)'
                  : '1.5px solid rgba(75, 85, 99, 0.6)',
              }}
              title={statusLabel || (statusConnected ? 'Connected' : 'Disconnected')}
            />
          )}
          
          {/* Title and Subtitle */}
          <div>
            <h2 className="text-lg font-semibold text-white whitespace-nowrap">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-gray-400 whitespace-nowrap">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        
        {/* Right-side controls */}
        {children && (
          <div className="flex items-center gap-4">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
