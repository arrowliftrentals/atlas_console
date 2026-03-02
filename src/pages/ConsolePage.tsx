import DashboardView from '@/components/DashboardView';
import { Component, ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<{children: ReactNode}, ErrorBoundaryState> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Dashboard Error:', error);
    console.error('Error Info:', errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          width: '100vw', 
          height: '100vh', 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 99999,
          padding: '32px'
        }}>
          <div style={{ maxWidth: '800px', width: '100%' }}>
            <div style={{ 
              backgroundColor: '#2a1a1a', 
              border: '3px solid #ef4444',
              borderRadius: '12px',
              padding: '32px'
            }}>
              <h1 style={{ 
                color: '#ef4444', 
                fontSize: '32px', 
                fontWeight: 'bold', 
                marginBottom: '24px',
                fontFamily: 'monospace'
              }}>
                ⚠️ DASHBOARD ERROR
              </h1>
              <div style={{ 
                color: '#fca5a5', 
                fontSize: '18px', 
                marginBottom: '24px',
                fontFamily: 'monospace',
                lineHeight: '1.6'
              }}>
                {this.state.error?.message || 'Unknown error occurred'}
              </div>
              <div style={{ marginTop: '24px' }}>
                <div style={{ 
                  color: '#f87171', 
                  fontWeight: 'bold',
                  marginBottom: '12px',
                  fontSize: '16px',
                  fontFamily: 'monospace'
                }}>FULL ERROR:</div>
                <pre style={{ 
                  backgroundColor: '#111', 
                  color: '#fca5a5', 
                  padding: '16px', 
                  borderRadius: '8px',
                  overflow: 'auto',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '400px',
                  border: '1px solid #ef4444'
                }}>{this.state.error?.stack || 'No stack trace available'}
{this.state.errorInfo?.componentStack || ''}</pre>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ConsolePage() {
  return (
    <ErrorBoundary>
      <main className="h-full w-full">
        <DashboardView />
      </main>
    </ErrorBoundary>
  );
}
