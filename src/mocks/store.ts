import type { Job, JobInput, Report, Scenario, ScenarioInput, Server } from '../shared/api/contracts';
import { testTypeLabels, toolsByWorkload } from '../shared/api/contracts';

export class ContractError extends Error {
  constructor(public status: number, public code: string, message: string, public fieldErrors?: Record<string, string>) { super(message); }
}
const fail = (status: number, code: string, message: string): never => { throw new ContractError(status, code, message); };
const serverSeed: Server[] = [
  { id: 'srv-001', name: 'lab-dell-01', brand: 'Dell', model: 'PowerEdge R760', address: '192.0.2.11', status: 'online', cpu: 'Intel Xeon Gold 6430', cores: 64, memoryGiB: 256, gpu: null, gpuCount: 0, location: '模拟实验室 A · 机架 01' },
  { id: 'srv-002', name: 'lab-gpu-01', brand: 'Dell', model: 'PowerEdge R750xa', address: '192.0.2.12', status: 'online', cpu: 'Intel Xeon Gold 6338', cores: 64, memoryGiB: 512, gpu: 'NVIDIA A100 80GB', gpuCount: 4, location: '模拟实验室 A · 机架 02' },
  { id: 'srv-003', name: 'lab-hpe-01', brand: 'HPE', model: 'ProLiant DL380 Gen11', address: '192.0.2.21', status: 'online', cpu: 'Intel Xeon Silver 4410Y', cores: 24, memoryGiB: 128, gpu: null, gpuCount: 0, location: '模拟实验室 B · 机架 01' },
  { id: 'srv-004', name: 'lab-lenovo-01', brand: 'Lenovo', model: 'ThinkSystem SR650 V3', address: '192.0.2.31', status: 'offline', cpu: 'Intel Xeon Gold 5418Y', cores: 48, memoryGiB: 256, gpu: null, gpuCount: 0, location: '模拟实验室 B · 机架 02' },
  { id: 'srv-005', name: 'lab-gpu-02', brand: 'Lenovo', model: 'ThinkSystem SR670 V2', address: '192.0.2.32', status: 'online', cpu: 'AMD EPYC 7543', cores: 64, memoryGiB: 512, gpu: 'NVIDIA A40 48GB', gpuCount: 2, location: '模拟实验室 A · 机架 03' },
];
const scenarioSeed: Scenario[] = [
  { id: 'scn-001', name: 'CPU 基线压力测试', testType: 'stress', workload: 'cpu', tool: 'stress-ng', durationMinutes: 30, concurrency: 64, intensityPercent: 85, updatedAt: '2026-11-03T07:00:00Z' },
  { id: 'scn-002', name: 'HTTP 峰值负载测试', testType: 'load', workload: 'http', tool: 'Locust', durationMinutes: 15, concurrency: 500, intensityPercent: 75, updatedAt: '2026-11-03T07:05:00Z' },
  { id: 'scn-003', name: 'GPU 长稳测试', testType: 'stability', workload: 'gpu', tool: 'gpu-burn', durationMinutes: 120, concurrency: 4, intensityPercent: 95, updatedAt: '2026-11-03T07:10:00Z' },
];
export function validateScenario(input: unknown): Required<ScenarioInput> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail(400, 'VALIDATION_ERROR', '场景必须是对象');
  const p = input as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const name = typeof p.name === 'string' ? p.name.trim() : '';
  if (name.length < 2 || name.length > 60) errors.name = '名称需为 2–60 个字符';
  const testType = p.testType === undefined ? 'stress' : p.testType;
  if (typeof testType !== 'string' || !Object.hasOwn(testTypeLabels, testType)) errors.testType = '请选择压力、负载或稳定性测试';
  if (typeof p.workload !== 'string' || !Object.hasOwn(toolsByWorkload, p.workload)) errors.workload = '请选择有效的负载类型';
  else if (!toolsByWorkload[p.workload as ScenarioInput['workload']].includes(p.tool as ScenarioInput['tool'])) errors.tool = '工具与负载类型不兼容';
  for (const [field, min, max] of [['durationMinutes', 1, 1440], ['concurrency', 1, 10000], ['intensityPercent', 1, 100]] as const) {
    if (typeof p[field] !== 'number' || !Number.isInteger(p[field]) || p[field] < min || p[field] > max) errors[field] = `必须为 ${min}–${max} 的整数`;
  }
  if (Object.keys(errors).length) throw new ContractError(400, 'VALIDATION_ERROR', '请检查场景参数', errors);
  return { name, testType, workload: p.workload, tool: p.tool, durationMinutes: p.durationMinutes, concurrency: p.concurrency, intensityPercent: p.intensityPercent } as Required<ScenarioInput>;
}
export function createStore(now: () => number = Date.now) {
  let servers: Server[], scenarios: Scenario[], jobs: Job[], nextId: number;
  let empty = false;
  let failNext = false;
  const copy = <T,>(value: T): T => structuredClone(value);
  function reset() {
    servers = copy(serverSeed); scenarios = copy(scenarioSeed); nextId = 4; empty = false; failNext = false;
    jobs = [{ id: 'job-001', name: '机架 A · CPU 验证', scenario: copy(scenarios[0]), servers: [copy(servers[0])], status: 'completed', progress: 100, createdAt: new Date(now() - 3600000).toISOString(), finishedAt: new Date(now() - 3590000).toISOString() }];
  }
  reset();
  const getServer = (id: string) => copy(servers.find(s => s.id === id) ?? fail(404, 'NOT_FOUND', '服务器不存在'));
  const getScenario = (id: string) => copy(scenarios.find(s => s.id === id) ?? fail(404, 'NOT_FOUND', '场景不存在'));
  const syncJob = (j: Job): Job => {
    if (j.status === 'completed' || j.status === 'canceled') return j;
    const elapsed = now() - Date.parse(j.createdAt);
    j.progress = Math.max(0, Math.min(100, Math.floor((elapsed - 1500) / 135)));
    j.status = elapsed < 1500 ? 'queued' : elapsed < 15000 ? 'running' : 'completed';
    if (j.status === 'completed') { j.progress = 100; j.finishedAt = new Date(Date.parse(j.createdAt) + 15000).toISOString(); }
    return j;
  };
  const jobRef = (id: string) => syncJob(jobs.find(j => j.id === id) ?? fail(404, 'NOT_FOUND', '任务不存在'));
  return {
    reset,
    control(mode: 'normal' | 'empty' | 'fail') { empty = mode === 'empty'; failNext = mode === 'fail'; },
    checkFailure() { if (failNext) { failNext = false; return fail(503, 'SIMULATED_FAILURE', '模拟服务暂时不可用，请重试'); } },
    servers: () => empty ? [] : copy(servers), getServer,
    scenarios: () => empty ? [] : copy(scenarios), getScenario,
    saveScenario(input: unknown, id?: string) {
      const valid = validateScenario(input);
      if (id) getScenario(id);
      const s = { ...valid, id: id ?? `scn-${nextId++}`, updatedAt: new Date(now()).toISOString() };
      scenarios = id ? scenarios.map(old => old.id === id ? s : old) : [...scenarios, s]; return copy(s);
    },
    jobs: () => empty ? [] : copy(jobs.map(syncJob)),
    getJob: (id: string) => copy(jobRef(id)),
    createJob(input: unknown) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) return fail(400, 'VALIDATION_ERROR', '任务必须是对象');
      const p = input as JobInput;
      const name = typeof p.name === 'string' ? p.name.trim() : '';
      if (name.length < 2 || name.length > 60) return fail(400, 'VALIDATION_ERROR', '任务名称需为 2–60 个字符');
      if (typeof p.scenarioId !== 'string' || !Array.isArray(p.serverIds) || !p.serverIds.length || p.serverIds.some(id => typeof id !== 'string') || new Set(p.serverIds).size !== p.serverIds.length) return fail(400, 'VALIDATION_ERROR', '请选择场景和不重复的目标服务器');
      const scenario = getScenario(p.scenarioId);
      const targets = p.serverIds.map(getServer);
      if (targets.some(s => s.status !== 'online')) return fail(400, 'INCOMPATIBLE_TARGET', '目标服务器必须在线');
      if (scenario.workload === 'gpu' && targets.some(s => !s.gpuCount)) return fail(400, 'INCOMPATIBLE_TARGET', 'GPU 场景只能选择 GPU 服务器');
      const job: Job = { id: `job-${nextId++}`, name, scenario, servers: targets, status: 'queued', progress: 0, createdAt: new Date(now()).toISOString(), finishedAt: null };
      jobs.unshift(job); return copy(job);
    },
    cancelJob(id: string) {
      const j = jobRef(id);
      if (j.status === 'completed' || j.status === 'canceled') return fail(409, 'INVALID_STATE', '任务已结束，不能取消');
      j.status = 'canceled'; j.finishedAt = new Date(now()).toISOString(); return copy(j);
    },
    report(id: string): Report {
      const j = jobRef(id);
      if (j.status !== 'completed') return fail(409, 'REPORT_NOT_READY', '仅已完成任务可查看报告');
      const workload = j.scenario.workload;
      const metrics = workload === 'http' ? [{ label: '吞吐量', value: 2840, unit: 'req/s' }, { label: 'P95 延迟', value: 86, unit: 'ms' }, { label: '错误率', value: 0.02, unit: '%' }] : workload === 'gpu' ? [{ label: 'GPU 平均利用率', value: 96.8, unit: '%' }, { label: 'GPU 最高温度', value: 78, unit: '°C' }, { label: '计算错误', value: 0, unit: '次' }] : [{ label: 'CPU 平均利用率', value: 86.2, unit: '%' }, { label: '内存峰值', value: 72.4, unit: '%' }, { label: 'CPU 最高温度', value: 71, unit: '°C' }];
      const base = workload === 'http' ? 2800 : workload === 'gpu' ? 95 : 85;
      return { jobId: j.id, simulated: true, generatedAt: j.finishedAt!, workload, scenario: copy(j.scenario), servers: copy(j.servers), verdict: '示例通过', metrics, series: { label: metrics[0].label, unit: metrics[0].unit, samples: Array.from({ length: 16 }, (_, i) => ({ second: i, value: Math.round((base + Math.sin(i * 1.7) * base * 0.025) * 10) / 10 })) } };
    },
  };
}
export const store = createStore();
