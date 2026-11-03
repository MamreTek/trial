import { describe, expect, it } from 'vitest';
import { createStore, validateScenario } from '../mocks/store';
import { api } from '../shared/api/client';

const basic = { name: '部件验证模板', workload: 'cpu', tool: 'stress-ng', durationMinutes: 10, concurrency: 1, intensityPercent: 80 } as const;

describe('component inventory and tool-specific plans', () => {
  it('exposes five component types, searchable specifications, facets and verified tool boundaries over HTTP', async () => {
    const all = await api.components({ pageSize: 100 });
    expect(new Set(all.items.map(c => c.kind))).toEqual(new Set(['cpu', 'memory', 'disk', 'network', 'gpu']));
    const page = await api.components({ kind: 'disk', manufacturer: 'Samsung', serverId: 'srv-001', q: 'NVMe', pageSize: 1 });
    expect(page).toMatchObject({ total: 1, pageSize: 1 });
    expect(page.facets.manufacturers).toContain('Micron');
    const component = await api.component(page.items[0].id);
    expect(component).toMatchObject({ simulated: true, supportedTools: ['fio'], sampleMetrics: [{ unit: 'IOPS' }, { unit: 'MiB/s' }, { unit: 'µs' }] });
    expect(component.specs.some(s => s.unit === 'GiB')).toBe(true);
    await expect(api.components({ kind: 'http' })).rejects.toMatchObject({ status: 400 });
    await expect(api.component('missing')).rejects.toMatchObject({ status: 404 });
    const tools = await api.tools();
    expect(tools.find(t => t.id === 'gpu-burn')).toMatchObject({ availability: 'mock', workloads: ['gpu'], license: 'BSD-2-Clause' });
    expect(tools.find(t => t.id === 'fio')?.schemas.disk?.find(p => p.key === 'blockKiB')?.unit).toBe('KiB');
    expect(tools.find(t => t.id === 'SPEC-CPU-unverified')?.availability).toBe('unverified');
    expect(tools.find(t => t.id === 'Memtest86+')?.availability).toBe('external');
  });
  it('preserves parameter, tool revision, component and completed-round snapshots through report generation', () => {
    let clock = Date.now(); const store = createStore(() => clock);
    const scenario = store.saveScenario({ ...basic, workload: 'disk', tool: 'fio', parameters: { blockKiB: 4, queueDepth: 16 }, termination: { mode: 'rounds', rounds: 3, roundSeconds: 20 } });
    const disks = store.components().filter(c => c.serverId === 'srv-001' && c.kind === 'disk');
    const job = store.createJob({ name: '两块磁盘的模拟任务', scenarioId: scenario.id, serverIds: ['srv-001'], componentIds: disks.map(c => c.id) });
    job.components[0].model = '外部修改返回值';
    store.saveScenario({ ...scenario, parameters: { ...scenario.parameters, blockKiB: 64 }, termination: { mode: 'duration' } }, scenario.id);
    clock += 5000; expect(store.getJob(job.id).completedRounds).toBe(0);
    clock += 10000;
    const report = store.report(job.id);
    expect(report).toMatchObject({ completedRounds: 3, scenario: { parameters: { blockKiB: 4, queueDepth: 16 }, toolVersion: scenario.toolVersion, termination: { mode: 'rounds', rounds: 3, roundSeconds: 20 } } });
    expect(report.componentResults.map(r => r.component.model)).toEqual(disks.map(c => c.model));
    expect(report.componentResults).toHaveLength(2);
    expect(report.componentResults[0].metrics[0].unit).toBe('IOPS');
    expect(report.componentResults[1].metrics[1].value).not.toBe(report.componentResults[0].metrics[1].value);
    expect(report.metrics).toEqual(report.componentResults[0].metrics);
  });
  it('keeps legacy server-only requests deterministic while rejecting incompatible, foreign and duplicate components', () => {
    const s = createStore(), cpu = s.components().find(c => c.kind === 'cpu' && c.serverId === 'srv-001')!;
    expect(s.createJob({ name: '兼容旧请求', scenarioId: 'scn-001', serverIds: ['srv-001'] }).components[0].id).toBe(cpu.id);
    expect(() => s.createJob({ name: '跨服务器部件', scenarioId: 'scn-001', serverIds: ['srv-002'], componentIds: [cpu.id] })).toThrow('归属');
    expect(() => s.createJob({ name: '重复部件请求', scenarioId: 'scn-001', serverIds: ['srv-001'], componentIds: [cpu.id, cpu.id] })).toThrow('不重复');
    expect(() => s.createJob({ name: 'AMD 不是 CUDA', scenarioId: 'scn-003', serverIds: ['srv-003'] })).toThrow('NVIDIA CUDA');
    for (const id of ['scn-007', 'scn-008']) expect(() => s.createJob({ name: '未适配工具', scenarioId: id, serverIds: ['srv-001'] })).toThrow();
  });
  it.each([
    { workload: 'memory', tool: 'stress-ng', parameters: { memoryMode: 'vm', memoryMiB: 1048576 } },
    { workload: 'disk', tool: 'fio', concurrency: 1000, parameters: { fileGiB: 64 } },
    { workload: 'network', tool: 'iperf3', concurrency: 1000, parameters: { bitrateMbps: 100 } },
  ])('enforces component capacity for $workload', patch => {
    const s = createStore(); const scenario = s.saveScenario({ ...basic, ...patch });
    expect(() => s.createJob({ name: '容量超限任务', scenarioId: scenario.id, serverIds: ['srv-001'] })).toThrow('模拟容量');
  });
  it.each([
    { parameters: { command: 'not permitted' } }, { parameters: null }, { parameters: { cpuMethod: 'unknown' } },
    { toolVersion: 'arbitrary version' }, { termination: { mode: 'duration', rounds: 3 } },
    { termination: { mode: 'rounds', rounds: 0 } }, { termination: { mode: 'rounds', rounds: 1, roundSeconds: 0 } },
    { durationMinutes: 1, termination: { mode: 'rounds', rounds: 10, roundSeconds: 30 } },
    { workload: 'disk', tool: 'fio', parameters: { queueDepth: 0 } },
    { workload: 'network', tool: 'iperf3', parameters: { peerId: 'https://arbitrary-target.invalid' } },
    { workload: 'gpu', tool: 'gpu-burn', parameters: { gpuMemoryPercent: 100 } },
  ])('rejects unsupported plan parameters %j', patch => {
    expect(() => validateScenario({ ...basic, ...patch })).toThrow();
  });
  it('uses protocol-specific network metrics and separate memory stress modes', () => {
    let time = Date.now(); const s = createStore(() => time);
    const plan = s.saveScenario({ ...basic, workload: 'network', tool: 'iperf3', parameters: { protocol: 'udp' } });
    const udp = s.createJob({ name: 'UDP 模拟验证', scenarioId: plan.id, serverIds: ['srv-001'] });
    const tcp = s.createJob({ name: 'TCP 模拟验证', scenarioId: 'scn-006', serverIds: ['srv-001'] });
    const stream = s.createJob({ name: '内存带宽验证', scenarioId: 'scn-004', serverIds: ['srv-001'], componentIds: s.components().filter(c => c.kind === 'memory' && c.serverId === 'srv-001').map(c => c.id) });
    const vmPlan = s.saveScenario({ ...basic, workload: 'memory', parameters: { memoryMode: 'vm', memoryMiB: 2048 } });
    const vm = s.createJob({ name: '内存校验验证', scenarioId: vmPlan.id, serverIds: ['srv-001'] });
    time += 15000;
    expect(s.report(udp.id).metrics.map(m => m.unit)).toEqual(['Gbit/s', 'ms', '%']);
    expect(s.report(tcp.id).metrics.map(m => m.label)).toContain('TCP 重传');
    expect(s.report(tcp.id).metrics.map(m => m.label)).not.toContain('UDP 抖动');
    expect(s.report(stream.id).metrics[0]).toMatchObject({ label: 'stream 读取速率', unit: 'MB/s' });
    const memoryResults = s.report(stream.id).componentResults;
    expect(memoryResults).toHaveLength(2);
    expect(memoryResults[0].component.measurementScope).toBe('host-memory');
    expect(memoryResults[0].metrics).toEqual(memoryResults[1].metrics);
    expect(s.report(vm.id).metrics[0]).toMatchObject({ label: 'vm 总分配量', value: 2048, unit: 'MiB' });
  });
  it.each(['tool-error', 'timeout'] as const)('makes %s terminal without a successful report and consumes it only once', mode => {
    let time = Date.now(); const s = createStore(() => time); s.control(mode);
    const bad = s.createJob({ name: '故障演示任务', scenarioId: 'scn-001', serverIds: ['srv-001'] });
    const good = s.createJob({ name: '后续正常任务', scenarioId: 'scn-001', serverIds: ['srv-001'] });
    time += 20000;
    expect(s.getJob(bad.id)).toMatchObject({ status: 'failed', failure: { code: mode === 'timeout' ? 'TIMEOUT' : 'TOOL_EXIT_NONZERO' } });
    expect(s.getJob(bad.id).progress).toBeLessThan(100);
    expect(s.getJob(good.id).status).toBe('completed');
    expect(() => s.report(bad.id)).toThrow('仅已完成');
    expect(() => s.cancelJob(bad.id)).toThrow('任务已结束');
    time += 60000; expect(s.getJob(bad.id).status).toBe('failed');
  });
});
