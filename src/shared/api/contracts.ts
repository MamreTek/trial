export type Brand = 'Dell' | 'HPE' | 'Lenovo';
export type ServerStatus = 'online' | 'offline';
export type Workload = 'cpu' | 'memory' | 'disk' | 'network' | 'http' | 'gpu';
export type ComponentKind = Exclude<Workload, 'http'>;
export type TestType = 'stress' | 'load' | 'stability';
export type Tool = 'stress-ng' | 'fio' | 'iperf3' | 'gpu-burn' | 'JMeter' | 'Locust' | 'Memtest86+' | 'SPEC-CPU-unverified';
export type JobStatus = 'queued' | 'running' | 'completed' | 'canceled' | 'failed';
export type MockMode = 'normal' | 'empty' | 'fail' | 'tool-error' | 'timeout';
export interface Metric { label: string; value: number; unit: string }
export interface ParameterSpec {
  key: string; label: string; unit?: string; defaultValue: string | number;
  min?: number; max?: number; options?: { value: string; label: string }[];
}
export type Termination = { mode: 'duration' } | { mode: 'rounds'; rounds: number; roundSeconds?: number };
export interface ToolDefinition {
  id: Tool; name: string; revision: string; license: string; licenseUrl: string; docsUrl: string;
  workloads: Workload[]; availability: 'mock' | 'external' | 'unverified'; notes: string;
  terminationModes: Termination['mode'][]; schemas: Partial<Record<Workload, ParameterSpec[]>>;
}
export interface HardwareComponent {
  id: string; name: string; kind: ComponentKind; serverId: string; serverName: string;
  manufacturer: string; model: string; slot: string; status: ServerStatus; simulated: true;
  specs: { label: string; value: string | number; unit?: string }[];
  supportedTools: Tool[]; unavailableReason?: string; memoryMiB?: number; diskGiB?: number; linkMbps?: number;
  gpuApi?: 'cuda' | 'rocm'; sampleMetrics: Metric[];
  measurementScope: 'host-cpu' | 'host-memory' | 'storage-test-file' | 'network-path' | 'gpu-device';
}
export const measurementScopeLabels = { 'host-cpu': '主机 CPU 工作集', 'host-memory': '内存子系统，非单条 DIMM', 'storage-test-file': '隔离测试文件，非整盘评分', 'network-path': '端到端路径，非网卡额定值', 'gpu-device': '指定 GPU 计算任务' };
export interface Server {
  id: string; name: string; brand: Brand; model: string; address: string;
  status: ServerStatus; cpu: string; cores: number; memoryGiB: number;
  gpu: string | null; gpuCount: number; location: string;
}
export interface ScenarioInput {
  name: string; testType?: TestType; workload: Workload; tool: Tool; durationMinutes: number;
  concurrency: number; intensityPercent: number;
  parameters?: Record<string, string | number>; toolVersion?: string; termination?: Termination;
}
export interface Scenario extends ScenarioInput {
  id: string; testType: TestType; updatedAt: string; parameters: Record<string, string | number>;
  toolVersion: string; termination: Termination;
}
export interface JobInput { name: string; scenarioId: string; serverIds: string[]; componentIds?: string[] }
export interface Job {
  id: string; name: string; scenario: Scenario; servers: Server[]; status: JobStatus;
  progress: number; createdAt: string; finishedAt: string | null;
  components: HardwareComponent[]; completedRounds: number;
  failure?: { code: 'TOOL_EXIT_NONZERO' | 'TIMEOUT'; message: string; retryable: boolean };
}
export interface Sample { second: number; value: number }
export interface Report {
  jobId: string; simulated: true; generatedAt: string; workload: Workload;
  scenario: Scenario; servers: Server[]; verdict: '示例通过';
  metrics: Metric[]; completedRounds: number;
  componentResults: { component: HardwareComponent; metrics: Metric[] }[];
  series: { label: string; unit: string; samples: Sample[] };
}
export interface Envelope<T> { data: T; requestId: string }
export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }
export interface ComponentPage extends Page<HardwareComponent> { facets: { manufacturers: string[]; servers: { id: string; name: string }[] } }
export interface Failure { error: { code: string; message: string; fieldErrors?: Record<string, string> }; requestId: string }
export interface ListQuery { page?: number; pageSize?: number; q?: string; sort?: string; brand?: string; status?: string; testType?: string; workload?: string; kind?: string; manufacturer?: string; serverId?: string }
export const toolsByWorkload: Record<Workload, Tool[]> = { cpu: ['stress-ng', 'SPEC-CPU-unverified'], memory: ['stress-ng', 'Memtest86+'], disk: ['fio'], network: ['iperf3'], http: ['JMeter', 'Locust'], gpu: ['gpu-burn'] };
export const workloadLabels: Record<Workload, string> = { cpu: 'CPU', memory: '内存', disk: '磁盘', network: '网络 / 网卡', http: 'HTTP 负载', gpu: 'GPU 计算' };
export const testTypeLabels: Record<TestType, string> = { stress: '压力测试', load: '负载测试', stability: '稳定性测试' };
export const jobLabels: Record<JobStatus, string> = { queued: '排队中', running: '运行中', completed: '已完成', canceled: '已取消', failed: '失败' };
