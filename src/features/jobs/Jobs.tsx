import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Card, Form, Input, Modal, Popconfirm, Progress, Select, Space, Table, Tag } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorText } from '../../shared/api/client';
import type { Job, JobInput } from '../../shared/api/contracts';
import { jobLabels, testTypeLabels, workloadLabels } from '../../shared/api/contracts';
import { useResource } from '../../shared/useResource';
import { ErrorNotice, JobTag, PageTitle, utc } from '../../shared/ui';
import { terminationText, toolDefinition } from '../../shared/testing';

function JobEditor({ close, saved, initialComponentId }: { close: () => void; saved: () => void; initialComponentId?: string | null }) {
  const load = useCallback(async () => { const [scenarios, servers, components] = await Promise.all([api.scenarios({ pageSize: 100 }), api.servers({ pageSize: 100 }), api.components({ pageSize: 100 })]); return { scenarios: scenarios.items, servers: servers.items, components: components.items }; }, []);
  const { data, loading, error: loadError, refresh } = useResource(load);
  const [form] = Form.useForm<JobInput>();
  const scenarioId = Form.useWatch('scenarioId', form);
  const scenario = data?.scenarios.find(s => s.id === scenarioId);
  const serverIds: string[] = Form.useWatch('serverIds', form) ?? [];
  const unavailable = scenario && toolDefinition(scenario.tool).availability !== 'mock';
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const prefilled = useRef(false);
  useEffect(() => {
    if (!data || !initialComponentId || prefilled.current) return;
    prefilled.current = true;
    const component = data.components.find(c => c.id === initialComponentId);
    const template = component && data.scenarios.find(s => s.workload === component.kind && component.supportedTools.includes(s.tool) && toolDefinition(s.tool).availability === 'mock');
    if (component && template && component.status === 'online') form.setFieldsValue({ name: `${workloadLabels[component.kind]} / ${component.serverName}`, scenarioId: template.id, serverIds: [component.serverId], componentIds: [component.id] });
    else setError('该部件不存在、离线或暂无兼容模板，请手动选择其他目标。');
  }, [data, form, initialComponentId]);
  async function submit() {
    let values: JobInput;
    try { values = await form.validateFields(); } catch { return; }
    setBusy(true); setError('');
    try { await api.createJob(values); window.dispatchEvent(new Event('trial:mock-job-created')); saved(); close(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <Modal title="新建压测任务" open okText="创建模拟任务" cancelText="取消" confirmLoading={busy} okButtonProps={{ disabled: loading || !!loadError || !data?.scenarios.length || !!unavailable }} onOk={() => void submit()} onCancel={busy ? undefined : close} closable={!busy} mask={{ closable: !busy }}>
    <ErrorNotice error={loadError} retry={() => void refresh()} /><ErrorNotice error={error} />
    {data && !data.scenarios.length && <p>还没有场景，请先取消并到“压测场景”新建场景。</p>}
    <Form form={form} layout="vertical" initialValues={{ serverIds: [] }}>
      <Form.Item name="name" label="任务名称" rules={[{ required: true, whitespace: true, min: 2, max: 60, message: '请输入 2–60 个字符' }]}><Input maxLength={60} placeholder="例如：GPU 服务器到货验证" /></Form.Item>
      <Form.Item name="scenarioId" label="压测场景" rules={[{ required: true, message: '请选择一个场景' }]}><Select loading={loading} placeholder="选择已保存的场景" onChange={() => { form.setFieldValue('serverIds', []); form.setFieldValue('componentIds', undefined); }} options={data?.scenarios.map(s => ({ value: s.id, label: `${s.name} · ${s.tool}` }))} /></Form.Item>
      {scenario && <div className="selected-scenario"><Tag color="blue">{testTypeLabels[scenario.testType]}</Tag><Tag>{workloadLabels[scenario.workload]}</Tag>{terminationText(scenario)}<div className="muted revision">{scenario.toolVersion}</div>{unavailable && <p>{toolDefinition(scenario.tool).notes}</p>}</div>}
      <Form.Item name="serverIds" label="目标服务器" extra="仅在线且有兼容部件的服务器可选；gpu-burn 需要 NVIDIA CUDA。" rules={[{ required: true, type: 'array', min: 1, message: '请至少选择一台兼容服务器' }]}><Select mode="multiple" disabled={!scenario || !!unavailable} placeholder="选择模拟目标" onChange={() => form.setFieldValue('componentIds', [])} options={data?.servers.map(s => ({ value: s.id, label: `${s.name}${s.status === 'offline' ? ' · 离线' : ''}`, disabled: s.status !== 'online' || !!scenario && scenario.workload !== 'http' && !data.components.some(c => c.serverId === s.id && c.kind === scenario.workload && c.supportedTools.includes(scenario.tool)) }))} /></Form.Item>
      {scenario && scenario.workload !== 'http' && <Form.Item name="componentIds" label="具体部件" extra="任务会保存所选部件的厂商、型号、规格和参数快照。" rules={[{ required: true, type: 'array', min: 1, message: '请选择兼容部件' }]} preserve={false}><Select mode="multiple" disabled={!!unavailable || !serverIds.length} placeholder="先选服务器，再选具体部件" options={data?.components.filter(c => serverIds.includes(c.serverId) && c.kind === scenario.workload).map(c => ({ value: c.id, label: `${c.name} · ${c.model}${!c.supportedTools.includes(scenario.tool) ? ' · 工具不兼容' : ''}`, disabled: c.status !== 'online' || !c.supportedTools.includes(scenario.tool) }))} /></Form.Item>}
    </Form><p className="muted">只创建内存模拟任务，约 15 秒演示。顶部 Mock 控制可演示下一任务的工具失败或超时；不会安装工具或连接目标。</p>
  </Modal>;
}
export default function Jobs({ reports = false }: { reports?: boolean }) {
  const [params, setParams] = useSearchParams();
  const [editor, setEditor] = useState(params.get('new') === '1');
  const [q, setQ] = useState(''), [status, setStatus] = useState<string>(), [page, setPage] = useState(1), [sort, setSort] = useState('-createdAt');
  const [actionError, setActionError] = useState(''), [canceling, setCanceling] = useState<string>();
  const load = useCallback(() => api.jobs({ q, status: reports ? 'completed' : status, page, pageSize: 5, sort }), [q, status, page, reports, sort]);
  const { data, loading, error, refresh } = useResource(load, 2000);
  async function cancel(id: string) { setCanceling(id); setActionError(''); try { await api.cancelJob(id); await refresh(); } catch (e) { setActionError(errorText(e)); } finally { setCanceling(undefined); } }
  return <><PageTitle title={reports ? '压测报告' : '压测任务'} description={reports ? '查询已完成任务的模拟指标与结果报告。' : '查询任务状态与配置快照，模拟任务约 15 秒完成。'} />
    <ErrorNotice error={error || actionError} retry={() => { setActionError(''); void refresh(); }} />
    <Card className="query-card"><Form layout="inline" className="query-form">
      <Form.Item label="任务名称"><Input.Search aria-label="搜索任务" placeholder="请输入任务名称" value={q} allowClear onSearch={() => void refresh()} onChange={e => { setQ(e.target.value); setPage(1); }} /></Form.Item>
      {!reports && <Form.Item label="任务状态"><Select aria-label="任务状态筛选" allowClear placeholder="全部状态" value={status} onChange={v => { setStatus(v); setPage(1); }} options={Object.entries(jobLabels).map(([value, label]) => ({ value, label }))} /></Form.Item>}
      <Form.Item><Button onClick={() => { setQ(''); setStatus(undefined); setPage(1); }}>重置</Button></Form.Item>
    </Form></Card>
    <Card title={reports ? '报告列表' : '任务列表'} extra={<Space>{!reports && <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditor(true)}>新建压测任务</Button>}<Button aria-label="刷新任务" icon={<ReloadOutlined />} onClick={() => void refresh()} /></Space>}>
    <Table<Job> rowKey="id" dataSource={data?.items} loading={loading && !data} scroll={{ x: 920 }} pagination={{ current: page, pageSize: 5, total: data?.total ?? 0, showSizeChanger: false }} onChange={(p, _, s) => { setPage(p.current ?? 1); const first = Array.isArray(s) ? s[0] : s; setSort(first.order === 'ascend' ? 'createdAt' : '-createdAt'); }} columns={[
      { title: '任务 / 场景', render: (_, j) => <div><Link to={`/jobs/${j.id}`}>{j.name}</Link><div className="muted">{j.scenario.name} · {testTypeLabels[j.scenario.testType]} · {j.servers.length} 台目标</div></div> },
      { title: '状态', render: (_, j) => <div><JobTag status={j.status} />{['queued', 'running'].includes(j.status) && <Progress percent={j.progress} size="small" style={{ width: 100 }} />}</div> },
      { title: '创建时间', dataIndex: 'createdAt', sorter: true, sortOrder: sort === 'createdAt' ? 'ascend' : 'descend', render: utc },
      { title: '操作', render: (_, j) => <Space><Link to={`/jobs/${j.id}`}><Button>{j.status === 'completed' ? '查看报告' : '查看详情'}</Button></Link>{['queued', 'running'].includes(j.status) && <Popconfirm title={`取消“${j.name}”？`} description="取消后的模拟任务不会再继续完成。" okText="取消任务" cancelText="返回" onConfirm={() => cancel(j.id)}><Button danger loading={canceling === j.id} disabled={!!canceling}>取消</Button></Popconfirm>}</Space> },
    ]} /></Card>{editor && <JobEditor initialComponentId={params.get('componentId')} close={() => { setEditor(false); if (params.has('new')) setParams({}); }} saved={() => void refresh()} />}</>;
}
