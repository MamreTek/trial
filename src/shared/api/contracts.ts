export type Brand = 'Dell' | 'HPE' | 'Lenovo';
export type ServerStatus = 'online' | 'offline';
export type Workload = 'cpu' | 'http' | 'gpu';
export type Tool = 'stress-ng' | 'JMeter' | 'Locust' | 'gpu-burn';
export type JobStatus = 'queued' | 'running' | 'completed' | 'canceled';
export interface Server {
  id: string; name: string; brand: Brand; model: string; address: string;
  status: ServerStatus; cpu: string; cores: number; memoryGiB: number;
  gpu: string | null; gpuCount: number; location: string;
}
export interface ScenarioInput {
  name: string; workload: Workload; tool: Tool; durationMinutes: number;
  concurrency: number; intensityPercent: number;
}
export interface Scenario extends ScenarioInput { id: string; updatedAt: string }
export interface JobInput { name: string; scenarioId: string; serverIds: string[] }
export interface Job {
  id: string; name: string; scenario: Scenario; servers: Server[]; status: JobStatus;
  progress: number; createdAt: string; finishedAt: string | null;
}
export interface Sample { second: number; value: number }
export interface Report {
  jobId: string; simulated: true; generatedAt: string; workload: Workload;
  scenario: Scenario; servers: Server[]; verdict: '示例通过';
  metrics: { label: string; value: number; unit: string }[];
  series: { label: string; unit: string; samples: Sample[] };
}
export interface Envelope<T> { data: T; requestId: string }
export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }
export interface Failure { error: { code: string; message: string; fieldErrors?: Record<string, string> }; requestId: string }
export interface ListQuery { page?: number; pageSize?: number; q?: string; sort?: string; brand?: string; status?: string }
export const toolsByWorkload: Record<Workload, Tool[]> = { cpu: ['stress-ng'], http: ['JMeter', 'Locust'], gpu: ['gpu-burn'] };
export const workloadLabels: Record<Workload, string> = { cpu: 'CPU / 内存', http: 'HTTP 负载', gpu: 'GPU 稳定性' };
export const jobLabels: Record<JobStatus, string> = { queued: '排队中', running: '运行中', completed: '已完成', canceled: '已取消' };
