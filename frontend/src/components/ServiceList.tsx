import { useState } from 'react';
import { Service, deleteService } from '../api';
import { StatusDot, StatusPill } from './StatusBadge';
import { toast } from './Toast';

type Props = {
  services: Service[];
  selected: number | null;
  onSelect: (id: number) => void;
  onRefresh: () => void;
  onEdit: (service: Service) => void;
};

export function ServiceList({ services, selected, onSelect, onRefresh, onEdit }: Props) {
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleDelete(service: Service, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete "${service.name}" and all its history?`)) return;
    setDeletingId(service.id);
    try {
      await deleteService(service.id);
      toast('success', `"${service.name}" deleted`);
      onRefresh();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not delete service');
    } finally {
      setDeletingId(null);
    }
  }

  if (services.length === 0) {
    return (
      <div className="empty">
        <span className="empty-icon" aria-hidden>⌁</span>
        <b>No services monitored yet</b>
        <span>Click "Add service" to start tracking an endpoint.</span>
      </div>
    );
  }

  return (
    <div className="service-list" role="list">
      {services.map((svc) => (
        <div
          key={svc.id}
          role="listitem"
          className={`service-row ${selected === svc.id ? 'selected' : ''}`}
          onClick={() => onSelect(svc.id)}
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onSelect(svc.id)}
          aria-selected={selected === svc.id}
        >
          <StatusDot status={svc.status} />
          <span className="service-name">
            <b>{svc.name}</b>
            <small title={svc.url}>{svc.url}</small>
            {svc.tags && (
              <span className="service-tags">
                {svc.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                  <span key={t} className="tag">{t}</span>
                ))}
              </span>
            )}
          </span>
          <span className="service-meta">
            {svc.uptime_percent != null && (
              <span className="uptime-badge">{svc.uptime_percent}%</span>
            )}
            <StatusPill status={svc.status} />
          </span>
          <span className="service-actions" onClick={(e) => e.stopPropagation()}>
            <button
              className="icon-btn"
              title="Edit service"
              aria-label={`Edit ${svc.name}`}
              onClick={(e) => { e.stopPropagation(); onEdit(svc); }}
            >
              ✎
            </button>
            <button
              className="icon-btn danger"
              title="Delete service"
              aria-label={`Delete ${svc.name}`}
              disabled={deletingId === svc.id}
              onClick={(e) => handleDelete(svc, e)}
            >
              ✕
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
