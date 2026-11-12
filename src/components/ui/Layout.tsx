import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="label text-accent">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[1.7rem]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

interface PanelProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Removes inner padding so tables and lists can reach the edges. */
  flush?: boolean;
}

export function Panel({ title, actions, children, className, flush = false }: PanelProps) {
  return (
    <section className={cn('min-w-0 rounded-xl border border-line bg-panel', className)}>
      {(title || actions) && (
        <header className="flex min-h-13 items-center justify-between gap-3 border-b border-line px-4 py-2 sm:px-5">
          {title && <h2 className="label text-ink-soft">{title}</h2>}
          {actions && <div className="flex items-center gap-1">{actions}</div>}
        </header>
      )}
      <div className={flush ? '' : 'p-4 sm:p-5'}>{children}</div>
    </section>
  );
}

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger' | 'violet';

const TONES: Record<Tone, string> = {
  neutral: 'border-line-strong text-ink-soft',
  accent: 'border-accent/40 text-accent',
  ok: 'border-ok/40 text-ok',
  warn: 'border-warn/40 text-warn',
  danger: 'border-danger/50 text-danger',
  violet: 'border-violet/40 text-violet',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium', TONES[tone])}>{children}</span>;
}

const BAR_TONES: Record<'accent' | 'ok' | 'warn' | 'danger' | 'violet', string> = {
  accent: 'bg-accent',
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
  violet: 'bg-violet',
};

export function ProgressBar({ percent, tone = 'accent', label }: { percent: number; tone?: keyof typeof BAR_TONES; label: string }) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className={cn('h-full rounded-full transition-[width] duration-500', BAR_TONES[tone])} style={{ width: `${value}%` }} />
    </div>
  );
}

interface StatProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: 'default' | 'ok' | 'danger' | 'accent';
}

export function Stat({ label, value, detail, tone = 'default' }: StatProps) {
  const color = { default: 'text-ink', ok: 'text-ok', danger: 'text-danger', accent: 'text-accent' }[tone];
  return (
    <div role="group" aria-label={label} className="min-w-0 rounded-xl border border-line bg-panel px-4 py-3.5 sm:px-5">
      <p className="label">{label}</p>
      <p className={cn('num mt-1.5 text-[1.05rem] font-semibold leading-tight sm:text-[1.35rem]', color)}>{value}</p>
      {detail && <p className="mt-0.5 truncate text-sm text-ink-mute">{detail}</p>}
    </div>
  );
}

interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  label: string;
}

export function Tabs<T extends string>({ value, onChange, options, label }: TabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors',
              active ? 'border-accent text-accent' : 'border-transparent text-ink-mute hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
