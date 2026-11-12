import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-void font-semibold hover:bg-accent/85',
  secondary: 'border border-line-strong bg-raised text-ink hover:border-accent/60',
  ghost: 'text-ink-soft hover:bg-raised hover:text-ink',
  danger: 'border border-danger/50 bg-danger/10 text-danger hover:bg-danger/20',
};

export function Button({ variant = 'secondary', size = 'md', loading = false, icon, children, className, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-9 px-3 text-sm' : 'h-11 px-4 text-sm',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: 'default' | 'danger';
}

/** Square icon-only button; `label` is its accessible name and tooltip. */
export function IconButton({ label, tone = 'default', className, children, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-mute transition-colors hover:bg-raised disabled:opacity-40',
        tone === 'danger' ? 'hover:text-danger' : 'hover:text-accent',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
