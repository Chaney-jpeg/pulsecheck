import { UptimeDayBucket } from '../api';

type Props = {
  buckets: UptimeDayBucket[];
};

function bucketColor(pct: number | null): string {
  if (pct === null) return 'var(--color-neutral)';
  if (pct >= 99) return 'var(--color-success)';
  if (pct >= 90) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

export function UptimeBar({ buckets }: Props) {
  return (
    <div className="uptime-bar" role="img" aria-label="Uptime history">
      {buckets.map((b) => (
        <span
          key={b.date}
          className="uptime-segment"
          style={{ background: bucketColor(b.uptime_percent) }}
          title={
            b.total_checks === 0
              ? `${b.date} — no data`
              : `${b.date} — ${b.uptime_percent?.toFixed(1) ?? '?'}% (${b.total_checks} checks)`
          }
        />
      ))}
    </div>
  );
}
