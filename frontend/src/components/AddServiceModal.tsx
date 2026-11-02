import { FormEvent, useState } from 'react';
import { createService } from '../api';
import { toast } from './Toast';

type Props = {
  onCreated: () => void;
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

export function AddServiceModal({ onCreated, onClose }: Props) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [interval, setInterval] = useState(300);
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createService({ name: name.trim(), url: url.trim(), interval_seconds: interval, tags });
      toast('success', `"${name}" added and scheduled every ${interval}s`);
      onCreated();
      onClose();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not add service');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal">
        <div className="modal-header">
          <h2 id="modal-title">Add a service</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <label>
            Name
            <input
              required
              minLength={1}
              maxLength={120}
              placeholder="My API"
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
              placeholder="https://api.example.com/health"
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
              placeholder="production, api, critical"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              maxLength={500}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="button primary" disabled={busy}>
              {busy ? 'Adding…' : 'Add service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
