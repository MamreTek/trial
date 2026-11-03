import { useCallback, useState } from 'react';
import { Button, Card, Form, Input, Modal, Popconfirm, Progress, Select, Space, Table, Tag } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorText } from '../../shared/api/client';
import type { Job, JobInput } from '../../shared/api/contracts';
import { jobLabels, workloadLabels } from '../../shared/api/contracts';
import { useResource } from '../../shared/useResource';
import { ErrorNotice, JobTag, PageTitle, utc } from '../../shared/ui';

function JobEditor({ close, saved }: { close: () => void; saved: () => void }) {
  const load = useCallback(async () => { const [scenarios, servers] = await Promise.all([api.scenarios({ pageSize: 100 }), api.servers({ pageSize: 100 })]); return { scenarios: scenarios.items, servers: servers.items }; }, []);
  const { data, loading, error: loadError, refresh } = useResource(load);
  const [form] = Form.useForm<JobInput>();
  const scenarioId = Form.useWatch('scenarioId', form);
  const scenario = data?.scenarios.find(s => s.id === scenarioId);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit() {
    let values: JobInput;
    try { values = await form.validateFields(); } catch { return; }
    setBusy(true); setError('');
    try { await api.createJob(values); saved(); close(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <Modal title="新建压测任务" open okText="创建模拟任务" cancelText="取消" confirmLoading={busy} okButtonProps={{ disabled: loading || !!loadError || !data?.scenarios.length }} onOk={() => void submit()} onCancel={busy ? undefined : close} closable={!busy} mask={{ closable: !busy }}>
    <ErrorNotice error={loadError} retry={() => void refresh()} /><ErrorNotice error={error} />
    {data && !data.scenarios.length && <p>还没有场景，请先取消并到“压测场景”新建场景。</p>}
    <Form form={form} layout="vertical" initialValues={{ serverIds: [] }}>
      <Form.Item name="name" label="任务名称" rules={[{ required: true, whitespace: true, min: 2, max: 60, message: '请输入 2–60 个字符' }]}><Input maxLength={60} placeholder="例如：GPU 服务器到货验证" /></Form.Item>
      <Form.Item name="scenarioId" label="压测场景" rules={[{ required: true, message: '请选择一个场景' }]}><Select loading={loading} placeholder="选择已保存的场景" onChange={() => form.setFieldValue('serverIds', [])} options={data?.scenarios.map(s => ({ value: s.id, label: `${s.name} · ${s.tool}` }))} /></Form.Item>
      {scenario && <div className="selected-scenario"><Tag>{workloadLabels[scenario.workload]}</Tag>{scenario.durationMinutes} 分钟配置时长 · {scenario.concurrency} 并发 · {scenario.intensityPercent}% 压力</div>}
      <Form.Item name="serverIds" label="目标服务器" extra="只能选择在线服务器；GPU 场景仅支持 GPU 服务器。" rules={[{ required: true, type: 'array', min: 1, message: '请至少选择一台兼容服务器' }]}><Select mode="multiple" disabled={!scenario} placeholder="选择模拟目标" options={data?.servers.map(s => ({ value: s.id, label: `${s.name} · ${s.gpu ? 'GPU' : 'CPU'}${s.status === 'offline' ? ' · 离线' : ''}`, disabled: s.status !== 'online' || scenario?.workload === 'gpu' && !s.gpuCount }))} /></Form.Item>
    </Form><p className="muted">此操作只创建内存中的模拟任务，约 15 秒完成，不连接真实服务器。</p>
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
  return <><PageTitle eyebrow={reports ? 'REPORTS / 结果分析' : 'EXPERIMENTS / 压测执行'} title={reports ? '压测报告' : '压测任务'} description={reports ? '回看已完成的模拟实验。所有指标与结论均为示例。' : '跟踪每次实验的配置快照与状态，演示任务约 15 秒完成。'} action={!reports && <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditor(true)}>新建压测任务</Button>} />
    <ErrorNotice error={error || actionError} retry={() => { setActionError(''); void refresh(); }} /><Card><Space wrap className="filters"><Input.Search aria-label="搜索任务" placeholder="搜索任务名称" allowClear onChange={e => { setQ(e.target.value); setPage(1); }} style={{ width: 260 }} />{!reports && <Select aria-label="任务状态筛选" allowClear placeholder="全部状态" style={{ width: 150 }} value={status} onChange={v => { setStatus(v); setPage(1); }} options={Object.entries(jobLabels).map(([value, label]) => ({ value, label }))} />}<Button icon={<ReloadOutlined />} onClick={() => void refresh()}>刷新</Button></Space>
    <Table<Job> rowKey="id" dataSource={data?.items} loading={loading && !data} scroll={{ x: 920 }} pagination={{ current: page, pageSize: 5, total: data?.total ?? 0, showSizeChanger: false }} onChange={(p, _, s) => { setPage(p.current ?? 1); const first = Array.isArray(s) ? s[0] : s; setSort(first.order === 'ascend' ? 'createdAt' : '-createdAt'); }} columns={[
      { title: '任务 / 场景', render: (_, j) => <div><Link to={`/jobs/${j.id}`}>{j.name}</Link><div className="muted">{j.scenario.name} · {j.servers.length} 台目标</div></div> },
      { title: '状态', render: (_, j) => <div><JobTag status={j.status} />{['queued', 'running'].includes(j.status) && <Progress percent={j.progress} size="small" style={{ width: 100 }} />}</div> },
      { title: '创建时间', dataIndex: 'createdAt', sorter: true, sortOrder: sort === 'createdAt' ? 'ascend' : 'descend', render: utc },
      { title: '操作', render: (_, j) => <Space><Link to={`/jobs/${j.id}`}><Button>{j.status === 'completed' ? '查看报告' : '查看详情'}</Button></Link>{['queued', 'running'].includes(j.status) && <Popconfirm title={`取消“${j.name}”？`} description="取消后的模拟任务不会再继续完成。" okText="取消任务" cancelText="返回" onConfirm={() => cancel(j.id)}><Button danger loading={canceling === j.id} disabled={!!canceling}>取消</Button></Popconfirm>}</Space> },
    ]} /></Card>{editor && <JobEditor close={() => { setEditor(false); if (params.has('new')) setParams({}); }} saved={() => void refresh()} />}</>;
}
