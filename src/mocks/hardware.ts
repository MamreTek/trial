import type { ComponentKind, HardwareComponent, Metric, Scenario, Server } from '../shared/api/contracts';
import { defaultParameters } from '../shared/testing';

export function sampleMetrics(kind: ComponentKind | 'http', parameters: Scenario['parameters'] = {}, index = 0, intensity = 85, concurrency = 1): Metric[] {
  switch (kind) {
    case 'cpu': return [{ label: 'CPU 平均利用率', value: intensity, unit: '%' }, { label: 'CPU 最高温度', value: 71 + index, unit: '°C' }, { label: 'CPU bogo ops', value: 4295 + index * 110, unit: 'ops/s' }];
    case 'memory': return parameters.memoryMode === 'vm'
      ? [{ label: 'vm 总分配量', value: Number(parameters.memoryMiB), unit: 'MiB' }, { label: 'vm bogo ops', value: 18840 + index * 200, unit: 'ops/s' }, { label: '校验错误', value: 0, unit: '次' }]
      : [{ label: 'stream 读取速率', value: 42000 + index * 700, unit: 'MB/s' }, { label: 'stream 写入速率', value: 31000 + index * 400, unit: 'MB/s' }, { label: '校验错误', value: 0, unit: '次' }];
    case 'disk': {
      const iops = 80000 + index * 5000;
      return [{ label: 'I/O 吞吐', value: iops, unit: 'IOPS' }, { label: '传输带宽', value: Math.round(iops * Number(parameters.blockKiB ?? 4) / 1024 * 10) / 10, unit: 'MiB/s' }, { label: 'P99 完成延迟', value: 420 + index * 20, unit: 'µs' }];
    }
    case 'network': return [{ label: '接收吞吐', value: Math.round(Number(parameters.bitrateMbps ?? 100) * concurrency * 0.92) / 1000, unit: 'Gbit/s' }, ...(parameters.protocol === 'udp'
      ? [{ label: 'UDP 抖动', value: 0.18 + index * 0.01, unit: 'ms' }, { label: 'UDP 丢包率', value: 0.05, unit: '%' }]
      : [{ label: 'TCP 重传', value: index, unit: '次' }, { label: '接收数据量', value: 164, unit: 'MiB' }])];
    case 'gpu': return [{ label: '计算吞吐', value: 32000 + index * 500, unit: 'GFLOP/s' }, { label: 'GPU 最高温度', value: 78 + index, unit: '°C' }, { label: '计算错误', value: 0, unit: '次' }];
    case 'http': return [{ label: '吞吐量', value: 2840, unit: 'req/s' }, { label: 'P95 延迟', value: 86, unit: 'ms' }, { label: '错误率', value: 0.02, unit: '%' }];
  }
}

export function createComponents(servers: Server[]): HardwareComponent[] {
  return servers.flatMap((s, i) => {
    const base = { serverId: s.id, serverName: s.name, status: s.status, simulated: true as const };
    const component = (kind: ComponentKind, index: number, fields: Partial<HardwareComponent>): HardwareComponent => ({
      ...base, id: `${kind}-${s.id}-${index}`, name: `${s.name} / ${kind.toUpperCase()} ${index}`, kind,
      measurementScope: ({ cpu: 'host-cpu', memory: 'host-memory', disk: 'storage-test-file', network: 'network-path', gpu: 'gpu-device' } as const)[kind],
      manufacturer: '示例厂商', model: '虚构型号', slot: `${kind.toUpperCase()}${index}`,
      supportedTools: [], specs: [], sampleMetrics: sampleMetrics(kind, defaultParameters(kind, { cpu: 'stress-ng', memory: 'stress-ng', disk: 'fio', network: 'iperf3', gpu: 'gpu-burn' }[kind] as Scenario['tool']), i), ...fields,
    });
    return [
      component('cpu', 0, { manufacturer: s.cpu.startsWith('AMD') ? 'AMD' : 'Intel', model: s.cpu, supportedTools: ['stress-ng'], specs: [{ label: '模拟核心', value: s.cores, unit: '核' }, { label: '模拟基准频率', value: 2.4, unit: 'GHz' }, { label: '架构', value: 'x86_64 / Linux 计划' }] }),
      ...[0, 1].map(n => component('memory', n, { manufacturer: i % 2 ? 'Micron' : 'Samsung', model: `Demo-DDR5-${s.memoryGiB / 2}`, supportedTools: ['stress-ng'], memoryMiB: s.memoryGiB / 2 * 1024, specs: [{ label: '模拟容量', value: s.memoryGiB / 2, unit: 'GiB' }, { label: '模拟速率', value: 4800, unit: 'MT/s' }, { label: 'ECC', value: '示例：启用' }] })),
      ...[0, 1].map(n => component('disk', n, { manufacturer: n ? 'Micron' : 'Samsung', model: n ? 'Demo-SATA-2T' : 'Demo-NVMe-1T', supportedTools: ['fio'], diskGiB: n ? 2048 : 1024, specs: [{ label: '模拟容量', value: n ? 2048 : 1024, unit: 'GiB' }, { label: '接口', value: n ? 'SATA / SSD' : 'PCIe 4.0 / NVMe SSD' }, { label: '测试区', value: '仅隔离文件计划，无设备路径' }] })),
      component('network', 0, { manufacturer: i % 2 ? 'Broadcom' : 'Intel', model: 'Demo-NIC-25G', supportedTools: ['iperf3'], linkMbps: 25000, specs: [{ label: '模拟链路', value: 25, unit: 'Gbit/s' }, { label: '端口', value: 2, unit: '个' }, { label: '模拟 MTU', value: 1500, unit: 'B' }] }),
      ...Array.from({ length: s.gpuCount }, (_, n) => component('gpu', n, { manufacturer: s.gpu?.startsWith('AMD') ? 'AMD' : 'NVIDIA', model: s.gpu!, gpuApi: s.gpu?.startsWith('AMD') ? 'rocm' : 'cuda', supportedTools: s.gpu?.startsWith('AMD') ? [] : ['gpu-burn'], ...(s.gpu?.startsWith('AMD') ? { unavailableReason: '当前工具 gpu-burn 仅支持 NVIDIA CUDA；ROCm 适配尚未实现。', sampleMetrics: [] } : {}), specs: [{ label: '模拟显存', value: 48 + i * 8, unit: 'GiB' }, { label: '计算 API', value: s.gpu?.startsWith('AMD') ? 'ROCm（未适配）' : 'CUDA（仅兼容性建模）' }] })),
    ];
  });
}
