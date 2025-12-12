// NeuralShellControls.tsx
// External UI controls for rotating cognitive shells

'use client';

import { useState, useEffect } from 'react';

interface ShellRotation {
  x: number;
  y: number;
  z: number;
}

interface Props {
  onCoreRotationChange: (rotation: ShellRotation) => void;
  onMemoryRotationChange: (rotation: ShellRotation) => void;
  onPerceptionRotationChange: (rotation: ShellRotation) => void;
  selectedShell: 'core' | 'memory' | 'perception' | null;
  onShellSelect: (shell: 'core' | 'memory' | 'perception' | null) => void;
  coreRotation: ShellRotation;
  memoryRotation: ShellRotation;
  perceptionRotation: ShellRotation;
  onOptimize?: () => void;
  onOptimizePositions?: () => void;
}

export function NeuralShellControls({
  onCoreRotationChange,
  onMemoryRotationChange,
  onPerceptionRotationChange,
  selectedShell,
  onShellSelect,
  coreRotation,
  memoryRotation,
  perceptionRotation,
  onOptimize,
  onOptimizePositions,
}: Props) {



  const resetRotation = (shell: 'core' | 'memory' | 'perception') => {
    const zero = { x: 0, y: 0, z: 0 };
    if (shell === 'core') {
      onCoreRotationChange(zero);
    } else if (shell === 'memory') {
      onMemoryRotationChange(zero);
    } else {
      onPerceptionRotationChange(zero);
    }
  };

  const saveRotations = () => {
    localStorage.setItem('neural-shell-rotation-core', JSON.stringify(coreRotation));
    localStorage.setItem('neural-shell-rotation-memory', JSON.stringify(memoryRotation));
    localStorage.setItem('neural-shell-rotation-perception', JSON.stringify(perceptionRotation));
  };
  
  // Load saved rotations on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCore = localStorage.getItem('neural-shell-rotation-core');
      const savedMemory = localStorage.getItem('neural-shell-rotation-memory');
      const savedPerception = localStorage.getItem('neural-shell-rotation-perception');
      
      if (savedCore) {
        onCoreRotationChange(JSON.parse(savedCore));
      }
      if (savedMemory) {
        onMemoryRotationChange(JSON.parse(savedMemory));
      }
      if (savedPerception) {
        onPerceptionRotationChange(JSON.parse(savedPerception));
      }
    }
  }, []);

  const getRotation = (shell: 'core' | 'memory' | 'perception') => {
    if (shell === 'core') return coreRotation;
    if (shell === 'memory') return memoryRotation;
    return perceptionRotation;
  };

  return (
    <div 
      className="absolute top-4 right-4 w-64 bg-gray-900/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700 p-4"
      style={{ zIndex: 100 }}
    >
      <div className="flex justify-between items-center mb-3 border-b border-gray-700 pb-2">
        <h3 className="text-base font-bold text-white">
          Shell Rotation
        </h3>
        <div className="flex flex-wrap gap-1">
          {onOptimize && (
            <button
              onClick={onOptimize}
              className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-500 rounded text-white font-semibold"
              title="Optimize shell rotations to minimize connection lengths"
            >
              Rotate
            </button>
          )}
          {onOptimizePositions && (
            <button
              onClick={onOptimizePositions}
              className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white font-semibold"
              title="Optimize node positions on sphere to minimize connection lengths"
            >
              Reposition
            </button>
          )}
          <button
            onClick={saveRotations}
            className="px-2 py-1 text-xs bg-green-600 hover:bg-green-500 rounded text-white font-semibold"
          >
            Save
          </button>
        </div>
      </div>

      <div className={`text-xs mb-3 p-2 rounded ${selectedShell ? 'bg-blue-900/50 text-blue-200 border border-blue-500' : 'bg-gray-800/50 text-gray-400'}`}>
        {selectedShell ? (
          <span className="font-semibold">🖱️ Drag anywhere in 3D view to rotate {selectedShell} shell</span>
        ) : (
          <span>Select a shell below, then drag in the 3D view to rotate it</span>
        )}
      </div>
      
      {/* Shell selection buttons */}
      <div className="space-y-2 mb-4">
        {[
          { id: 'core' as const, label: 'Core Shell', color: '#FF6B9D' },
          { id: 'memory' as const, label: 'Memory Shell', color: '#4ECDC4' },
          { id: 'perception' as const, label: 'Perception Shell', color: '#FFD93D' },
        ].map(({ id, label, color }) => (
          <button
            key={id}
            onClick={() => onShellSelect(selectedShell === id ? null : id)}
            className={`w-full px-3 py-2 rounded font-semibold text-sm transition-all ${
              selectedShell === id
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
            style={selectedShell === id ? { 
              boxShadow: `0 0 20px ${color}40`,
              borderLeft: `4px solid ${color}`
            } : {
              borderLeft: `4px solid ${color}`
            }}
          >
            {label}
            {selectedShell === id && (
              <span className="ml-2 text-xs">✓ Active</span>
            )}
          </button>
        ))}
      </div>

      {/* Current rotation display */}
      {selectedShell && (
        <div className="p-3 bg-gray-800/50 rounded border border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-semibold text-white capitalize">{selectedShell}</h4>
            <button
              onClick={() => resetRotation(selectedShell)}
              className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-white"
            >
              Reset
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {(['x', 'y', 'z'] as const).map(axis => (
              <div key={axis} className="text-center">
                <div className="text-gray-400 uppercase font-semibold">{axis}</div>
                <div className="text-white">{getRotation(selectedShell)[axis].toFixed(0)}°</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!selectedShell && (
        <div className="text-xs text-gray-500 text-center italic">
          No shell selected
        </div>
      )}
    </div>
  );
}
