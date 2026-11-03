import { describe, expect, it } from 'vitest';
import { ContractError, createStore, validateScenario } from '../mocks/store';

describe('Trial business flow', () => {
  it('runs a job with an immutable scenario snapshot and a consistent completed report', () => {
    let time = Date.parse('2026-11-03T08:00:00Z');
    const s = createStore(() => time);
    const scenario = s.saveScenario({ name: 'HTTP 验收场景', testType: 'load', workload: 'http', tool: 'JMeter', durationMinutes: 10, concurrency: 100, intensityPercent: 80 });
    const job = s.createJob({ name: 'HTTP 验收任务', scenarioId: scenario.id, serverIds: ['srv-001'] });
    expect(job.status).toBe('queued');
    expect(() => s.report(job.id)).toThrow(ContractError);
    s.saveScenario({ ...scenario, name: '修改后的场景', testType: 'stress' }, scenario.id);
    time += 3000;
    expect(s.getJob(job.id)).toMatchObject({ status: 'running', scenario: { name: 'HTTP 验收场景', testType: 'load' } });
    time += 12000;
    expect(s.getJob(job.id)).toMatchObject({ status: 'completed', progress: 100 });
    const report = s.report(job.id);
    expect(report).toMatchObject({ jobId: job.id, simulated: true, workload: 'http', scenario: { testType: 'load' } });
    expect(report.metrics.map(m => m.label)).toEqual(['吞吐量', 'P95 延迟', '错误率']);
    expect(() => s.cancelJob(job.id)).toThrow('任务已结束');
  });
  it('keeps canceled jobs canceled even after the completion time', () => {
    let time = Date.now(); const s = createStore(() => time);
    const job = s.createJob({ name: '取消演示', scenarioId: 'scn-001', serverIds: ['srv-001'] });
    s.cancelJob(job.id); time += 60000;
    expect(s.getJob(job.id).status).toBe('canceled');
    expect(() => s.report(job.id)).toThrow('仅已完成');
  });
  it('rejects offline, duplicate and GPU-incompatible targets', () => {
    const s = createStore();
    expect(() => s.createJob({ name: '离线目标', scenarioId: 'scn-001', serverIds: ['srv-004'] })).toThrow('必须在线');
    expect(() => s.createJob({ name: 'GPU 目标', scenarioId: 'scn-003', serverIds: ['srv-001'] })).toThrow('只能选择 GPU');
    expect(() => s.createJob({ name: '重复目标', scenarioId: 'scn-001', serverIds: ['srv-001', 'srv-001'] })).toThrow('不重复');
    expect(s.createJob({ name: 'GPU 兼容目标', scenarioId: 'scn-003', serverIds: ['srv-002'] }).servers).toHaveLength(1);
  });
  it.each(['stress', 'load', 'stability'] as const)('keeps %s independent of the workload', testType => {
    const scenario = validateScenario({ name: '独立类型', testType, workload: 'cpu', tool: 'stress-ng', durationMinutes: 10, concurrency: 4, intensityPercent: 90 });
    expect(scenario).toMatchObject({ testType, workload: 'cpu', tool: 'stress-ng' });
  });
  it('defaults omitted test types to stress for legacy requests', () => {
    expect(validateScenario({ name: '旧接口场景', workload: 'http', tool: 'Locust', durationMinutes: 10, concurrency: 4, intensityPercent: 90 }).testType).toBe('stress');
  });
  it.each([{ name: 'x' }, { workload: 'gpu', tool: 'JMeter' }, { durationMinutes: 0 }, { concurrency: 10001 }, { intensityPercent: 1.5 }, { workload: 'constructor' }, { testType: 'unknown' }, { testType: null }])('rejects invalid scenario %j', patch => {
    expect(() => validateScenario({ name: '有效场景', workload: 'cpu', tool: 'stress-ng', durationMinutes: 10, concurrency: 4, intensityPercent: 90, ...patch })).toThrow(ContractError);
  });
});
