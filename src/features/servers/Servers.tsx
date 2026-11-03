import { useCallback, useState } from 'react';
import { Button, Card, Descriptions, Drawer, Form, Input, Select, Table, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { api } from '../../shared/api/client';
import type { Server } from '../../shared/api/contracts';
import { useResource } from '../../shared/useResource';
import { ErrorNotice, PageTitle } from '../../shared/ui';

function ServerDetail({ id, close }: { id: string; close: () => void }) {
  const load = useCallback(() => api.server(id), [id]);
  const { data: server, loading, error, refresh } = useResource(load);
  return <Drawer title="服务器详情 · 模拟资产" open onClose={close} loading={loading} width={480}><ErrorNotice error={error} retry={() => void refresh()} />{server && <Descriptions column={1} bordered items={Object.entries({ '资产名称': server.name, '品牌 / 型号': `${server.brand} ${server.model}`, '文档保留地址': server.address, '位置': server.location, 'CPU': server.cpu, 'CPU 核数': server.cores, '内存': `${server.memoryGiB} GiB`, 'GPU': server.gpu ? `${server.gpu} × ${server.gpuCount}` : '未配置', '模拟 Agent': server.status === 'online' ? '在线' : '离线' }).map(([label, children]) => ({ key: label, label, children }))} />}</Drawer>;
}
export default function Servers() {
  const [q, setQ] = useState(''), [brand, setBrand] = useState<string>(), [status, setStatus] = useState<string>();
  const [page, setPage] = useState(1), [sort, setSort] = useState('name'), [selected, setSelected] = useState<Server>();
  const load = useCallback(() => api.servers({ q, brand, status, page, pageSize: 5, sort }), [q, brand, status, page, sort]);
  const { data, loading, error, refresh } = useResource(load);
  return <><PageTitle title="服务器" description="查询服务器配置与模拟 Agent 状态，所有资产均为虚构样本。" />
    <ErrorNotice error={error} retry={() => void refresh()} />
    <Card className="query-card"><Form layout="inline" className="query-form">
      <Form.Item label="服务器名称"><Input.Search aria-label="搜索服务器" placeholder="请输入服务器名称" allowClear value={q} onSearch={() => void refresh()} onChange={e => { setQ(e.target.value); setPage(1); }} /></Form.Item>
      <Form.Item label="品牌"><Select aria-label="品牌筛选" placeholder="全部品牌" allowClear value={brand} onChange={v => { setBrand(v); setPage(1); }} options={['Dell', 'HPE', 'Lenovo'].map(value => ({ value, label: value }))} /></Form.Item>
      <Form.Item label="Agent 状态"><Select aria-label="在线状态筛选" placeholder="全部状态" allowClear value={status} onChange={v => { setStatus(v); setPage(1); }} options={[{ value: 'online', label: '在线' }, { value: 'offline', label: '离线' }]} /></Form.Item>
      <Form.Item><Button onClick={() => { setQ(''); setBrand(undefined); setStatus(undefined); setPage(1); }}>重置</Button></Form.Item>
    </Form></Card>
    <Card title="服务器列表" extra={<Button icon={<ReloadOutlined />} onClick={() => void refresh()}>刷新</Button>}>
    <Table<Server> rowKey="id" loading={loading} dataSource={data?.items} scroll={{ x: 840 }} pagination={{ current: page, pageSize: 5, total: data?.total ?? 0, showSizeChanger: false, showTotal: total => `共 ${total} 台模拟服务器` }} onChange={(p, _, s) => { setPage(p.current ?? 1); const first = Array.isArray(s) ? s[0] : s; setSort(first.order === 'descend' ? '-name' : 'name'); }} columns={[
      { title: '服务器', dataIndex: 'name', sorter: true, sortOrder: sort === '-name' ? 'descend' : 'ascend', render: (value, s) => <div><Button type="link" className="table-link" onClick={() => setSelected(s)}>{value}</Button><div className="muted mono">{s.address}</div></div> },
      { title: '品牌 / 型号', render: (_, s) => <div>{s.brand}<div className="muted">{s.model}</div></div> },
      { title: '计算资源', render: (_, s) => <div>{s.cores} 核 / {s.memoryGiB} GiB<div className="muted">{s.gpu ? `${s.gpuCount} × ${s.gpu}` : 'CPU 服务器'}</div></div> },
      { title: '模拟 Agent', render: (_, s) => <Tag color={s.status === 'online' ? 'success' : 'default'}>{s.status === 'online' ? '在线' : '离线'}</Tag> },
      { title: '操作', render: (_, s) => <Button type="link" onClick={() => setSelected(s)}>详情</Button> },
    ]} /></Card>{selected && <ServerDetail id={selected.id} close={() => setSelected(undefined)} />}</>;
}
