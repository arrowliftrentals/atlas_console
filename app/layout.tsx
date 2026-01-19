import "./globals.css";
import type { ReactNode } from "react";

import Sidebar from "@/components/Sidebar";
import ChatPanel from "@/components/ChatPanel";
import StatusBar from "@/components/StatusBar";
import TerminalPanel from "@/components/TerminalPanel";
import { ConsoleProvider } from "@/components/ConsoleProvider";
import { ConsoleLogInterceptor } from "@/components/ConsoleLogInterceptor";
import { HealthProvider } from "@/contexts/HealthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ColorPalettePainter from "@/components/ColorPalettePainter";

export const metadata = {
  title: "ATLAS Web Console",
  description: "VS Codestyle console for the ATLAS Core assistant",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Panel widths are managed via CSS variables.
  // Sidebar width and chat panel width persistence are handled in their respective components.
  return (
    <html lang="en">
      <body className="h-screen w-screen text-gray-100" style={{ backgroundColor: 'var(--atlas-bg-primary)' }}>
        <ThemeProvider>
          <HealthProvider>
            <ConsoleProvider>
            {/* <ConsoleLogInterceptor /> */}
            <div className="flex flex-col h-full w-full">
            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar + resize handle */}
              <div className="flex border-r" style={{ width: "var(--sidebar-width, 256px)", borderColor: 'var(--atlas-border)', backgroundColor: 'var(--atlas-bg-elevated)' }}>
                <Sidebar />
              </div>

              {/* Main + Terminal */}
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* Main content */}
                <div className="flex-1 overflow-auto">
                  {children}
                </div>
                {/* Collapsible terminal panel */}
                <TerminalPanel />
              </div>

              {/* Chat panel + resize handle */}
              <div className="flex" style={{ width: "var(--chat-panel-width, 460px)" }}>
                {/* Resize handle is rendered inside ChatPanel so it can access width state */}
                <ChatPanel />
              </div>
            </div>

            {/* Status bar */}
            <StatusBar />
            </div>
            {/* Color Painter Tool */}
            <ColorPalettePainter />
          </ConsoleProvider>
        </HealthProvider>
      </ThemeProvider>
      </body>
    </html>
  );
}
