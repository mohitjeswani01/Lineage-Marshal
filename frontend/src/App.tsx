import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ToastProvider } from '@/hooks/useToast';
import { TriggerDemoPage } from '@/pages/TriggerDemoPage';
import { EmptyState } from '@/components/ui/EmptyState';

/**
 * Last-resort boundary. A render crash in one panel shouldn't take the whole
 * demo down with a blank page — show what broke and offer a reload.
 */
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error?: Error }
> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-dvh place-items-center p-6">
          <EmptyState
            tone="error"
            title="Something broke in the UI"
            description={this.state.error.message}
            action={{ label: 'Reload', onClick: () => location.reload() }}
          />
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <TriggerDemoPage />
      </ToastProvider>
    </ErrorBoundary>
  );
}
