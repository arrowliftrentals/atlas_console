import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import StatusBar from './components/StatusBar';
import TerminalPanel from './components/TerminalPanel';
import { ConsoleProvider } from './components/ConsoleProvider';
import { HealthProvider } from './contexts/HealthContext';
import { TelemetryProvider } from './contexts/TelemetryContext';

// Pages
import ConsolePage from './pages/ConsolePage';
import Neural3DPage from './pages/Neural3DPage';
import Neural3DFullscreenPage from './pages/Neural3DFullscreenPage';
import SettingsPage from './pages/SettingsPage';
import DebugSessionsPage from './pages/DebugSessionsPage';
import TestParticlesPage from './pages/TestParticlesPage';

export default function App() {
  return (
    <HealthProvider>
      <TelemetryProvider>
        <ConsoleProvider>
          <div className="flex flex-col h-screen w-screen bg-[#1e1e1e] text-gray-100">
            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar + resize handle */}
              <div className="flex border-r border-gray-700 bg-[#252526]" style={{ width: "var(--sidebar-width, 256px)" }}>
                <Sidebar />
              </div>

              {/* Main + Terminal */}
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* Main content */}
                <div className="flex-1 overflow-auto">
                  <Routes>
                    <Route path="/" element={<ConsolePage />} />
                    <Route path="/neural-3d" element={<Neural3DPage />} />
                    <Route path="/neural-3d-fullscreen" element={<Neural3DFullscreenPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/debug-sessions" element={<DebugSessionsPage />} />
                    <Route path="/test-particles" element={<TestParticlesPage />} />
                  </Routes>
                </div>
                {/* Collapsible terminal panel */}
                <TerminalPanel />
              </div>

              {/* Chat panel + resize handle */}
              <div className="flex" style={{ width: "var(--chat-panel-width, 460px)" }}>
                <ChatPanel />
              </div>
            </div>

            {/* Status bar */}
            <StatusBar />
          </div>
        </ConsoleProvider>
      </TelemetryProvider>
    </HealthProvider>
  );
}
