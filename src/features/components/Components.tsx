import { useCallback, useState } from 'react';
import { Alert, Button, Card, Descriptions, Drawer, Form, Input, Select, Table, Tabs, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/client';
import type { ComponentKind, HardwareComponent } from '../../shared/api/contracts';
import { measurementScopeLabels } from '../../shared/api/contracts';
import { useResource } from '../../shared/useResource';
import { ErrorNotice, PageTitle } from '../../shared/ui';

const componentViews: Record<ComponentKind, { label: string; scope: string; specs: string[]; metrics: { label: string; unit: string }[] }> = {
  cpu: { label: 'CPU', scope: '主机 CPU 工作集的模拟样例；bogo-ops 仅适用于同版本、同方法比较。', specs: ['模拟核心', '模拟基准频率', '架构'], metrics: [{ label: 'CPU 平均利用率', unit: '%' }, { label: 'CPU 最高温度', unit: '°C' }, { label: 'CPU bogo ops', unit: 'ops/s' }] },
  memory: { label: '内存', scope: 'stream 内存子系统模拟样例，不是单条 DIMM 的独立成绩。', specs: ['模拟容量', '模拟速率', 'ECC'], metrics: [{ label: 'stream 读取速率', unit: 'MB/s' }, { label: 'stream 写入速率', unit: 'MB/s' }, { label: '校验错误', unit: '次' }] },
  disk: { label: '硬盘', scope: '4 KiB 随机读、隔离测试文件的模拟样例，不是整盘评分。', specs: ['模拟容量', '接口', '测试区'], metrics: [{ label: 'I/O 吞吐', unit: 'IOPS' }, { label: '传输带宽', unit: 'MiB/s' }, { label: 'P99 完成延迟', unit: 'µs' }] },
  network: { label: '网络', scope: '单流 TCP 端到端路径的模拟样例，不是网卡额定性能或网络时延。', specs: ['模拟链路', '端口', '模拟 MTU'], metrics: [{ label: '接收吞吐', unit: 'Gbit/s' }, { label: 'TCP 重传', unit: '次' }, { label: '接收数据量', unit: 'MiB' }] },
  gpu: { label: 'GPU', scope: 'GPU 计算任务的模拟样例；当前 gpu-burn 仅适配 NVIDIA CUDA。未适配设备不显示模拟成绩。', specs: ['模拟显存', '计算 API'], metrics: [{ label: '计算吞吐', unit: 'GFLOP/s' }, { label: 'GPU 最高温度', unit: '°C' }, { label: '计算错误', unit: '次' }] },
};
interface ComponentQuery { q: string; manufacturer?: string; serverId?: string; page: number; sort: string }
const defaultQuery: ComponentQuery = { q: '', page: 1, sort: 'name' };

function ComponentDetail({ id, close }: { id: string; close: () => void }) {
  const load = useCallback(() => api.component(id), [id]);
  const { data, error, loading, refresh } = useResource(load);
  return <Drawer open title="部件详情 / 模拟配置" onClose={close} size={560} loading={loading}>
    <ErrorNotice error={error} retry={() => void refresh()} />{data && <>
      <Descriptions column={1} bordered size="small" items={[
        { key: 'id', label: '部件标识', children: data.id }, { key: 'server', label: '所属服务器 / 位置', children: `${data.serverName} / ${data.slot}` },
        { key: 'model', label: '厂商 / 型号', children: `${data.manufacturer} / ${data.model}` },
        { key: 'scope', label: '指标范围', children: measurementScopeLabels[data.measurementScope] },
        ...data.specs.map(s => ({ key: s.label, label: s.label, children: `${s.value} ${s.unit ?? ''}` })),
      ]} />
      <h4>模拟性能样例</h4><p className="muted">合成示例，不是最近实测、额定规格或硬件质量结论。内存样例为 stream；磁盘为 4 KiB 随机读；网络为单流 TCP。</p>
      <Table size="small" rowKey="label" pagination={false} dataSource={data.sampleMetrics} columns={[{ title: '指标', dataIndex: 'label' }, { title: '模拟值', render: (_, m) => `${m.value} ${m.unit}` }]} />
      <h4>工具兼容性</h4><p>{data.supportedTools.join('、') || '暂无已适配工具'}；{data.unavailableReason || '仅产品兼容性建模，真实安装/驱动尚未探测。'}</p>
      <Link to={`/jobs?new=1&componentId=${encodeURIComponent(data.id)}`}><Button type="primary" disabled={data.status !== 'online' || !data.supportedTools.length}>配置此部件的模拟任务</Button></Link>
    </>}
  </Drawer>;
}
export default function Components() {
  const [kind, setKind] = useState<ComponentKind>('cpu');
  const [queries, setQueries] = useState<Partial<Record<ComponentKind, ComponentQuery>>>({});
  const { q, manufacturer, serverId, page, sort } = queries[kind] ?? defaultQuery;
  const updateQuery = (patch: Partial<ComponentQuery>) => setQueries(previous => ({ ...previous, [kind]: { ...(previous[kind] ?? defaultQuery), ...patch } }));
  const [selected, setSelected] = useState<string>();
  const load = useCallback(() => api.components({ q, kind, manufacturer, serverId, page, pageSize: 5, sort }), [q, kind, manufacturer, serverId, page, sort]);
  const { data, loading, error, refresh } = useResource(load);
  const view = componentViews[kind];
  const sorted = (field: string) => ({ sorter: true, sortOrder: sort === field ? 'ascend' as const : sort === `-${field}` ? 'descend' as const : null });
  const columns: TableColumnsType<HardwareComponent> = [
    { title: '部件 / 位置', dataIndex: 'name', ...sorted('name'), width: 210, render: (name, c) => <Button type="link" className="table-link" onClick={() => setSelected(c.id)}>{name}</Button> },
    { title: '厂商', dataIndex: 'manufacturer', ...sorted('manufacturer'), width: 110 },
    { title: '型号', dataIndex: 'model', ...sorted('model'), width: 190 },
    ...view.specs.map(label => ({ title: label, key: `spec-${label}`, width: 125, render: (_: unknown, c: HardwareComponent) => {
      const spec = c.specs.find(s => s.label === label);
      return spec ? `${spec.value} ${spec.unit ?? ''}` : '—';
    } })),
    ...view.metrics.map(metric => ({ title: `${metric.label}（${metric.unit}）`, key: `metric-${metric.label}`, width: 145, render: (_: unknown, c: HardwareComponent) => {
      const sample = c.sampleMetrics.find(m => m.label === metric.label);
      return sample ? `${sample.value} ${sample.unit}` : '—';
    } })),
    { title: '状态 / 工具', width: 190, render: (_, c) => <><Tag color={c.status === 'online' ? 'success' : 'default'}>{c.status === 'online' ? '模拟在线' : '模拟离线'}</Tag><div className="muted">{c.supportedTools.join('、') || '未适配，暂无成绩'}</div>{c.unavailableReason && <div className="muted">{c.unavailableReason}</div>}</> },
    { title: '操作', width: 80, render: (_, c) => <Button type="link" onClick={() => setSelected(c.id)}>详情</Button> },
  ];
  const activeItems = data?.items.filter(c => c.kind === kind);
  const content = <>
    <Card className="query-card"><Form layout="inline" className="query-form">
      <Form.Item label="名称 / 型号"><Input.Search aria-label="搜索部件" placeholder="名称、厂商、型号或槽位" value={q} allowClear onChange={e => updateQuery({ q: e.target.value, page: 1 })} /></Form.Item>
      <Form.Item label="厂商"><Select aria-label="部件厂商筛选" value={manufacturer} allowClear placeholder="全部厂商" options={data?.facets.manufacturers.map(value => ({ value, label: value }))} onChange={value => updateQuery({ manufacturer: value, page: 1 })} /></Form.Item>
      <Form.Item label="服务器"><Select aria-label="部件服务器筛选" value={serverId} allowClear placeholder="全部服务器" options={data?.facets.servers.map(s => ({ value: s.id, label: s.name }))} onChange={value => updateQuery({ serverId: value, page: 1 })} /></Form.Item>
      <Form.Item><Button onClick={() => setQueries(previous => ({ ...previous, [kind]: defaultQuery }))}>重置</Button></Form.Item>
    </Form></Card>
    <Card title={`${view.label}部件列表`} extra={<Button aria-label="刷新部件" icon={<ReloadOutlined />} onClick={() => void refresh()} />}>
      <p className="muted">{view.scope}</p>
      <Table<HardwareComponent> key={kind} rowKey="id" loading={loading} dataSource={activeItems} scroll={{ x: 1600 }} pagination={{ current: page, pageSize: 5, total: data?.items.every(c => c.kind === kind) ? data.total : 0, showSizeChanger: false }} onChange={(p, _, s) => { const first = Array.isArray(s) ? s[0] : s; updateQuery({ page: p.current ?? 1, sort: first.order && typeof first.field === 'string' ? `${first.order === 'descend' ? '-' : ''}${first.field}` : 'name' }); }} columns={columns} />
    </Card>
  </>;
  return <><PageTitle title="部件清单" description="按部件类型查看厂商、型号、适用规格和有单位的模拟性能指标。各标签独立保留查询条件。" />
    <ErrorNotice error={error} retry={() => void refresh()} />
    <Alert type="info" showIcon title="所有资产和性能数值均为虚构示例，非硬件发现或实际测试结果。" style={{ marginBottom: 16 }} />
    <Tabs id="component-types" className="component-tabs" activeKey={kind} onChange={value => { setKind(value as ComponentKind); setSelected(undefined); }} destroyOnHidden items={(Object.keys(componentViews) as ComponentKind[]).map(key => ({ key, label: componentViews[key].label, children: key === kind ? content : undefined }))} />
    {selected && <ComponentDetail id={selected} close={() => setSelected(undefined)} />}</>;
}
