import type { ComponentPage, Envelope, Failure, HardwareComponent, Job, JobInput, ListQuery, Page, Report, Scenario, ScenarioInput, Server, ToolDefinition } from './contracts';
export class ApiError extends Error {
  constructor(public status: number, public details: Failure) { super(details.error.message); }
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(new URL(`/api/v1${path}`, window.location.origin), { ...init, credentials: 'omit', headers: { 'Content-Type': 'application/json' }, signal: controller.signal });
    const envelope = await response.json() as Envelope<T> | Failure;
    if (!response.ok || 'error' in envelope) throw new ApiError(response.status, envelope as Failure);
    return envelope.data;
  } finally { clearTimeout(timeout); }
}
function query(q: ListQuery = {}) { const params = new URLSearchParams(); Object.entries(q).forEach(([k, v]) => { if (v !== undefined && v !== '') params.set(k, String(v)); }); return `?${params}`; }
export const api = {
  components: (q?: ListQuery) => request<ComponentPage>(`/components${query(q)}`),
  component: (id: string) => request<HardwareComponent>(`/components/${encodeURIComponent(id)}`),
  tools: () => request<ToolDefinition[]>('/tools'),
  servers: (q?: ListQuery) => request<Page<Server>>(`/servers${query(q)}`),
  server: (id: string) => request<Server>(`/servers/${encodeURIComponent(id)}`),
  scenarios: (q?: ListQuery) => request<Page<Scenario>>(`/scenarios${query(q)}`),
  saveScenario: (data: ScenarioInput, id?: string) => request<Scenario>(`/scenarios${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PATCH' : 'POST', body: JSON.stringify(data) }),
  jobs: (q?: ListQuery) => request<Page<Job>>(`/jobs${query(q)}`),
  job: (id: string) => request<Job>(`/jobs/${encodeURIComponent(id)}`),
  createJob: (data: JobInput) => request<Job>('/jobs', { method: 'POST', body: JSON.stringify(data) }),
  cancelJob: (id: string) => request<Job>(`/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  report: (id: string) => request<Report>(`/jobs/${encodeURIComponent(id)}/report`),
};
export function errorText(error: unknown) { return error instanceof ApiError ? `${error.message}（请求 ${error.details.requestId}）` : error instanceof Error && error.name === 'AbortError' ? '请求超时，请重试' : '请求失败，请重试'; }
