import { useMemo, useState } from 'react';
import {
  Area, AreaChart, CartesianGrid, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Check } from '../api';

type Props = {
  checks: Check[];
  serviceName: string;
};

const PERIODS = [
  { label: 'Last 10', count: 10 },
  { label: 'Last 25', count: 25 },
  { label: 'Last 50', count: 50 },
];

export function ResponseChart({ checks, serviceName }: Props) {
  const [periodCount, setPeriodCount] = useState(25);

  const chartData = useMemo(() => {
    const slice = [...checks].slice(0, periodCount).reverse();
    return slice.map((item) => ({
      time: new Date(item.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ms: item.is_success ? item.response_time_ms : null,
      failed: !item.is_success ? item.response_time_ms || 0 : null,
    }));
  }, [checks, periodCount]);

  const avgMs = useMemo(() => {
    const successful = checks.filter((c) => c.is_success);
    if (!successful.length) return null;
    return Math.round(successful.reduce((s, c) => s + c.response_time_ms, 0) / successful.length);
  }, [checks]);

  const latest = checks[0];

  return (
    <article className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <h2>Response time</h2>
          <p>{serviceName} · {checks.length} checks loaded</p>
        </div>
        <select
          aria-label="Chart period"
          value={periodCount}
          onChange={(e) => setPeriodCount(Number(e.target.value))}
        >
          {PERIODS.map((p) => (
            <option key={p.count} value={p.count}>{p.label}</option>
          ))}
        </select>
      </div>

      {chartData.length > 0 ? (
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fill-ok" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7259e8" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#7259e8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fill-err" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e45c61" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#e45c61" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={false} width={38} tick={{ fontSize: 10 }} unit="ms" />
              <Tooltip
                formatter={(val, name) => [
                  val != null ? `${val} ms` : '—',
                  name === 'ms' ? 'Response time' : 'Failed',
                ]}
              />
              {avgMs != null && (
                <ReferenceLine
                  y={avgMs}
                  stroke="#7259e8"
                  strokeDasharray="4 2"
                  label={{ value: `avg ${avgMs}ms`, position: 'insideTopRight', fontSize: 9 }}
                />
              )}
              <Area
                type="monotone"
                dataKey="ms"
                stroke="#7259e8"
                strokeWidth={2}
                fill="url(#fill-ok)"
                dot={false}
                connectNulls={false}
              />
              <Area
                type="monotone"
                dataKey="failed"
                stroke="#e45c61"
                strokeWidth={2}
                fill="url(#fill-err)"
                dot={false}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="chart-empty">Run a check to start building response-time history.</div>
      )}

      <div className="chart-legend">
        <span>
          <i aria-hidden /> Response time{' '}
          <b>{latest?.is_success ? `${latest.response_time_ms} ms` : 'failed'}</b>
        </span>
        <span>Latest: {latest ? new Date(latest.checked_at).toLocaleString() : 'No data'}</span>
      </div>
    </article>
  );
}
