import type { ParameterSpec, Scenario, Termination, Tool, ToolDefinition, Workload } from './api/contracts';

const choice = (key: string, label: string, values: string[], defaultValue = values[0]): ParameterSpec => ({ key, label, defaultValue, options: values.map(value => ({ value, label: value })) });
const number = (key: string, label: string, unit: string, defaultValue: number, min: number, max: number): ParameterSpec => ({ key, label, unit, defaultValue, min, max });
const schemas: Partial<Record<Workload, ParameterSpec[]>> = {
  cpu: [choice('cpuMethod', 'CPU 方法', ['all', 'sqrt'])],
  memory: [choice('memoryMode', '内存模式', ['stream', 'vm']), number('memoryMiB', 'vm 总分配量', 'MiB', 1024, 64, 1048576)],
  disk: [choice('diskPattern', 'I/O 模式', ['randread', 'read', 'randwrite', 'write']), number('blockKiB', '块大小', 'KiB', 4, 1, 1024), number('queueDepth', '队列深度', '项', 32, 1, 128), number('fileGiB', '每 worker 隔离文件', 'GiB', 1, 1, 64)],
  network: [choice('protocol', '传输协议', ['tcp', 'udp']), choice('peerId', '受控模拟对端', ['peer-lab-a', 'peer-lab-b']), number('bitrateMbps', '每流目标速率', 'Mbit/s', 100, 1, 100000)],
  gpu: [number('gpuMemoryPercent', '可用显存比例', '%', 80, 1, 95), choice('precision', '计算精度', ['fp32', 'fp64'])],
  http: [],
};
export const toolCatalog: ToolDefinition[] = [
  { id: 'stress-ng', name: 'stress-ng', revision: 'source@53b3f237e3c0110cb5b7d62579376d1f4d32cc15', license: 'GPL-2.0-or-later（所选文件）', licenseUrl: 'https://github.com/ColinIanKing/stress-ng/blob/master/COPYING', docsUrl: 'https://github.com/ColinIanKing/stress-ng', workloads: ['cpu', 'memory'], availability: 'mock', notes: 'CPU / vm / stream；bogo-ops 仅同版本同方法可比较。stream 不是标准 STREAM 成绩；vm 分配量是全部 worker 共享总量，stream 忽略此量。', terminationModes: ['duration', 'rounds'], schemas: { cpu: schemas.cpu, memory: schemas.memory } },
  { id: 'fio', name: 'fio', revision: 'source@4b1bb1e0028b452a5bda33a1e934734be15c2bf4', license: 'GPL-2.0（文件例外另计）', licenseUrl: 'https://github.com/axboe/fio/blob/master/fio.c', docsUrl: 'https://fio.readthedocs.io/en/latest/fio_doc.html', workloads: ['disk'], availability: 'mock', notes: '仅模拟隔离测试文件；不接受设备路径。不执行读写。未来需验证 ioengine/direct I/O 与文件区；此处按 libaio / direct I/O 建模，iodepth 不能直接套用于同步引擎。', terminationModes: ['duration', 'rounds'], schemas: { disk: schemas.disk } },
  { id: 'iperf3', name: 'iperf3', revision: 'source@a004933607da4bc1faac9f10bff93a76e911b841', license: 'BSD-3-Clause + 第三方声明', licenseUrl: 'https://github.com/esnet/iperf/blob/master/LICENSE', docsUrl: 'https://software.es.net/iperf/invoking.html', workloads: ['network'], availability: 'mock', notes: '需要受控双端；并发对应 parallel 流，速率限制按每流生效。TCP 展示重传，UDP 展示抖动和丢包，均不代表网络时延。', terminationModes: ['duration', 'rounds'], schemas: { network: schemas.network } },
  { id: 'gpu-burn', name: 'gpu-burn', revision: 'source@0d19c94dcb2e9b6858b7586a4c327674cd67113b', license: 'BSD-2-Clause', licenseUrl: 'https://github.com/wilicc/gpu-burn/blob/master/LICENSE', docsUrl: 'https://github.com/wilicc/gpu-burn', workloads: ['gpu'], availability: 'mock', notes: '仅 NVIDIA CUDA；CUDA/驱动许可与实际兼容性需另核对，不能用于 AMD/ROCm。显存比例与 fp32/fp64 是计划参数，并发/压力值不对应 GPU 百分比限速。', terminationModes: ['duration', 'rounds'], schemas: { gpu: schemas.gpu } },
  { id: 'JMeter', name: 'Apache JMeter', revision: 'source@f31fb25054ebd8f457ccb4370f920539ff21cfa3', license: 'Apache-2.0', licenseUrl: 'https://www.apache.org/licenses/LICENSE-2.0', docsUrl: 'https://jmeter.apache.org/', workloads: ['http'], availability: 'mock', notes: '保留原 HTTP 模板；未导入或执行 JMX，真实 HTTP 目标和执行脚本不在本期。', terminationModes: ['duration', 'rounds'], schemas: { http: [] } },
  { id: 'Locust', name: 'Locust', revision: 'source@dc31d4413ab04a5d38aa1be5cf28637928f7cc97', license: 'MIT', licenseUrl: 'https://github.com/locustio/locust/blob/master/LICENSE', docsUrl: 'https://docs.locust.io/', workloads: ['http'], availability: 'mock', notes: '保留原 HTTP 模板；未导入或执行 Python 用户脚本，无真实目标请求。', terminationModes: ['duration', 'rounds'], schemas: { http: [] } },
  { id: 'Memtest86+', name: 'Memtest86+（独立启动）', revision: '9.00', license: 'GPL-2.0', licenseUrl: 'https://memtest.org/readme#licensing', docsUrl: 'https://memtest.org/readme', workloads: ['memory'], availability: 'external', notes: '官方 9.00；需要 BIOS/UEFI 独立启动和离线流程。不是 PassMark MemTest86；本原型不配置引导、不重启或更改 Secure Boot，仅保留计划模板。', terminationModes: ['rounds'], schemas: { memory: [] } },
  { id: 'SPEC-CPU-unverified', name: 'CPU_SPEC_2007（待确认）', revision: 'unverified', license: '需用户自备，版本与许可待确认', licenseUrl: 'https://www.spec.org/order/', docsUrl: 'https://www.spec.org/cpu/', workloads: ['cpu'], availability: 'unverified', notes: '官方 CPU 目录未找到 2007；不替用户选择 2006/2017/2026，不打包套件，不生成 SPEC 分数。CPU2017 于 2026-11-17 退役；实际许可和报告规则另行核对。', terminationModes: ['rounds'], schemas: { cpu: [] } },
];
export const toolDefinition = (tool: Tool) => toolCatalog.find(t => t.id === tool)!;
export const parameterSchema = (workload: Workload, tool: Tool) => toolDefinition(tool).schemas[workload] ?? [];
export const defaultParameters = (workload: Workload, tool: Tool) => Object.fromEntries(parameterSchema(workload, tool).map(p => [p.key, p.defaultValue]));
export const defaultTermination = (tool: Tool): Termination => toolDefinition(tool).terminationModes.includes('duration') ? { mode: 'duration' } : { mode: 'rounds', rounds: 1 };
export function terminationText(s: Pick<Scenario, 'termination' | 'durationMinutes'>) {
  const t = s.termination;
  return t.mode === 'duration' ? `${s.durationMinutes} 分钟运行时长` : `${t.rounds} 轮${t.roundSeconds ? ` × ${t.roundSeconds} 秒` : ''} · 总超时 ${s.durationMinutes} 分钟`;
}
