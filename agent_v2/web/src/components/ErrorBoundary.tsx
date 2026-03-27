import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('ErrorBoundary:', error, info); }

  render() {
    if (this.state.hasError) return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg-page)]">
        <div className="text-center space-y-4 max-w-md px-6">
          <AlertTriangle size={36} className="mx-auto text-amber-500" />
          <h1 className="text-[16px] font-semibold text-[var(--gray-900)]">Something went wrong</h1>
          <p className="text-[13px] text-[var(--gray-500)]">{this.state.error?.message || 'An unexpected error occurred.'}</p>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="btn btn-primary text-[13px]"><RefreshCw size={14} /> Reload</button>
        </div>
      </div>
    );
    return this.props.children;
  }
}
