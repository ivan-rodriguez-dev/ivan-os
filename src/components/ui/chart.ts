// Shared Recharts styling so every chart reads as part of the same system.
export const CHART = {
  accent: '#22d3ee',
  ok: '#34d399',
  danger: '#f87171',
  warn: '#fbbf24',
  violet: '#a78bfa',
  grid: '#1c2740',
  axis: '#6f7f9c',
  series: ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#60a5fa', '#f472b6', '#94a3b8'],
} as const;

export const axisProps = {
  stroke: CHART.axis,
  tick: { fill: CHART.axis, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: CHART.grid },
} as const;

export const tooltipProps = {
  contentStyle: {
    background: '#111a2c',
    border: '1px solid #2a3a5c',
    borderRadius: 8,
    color: '#e6ecf5',
    fontSize: 13,
  },
  labelStyle: { color: '#a3b1c9', marginBottom: 4 },
  itemStyle: { color: '#e6ecf5' },
  cursor: { fill: 'rgba(34, 211, 238, 0.06)' },
} as const;
