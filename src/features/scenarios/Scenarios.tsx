import { useCallback, useState } from 'react';
import { Alert, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag } from 'antd';
import type { FormInstance } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { api, ApiError, errorText } from '../../shared/api/client';
import type { Scenario, ScenarioInput, Workload } from '../../shared/api/contracts';
import { testTypeLabels, toolsByWorkload, workloadLabels } from '../../shared/api/contracts';
import { useResource } from '../../shared/useResource';
import { ErrorNotice, PageTitle } from '../../shared/ui';
import { defaultParameters, defaultTermination, parameterSchema, terminationText, toolDefinition } from '../../shared/testing';
type ScenarioFieldName = Parameters<FormInstance<ScenarioInput>['setFields']>[0][number]['name'];

function ScenarioEditor({ scenario, close, saved }: { scenario?: Scenario; close: () => void; saved: (scenario: Scenario) => void }) {
  const [form] = Form.useForm<ScenarioInput>();
  const workload: Workload = Form.useWatch('workload', form) ?? scenario?.workload ?? 'cpu';
  const tool = Form.useWatch('tool', form) ?? scenario?.tool ?? 'stress-ng';
  const definition = toolDefinition(tool);
  const terminationMode = Form.useWatch(['termination', 'mode'], form) ?? scenario?.termination.mode ?? 'duration';
  function changeTool(value: Scenario['tool'], nextWorkload = workload) {
    form.setFieldValue('tool', value);
    form.setFieldValue('toolVersion', toolDefinition(value).revision);
    form.setFieldValue('parameters', defaultParameters(nextWorkload, value));
    form.setFieldValue('termination', defaultTermination(value));
  }
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit() {
    let values: ScenarioInput;
    try { values = await form.validateFields(); } catch { return; }
    setBusy(true); setError('');
    try { const result = await api.saveScenario(values, scenario?.id); saved(result); close(); }
    catch (e) { setError(errorText(e)); if (e instanceof ApiError && e.details.error.fieldErrors) form.setFields(Object.entries(e.details.error.fieldErrors).map(([name, message]) => ({ name: name.split('.') as ScenarioFieldName, errors: [message] }))); }
    finally { setBusy(false); }
  }
  return <Modal open title={scenario ? '编辑压测场景' : '新建压测场景'} styles={{ body: { maxHeight: '65vh', overflowY: 'auto', paddingRight: 8 } }} onCancel={busy ? undefined : close} onOk={() => void submit()} confirmLoading={busy} okText="保存场景" cancelText="取消" closable={!busy} mask={{ closable: !busy }}>
    <ErrorNotice error={error} /><Form form={form} layout="vertical" initialValues={scenario ?? { testType: 'stress', workload: 'cpu', tool: 'stress-ng', durationMinutes: 30, concurrency: 64, intensityPercent: 85, toolVersion: toolDefinition('stress-ng').revision, parameters: defaultParameters('cpu', 'stress-ng'), termination: { mode: 'duration' } }}>
      <Form.Item name="name" label="场景名称" rules={[{ required: true, whitespace: true, min: 2, max: 60, message: '请输入 2–60 个字符' }]}><Input placeholder="例如：新服务器 CPU 基线验证" maxLength={60} /></Form.Item>
      <Form.Item name="testType" label="测试类型" extra="测试目的与下方部件 / 负载类型独立。" rules={[{ required: true, message: '请选择测试类型' }]}><Select options={Object.entries(testTypeLabels).map(([value, label]) => ({ value, label }))} /></Form.Item>
      <Space className="form-columns" align="start"><Form.Item name="workload" label="负载类型" rules={[{ required: true }]}><Select options={Object.entries(workloadLabels).map(([value, label]) => ({ value, label }))} onChange={(v: Workload) => { changeTool(toolsByWorkload[v][0], v); form.setFieldValue('concurrency', v === 'cpu' ? 4 : 1); }} /></Form.Item><Form.Item name="tool" label="压测工具（仅模拟）" rules={[{ required: true }]}><Select options={toolsByWorkload[workload].map(value => ({ value, label: toolDefinition(value).name }))} onChange={value => changeTool(value)} /></Form.Item></Space>
      <Form.Item name="toolVersion" label="工具参考修订（未安装验证）"><Input readOnly className="mono" /></Form.Item>
      <p className="muted">{definition.notes}</p>{definition.availability !== 'mock' && <Alert type="warning" showIcon title="仅可保存计划：此工具当前不能创建模拟执行任务。" style={{ marginBottom: 16 }} />}
      {parameterSchema(workload, tool).map(p => <Form.Item key={`${tool}-${workload}-${p.key}`} name={['parameters', p.key]} label={`${p.label}${p.unit ? `（${p.unit}）` : ''}`} rules={p.options ? [{ required: true }] : [{ required: true, type: 'integer', min: p.min, max: p.max, message: `${p.min}–${p.max} 的整数` }]} preserve={false}>
        {p.options ? <Select options={p.options} /> : <InputNumber min={p.min} max={p.max} style={{ width: '100%' }} />}
      </Form.Item>)}
      <Form.Item name={['termination', 'mode']} label="终止条件" rules={[{ required: true }]}><Select options={definition.terminationModes.map(value => ({ value, label: value === 'duration' ? '达到运行时长' : '完成指定轮数' }))} onChange={mode => form.setFieldValue('termination', mode === 'duration' ? { mode } : { mode, rounds: 1, ...(definition.availability === 'mock' ? { roundSeconds: 30 } : {}) })} /></Form.Item>
      {terminationMode === 'rounds' && <><Form.Item name={['termination', 'rounds']} label="测试轮数" rules={[{ required: true, type: 'integer', min: 1, max: 1000, message: '1–1000 的整数' }]} preserve={false}><InputNumber min={1} max={1000} /></Form.Item>
        {definition.availability === 'mock' && <Form.Item name={['termination', 'roundSeconds']} label="每轮运行时长（秒）" extra="未来适配层重复完整的限时运行，不是工具内部迭代或 bogo-ops。" rules={[{ required: true, type: 'integer', min: 5, max: 3600 }]} preserve={false}><InputNumber min={5} max={3600} /></Form.Item>}</>}
      <Space className="form-columns" align="start"><Form.Item name="durationMinutes" label={terminationMode === 'rounds' ? '总超时上限（分钟）' : '配置时长（分钟）'} rules={[{ required: true, type: 'integer', min: 1, max: 1440, message: '1–1440 的整数' }]}><InputNumber min={1} max={1440} /></Form.Item><Form.Item name="concurrency" label="并发 / worker / 流" rules={[{ required: true, type: 'integer', min: 1, max: 10000, message: '1–10000 的整数' }]}><InputNumber min={1} max={10000} /></Form.Item></Space>
      <Form.Item name="intensityPercent" label="CPU 目标压力（%，其他工具仅计划元数据）" rules={[{ required: true, type: 'integer', min: 1, max: 100, message: '1–100 的整数' }]}><InputNumber min={1} max={100} /></Form.Item><p className="muted">演示约 15 秒，配置时间和轮数是计划信息。磁盘写入也只模拟；不会访问真实文件、网络对端或设备。</p>
    </Form>
  </Modal>;
}
export default function Scenarios() {
  const [q, setQ] = useState(''), [page, setPage] = useState(1), [sort, setSort] = useState('name');
  const [testType, setTestType] = useState<string>();
  const [workloadFilter, setWorkloadFilter] = useState<string>();
  const [editor, setEditor] = useState<Scenario | 'new'>();
  const load = useCallback(() => api.scenarios({ q, testType, workload: workloadFilter, page, pageSize: 5, sort }), [q, testType, workloadFilter, page, sort]);
  const { data, loading, error, refresh } = useResource(load);
  return <><PageTitle title="压测场景与模板" description="按部件配置工具、参考修订、参数、轮数与时长，保存后可重复创建任务。" />
    <ErrorNotice error={error} retry={() => void refresh()} />
    <Card className="query-card"><Form layout="inline" className="query-form">
      <Form.Item label="场景名称"><Input.Search aria-label="搜索场景" placeholder="请输入场景名称" value={q} allowClear onSearch={() => void refresh()} onChange={e => { setQ(e.target.value); setPage(1); }} /></Form.Item>
      <Form.Item label="测试类型"><Select aria-label="测试类型筛选" placeholder="全部类型" allowClear value={testType} onChange={value => { setTestType(value); setPage(1); }} options={Object.entries(testTypeLabels).map(([value, label]) => ({ value, label }))} /></Form.Item>
      <Form.Item label="部件 / 负载"><Select aria-label="模板负载筛选" placeholder="全部负载" allowClear value={workloadFilter} onChange={value => { setWorkloadFilter(value); setPage(1); }} options={Object.entries(workloadLabels).map(([value, label]) => ({ value, label }))} /></Form.Item>
      <Form.Item><Button onClick={() => { setQ(''); setTestType(undefined); setWorkloadFilter(undefined); setPage(1); }}>重置</Button></Form.Item>
    </Form></Card>
    <Card title="场景列表" extra={<Space><Button type="primary" icon={<PlusOutlined />} onClick={() => setEditor('new')}>新建场景</Button><Button aria-label="刷新场景" icon={<ReloadOutlined />} onClick={() => void refresh()} /></Space>}>
    <Table<Scenario> rowKey="id" dataSource={data?.items} loading={loading} scroll={{ x: 900 }} pagination={{ current: page, pageSize: 5, total: data?.total ?? 0, showSizeChanger: false }} onChange={(p, _, s) => { setPage(p.current ?? 1); const first = Array.isArray(s) ? s[0] : s; setSort(first.order === 'descend' ? '-name' : 'name'); }} columns={[
      { title: '场景名称', dataIndex: 'name', sorter: true, sortOrder: sort === '-name' ? 'descend' : 'ascend', render: (name, s) => <Button type="link" className="table-link" onClick={() => setEditor(s)}>{name}</Button> },
      { title: '测试类型', render: (_, s) => testTypeLabels[s.testType] },
      { title: '负载 / 工具', render: (_, s) => <div>{workloadLabels[s.workload]}<div className="muted mono">{s.tool}</div>{toolDefinition(s.tool).availability !== 'mock' && <Tag color="warning">仅计划</Tag>}</div> },
      { title: '终止策略', render: (_, s) => terminationText(s) }, { title: '并发', dataIndex: 'concurrency' }, { title: 'CPU 压力 / 元数据', render: (_, s) => `${s.intensityPercent}%` },
      { title: '操作', render: (_, s) => <Button type="link" onClick={() => setEditor(s)}>编辑</Button> },
    ]} /></Card>{editor && <ScenarioEditor scenario={editor === 'new' ? undefined : editor} close={() => setEditor(undefined)} saved={s => { setPage(1); setTestType(undefined); setWorkloadFilter(undefined); if (q === s.name) void refresh(); else setQ(s.name); }} />}</>;
}
