import { Stats } from '../api';

type Props = { stats: Stats | null };

export function StatCards({ stats }: Props) {
  const uptimePct = stats && stats.total_services > 0
    ? Math.round((stats.operational_services / stats.total_services) * 100)
    : null;

  return (
    <section className="stats" aria-label="Summary statistics">
      <article className="stat-card">
        <span className="stat-label">OVERALL UPTIME <span aria-hidden>ⓘ</span></span>
        <div className="stat-main">
          {uptimePct !== null ? `${uptimePct}%` : '—'}
          {stats && stats.degraded_services > 0 && (
            <small className="warn">↓ {stats.degraded_services} degraded</small>
          )}
        </div>
        <div className="stat-foot">Across {stats?.total_services ?? '—'} monitored services</div>
      </article>

      <article className="stat-card">
        <span className="stat-label">ACTIVE INCIDENTS</span>
        <div className="stat-main">
          {stats?.open_incidents ?? '—'}
          <small className={stats?.open_incidents ? 'negative' : 'positive'}>
            {stats?.open_incidents ? 'Needs attention' : 'All clear'}
          </small>
        </div>
        <div className="stat-foot">Open incidents right now</div>
      </article>

      <article className="stat-card">
        <span className="stat-label">CHECKS (24 H)</span>
        <div className="stat-main">
          {stats?.checks_last_24h ?? '—'}
          {stats?.avg_response_ms_last_24h != null && (
            <small className="positive">~{stats.avg_response_ms_last_24h} ms avg</small>
          )}
        </div>
        <div className="stat-foot">{stats?.active_services ?? '—'} active monitors</div>
      </article>
    </section>
  );
}
