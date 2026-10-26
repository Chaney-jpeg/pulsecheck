import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Service = { id: number; name: string; url: string; interval_seconds: number; is_active: boolean; status: string };
type Check = { id: number; checked_at: string; is_success: boolean; response_time_ms: number; status_code: number | null };
type Incident = { id: number; service_id: number; status: string; started_at: string; summary: string };
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  if (!response.ok) throw new Error((await response.text()) || `Request failed (${response.status})`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export default function App() {
  const [services, setServices] = useState<Service[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const [serviceData, incidentData] = await Promise.all([request<Service[]>('/api/services'), request<Incident[]>('/api/incidents?state=open')]);
      setServices(serviceData); setIncidents(incidentData);
      setSelected(current => current ?? serviceData[0]?.id ?? null);
      setError('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load PulseCheck'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (selected === null) { setChecks([]); return; }
    request<Check[]>(`/api/services/${selected}/checks?limit=30`).then(setChecks).catch(err => setError(err.message));
  }, [selected, services]);

  const uptime = useMemo(() => services.length ? Math.round(services.filter(s => s.status === 'operational').length / services.length * 100) : 0, [services]);
  const chartData = [...checks].reverse().map(item => ({ time: new Date(item.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), ms: item.response_time_ms }));

  async function addService(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { const service = await request<Service>('/api/services', { method: 'POST', body: JSON.stringify({ name, url, interval_seconds: 300 }) }); setName(''); setUrl(''); setSelected(service.id); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not add service'); }
    finally { setBusy(false); }
  }
  async function runCheck(id: number) {
    setBusy(true);
    try { await request(`/api/services/${id}/checks`, { method: 'POST' }); await refresh(); setChecks(await request<Check[]>(`/api/services/${id}/checks?limit=30`)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Check failed'); }
    finally { setBusy(false); }
  }

  return <main className="shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark">P</span><span>pulse<span className="brand-light">check</span></span></a><span className="workspace">WORKSPACE <b>Personal</b></span><div className="avatar">KC</div></header>
    <section className="page-heading"><div><div className="eyebrow">MONITORING OVERVIEW</div><h1>Your services, at a glance</h1><p>Here’s what’s happening with your services today.</p></div><button className="button primary" onClick={() => selected && runCheck(selected)} disabled={!selected || busy}>↻ &nbsp;Run check</button></section>
    {error && <div className="notice" role="alert">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
    <section className="stats"><article className="stat-card"><span className="stat-label">OVERALL UPTIME <span>ⓘ</span></span><div className="stat-main">{services.length ? `${uptime}.0%` : '—'} <small className="positive">↑ 0.2%</small></div><div className="stat-foot">Across {services.length} monitored services</div></article><article className="stat-card"><span className="stat-label">ACTIVE INCIDENTS</span><div className="stat-main">{incidents.length} <small className={incidents.length ? 'negative' : 'positive'}>{incidents.length ? 'Needs attention' : 'All clear'}</small></div><div className="stat-foot">Open incidents right now</div></article><article className="stat-card"><span className="stat-label">MONITORED SERVICES</span><div className="stat-main">{services.length} <small>↗</small></div><div className="stat-foot">{services.filter(s => s.is_active).length} active monitors</div></article></section>
    <section className="content-grid"><article className="panel services-panel"><div className="panel-heading"><div><h2>Monitored services</h2><p>Your endpoints and their current health</p></div><button className="button secondary" onClick={refresh}>↻ &nbsp;Refresh</button></div>
      {loading ? <div className="empty">Loading your services…</div> : services.length === 0 ? <div className="empty"><span className="empty-icon">⌁</span><b>No services monitored yet</b><span>Add your first endpoint below to start tracking its availability.</span></div> : <div className="service-list">{services.map(service => <button className={`service-row ${selected === service.id ? 'selected' : ''}`} key={service.id} onClick={() => setSelected(service.id)}><span className={`status-dot ${service.status}`} /><span className="service-name"><b>{service.name}</b><small>{service.url}</small></span><span className={`status-pill ${service.status}`}>{service.status}</span><span className="service-check">{checks[0]?.response_time_ms ?? '—'} ms</span></button>)}</div>}
      <form className="add-form" onSubmit={addService}><h3>Add a service</h3><div className="form-fields"><input required minLength={1} placeholder="Service name" value={name} onChange={e => setName(e.target.value)} /><input required type="url" placeholder="https://api.example.com/health" value={url} onChange={e => setUrl(e.target.value)} /><button disabled={busy} className="button primary">Add service</button></div></form>
    </article><article className="panel chart-panel"><div className="panel-heading"><div><h2>Response time</h2><p>{services.find(s => s.id === selected)?.name ?? 'Select a service'} · Recent checks</p></div><select aria-label="Chart period"><option>Last 24 hours</option></select></div>{chartData.length ? <div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7259e8" stopOpacity={0.2}/><stop offset="100%" stopColor="#7259e8" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#eef0f3" vertical={false}/><XAxis dataKey="time" tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false} width={38}/><Tooltip/><Area type="monotone" dataKey="ms" stroke="#7259e8" strokeWidth={2} fill="url(#fill)"/></AreaChart></ResponsiveContainer></div> : <div className="chart-empty">Run a check to start building your response-time history.</div>}<div className="chart-legend"><span><i/> Response time <b>{checks[0] ? `${checks[0].response_time_ms} ms` : '—'}</b></span><span>Latest check: {checks[0] ? new Date(checks[0].checked_at).toLocaleString() : 'No data yet'}</span></div></article></section>
    <section className="panel incidents-panel"><div className="panel-heading"><div><h2>Recent incidents</h2><p>Outages and recoveries across your services</p></div><a href="#incidents">View all incidents <span>→</span></a></div>{incidents.length ? incidents.slice(0, 5).map(item => <div className="incident-row" key={item.id}><span className="incident-icon">!</span><b>{services.find(s => s.id === item.service_id)?.name ?? `Service #${item.service_id}`}</b><span>{item.summary}</span><time>{new Date(item.started_at).toLocaleString()}</time><span className="status-pill down">Open</span></div>) : <div className="all-clear"><span>✓</span><div><b>No active incidents</b><small>Your services are looking healthy. We’ll show incidents here if a check fails.</small></div></div>}</section>
    <footer>PulseCheck <span>·</span> Built for reliability <span>·</span> <a href={`${API}/docs`} target="_blank" rel="noreferrer">API docs ↗</a></footer>
  </main>;
}
