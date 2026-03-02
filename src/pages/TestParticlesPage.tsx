import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getAtlasWsUrl } from '@/lib/api';

export default function TestParticlesPage() {
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const sendTestQuery = async () => {
    setLoading(true);
    setResponse('Sending...');
    
    try {
      const res = await fetch('/v1/atlas/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Hello Atlas, please list the files in the current directory.',
          session_id: 'test-particle-session-' + Date.now()
        })
      });
      
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setResponse('Error: ' + String(error));
    } finally {
      setLoading(false);
    }
  };

  const checkWebSocket = () => {
    const ws = new WebSocket(getAtlasWsUrl('/v1/telemetry/stream'));
    
    ws.onopen = () => {
      setResponse('WebSocket CONNECTED');
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setResponse(prev => prev + '\n\nReceived: ' + JSON.stringify(data, null, 2));
    };
    
    ws.onerror = (error) => {
      setResponse('WebSocket ERROR: ' + String(error));
    };
    
    ws.onclose = () => {
      setResponse(prev => prev + '\n\nWebSocket CLOSED');
    };
    
    // Close after 30 seconds
    setTimeout(() => {
      ws.close();
    }, 30000);
  };

  const injectTestEvent = () => {
    // Test the store directly
    const { useNeuralTelemetryStoreV2 } = require('@/components/Neural3D/NeuralTelemetryStoreV2');
    const { ingestEvents } = useNeuralTelemetryStoreV2.getState();
    
    const testEvents = [{
      source: 'agent_router',
      target: 'llm_gateway',
      type: 'data_transfer' as const,
      timestamp: Date.now(),
      bytes: 1024,
      priority: 'high' as const,
      is_parent_trace: true,
      spawn_count: 3,
    }];
    
    console.log('[TEST] Injecting test events:', testEvents);
    ingestEvents(testEvents);
    setResponse('Injected test event - check browser console and Neural 3D view');
  };

  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Particle System Debug Page</h1>
      
      <div className="space-y-4">
        <div>
          <button
            onClick={sendTestQuery}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Test Query to Atlas'}
          </button>
          <p className="text-sm text-gray-400 mt-2">
            Sends a query to Atlas backend to generate telemetry events
          </p>
        </div>
        
        <div>
          <button
            onClick={checkWebSocket}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
          >
            Test WebSocket Connection
          </button>
          <p className="text-sm text-gray-400 mt-2">
            Opens WebSocket and listens for 30 seconds
          </p>
        </div>
        
        <div>
          <button
            onClick={injectTestEvent}
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded"
          >
            Inject Test Particle Event
          </button>
          <p className="text-sm text-gray-400 mt-2">
            Directly injects a test event into the store (bypass backend)
          </p>
        </div>
      </div>
      
      <div className="mt-8 bg-black p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Output:</h2>
        <pre className="whitespace-pre-wrap text-sm text-green-400">{response}</pre>
      </div>
      
      <div className="mt-8 bg-gray-800 p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Instructions:</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Open browser console (F12) to see detailed logs</li>
          <li>Navigate to Neural 3D tab in main console</li>
          <li>Click "Send Test Query" to generate backend activity</li>
          <li>Watch for <code className="bg-gray-700 px-1">[PARTICLE ACTIVATED]</code> logs</li>
          <li>If no particles appear, try "Inject Test Event" to bypass backend</li>
        </ol>
      </div>
      
      <div className="mt-4">
        <Link to="/" className="text-blue-400 hover:underline">← Back to Main Console</Link>
      </div>
    </div>
  );
}
