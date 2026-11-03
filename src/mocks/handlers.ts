import { delay, http, HttpResponse } from 'msw';
import type { Page } from '../shared/api/contracts';
import { testTypeLabels, workloadLabels } from '../shared/api/contracts';
import { ContractError, store } from './store';

function page<T extends { id: string; name: string }>(items: T[], url: URL, allowedSort: string[], search: (item: T) => string = item => item.name): Page<T> {
  const p = Number(url.searchParams.get('page') ?? 1), size = Number(url.searchParams.get('pageSize') ?? 10);
  const sort = url.searchParams.get('sort') ?? 'name';
  if (!Number.isInteger(p) || p < 1 || !Number.isInteger(size) || size < 1 || size > 100 || !allowedSort.includes(sort)) throw new ContractError(400, 'VALIDATION_ERROR', '分页或排序参数无效');
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const filtered = items.filter(item => search(item).toLowerCase().includes(q));
  const desc = sort.startsWith('-');
  const key = sort.replace(/^-/, '') as keyof T;
  filtered.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (desc ? -1 : 1));
  return { items: filtered.slice((p - 1) * size, p * size), total: filtered.length, page: p, pageSize: size };
}
async function handle(action: () => unknown | Promise<unknown>, status = 200) {
  // getRandomValues also works on private HTTP origins where randomUUID is absent.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  const requestId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  try { store.checkFailure(); await delay(180); return HttpResponse.json({ data: await action(), requestId }, { status }); }
  catch (e) {
    if (!(e instanceof ContractError)) throw e;
    return HttpResponse.json({ error: { code: e.code, message: e.message, ...(e.fieldErrors ? { fieldErrors: e.fieldErrors } : {}) }, requestId }, { status: e.status });
  }
}
async function body(request: Request) {
  try { return await request.json(); } catch { throw new ContractError(400, 'INVALID_JSON', '请求必须是有效 JSON'); }
}
export const handlers = [
  http.get('*/api/v1/tools', () => handle(() => store.tools())),
  http.get('*/api/v1/components', ({ request }) => handle(() => {
    const url = new URL(request.url), kind = url.searchParams.get('kind'), manufacturer = url.searchParams.get('manufacturer'), serverId = url.searchParams.get('serverId');
    if (kind && (!Object.hasOwn(workloadLabels, kind) || kind === 'http')) throw new ContractError(400, 'VALIDATION_ERROR', '部件类型无效');
    const all = store.components();
    return { ...page(all.filter(c => (!kind || c.kind === kind) && (!manufacturer || c.manufacturer === manufacturer) && (!serverId || c.serverId === serverId)), url, ['name', '-name', 'manufacturer', '-manufacturer', 'model', '-model'], c => `${c.name} ${c.manufacturer} ${c.model} ${c.slot}`), facets: { manufacturers: [...new Set(all.map(c => c.manufacturer))].sort(), servers: store.servers().map(s => ({ id: s.id, name: s.name })) } };
  })),
  http.get('*/api/v1/components/:id', ({ params }) => handle(() => store.getComponent(String(params.id)))),
  http.get('*/api/v1/servers', ({ request }) => handle(() => {
    const url = new URL(request.url), brand = url.searchParams.get('brand'), status = url.searchParams.get('status');
    if (brand && !['Dell', 'HPE', 'Lenovo'].includes(brand) || status && !['online', 'offline'].includes(status)) throw new ContractError(400, 'VALIDATION_ERROR', '品牌或状态无效');
    return page(store.servers().filter(s => (!brand || s.brand === brand) && (!status || s.status === status)), url, ['name', '-name']);
  })),
  http.get('*/api/v1/servers/:id', ({ params }) => handle(() => store.getServer(String(params.id)))),
  http.get('*/api/v1/scenarios', ({ request }) => handle(() => {
    const url = new URL(request.url), testType = url.searchParams.get('testType'), workload = url.searchParams.get('workload');
    if (testType && !Object.hasOwn(testTypeLabels, testType)) throw new ContractError(400, 'VALIDATION_ERROR', '测试类型筛选无效');
    if (workload && !Object.hasOwn(workloadLabels, workload)) throw new ContractError(400, 'VALIDATION_ERROR', '负载类型无效');
    return page(store.scenarios().filter(s => (!testType || s.testType === testType) && (!workload || s.workload === workload)), url, ['name', '-name', 'updatedAt', '-updatedAt']);
  })),
  http.get('*/api/v1/scenarios/:id', ({ params }) => handle(() => store.getScenario(String(params.id)))),
  http.post('*/api/v1/scenarios', ({ request }) => handle(async () => store.saveScenario(await body(request)), 201)),
  http.patch('*/api/v1/scenarios/:id', ({ request, params }) => handle(async () => store.saveScenario(await body(request), String(params.id)))),
  http.get('*/api/v1/jobs', ({ request }) => handle(() => {
    const url = new URL(request.url), status = url.searchParams.get('status');
    if (status && !['queued', 'running', 'completed', 'canceled', 'failed'].includes(status)) throw new ContractError(400, 'VALIDATION_ERROR', '任务状态无效');
    return page(store.jobs().filter(j => !status || j.status === status), url, ['name', '-name', 'createdAt', '-createdAt']);
  })),
  http.get('*/api/v1/jobs/:id', ({ params }) => handle(() => store.getJob(String(params.id)))),
  http.post('*/api/v1/jobs', ({ request }) => handle(async () => store.createJob(await body(request)), 201)),
  http.post('*/api/v1/jobs/:id/cancel', ({ params }) => handle(() => store.cancelJob(String(params.id)))),
  http.get('*/api/v1/jobs/:id/report', ({ params }) => handle(() => store.report(String(params.id)))),
];
