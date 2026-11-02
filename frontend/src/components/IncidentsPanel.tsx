import { useState } from 'react';
import { Incident, Service } from '../api';

type Props = {
  incidents: Incident[];
  services: Service[];
  showAll?: boolean;
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export function IncidentsPanel({ incidents, services, showAll = false }: Props) {
  const [tab, setTab] = useState<'open' | 'resolved'>('open');

  const filtered = incidents.filter((i) => (showAll ? i.status === tab : i.status === 'open'));
  const visible = showAll ? filtered : filtered.slice(0, 5);

  function serviceName(id: number) {
    return services.find((s) => s.id === id)?.name ?? `Service #${id}`;
  }

  return (
    <section className={`panel incidents-panel ${showAll ? 'incidents-full' : ''}`}>
      <div className="panel-heading">
        <div>
          <h2>Incidents</h2>
          <p>Outages and recoveries across your services</p>
        </div>
        {showAll && (
          <div className="tab-group" role="tablist">
            <button
              role="tab"
              aria-selected={tab === 'open'}
              className={`tab ${tab === 'open' ? 'active' : ''}`}
              onClick={() => setTab('open')}
            >
              Open
            </button>
            <button
              role="tab"
              aria-selected={tab === 'resolved'}
              className={`tab ${tab === 'resolved' ? 'active' : ''}`}
              onClick={() => setTab('resolved')}
            >
              Resolved
            </button>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="all-clear">
          <span aria-hidden>✓</span>
          <div>
            <b>No {tab} incidents</b>
            <small>
              {tab === 'open'
                ? "Your services are looking healthy. Incidents appear here when a check fails."
                : 'No resolved incidents to show.'}
            </small>
          </div>
        </div>
      ) : (
        visible.map((item) => (
          <div
            key={item.id}
            className={`incident-row ${item.status}`}
          >
            {/* Icon + status pill */}
            <span className={`incident-icon ${item.status}`} aria-hidden>
              {item.status === 'open' ? '!' : '✓'}
            </span>

            {/* Main body — two lines */}
            <div className="incident-body">
              <div className="incident-top">
                <b className="incident-service">{serviceName(item.service_id)}</b>
                <span className={`status-pill ${item.status}`}>
                  {item.status === 'open' ? 'Open' : 'Resolved'}
                </span>
              </div>

              {/* The actual reason / error message */}
              <span className="incident-reason">{item.summary}</span>

              <div className="incident-times">
                <time dateTime={item.started_at} title="Started at">
                  Started {new Date(item.started_at).toLocaleString()}
                </time>
                {item.duration_seconds != null && (
                  <span className="incident-duration">
                    · {item.status === 'resolved'
                      ? `resolved in ${formatDuration(item.duration_seconds)}`
                      : `open for ${formatDuration(item.duration_seconds)}`}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </section>
  );
}
