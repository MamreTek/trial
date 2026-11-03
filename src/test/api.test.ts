import { describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../shared/api/client';
import { store } from '../mocks/store';

describe('API contract through the same HTTP handlers used in the browser', () => {
  it('works without secure-context randomUUID support on a private HTTP origin', async () => {
    const originalCrypto = crypto;
    vi.stubGlobal('crypto', { getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto) });
    try {
      const response = await fetch(new URL('/api/v1/servers', window.location.origin));
      expect(response.status).toBe(200);
      const envelope = await response.json();
      expect(envelope.data.total).toBe(5);
      expect(envelope.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally { vi.unstubAllGlobals(); }
  });
  it('filters and paginates synthetic servers with a stable envelope', async () => {
    const page = await api.servers({ brand: 'Dell', pageSize: 1, page: 2, sort: '-name' });
    expect(page).toMatchObject({ total: 2, page: 2, pageSize: 1 });
    expect(page.items[0].brand).toBe('Dell');
    expect(await api.server(page.items[0].id)).toEqual(page.items[0]);
  });
  it('validates scenario fields and preserves the contract error structure', async () => {
    try { await api.saveScenario({ name: 'a', workload: 'cpu', tool: 'stress-ng', durationMinutes: 0, concurrency: 1, intensityPercent: 90 }); throw new Error('unexpected success'); }
    catch (e) { expect(e).toBeInstanceOf(ApiError); const error = e as ApiError; expect(error.status).toBe(400); expect(error.details.requestId).toBeTruthy(); expect(error.details.error.fieldErrors).toHaveProperty('durationMinutes'); }
    const response = await fetch(new URL('/api/v1/scenarios', window.location.origin), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '无效类型', testType: 'unknown', workload: 'cpu', tool: 'stress-ng', durationMinutes: 10, concurrency: 1, intensityPercent: 90 }) });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { fieldErrors: { testType: '请选择压力、负载或稳定性测试' } } });
  });
  it('filters test types before pagination and accepts legacy scenario requests', async () => {
    const legacy = await api.saveScenario({ name: '旧客户端场景', workload: 'cpu', tool: 'stress-ng', durationMinutes: 10, concurrency: 1, intensityPercent: 90 });
    expect(legacy.testType).toBe('stress');
    const page = await api.scenarios({ testType: 'stability', q: 'GPU', pageSize: 1 });
    expect(page).toMatchObject({ total: 1, page: 1, pageSize: 1 });
    expect(page.items[0]).toMatchObject({ id: 'scn-003', testType: 'stability', workload: 'gpu' });
    await expect(api.scenarios({ testType: 'unknown' })).rejects.toMatchObject({ status: 400 });
  });
  it('creates a scenario and job, exposes snapshots, then enforces cancellation conflicts', async () => {
    const scenario = await api.saveScenario({ name: 'API 验收场景', testType: 'stability', workload: 'gpu', tool: 'gpu-burn', durationMinutes: 30, concurrency: 2, intensityPercent: 95 });
    const job = await api.createJob({ name: 'API 验收任务', scenarioId: scenario.id, serverIds: ['srv-002'] });
    await api.saveScenario({ ...scenario, testType: 'load' }, scenario.id);
    expect(await api.job(job.id)).toMatchObject({ scenario: { id: scenario.id, testType: 'stability' }, status: 'queued' });
    await expect(api.report(job.id)).rejects.toMatchObject({ status: 409 });
    expect((await api.cancelJob(job.id)).status).toBe('canceled');
    await expect(api.cancelJob(job.id)).rejects.toMatchObject({ status: 409 });
  });
  it('returns HTTP 400 for malformed JSON and invalid pagination', async () => {
    const response = await fetch(new URL('/api/v1/jobs', window.location.origin), { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json' } });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'INVALID_JSON' } });
    await expect(api.servers({ page: -1 })).rejects.toMatchObject({ status: 400 });
    await expect(api.jobs({ status: 'unknown' })).rejects.toMatchObject({ status: 400 });
  });
  it('recovers from a service failure and from empty data without contacting a backend', async () => {
    store.control('fail'); await expect(api.jobs()).rejects.toMatchObject({ status: 503 });
    expect((await api.jobs()).total).toBe(1);
    store.control('empty'); expect((await api.servers()).total).toBe(0);
    store.control('fail'); await expect(api.servers()).rejects.toMatchObject({ status: 503 });
    expect((await api.servers()).total).toBe(5);
  });
  it('returns a labeled completed report and a clear not-found error', async () => {
    expect(await api.report('job-001')).toMatchObject({ simulated: true, workload: 'cpu', jobId: 'job-001' });
    await expect(api.job('missing')).rejects.toMatchObject({ status: 404 });
  });
});
