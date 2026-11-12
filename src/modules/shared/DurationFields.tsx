import { Input } from '@/components/ui';
import type { Rule } from '@/lib/validation';

export interface DurationValues {
  hours: string;
  minutes: string;
}

export const toDuration = (totalMinutes: number | undefined): DurationValues =>
  totalMinutes === undefined ? { hours: '1', minutes: '0' } : { hours: String(Math.floor(totalMinutes / 60)), minutes: String(totalMinutes % 60) };

export const durationMinutes = (v: DurationValues): number => Number(v.hours || 0) * 60 + Number(v.minutes || 0);

/** Attach to the `hours` field: validates the hours + minutes pair as one duration (1 min – 24 h). */
export const durationRule: Rule<DurationValues> = (_value, values) => {
  const h = Number(values.hours || 0);
  const m = Number(values.minutes || 0);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || m > 59) return 'Duración no válida';
  const total = h * 60 + m;
  if (total < 1) return 'La duración debe ser de al menos 1 minuto';
  return total > 1440 ? 'La duración máxima es de 24 horas' : null;
};

interface Props {
  values: DurationValues;
  error: string | undefined;
  onChange: (key: keyof DurationValues, value: string) => void;
}

export function DurationFields({ values, error, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Input label="Horas" type="number" inputMode="numeric" min={0} max={24} value={values.hours} error={error} onChange={(e) => onChange('hours', e.target.value)} />
      <Input label="Minutos" type="number" inputMode="numeric" min={0} max={59} value={values.minutes} onChange={(e) => onChange('minutes', e.target.value)} />
    </div>
  );
}
