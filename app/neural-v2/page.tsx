'use client';

import { useState } from 'react';
import NeuralArchitecture3DV2 from '@/components/Neural3D/NeuralArchitecture3DV2';

export default function NeuralV2Page() {
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  
  const runDiagnostic = async () => {
    setShowDiagnostic(true);
    setDiagnosticLogs([]);
    
    const log = (msg: string) => {
      console.log(msg);
      setDiagnosticLogs(prev => [...prev, `[${new Date().toISOString()}] ${msg}`]);
    };
    
    log('=== TELEMETRY DIAGNOSTIC START ===');
    
    // Test 1: Backend health
    log('Test 1: Checking backend...');
    try {
      const health = await fetch('http://localhost:8000/health');
      const data = await health.json();
      log('✅ Backend: ' + JSON.stringify(data));
    } catch (err: any) {
      log('❌ Backend unreachable: ' + err.message);
      return;
    }
    
    // Test 2: WebSocket telemetry
    log('Test 2: Connecting to telemetry WebSocket...');
    const ws = new WebSocket('ws://localhost:8000/v1/telemetry/stream');
    let msgCount = 0;
    let flowCount = 0;
    
    ws.onopen = () => {
      log('✅ WebSocket connected');
      log('Test 3: Sending query to generate telemetry...');
      fetch('http://localhost:8000/v1/atlas/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test' })
      }).then(() => log('✅ Query sent'));
    };
    
    ws.onmessage = (event) => {
      msgCount++;
      const data = JSON.parse(event.data);
      log(`📨 Msg ${msgCount}: type=${data.type}`);
      
      if (data.type === 'execution_flow') {
        flowCount++;
        log(`  ✅ execution_flow: ${data.source} → ${data.target}`);
      } else if (data.type === 'batch') {
        flowCount += data.events?.length || 0;
        log(`  ✅ batch: ${data.events?.length} flows`);
      }
    };
    
    setTimeout(() => {
      ws.close();
      log('=== DIAGNOSTIC COMPLETE ===');
      log(`Messages: ${msgCount}, Flows: ${flowCount}`);
      if (flowCount === 0) {
        log('❌ NO FLOWS RECEIVED - Backend not sending execution_flow/batch events');
      } else {
        log('✅ Telemetry working! If no particles, check rendering code.');
      }
    }, 10000);
  };
  
  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, position: 'relative' }}>
      <NeuralArchitecture3DV2
        timeScale={1.0}
        maxParticles={50000}
      />
      
      {/* Diagnostic Button */}
      <button
        onClick={runDiagnostic}
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          padding: '8px 16px',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 'bold',
          zIndex: 9999,
        }}
      >
        🔍 Diagnose Telemetry
      </button>
      
      {/* Diagnostic Output */}
      {showDiagnostic && (
        <div style={{
          position: 'absolute',
          top: 50,
          right: 10,
          width: 400,
          maxHeight: '80vh',
          background: '#1e1e1e',
          border: '1px solid #3b82f6',
          borderRadius: 4,
          padding: 10,
          overflow: 'auto',
          zIndex: 9999,
          fontFamily: 'monospace',
          fontSize: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <strong style={{ color: '#3b82f6' }}>Diagnostic Log</strong>
            <button onClick={() => setShowDiagnostic(false)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
          {diagnosticLogs.map((log, i) => (
            <div key={i} style={{ color: log.includes('❌') ? '#ef4444' : log.includes('✅') ? '#22c55e' : '#fff', marginBottom: 4 }}>
              {log}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
