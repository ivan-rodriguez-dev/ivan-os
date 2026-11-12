import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART, axisProps, tooltipProps } from '@/components/ui';
import { formatMinutes, minutesToHours } from '@/lib/dates';
import type { Bucket } from '@/lib/sessions';

interface Props {
  buckets: Bucket[];
  /** Stacked series: bucket.groups keys with their legend labels. Omit for a single total bar. */
  series?: { key: string; label: string }[];
  ariaLabel: string;
}

/** Hours per period as bars; stacked when `series` is given. */
export function HoursChart({ buckets, series, ariaLabel }: Props) {
  const data = buckets.map((b) => ({
    label: b.label,
    total: minutesToHours(b.minutes),
    ...Object.fromEntries((series ?? []).map((s) => [s.key, minutesToHours(b.groups[s.key] ?? 0)])),
  }));
  const format = (value: unknown) => formatMinutes(Math.round(Number(value) * 60));

  return (
    <div className="h-60 w-full" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
          <YAxis {...axisProps} allowDecimals={false} unit=" h" width={56} />
          <Tooltip {...tooltipProps} formatter={(value, name) => [format(value), name]} />
          {series ? (
            <>
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, color: CHART.axis }} />
              {series.map((s, i) => (
                <Bar isAnimationActive={false} key={s.key} dataKey={s.key} name={s.label} stackId="hours" fill={CHART.series[i % CHART.series.length] as string} maxBarSize={36} />
              ))}
            </>
          ) : (
            <Bar isAnimationActive={false} dataKey="total" name="Horas" fill={CHART.accent} radius={[4, 4, 0, 0]} maxBarSize={36} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
