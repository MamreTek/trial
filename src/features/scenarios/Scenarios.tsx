import { useCallback, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { api, ApiError, errorText } from '../../shared/api/client';
import type { Scenario, ScenarioInput, Workload } from '../../shared/api/contracts';
import { toolsByWorkload, workloadLabels } from '../../shared/api/contracts';
import { useResource } from '../../shared/useResource';
import { ErrorNotice, PageTitle } from '../../shared/ui';

function ScenarioEditor({ scenario, close, saved }: { scenario?: Scenario; close: () => void; saved: () => void }) {
  const [form] = Form.useForm<ScenarioInput>();
  const workload: Workload = Form.useWatch('workload', form) ?? scenario?.workload ?? 'cpu';
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit() {
    let values: ScenarioInput;
    try { values = await form.validateFields(); } catch { return; }
    setBusy(true); setError('');
    try { await api.saveScenario(values, scenario?.id); saved(); close(); }
    catch (e) { setError(errorText(e)); if (e instanceof ApiError && e.details.error.fieldErrors) form.setFields(Object.entries(e.details.error.fieldErrors).map(([name, message]) => ({ name: name as keyof ScenarioInput, errors: [message] }))); }
    finally { setBusy(false); }
  }
  return <Modal open title={scenario ? '编辑压测场景' : '新建压测场景'} onCancel={busy ? undefined : close} onOk={() => void submit()} confirmLoading={busy} okText="保存场景" cancelText="取消" closable={!busy} mask={{ closable: !busy }}>
    <ErrorNotice error={error} /><Form form={form} layout="vertical" initialValues={scenario ?? { workload: 'cpu', tool: 'stress-ng', durationMinutes: 30, concurrency: 64, intensityPercent: 85 }}>
      <Form.Item name="name" label="场景名称" rules={[{ required: true, whitespace: true, min: 2, max: 60, message: '请输入 2–60 个字符' }]}><Input placeholder="例如：新服务器 CPU 基线验证" maxLength={60} /></Form.Item>
      <Space className="form-columns" align="start"><Form.Item name="workload" label="负载类型" rules={[{ required: true }]}><Select options={Object.entries(workloadLabels).map(([value, label]) => ({ value, label }))} onChange={(v: Workload) => form.setFieldValue('tool', toolsByWorkload[v][0])} /></Form.Item><Form.Item name="tool" label="压测工具（仅模拟）" rules={[{ required: true }]}><Select options={toolsByWorkload[workload].map(value => ({ value, label: value }))} /></Form.Item></Space>
      <Space className="form-columns" align="start"><Form.Item name="durationMinutes" label="配置时长（分钟）" rules={[{ required: true, type: 'integer', min: 1, max: 1440, message: '1–1440 的整数' }]}><InputNumber min={1} max={1440} /></Form.Item><Form.Item name="concurrency" label="并发数" rules={[{ required: true, type: 'integer', min: 1, max: 10000, message: '1–10000 的整数' }]}><InputNumber min={1} max={10000} /></Form.Item></Space>
      <Form.Item name="intensityPercent" label="目标压力（%）" rules={[{ required: true, type: 'integer', min: 1, max: 100, message: '1–100 的整数' }]}><InputNumber min={1} max={100} /></Form.Item><p className="muted">实际运行不执行任何工具，演示任务约 15 秒完成。参数仅用于产品流程验证。</p>
    </Form>
  </Modal>;
}
export default function Scenarios() {
  const [q, setQ] = useState(''), [page, setPage] = useState(1), [sort, setSort] = useState('name');
  const [editor, setEditor] = useState<Scenario | 'new'>();
  const load = useCallback(() => api.scenarios({ q, page, pageSize: 5, sort }), [q, page, sort]);
  const { data, loading, error, refresh } = useResource(load);
  return <><PageTitle title="压测场景" description="管理 CPU / 内存、HTTP 和 GPU 压测参数，场景可重复用于创建任务。" />
    <ErrorNotice error={error} retry={() => void refresh()} />
    <Card className="query-card"><Form layout="inline" className="query-form">
      <Form.Item label="场景名称"><Input.Search aria-label="搜索场景" placeholder="请输入场景名称" value={q} allowClear onSearch={() => void refresh()} onChange={e => { setQ(e.target.value); setPage(1); }} /></Form.Item>
      <Form.Item><Button onClick={() => { setQ(''); setPage(1); }}>重置</Button></Form.Item>
    </Form></Card>
    <Card title="场景列表" extra={<Space><Button type="primary" icon={<PlusOutlined />} onClick={() => setEditor('new')}>新建场景</Button><Button aria-label="刷新场景" icon={<ReloadOutlined />} onClick={() => void refresh()} /></Space>}>
    <Table<Scenario> rowKey="id" dataSource={data?.items} loading={loading} scroll={{ x: 750 }} pagination={{ current: page, pageSize: 5, total: data?.total ?? 0, showSizeChanger: false }} onChange={(p, _, s) => { setPage(p.current ?? 1); const first = Array.isArray(s) ? s[0] : s; setSort(first.order === 'descend' ? '-name' : 'name'); }} columns={[
      { title: '场景名称', dataIndex: 'name', sorter: true, sortOrder: sort === '-name' ? 'descend' : 'ascend', render: (name, s) => <Button type="link" className="table-link" onClick={() => setEditor(s)}>{name}</Button> },
      { title: '负载 / 工具', render: (_, s) => <div>{workloadLabels[s.workload]}<div className="muted mono">{s.tool}</div></div> },
      { title: '配置时长', render: (_, s) => `${s.durationMinutes} 分钟` }, { title: '并发', dataIndex: 'concurrency' }, { title: '目标压力', render: (_, s) => `${s.intensityPercent}%` },
      { title: '操作', render: (_, s) => <Button type="link" onClick={() => setEditor(s)}>编辑</Button> },
    ]} /></Card>{editor && <ScenarioEditor scenario={editor === 'new' ? undefined : editor} close={() => setEditor(undefined)} saved={() => void refresh()} />}</>;
}
