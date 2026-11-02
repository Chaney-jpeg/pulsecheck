/**
 * PulseCheck v2.0 — API client
 * Centralises all fetch calls and shared types.
 */

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';

export type Service = {
  id: number;
  name: string;
  url: string;
  interval_seconds: number;
  is_active: boolean;
  tags: string;
  created_at: string;
  status: 'operational' | 'degraded' | 'down' | 'unknown';
  uptime_percent: number | null;
  avg_response_ms: number | null;
};

export type Check = {
  id: number;
  service_id: number;
  checked_at: string;
  is_success: boolean;
  status_code: number | null;
  response_time_ms: number;
  error: string | null;
};

export type Incident = {
  id: number;
  service_id: number;
  status: 'open' | 'resolved';
  started_at: string;
  resolved_at: string | null;
  summary: string;
  duration_seconds: number | null;
};

export type UptimeDayBucket = {
  date: string;
  uptime_percent: number | null;
  total_checks: number;
};

export type Stats = {
  total_services: number;
  active_services: number;
  operational_services: number;
  degraded_services: number;
  down_services: number;
  unknown_services: number;
  open_incidents: number;
  checks_last_24h: number;
  avg_response_ms_last_24h: number | null;
};

export type ServiceCreate = {
  name: string;
  url: string;
  interval_seconds: number;
  tags: string;
};

export type ServiceUpdate = Partial<{
  name: string;
  url: string;
  interval_seconds: number;
  is_active: boolean;
  tags: string;
}>;

class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ApiError(response.status, text || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// ── Services ───────────────────────────────────────────────────────────

export const getServices = (tag?: string, status?: string) => {
  const params = new URLSearchParams();
  if (tag) params.set('tag', tag);
  if (status) params.set('status', status);
  const qs = params.toString();
  return request<Service[]>(`/api/services${qs ? `?${qs}` : ''}`);
};

export const getService = (id: number) => request<Service>(`/api/services/${id}`);

export const createService = (payload: ServiceCreate) =>
  request<Service>('/api/services', { method: 'POST', body: JSON.stringify(payload) });

export const updateService = (id: number, payload: ServiceUpdate) =>
  request<Service>(`/api/services/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

export const deleteService = (id: number) =>
  request<void>(`/api/services/${id}`, { method: 'DELETE' });

// ── Checks ────────────────────────────────────────────────────────────

export const runCheck = (serviceId: number) =>
  request<Check>(`/api/services/${serviceId}/checks`, { method: 'POST' });

export const runAllChecks = () =>
  request<Check[]>('/api/checks/run', { method: 'POST' });

export const getChecks = (serviceId: number, limit = 50) =>
  request<Check[]>(`/api/services/${serviceId}/checks?limit=${limit}`);

// ── Uptime ────────────────────────────────────────────────────────────

export const getUptimeHistory = (serviceId: number, days = 30) =>
  request<UptimeDayBucket[]>(`/api/services/${serviceId}/uptime/history?days=${days}`);

// ── Incidents ──────────────────────────────────────────────────────────

export const getIncidents = (state?: 'open' | 'resolved', serviceId?: number, limit = 50) => {
  const params = new URLSearchParams();
  if (state) params.set('state', state);
  if (serviceId != null) params.set('service_id', String(serviceId));
  params.set('limit', String(limit));
  return request<Incident[]>(`/api/incidents?${params.toString()}`);
};

// ── Stats ─────────────────────────────────────────────────────────────

export const getStats = () => request<Stats>('/api/stats');
