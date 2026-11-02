type Status = 'operational' | 'degraded' | 'down' | 'unknown';

const LABELS: Record<Status, string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
  unknown: 'Unknown',
};

export function StatusDot({ status }: { status: Status }) {
  return <span className={`status-dot ${status}`} aria-label={status} />;
}

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`status-pill ${status}`}>{LABELS[status] ?? status}</span>
  );
}
