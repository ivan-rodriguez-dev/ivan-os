export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <path d="M16 4l10.4 6v12L16 28 5.6 22V10z" fill="none" stroke="var(--color-accent)" strokeWidth="1.8" />
        <circle cx="16" cy="16" r="3.2" fill="var(--color-accent)" />
      </svg>
      {!compact && (
        <div className="leading-tight">
          <p className="num text-[0.95rem] font-semibold tracking-[0.18em] text-ink">IVAN OS</p>
          <p className="label !text-[0.62rem] !tracking-[0.14em]">Command Center</p>
        </div>
      )}
    </div>
  );
}
