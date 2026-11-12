import { CircleAlert, LoaderCircle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { QueryState } from '@/hooks/useQuery';
import { Button } from './Button';

export function LoadingState({ label = 'Cargando datos…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-12 text-ink-mute">
      <LoaderCircle className="size-5 animate-spin text-accent" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
      <CircleAlert className="size-7 text-danger" aria-hidden />
      <p className="max-w-sm text-ink-soft">{message}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <Icon className="size-8 text-line-strong" strokeWidth={1.5} aria-hidden />
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-mute">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Renders loading / error states for a query and hands loaded data to `children`. */
export function QueryView<T>({ query, children }: { query: QueryState<T>; children: (data: T) => ReactNode }) {
  if (query.data !== null) return <>{children(query.data)}</>;
  if (query.error) return <ErrorState message={query.error} onRetry={() => void query.reload()} />;
  return <LoadingState />;
}
