import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from '@/components/ui';

interface Props {
  children: ReactNode;
}

/** Last line of defence: a render error shows a recoverable message instead of a blank page. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[IVAN OS] render error', error, info.componentStack);
  }

  override render() {
    if (this.state.failed) {
      return (
        <div className="grid min-h-[50dvh] place-items-center">
          <ErrorState message="Algo falló al mostrar esta sección. Tus datos están a salvo." onRetry={() => window.location.reload()} />
        </div>
      );
    }
    return this.props.children;
  }
}
