'use client';

import { Graph } from './NeuralNetworkScene';

interface NeuralHUDProps {
  activitySpeed: number;
  edgeDensity: number;
  showLabels: boolean;
  selectedNode: string | null;
  hoveredNode: string | null;
  graph: Graph;
  onActivitySpeedChange: (value: number) => void;
  onEdgeDensityChange: (value: number) => void;
  onShowLabelsChange: (value: boolean) => void;
  onClearSelection: () => void;
}

export default function NeuralHUD({
  activitySpeed,
  edgeDensity,
  showLabels,
  selectedNode,
  hoveredNode,
  graph,
  onActivitySpeedChange,
  onEdgeDensityChange,
  onShowLabelsChange,
  onClearSelection
}: NeuralHUDProps) {
  const activeNodeId = hoveredNode || selectedNode;
  const activeNode = activeNodeId ? graph.nodes.find(n => n.id === activeNodeId) : null;
  
  return (
    <>
      {/* Top-right control panel */}
      <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg p-4 text-white min-w-[280px]">
        <h3 className="text-sm font-bold text-cyan-400 mb-3 uppercase tracking-wider">
          Neural Network Controls
        </h3>
        
        {/* Activity Speed Slider */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-gray-300">Activity Speed</label>
            <span className="text-xs text-cyan-400 font-mono">{activitySpeed.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={activitySpeed}
            onChange={(e) => onActivitySpeedChange(parseFloat(e.target.value))}
            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
        </div>
        
        {/* Edge Density Slider */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-gray-300">Edge Density</label>
            <span className="text-xs text-cyan-400 font-mono">{(edgeDensity * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={edgeDensity}
            onChange={(e) => onEdgeDensityChange(parseFloat(e.target.value))}
            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <p className="text-[10px] text-gray-500 mt-1">Hide edges with weight below threshold</p>
        </div>
        
        {/* Show Labels Toggle */}
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-300">Show Labels</label>
          <button
            onClick={() => onShowLabelsChange(!showLabels)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              showLabels ? 'bg-cyan-500' : 'bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                showLabels ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        
        {/* Stats */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="text-[10px] text-gray-400 space-y-1">
            <div className="flex justify-between">
              <span>Nodes:</span>
              <span className="text-cyan-400 font-mono">{graph.nodes.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Edges:</span>
              <span className="text-cyan-400 font-mono">{graph.edges.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Visible Edges:</span>
              <span className="text-cyan-400 font-mono">
                {graph.edges.filter(e => (e.weight || 0.5) >= edgeDensity).length}
              </span>
            </div>
          </div>
        </div>
        
        {/* Clear selection button */}
        {selectedNode && (
          <button
            onClick={onClearSelection}
            className="mt-3 w-full bg-gray-700 hover:bg-gray-600 text-xs text-white py-2 rounded transition-colors"
          >
            Clear Selection
          </button>
        )}
      </div>
      
      {/* Bottom-left info panel (active node details) */}
      {activeNode && (
        <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg p-4 text-white min-w-[300px]">
          <h3 className="text-sm font-bold text-cyan-400 mb-2 uppercase tracking-wider">
            {hoveredNode ? 'Hovered Node' : 'Selected Node'}
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <span className="text-gray-400 min-w-[60px]">ID:</span>
              <span className="text-white font-mono break-all">{activeNode.id}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-400 min-w-[60px]">Label:</span>
              <span className="text-white">{activeNode.label || '—'}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-400 min-w-[60px]">Group:</span>
              <span className="text-cyan-300">{activeNode.group || 'default'}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-400 min-w-[60px]">Activity:</span>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-white">{((activeNode.activity || 0) * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-blue-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${(activeNode.activity || 0) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-400 min-w-[60px]">Connections:</span>
              <span className="text-white font-mono">
                {graph.edges.filter(e => e.source === activeNode.id || e.target === activeNode.id).length}
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Title overlay */}
      <div className="absolute top-4 left-4 text-white">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Neural Network Visualization
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Interactive 3D brain-like dataflow • Click nodes to select • Drag to rotate
        </p>
      </div>
    </>
  );
}
