import type { HardwareComponent, Job, JobInput, MockMode, Report, Scenario, ScenarioInput, Server, Termination } from '../shared/api/contracts';
import { testTypeLabels, toolsByWorkload } from '../shared/api/contracts';
import { defaultParameters, defaultTermination, parameterSchema, toolCatalog, toolDefinition } from '../shared/testing';
import { createComponents, sampleMetrics } from './hardware';

export class ContractError extends Error {
  constructor(public status: number, public code: string, message: string, public fieldErrors?: Record<string, string>) { super(message); }
}
const fail = (status: number, code: string, message: string): never => { throw new ContractError(status, code, message); };
const serverSeed: Server[] = [
  { id: 'srv-001', name: 'lab-dell-01', brand: 'Dell', model: 'PowerEdge R760', address: '192.0.2.11', status: 'online', cpu: 'Intel Xeon Gold 6430', cores: 64, memoryGiB: 256, gpu: null, gpuCount: 0, location: '模拟实验室 A · 机架 01' },
  { id: 'srv-002', name: 'lab-gpu-01', brand: 'Dell', model: 'PowerEdge R750xa', address: '192.0.2.12', status: 'online', cpu: 'Intel Xeon Gold 6338', cores: 64, memoryGiB: 512, gpu: 'NVIDIA A100 80GB', gpuCount: 4, location: '模拟实验室 A · 机架 02' },
  { id: 'srv-003', name: 'lab-hpe-01', brand: 'HPE', model: 'ProLiant DL380 Gen11', address: '192.0.2.21', status: 'online', cpu: 'Intel Xeon Silver 4410Y', cores: 24, memoryGiB: 128, gpu: 'AMD Demo-ROCm GPU', gpuCount: 1, location: '模拟实验室 B · 机架 01' },
  { id: 'srv-004', name: 'lab-lenovo-01', brand: 'Lenovo', model: 'ThinkSystem SR650 V3', address: '192.0.2.31', status: 'offline', cpu: 'Intel Xeon Gold 5418Y', cores: 48, memoryGiB: 256, gpu: null, gpuCount: 0, location: '模拟实验室 B · 机架 02' },
  { id: 'srv-005', name: 'lab-gpu-02', brand: 'Lenovo', model: 'ThinkSystem SR670 V2', address: '192.0.2.32', status: 'online', cpu: 'AMD EPYC 7543', cores: 64, memoryGiB: 512, gpu: 'NVIDIA A40 48GB', gpuCount: 2, location: '模拟实验室 A · 机架 03' },
];
const scenarioSeed: (ScenarioInput & { id: string; updatedAt: string })[] = [
  { id: 'scn-001', name: 'CPU 基线压力测试', testType: 'stress', workload: 'cpu', tool: 'stress-ng', durationMinutes: 30, concurrency: 64, intensityPercent: 85, updatedAt: '2026-11-03T07:00:00Z' },
  { id: 'scn-002', name: 'HTTP 峰值负载测试', testType: 'load', workload: 'http', tool: 'Locust', durationMinutes: 15, concurrency: 500, intensityPercent: 75, updatedAt: '2026-11-03T07:05:00Z' },
  { id: 'scn-003', name: 'GPU 长稳测试', testType: 'stability', workload: 'gpu', tool: 'gpu-burn', durationMinutes: 120, concurrency: 4, intensityPercent: 95, updatedAt: '2026-11-03T07:10:00Z' },
  { id: 'scn-004', name: '内存带宽 · stream', testType: 'load', workload: 'memory', tool: 'stress-ng', durationMinutes: 10, concurrency: 2, intensityPercent: 80, updatedAt: '2026-11-03T07:15:00Z' },
  { id: 'scn-005', name: '磁盘随机读 · fio', workload: 'disk', tool: 'fio', durationMinutes: 10, concurrency: 1, intensityPercent: 80, updatedAt: '2026-11-03T07:20:00Z' },
  { id: 'scn-006', name: '网卡吞吐 · iperf3', workload: 'network', tool: 'iperf3', durationMinutes: 10, concurrency: 4, intensityPercent: 80, updatedAt: '2026-11-03T07:25:00Z' },
  { id: 'scn-007', name: 'Memtest86+ 离线计划', testType: 'stability', workload: 'memory', tool: 'Memtest86+', durationMinutes: 60, concurrency: 1, intensityPercent: 80, termination: { mode: 'rounds', rounds: 2 }, updatedAt: '2026-11-03T07:30:00Z' },
  { id: 'scn-008', name: 'CPU_SPEC_2007 · 待确认', workload: 'cpu', tool: 'SPEC-CPU-unverified', durationMinutes: 60, concurrency: 1, intensityPercent: 80, updatedAt: '2026-11-03T07:35:00Z' },
];
export function validateScenario(input: unknown): Omit<Scenario, 'id' | 'updatedAt'> {
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
  const workload = p.workload as Scenario['workload'], tool = p.tool as Scenario['tool'];
  const definition = toolDefinition(tool), schema = parameterSchema(workload, tool);
  const parameters = { ...defaultParameters(workload, tool) };
  if (p.parameters !== undefined) {
    if (!p.parameters || typeof p.parameters !== 'object' || Array.isArray(p.parameters)) errors.parameters = '参数必须是对象';
    else for (const [key, value] of Object.entries(p.parameters)) {
      const spec = schema.find(s => s.key === key);
      if (!spec) errors[`parameters.${key}`] = '当前工具不接受此参数';
      else if (spec.options ? !spec.options.some(o => o.value === value) : typeof value !== 'number' || !Number.isInteger(value) || value < spec.min! || value > spec.max!) errors[`parameters.${key}`] = spec.options ? '请选择有效参数' : `${spec.min}–${spec.max} 的整数，单位 ${spec.unit}`;
      else parameters[key] = value as string | number;
    }
  }
  const toolVersion = p.toolVersion === undefined ? definition.revision : p.toolVersion;
  if (toolVersion !== definition.revision) errors.toolVersion = '请选择工具目录中固定的参考修订';
  let termination = defaultTermination(tool);
  if (p.termination !== undefined) {
    const t = p.termination as Record<string, unknown>;
    if (!t || typeof t !== 'object' || Array.isArray(t) || !definition.terminationModes.includes(t.mode as Termination['mode'])) errors.termination = '工具不支持此终止模式';
    else if (t.mode === 'duration') {
      if (Object.keys(t).some(k => k !== 'mode')) errors.termination = '时长模式不接受轮数参数';
      termination = { mode: 'duration' };
    } else {
      if (!Number.isInteger(t.rounds) || Number(t.rounds) < 1 || Number(t.rounds) > 1000) errors['termination.rounds'] = '轮数必须为 1–1000 的整数';
      if (Object.keys(t).some(k => !['mode', 'rounds', 'roundSeconds'].includes(k))) errors.termination = '未知终止参数';
      if (definition.availability === 'mock') {
        const seconds = t.roundSeconds === undefined ? 30 : t.roundSeconds;
        if (!Number.isInteger(seconds) || Number(seconds) < 5 || Number(seconds) > 3600) errors['termination.roundSeconds'] = '每轮必须为 5–3600 秒的整数';
        termination = { mode: 'rounds', rounds: Number(t.rounds), roundSeconds: Number(seconds) };
      } else {
        if (t.roundSeconds !== undefined) errors['termination.roundSeconds'] = '离线/待确认工具不支持计时轮次适配';
        termination = { mode: 'rounds', rounds: Number(t.rounds) };
      }
    }
  }
  if (termination.mode === 'rounds' && termination.roundSeconds && termination.rounds * termination.roundSeconds > Number(p.durationMinutes) * 60) errors.durationMinutes = '总超时上限不足以容纳配置轮数与每轮时长';
  if (Object.keys(errors).length) throw new ContractError(400, 'VALIDATION_ERROR', '请检查模板参数', errors);
  return { name, testType, workload, tool, durationMinutes: p.durationMinutes, concurrency: p.concurrency, intensityPercent: p.intensityPercent, parameters, toolVersion, termination } as Omit<Scenario, 'id' | 'updatedAt'>;
}
export function createStore(now: () => number = Date.now) {
  let servers: Server[], scenarios: Scenario[], jobs: Job[], nextId: number;
  let components: HardwareComponent[];
  type SimulatedOutcome = 'success' | 'tool-error' | 'timeout';
  let nextOutcome: SimulatedOutcome = 'success';
  const outcomes = new Map<string, SimulatedOutcome>();
  let empty = false;
  let failNext = false;
  const copy = <T,>(value: T): T => structuredClone(value);
  function reset() {
    servers = copy(serverSeed); components = createComponents(servers); scenarios = scenarioSeed.map(s => ({ ...validateScenario(s), id: s.id, updatedAt: s.updatedAt })); nextId = 20; empty = false; failNext = false; nextOutcome = 'success'; outcomes.clear();
    jobs = [{ id: 'job-001', name: '机架 A · CPU 验证', scenario: copy(scenarios[0]), servers: [copy(servers[0])], components: [copy(components[0])], completedRounds: 0, status: 'completed', progress: 100, createdAt: new Date(now() - 3600000).toISOString(), finishedAt: new Date(now() - 3590000).toISOString() }];
  }
  reset();
  const getServer = (id: string) => copy(servers.find(s => s.id === id) ?? fail(404, 'NOT_FOUND', '服务器不存在'));
  const getScenario = (id: string) => copy(scenarios.find(s => s.id === id) ?? fail(404, 'NOT_FOUND', '场景不存在'));
  const getComponent = (id: string) => copy(components.find(c => c.id === id) ?? fail(404, 'NOT_FOUND', '部件不存在'));
  const syncJob = (j: Job): Job => {
    if (['completed', 'canceled', 'failed'].includes(j.status)) return j;
    const elapsed = now() - Date.parse(j.createdAt);
    const outcome = outcomes.get(j.id) ?? 'success';
    const end = outcome === 'timeout' ? 10500 : outcome === 'tool-error' ? 12300 : 15000;
    j.progress = Math.max(0, Math.min(100, Math.floor((elapsed - 1500) / 135)));
    j.status = elapsed < 1500 ? 'queued' : elapsed < end ? 'running' : 'completed';
    if (elapsed >= end) {
      j.finishedAt = new Date(Date.parse(j.createdAt) + end).toISOString();
      if (outcome !== 'success') {
        j.status = 'failed'; j.progress = outcome === 'timeout' ? 66 : 80;
        j.failure = { code: outcome === 'timeout' ? 'TIMEOUT' : 'TOOL_EXIT_NONZERO', message: outcome === 'timeout' ? '模拟总时限耗尽；未完成全部轮数/时长。' : '模拟工具返回非零退出码；未生成成功报告。', retryable: true };
      } else j.progress = 100;
    }
    j.completedRounds = j.scenario.termination.mode === 'rounds' ? Math.floor(j.scenario.termination.rounds * j.progress / 100) : 0;
    return j;
  };
  const jobRef = (id: string) => syncJob(jobs.find(j => j.id === id) ?? fail(404, 'NOT_FOUND', '任务不存在'));
  return {
    reset,
    control(mode: MockMode) { empty = mode === 'empty'; failNext = mode === 'fail'; nextOutcome = mode === 'tool-error' || mode === 'timeout' ? mode : 'success'; },
    checkFailure() { if (failNext) { failNext = false; return fail(503, 'SIMULATED_FAILURE', '模拟服务暂时不可用，请重试'); } },
    servers: () => empty ? [] : copy(servers), getServer,
    components: () => empty ? [] : copy(components), getComponent,
    tools: () => copy(toolCatalog),
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
      if (toolDefinition(scenario.tool).availability !== 'mock') return fail(409, 'TOOL_UNAVAILABLE', toolDefinition(scenario.tool).notes);
      const targets = p.serverIds.map(getServer);
      if (targets.some(s => s.status !== 'online')) return fail(400, 'INCOMPATIBLE_TARGET', '目标服务器必须在线');
      if (scenario.workload === 'gpu' && targets.some(s => !s.gpuCount)) return fail(400, 'INCOMPATIBLE_TARGET', 'GPU 场景只能选择 GPU 服务器');
      if (p.componentIds !== undefined && (!Array.isArray(p.componentIds) || !p.componentIds.length || p.componentIds.some(id => typeof id !== 'string') || new Set(p.componentIds).size !== p.componentIds.length)) return fail(400, 'VALIDATION_ERROR', '部件列表必须非空且不重复');
      const selected = p.componentIds?.map(getComponent) ?? (scenario.workload === 'http' ? [] : targets.map(s => copy(components.find(c => c.serverId === s.id && c.kind === scenario.workload && c.supportedTools.includes(scenario.tool)) ?? fail(400, 'INCOMPATIBLE_TARGET', '服务器没有兼容的在线部件；GPU 需 NVIDIA CUDA'))));
      if (selected.some(c => !p.serverIds.includes(c.serverId) || c.kind !== scenario.workload || c.status !== 'online' || !c.supportedTools.includes(scenario.tool)) || scenario.workload !== 'http' && targets.some(s => !selected.some(c => c.serverId === s.id))) return fail(400, 'INCOMPATIBLE_TARGET', '部件类型、归属、状态或工具不兼容');
      if (selected.some(c => scenario.workload === 'memory' && scenario.parameters.memoryMode === 'vm' && Number(scenario.parameters.memoryMiB) > c.memoryMiB! || scenario.workload === 'disk' && Number(scenario.parameters.fileGiB) * scenario.concurrency > c.diskGiB! || scenario.workload === 'network' && Number(scenario.parameters.bitrateMbps) * scenario.concurrency > c.linkMbps!)) return fail(400, 'CAPACITY_EXCEEDED', '参数超过所选部件的模拟容量或链路速率');
      const job: Job = { id: `job-${nextId++}`, name, scenario, servers: targets, components: selected, completedRounds: 0, status: 'queued', progress: 0, createdAt: new Date(now()).toISOString(), finishedAt: null };
      outcomes.set(job.id, nextOutcome); nextOutcome = 'success';
      jobs.unshift(job); return copy(job);
    },
    cancelJob(id: string) {
      const j = jobRef(id);
      if (['completed', 'canceled', 'failed'].includes(j.status)) return fail(409, 'INVALID_STATE', '任务已结束，不能取消');
      j.status = 'canceled'; j.finishedAt = new Date(now()).toISOString(); return copy(j);
    },
    report(id: string): Report {
      const j = jobRef(id);
      if (j.status !== 'completed') return fail(409, 'REPORT_NOT_READY', '仅已完成任务可查看报告');
      const workload = j.scenario.workload;
      const componentResults = j.components.map((component, i) => {
        const hostScoped = ['host-cpu', 'host-memory', 'network-path'].includes(component.measurementScope);
        const metricIndex = hostScoped ? j.servers.findIndex(s => s.id === component.serverId) : i;
        return { component: copy(component), metrics: sampleMetrics(workload, j.scenario.parameters, metricIndex, j.scenario.intensityPercent, j.scenario.concurrency) };
      });
      const metrics = componentResults[0]?.metrics ?? sampleMetrics(workload, j.scenario.parameters);
      const base = metrics[0].value;
      return { jobId: j.id, simulated: true, generatedAt: j.finishedAt!, workload, scenario: copy(j.scenario), servers: copy(j.servers), completedRounds: j.completedRounds, componentResults, verdict: '示例通过', metrics, series: { label: metrics[0].label, unit: metrics[0].unit, samples: Array.from({ length: 16 }, (_, i) => ({ second: i, value: Math.round((base + Math.sin(i * 1.7) * base * 0.025) * 10) / 10 })) } };
    },
  };
}
export const store = createStore();
