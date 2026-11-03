import { useCallback, useState } from 'react';
import { Alert, Button, Card, Descriptions, Drawer, Form, Input, Select, Table, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/client';
import type { HardwareComponent } from '../../shared/api/contracts';
import { measurementScopeLabels, workloadLabels } from '../../shared/api/contracts';
import { useResource } from '../../shared/useResource';
import { ErrorNotice, PageTitle } from '../../shared/ui';

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
  const [q, setQ] = useState(''), [kind, setKind] = useState<string>(), [manufacturer, setManufacturer] = useState<string>(), [serverId, setServerId] = useState<string>();
  const [page, setPage] = useState(1), [sort, setSort] = useState('name'), [selected, setSelected] = useState<string>();
  const load = useCallback(() => api.components({ q, kind, manufacturer, serverId, page, pageSize: 5, sort }), [q, kind, manufacturer, serverId, page, sort]);
  const { data, loading, error, refresh } = useResource(load);
  return <><PageTitle title="部件清单" description="查询 CPU、内存、磁盘、网卡和 GPU 的虚构配置、兼容工具及模拟性能样例。" />
    <ErrorNotice error={error} retry={() => void refresh()} />
    <Alert type="info" showIcon title="所有资产和性能数值均为虚构示例，非硬件发现或实际测试结果。" style={{ marginBottom: 16 }} />
    <Card className="query-card"><Form layout="inline" className="query-form">
      <Form.Item label="名称 / 型号"><Input.Search aria-label="搜索部件" placeholder="名称、厂商、型号或槽位" value={q} allowClear onChange={e => { setQ(e.target.value); setPage(1); }} /></Form.Item>
      <Form.Item label="部件类型"><Select aria-label="部件类型筛选" value={kind} allowClear placeholder="全部部件" options={Object.entries(workloadLabels).filter(([value]) => value !== 'http').map(([value, label]) => ({ value, label }))} onChange={value => { setKind(value); setPage(1); }} /></Form.Item>
      <Form.Item label="厂商"><Select aria-label="部件厂商筛选" value={manufacturer} allowClear placeholder="全部厂商" options={data?.facets.manufacturers.map(value => ({ value, label: value }))} onChange={value => { setManufacturer(value); setPage(1); }} /></Form.Item>
      <Form.Item label="服务器"><Select aria-label="部件服务器筛选" value={serverId} allowClear placeholder="全部服务器" options={data?.facets.servers.map(s => ({ value: s.id, label: s.name }))} onChange={value => { setServerId(value); setPage(1); }} /></Form.Item>
      <Form.Item><Button onClick={() => { setQ(''); setKind(undefined); setManufacturer(undefined); setServerId(undefined); setPage(1); }}>重置</Button></Form.Item>
    </Form></Card>
    <Card title="部件列表" extra={<Button aria-label="刷新部件" icon={<ReloadOutlined />} onClick={() => void refresh()} />}>
      <Table<HardwareComponent> rowKey="id" loading={loading} dataSource={data?.items} scroll={{ x: 1100 }} pagination={{ current: page, pageSize: 5, total: data?.total ?? 0, showSizeChanger: false }} onChange={(p, _, s) => { setPage(p.current ?? 1); const first = Array.isArray(s) ? s[0] : s; setSort(first.order ? `${first.order === 'descend' ? '-' : ''}${String(first.field)}` : 'name'); }} columns={[
        { title: '部件', dataIndex: 'name', sorter: true, render: (name, c) => <Button type="link" className="table-link" onClick={() => setSelected(c.id)}>{name}</Button> },
        { title: '类型 / 厂商', render: (_, c) => <>{workloadLabels[c.kind]}<div className="muted">{c.manufacturer}</div></> },
        { title: '型号 / 规格示例', render: (_, c) => <>{c.model}<div className="muted">{c.specs.slice(0, 2).map(s => `${s.value} ${s.unit ?? ''}`).join(' · ')}</div></> },
        { title: '模拟性能样例', render: (_, c) => <div className="muted"><div>{measurementScopeLabels[c.measurementScope]}</div>{c.sampleMetrics.length ? c.sampleMetrics.map(m => <div key={m.label}>{m.label}：{m.value} {m.unit}</div>) : '未测试 / 当前工具不支持'}</div> },
        { title: '状态 / 工具', render: (_, c) => <><Tag color={c.status === 'online' ? 'success' : 'default'}>{c.status === 'online' ? '模拟在线' : '模拟离线'}</Tag><div className="muted">{c.supportedTools.join('、') || '未适配'}</div></> },
        { title: '操作', render: (_, c) => <Button type="link" onClick={() => setSelected(c.id)}>详情</Button> },
      ]} />
    </Card>{selected && <ComponentDetail id={selected} close={() => setSelected(undefined)} />}</>;
}
