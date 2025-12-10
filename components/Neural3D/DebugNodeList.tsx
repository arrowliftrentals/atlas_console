'use client';

import { useNeuralTelemetryStoreV2 } from './NeuralTelemetryStoreV2';

export function DebugNodeList() {
  const { nodes } = useNeuralTelemetryStoreV2();
  const nodeArray = Array.from(nodes.values());
  
  const database = nodeArray.find(n => n.id === 'database');
  const vectorStore = nodeArray.find(n => n.id === 'vector_store');
  
  return (
    <div style={{
      position: 'absolute',
      top: 10,
      right: 10,
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      fontSize: '12px',
      fontFamily: 'monospace',
      maxHeight: '400px',
      overflow: 'auto',
      zIndex: 1000,
    }}>
      <div>Total nodes: {nodes.size}</div>
      <div style={{ marginTop: '10px', borderTop: '1px solid #444', paddingTop: '10px' }}>
        <div style={{ fontWeight: 'bold', color: '#FF1493' }}>DATABASE NODE:</div>
        {database ? (
          <>
            <div>✅ Exists in store</div>
            <div>Subsystem: {database.subsystem}</div>
            <div>Position: [{database.position.map(p => p.toFixed(1)).join(', ')}]</div>
            <div>Label: {database.label}</div>
          </>
        ) : (
          <div>❌ Not found</div>
        )}
      </div>
      <div style={{ marginTop: '10px', borderTop: '1px solid #444', paddingTop: '10px' }}>
        <div style={{ fontWeight: 'bold', color: '#FF1493' }}>VECTOR_STORE NODE:</div>
        {vectorStore ? (
          <>
            <div>✅ Exists in store</div>
            <div>Subsystem: {vectorStore.subsystem}</div>
            <div>Position: [{vectorStore.position.map(p => p.toFixed(1)).join(', ')}]</div>
            <div>Label: {vectorStore.label}</div>
          </>
        ) : (
          <div>❌ Not found</div>
        )}
      </div>
    </div>
  );
}
