'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { NodeStateV2 } from './NeuralTelemetryTypesV2';
import { classifyNode } from './NeuralCognitiveLayoutV2';
import { REGION_COLORS } from './NeuralVisualEncodingV2';

interface NodeSelectorPanelProps {
  nodes: Map<string, NodeStateV2>;
  onNodeSelect: (nodeId: string, position: [number, number, number]) => void;
  onClose?: () => void;
}

export function NodeSelectorPanel({ nodes, onNodeSelect, onClose }: NodeSelectorPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Convert nodes to array and sort by region and name
  const sortedNodes = useMemo(() => {
    const nodeArray = Array.from(nodes.values());
    
    return nodeArray
      .map(node => ({
        node,
        metadata: classifyNode(node.id, node.subsystem),
      }))
      .sort((a, b) => {
        // Sort by region first (core, memory, perception)
        const regionOrder = { core: 0, memory: 1, perception: 2 };
        const regionDiff = regionOrder[a.metadata.region] - regionOrder[b.metadata.region];
        if (regionDiff !== 0) return regionDiff;
        
        // Then by node name
        return a.node.id.localeCompare(b.node.id);
      });
  }, [nodes]);
  
  // Filter nodes based on search query
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return sortedNodes;
    
    const query = searchQuery.toLowerCase();
    return sortedNodes.filter(({ node }) => 
      node.id.toLowerCase().includes(query)
    );
  }, [sortedNodes, searchQuery]);
  
  // Group nodes by region
  const nodesByRegion = useMemo(() => {
    const groups = {
      core: [] as typeof filteredNodes,
      memory: [] as typeof filteredNodes,
      perception: [] as typeof filteredNodes,
    };
    
    filteredNodes.forEach(item => {
      groups[item.metadata.region].push(item);
    });
    
    return groups;
  }, [filteredNodes]);
  
  const handleNodeClick = (node: NodeStateV2) => {
    onNodeSelect(node.id, node.position);
  };
  
  const regionLabels = {
    core: 'Core Control & Reasoning',
    memory: 'Memory Systems',
    perception: 'Perception & Tools',
  };
  
  return (
    <div 
      className="absolute bottom-16 right-4 w-80 bg-[#252526] border border-gray-700 rounded-lg shadow-xl z-50 max-h-[70vh] flex flex-col"
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Node Navigator</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* Search */}
      <div className="p-3 border-b border-gray-700">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#1e1e1e] border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
      
      {/* Node List */}
      <div className="flex-1 overflow-y-auto p-2">
        {(['core', 'memory', 'perception'] as const).map(region => {
          const regionNodes = nodesByRegion[region];
          if (regionNodes.length === 0) return null;
          
          const regionColor = REGION_COLORS[region];
          
          return (
            <div key={region} className="mb-3">
              <div className="px-2 py-1.5 mb-1.5 flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: regionColor }}
                />
                <span className="text-sm font-bold text-gray-300 uppercase tracking-wide">
                  {regionLabels[region]}
                </span>
                <span className="text-xs text-gray-500">
                  ({regionNodes.length})
                </span>
              </div>
              
              <div className="space-y-1">
                {regionNodes.map(({ node, metadata }) => (
                  <button
                    key={node.id}
                    onClick={() => handleNodeClick(node)}
                    className="w-full px-3 py-1.5 bg-[#1e1e1e] hover:bg-[#2d2d2d] border border-gray-700 hover:border-gray-600 rounded text-left transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: regionColor }}
                      />
                      <span className="text-sm text-gray-200 font-mono truncate">
                        {node.id}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        
        {filteredNodes.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No nodes found
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="p-2 border-t border-gray-700 text-xs text-gray-400 text-center">
        {filteredNodes.length} of {sortedNodes.length} nodes
      </div>
    </div>
  );
}
