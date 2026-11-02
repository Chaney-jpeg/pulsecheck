import { useEffect, useState } from 'react';
import { Check, Service, UptimeDayBucket, getChecks, getUptimeHistory, runCheck } from '../api';
import { ResponseChart } from './ResponseChart';
import { StatusDot, StatusPill } from './StatusBadge';
import { UptimeBar } from './UptimeBar';
import { toast } from './Toast';

type Props = {
  service: Service;
  onRefreshServices: () => void;
};

export function ServiceDetail({ service, onRefreshServices }: Props) {
  const [checks, setChecks] = useState<Check[]>([]);
  const [history, setHistory] = useState<UptimeDayBucket[]>([]);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(50);

  async function loadChecks() {
    try {
      const [chks, hist] = await Promise.all([
        getChecks(service.id, limit),
        getUptimeHistory(service.id, 30),
      ]);
      setChecks(chks);
      setHistory(hist);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not load checks');
    }
  }

  useEffect(() => {
    void loadChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.id, limit]);

  async function handleRunCheck() {
    setBusy(true);
    try {
      await runCheck(service.id);
      toast('success', `Check triggered for "${service.name}"`);
      await loadChecks();
      onRefreshServices();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Check failed');
    } finally {
      setBusy(false);
    }
  }

  const intervalLabel =
    service.interval_seconds < 60
      ? `${service.interval_seconds}s`
      : service.interval_seconds < 3600
        ? `${service.interval_seconds / 60}m`
        : `${service.interval_seconds / 3600}h`;

  return (
    <div className="service-detail">
      <div className="detail-header">
        <div className="detail-title">
          <StatusDot status={service.status} />
          <div>
            <h3>{service.name}</h3>
            <a href={service.url} target="_blank" rel="noopener noreferrer" className="detail-url">
              {service.url}
            </a>
          </div>
        </div>
        <div className="detail-meta">
          <StatusPill status={service.status} />
          <span className="meta-chip">every {intervalLabel}</span>
          {!service.is_active && <span className="meta-chip paused">Paused</span>}
          {service.uptime_percent != null && (
            <span className="meta-chip">{service.uptime_percent}% uptime (7d)</span>
          )}
        </div>
        <button
          className="button primary"
          onClick={handleRunCheck}
          disabled={busy || !service.is_active}
          title={!service.is_active ? 'Service is paused' : 'Run a check now'}
        >
          {busy ? '…' : '↻'}&nbsp;Check now
        </button>
      </div>

      {history.length > 0 && (
        <div className="uptime-bar-section">
          <span className="uptime-bar-label">30-day history</span>
          <UptimeBar buckets={history} />
          <span className="uptime-bar-legend">
            <span style={{ color: 'var(--color-success)' }}>■</span> ≥99%
            <span style={{ color: 'var(--color-warning)' }}>■</span> ≥90%
            <span style={{ color: 'var(--color-danger)' }}>■</span> &lt;90%
            <span style={{ color: 'var(--color-neutral)' }}>■</span> no data
          </span>
        </div>
      )}

      <ResponseChart checks={checks} serviceName={service.name} />

      <div className="checks-table-header">
        <h3>Check history</h3>
        <select
          aria-label="Number of checks to show"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        >
          <option value={25}>Last 25</option>
          <option value={50}>Last 50</option>
          <option value={100}>Last 100</option>
        </select>
      </div>

      {checks.length === 0 ? (
        <p className="checks-empty">No checks yet — run one to see results here.</p>
      ) : (
        <div className="checks-table" role="table" aria-label="Check history">
          <div className="checks-thead" role="rowgroup">
            <div className="checks-row header" role="row">
              <span role="columnheader">Time</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Code</span>
              <span role="columnheader">Response</span>
              <span role="columnheader">Error</span>
            </div>
          </div>
          <div role="rowgroup">
            {checks.map((c) => (
              <div key={c.id} className={`checks-row ${c.is_success ? 'ok' : 'fail'}`} role="row">
                <span role="cell">{new Date(c.checked_at).toLocaleString()}</span>
                <span role="cell">
                  <span className={`status-pill ${c.is_success ? 'operational' : 'down'}`}>
                    {c.is_success ? 'OK' : 'Fail'}
                  </span>
                </span>
                <span role="cell">{c.status_code ?? '—'}</span>
                <span role="cell">{c.response_time_ms} ms</span>
                <span role="cell" className="check-error" title={c.error ?? ''}>
                  {c.error ?? '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
