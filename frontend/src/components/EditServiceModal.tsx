import { FormEvent, useState } from 'react';
import { Service, updateService } from '../api';
import { toast } from './Toast';

type Props = {
  service: Service;
  onUpdated: () => void;
  onClose: () => void;
};

const INTERVAL_OPTIONS = [
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
  { label: '15 minutes', value: 900 },
  { label: '30 minutes', value: 1800 },
  { label: '1 hour', value: 3600 },
];

export function EditServiceModal({ service, onUpdated, onClose }: Props) {
  const [name, setName] = useState(service.name);
  const [url, setUrl] = useState(service.url);
  const [interval, setInterval] = useState(service.interval_seconds);
  const [tags, setTags] = useState(service.tags);
  const [isActive, setIsActive] = useState(service.is_active);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateService(service.id, {
        name: name.trim(),
        url,
        interval_seconds: interval,
        tags,
        is_active: isActive,
      });
      toast('success', `"${name}" updated`);
      onUpdated();
      onClose();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not update service');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
      <div className="modal">
        <div className="modal-header">
          <h2 id="edit-modal-title">Edit service</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <label>
            Name
            <input
              required
              minLength={1}
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </label>
          <label>
            URL
            <input
              required
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <label>
            Check interval
            <select value={interval} onChange={(e) => setInterval(Number(e.target.value))}>
              {INTERVAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label>
            Tags <span className="label-hint">(comma-separated)</span>
            <input
              placeholder="production, api"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              maxLength={500}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Monitoring active
          </label>
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="button primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
