import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface FieldShell {
  label: string;
  error?: string | undefined;
  hint?: string;
}

const CONTROL =
  'w-full rounded-lg border bg-void px-3 text-[15px] text-ink placeholder:text-ink-mute transition-colors focus:border-accent focus:outline-none disabled:opacity-60';

function Shell({ id, label, error, hint, children }: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-soft">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-ink-mute">{hint}</p>
      ) : null}
    </div>
  );
}

const describe = (id: string, error?: string) => ({
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? `${id}-error` : undefined,
});

export function Input({ label, error, hint, className, ...rest }: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} {...(hint ? { hint } : {})}>
      <input id={id} className={cn(CONTROL, 'h-11', error ? 'border-danger' : 'border-line-strong', className)} {...describe(id, error)} {...rest} />
    </Shell>
  );
}

export function Textarea({ label, error, hint, className, rows = 3, ...rest }: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} {...(hint ? { hint } : {})}>
      <textarea id={id} rows={rows} className={cn(CONTROL, 'resize-y py-2.5', error ? 'border-danger' : 'border-line-strong', className)} {...describe(id, error)} {...rest} />
    </Shell>
  );
}

interface SelectProps extends FieldShell, SelectHTMLAttributes<HTMLSelectElement> {
  options: readonly { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ label, error, hint, options, placeholder, className, ...rest }: SelectProps) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} {...(hint ? { hint } : {})}>
      <select id={id} className={cn(CONTROL, 'h-11', error ? 'border-danger' : 'border-line-strong', className)} {...describe(id, error)} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Shell>
  );
}

/** Turns a `Record<value, label>` into Select options. */
export const optionsFrom = <K extends string>(labels: Record<K, string>): { value: K; label: string }[] =>
  (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }));
