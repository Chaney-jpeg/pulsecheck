import { useEffect, useMemo, useState } from 'react';
import { API_BASE, Service, Stats, getIncidents, getServices, getStats, runAllChecks } from './api';
import { AddServiceModal } from './components/AddServiceModal';
import { EditServiceModal } from './components/EditServiceModal';
import { IncidentsPanel } from './components/IncidentsPanel';
import { ServiceDetail } from './components/ServiceDetail';
import { ServiceList } from './components/ServiceList';
import { StatCards } from './components/StatCards';
import { ToastContainer, toast } from './components/Toast';
import { useLocalStorage, usePolling } from './hooks';
import type { Incident } from './api';

type Tab = 'dashboard' | 'incidents';

export default function App() {
  // ── State ────────────────────────────────────────────────────────────────
  const [services, setServices] = useState<Service[]>([]);
  const [allIncidents, setAllIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [tagFilter, setTagFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [darkMode, setDarkMode] = useLocalStorage('pulsecheck-dark', false);
  const [runningAll, setRunningAll] = useState(false);

  // ── Dark mode effect ──────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : '';
  }, [darkMode]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  async function refresh() {
    try {
      const [svcData, incData, statsData] = await Promise.all([
        getServices(tagFilter || undefined, statusFilter || undefined),
        getIncidents(undefined, undefined, 100),
        getStats(),
      ]);
      setServices(svcData);
      setAllIncidents(incData);
      setStats(statsData);
      setSelected((curr) => {
        if (curr && svcData.some((s) => s.id === curr)) return curr;
        return svcData[0]?.id ?? null;
      });
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Unable to load data');
    } finally {
      setLoading(false);
    }
  }

  // Initial load
  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when filters change
  useEffect(() => { void refresh(); }, [tagFilter, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 30 s
  usePolling(refresh, 30_000, !loading);

  // ── Derived data ──────────────────────────────────────────────────────────
  const selectedService = useMemo(
    () => services.find((s) => s.id === selected) ?? null,
    [services, selected],
  );

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    services.forEach((s) => {
      s.tags.split(',').map((t) => t.trim()).filter(Boolean).forEach((t) => tagSet.add(t));
    });
    return [...tagSet].sort();
  }, [services]);

  const openIncidents = useMemo(() => allIncidents.filter((i) => i.status === 'open'), [allIncidents]);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleRunAll() {
    setRunningAll(true);
    try {
      const results = await runAllChecks();
      toast('success', `Ran ${results.length} checks`);
      await refresh();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to run checks');
    } finally {
      setRunningAll(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <ToastContainer />

      {showAddModal && (
        <AddServiceModal
          onCreated={refresh}
          onClose={() => setShowAddModal(false)}
        />
      )}
      {editingService && (
        <EditServiceModal
          service={editingService}
          onUpdated={refresh}
          onClose={() => setEditingService(null)}
        />
      )}

      <main className="shell">
        {/* ── Topbar ──────────────────────────────────────────────────────── */}
        <header className="topbar">
          <a className="brand" href="#" aria-label="PulseCheck home">
            <span className="brand-mark" aria-hidden>P</span>
            <span>pulse<span className="brand-light">check</span></span>
            <span className="version-badge">v2</span>
          </a>

          <nav className="topbar-nav" aria-label="Main navigation">
            <button
              className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
              aria-current={activeTab === 'dashboard' ? 'page' : undefined}
            >
              Dashboard
            </button>
            <button
              className={`nav-tab ${activeTab === 'incidents' ? 'active' : ''}`}
              onClick={() => setActiveTab('incidents')}
              aria-current={activeTab === 'incidents' ? 'page' : undefined}
            >
              Incidents
              {openIncidents.length > 0 && (
                <span className="nav-badge" aria-label={`${openIncidents.length} open`}>
                  {openIncidents.length}
                </span>
              )}
            </button>
          </nav>

          <div className="topbar-actions">
            <button
              className="icon-btn"
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title="Toggle dark mode"
            >
              {darkMode ? '☀' : '☾'}
            </button>
            <button
              className="button primary"
              onClick={handleRunAll}
              disabled={runningAll || services.filter((s) => s.is_active).length === 0}
              title="Run checks for all active services"
            >
              {runningAll ? '…' : '↻'}&nbsp;Run all
            </button>
            <button className="button secondary" onClick={() => setShowAddModal(true)}>
              + Add service
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <>
            {/* ── Page heading ─────────────────────────────────────────────── */}
            <section className="page-heading">
              <div>
                <div className="eyebrow">MONITORING OVERVIEW</div>
                <h1>Your services, at a glance</h1>
                <p>Here's what's happening with your services right now.</p>
              </div>
            </section>

            {/* ── Stats ────────────────────────────────────────────────────── */}
            <StatCards stats={stats} />

            {/* ── Filter bar ───────────────────────────────────────────────── */}
            {(allTags.length > 0 || services.length > 0) && (
              <div className="filter-bar" role="search" aria-label="Filter services">
                <select
                  aria-label="Filter by tag"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                >
                  <option value="">All tags</option>
                  {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="operational">Operational</option>
                  <option value="degraded">Degraded</option>
                  <option value="down">Down</option>
                  <option value="unknown">Unknown</option>
                </select>
                {(tagFilter || statusFilter) && (
                  <button
                    className="button secondary"
                    onClick={() => { setTagFilter(''); setStatusFilter(''); }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {/* ── Main content grid ─────────────────────────────────────────── */}
            {loading ? (
              <div className="page-loading" role="status">Loading your services…</div>
            ) : (
              <div className="content-grid">
                {/* Services list */}
                <article className="panel services-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Monitored services</h2>
                      <p>{services.length} service{services.length !== 1 ? 's' : ''}</p>
                    </div>
                    <button className="button secondary" onClick={refresh} aria-label="Refresh service list">
                      ↻&nbsp;Refresh
                    </button>
                  </div>
                  <ServiceList
                    services={services}
                    selected={selected}
                    onSelect={setSelected}
                    onRefresh={refresh}
                    onEdit={setEditingService}
                  />
                </article>

                {/* Service detail / chart */}
                {selectedService ? (
                  <ServiceDetail
                    key={selectedService.id}
                    service={selectedService}
                    onRefreshServices={refresh}
                  />
                ) : (
                  <article className="panel chart-panel">
                    <div className="chart-empty">Select a service to view its response-time chart.</div>
                  </article>
                )}
              </div>
            )}

            {/* ── Incidents strip ───────────────────────────────────────────── */}
            <IncidentsPanel
              incidents={allIncidents}
              services={services}
            />
          </>
        )}

        {activeTab === 'incidents' && (
          <>
            <section className="page-heading">
              <div>
                <div className="eyebrow">INCIDENT LOG</div>
                <h1>All incidents</h1>
                <p>Complete history of outages and recoveries.</p>
              </div>
            </section>
            <IncidentsPanel
              incidents={allIncidents}
              services={services}
              showAll
            />
          </>
        )}

        <footer>
          PulseCheck v2.0 <span>·</span> Built for reliability{' '}
          <span>·</span>{' '}
          <a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer">
            API docs ↗
          </a>
        </footer>
      </main>
    </>
  );
}
