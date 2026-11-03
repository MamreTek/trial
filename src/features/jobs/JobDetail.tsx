import { useCallback, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Progress, Row, Space, Statistic, Table } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined } from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import { api, errorText } from '../../shared/api/client';
import type { Report, Sample } from '../../shared/api/contracts';
import { measurementScopeLabels, testTypeLabels, workloadLabels } from '../../shared/api/contracts';
import { useResource } from '../../shared/useResource';
import { ErrorNotice, JobTag, PageTitle, utc } from '../../shared/ui';
import { parameterSchema, terminationText } from '../../shared/testing';

function Curve({ samples, label, unit }: { samples: Sample[]; label: string; unit: string }) {
  const max = Math.max(...samples.map(s => s.value)) * 1.1;
  const points = samples.map((s, i) => `${48 + i * 46},${190 - s.value / max * 155}`).join(' ');
  return <div className="chart"><svg viewBox="0 0 780 240" role="img" aria-label={`${label}的模拟曲线，单位 ${unit}`}><defs><linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1890ff" stopOpacity=".16" /><stop offset="100%" stopColor="#1890ff" stopOpacity="0" /></linearGradient></defs>{[0, 1, 2, 3].map(i => <g key={i}><line x1="48" x2="738" y1={35 + i * 52} y2={35 + i * 52} stroke="#e6edf1" strokeDasharray="4 4" /><text x="38" y={39 + i * 52} textAnchor="end" fill="#7a8a9b" fontSize="10">{Math.round(max * (1 - i / 3))}</text></g>)}<polygon points={`48,190 ${points} 738,190`} fill="url(#curve-fill)" /><polyline points={points} fill="none" stroke="#1890ff" strokeWidth="2.5" strokeLinejoin="round" />{[0, 5, 10, 15].map(i => <text key={i} x={48 + i * 46} y="217" textAnchor="middle" fill="#7a8a9b" fontSize="11">{i}s</text>)}<text x="48" y="15" fill="#526579" fontSize="11">{unit} · 模拟加速时间</text></svg></div>;
}
function ReportView({ id }: { id: string }) {
  const load = useCallback(() => api.report(id), [id]);
  const { data, loading, error, refresh } = useResource(load);
  const [exportError, setExportError] = useState('');
  function download(report: Report) {
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify({ notice: '产品原型 / 模拟数据，不可用于真实硬件评估', ...report }, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `trial-simulated-${report.jobId}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setExportError(errorText(e)); }
  }
  return <div className="report-section"><ErrorNotice error={error || exportError} retry={() => void refresh()} />
    <Card loading={loading} title="结果报告" extra={data && <Button icon={<DownloadOutlined />} onClick={() => download(data)}>导出模拟报告</Button>}>{data && <>
      <Alert type="info" showIcon title="示例通过 · 模拟结果" description="这里的指标、曲线和结论均由 Mock 生成，不代表目标服务器的真实性能或质量。" style={{ marginBottom: 24 }} />
      <Descriptions size="small" column={{ xs: 1, sm: 2 }} items={[
        { key: 'type', label: '测试类型', children: testTypeLabels[data.scenario.testType] },
        { key: 'workload', label: '负载类型', children: workloadLabels[data.scenario.workload] },
        { key: 'termination', label: '终止策略', children: terminationText(data.scenario) },
        { key: 'rounds', label: '模拟完成轮数', children: data.scenario.termination.mode === 'rounds' ? data.completedRounds : '按时长，无轮数计分' },
      ]} style={{ marginBottom: 16 }} />
      <p className="muted">{data.componentResults.length ? '下方统计与曲线为首个部件的模拟样例，不是所有目标的聚合成绩；逐部件数据见后表。' : 'HTTP 场景为应用负载样例，不绑定具体硬件部件。'}</p>
      <Row gutter={[20, 20]}>{data.metrics.map(m => <Col xs={24} sm={8} key={m.label}><Statistic title={m.label} value={m.value} suffix={m.unit} /></Col>)}</Row>
      <h4 className="chart-title">{data.series.label}趋势 <span className="muted">/ 模拟采样</span></h4><Curve {...data.series} />
      <details><summary>查看可访问的采样数据</summary><Table rowKey="second" size="small" pagination={false} dataSource={data.series.samples} columns={[{ title: '模拟时间（秒）', dataIndex: 'second' }, { title: `${data.series.label}（${data.series.unit}）`, dataIndex: 'value' }]} /></details>
      {!!data.componentResults.length && <Table rowKey={r => r.component.id} size="small" pagination={false} scroll={{ x: 700 }} dataSource={data.componentResults} columns={[
        { title: '部件快照', render: (_, r) => <>{r.component.name}<div className="muted">{r.component.manufacturer} / {r.component.model}</div></> },
        { title: '关联部件的模拟指标 / 范围', render: (_, r) => <><div className="muted">{measurementScopeLabels[r.component.measurementScope]}</div>{r.metrics.map(m => <div key={m.label}>{m.label}：{m.value} {m.unit}</div>)}</> },
      ]} />}
      <p className="muted">报告生成于 {utc(data.generatedAt)} · {data.jobId}</p>
    </>}</Card>
  </div>;
}
export default function JobDetail() {
  const id = useParams().id ?? '';
  const load = useCallback(() => api.job(id), [id]);
  const { data, loading, error, refresh } = useResource(load, 2000);
  return <><Link to="/jobs"><Button type="text" icon={<ArrowLeftOutlined />} className="back-link">返回压测任务</Button></Link><PageTitle title={data?.name ?? '任务详情'} description="保存模板、工具修订、参数、部件及服务器快照，后续修改不回写本次任务。" action={data && <JobTag status={data.status} />} />
    <ErrorNotice error={error} retry={() => void refresh()} /><Card loading={loading && !data} title="任务配置快照">{data && <><Descriptions column={{ xs: 1, md: 2 }} items={[
      { key: 'id', label: '任务标识', children: data.id }, { key: 'time', label: '创建时间', children: utc(data.createdAt) },
      { key: 'scene', label: '场景 / 工具', children: `${data.scenario.name} / ${data.scenario.tool}` }, { key: 'workload', label: '负载类型', children: workloadLabels[data.scenario.workload] },
      { key: 'type', label: '测试类型', children: testTypeLabels[data.scenario.testType] },
      { key: 'duration', label: '终止策略', children: `${terminationText(data.scenario)}（演示约 15 秒）` }, { key: 'params', label: 'CPU 压力 / 并发元数据', children: `${data.scenario.intensityPercent}% / ${data.scenario.concurrency}` },
      { key: 'version', label: '工具参考修订', children: <span className="revision">{data.scenario.toolVersion}</span>, span: 2 },
      ...parameterSchema(data.scenario.workload, data.scenario.tool).map(p => ({ key: p.key, label: `${p.label}${p.unit ? `（${p.unit}）` : ''}`, children: String(data.scenario.parameters[p.key]) })),
      { key: 'rounds', label: '模拟已完成轮数', children: data.scenario.termination.mode === 'rounds' ? `${data.completedRounds} / ${data.scenario.termination.rounds}` : '按时长，无轮数计分' },
      { key: 'targets', label: '目标服务器', children: data.servers.map(s => s.name).join('、'), span: 2 },
    ]} />{!!data.components.length && <Table rowKey="id" size="small" pagination={false} scroll={{ x: 700 }} dataSource={data.components} columns={[
      { title: '目标部件', dataIndex: 'name' }, { title: '厂商 / 型号快照', render: (_, c) => `${c.manufacturer} / ${c.model}` },
      { title: '规格快照', render: (_, c) => c.specs.map(s => `${s.label}: ${s.value} ${s.unit ?? ''}`).join(' · ') },
    ]} />}<Space className="job-progress"><span>模拟进度</span><Progress percent={data.progress} status={['canceled', 'failed'].includes(data.status) ? 'exception' : data.status === 'completed' ? 'success' : 'active'} /></Space></>}</Card>
    {data?.status === 'completed' ? <ReportView id={id} /> : data && <Alert type={data.status === 'failed' ? 'error' : 'info'} showIcon style={{ marginTop: 20 }} title={data.status === 'failed' ? `模拟任务失败 · ${data.failure?.code}` : data.status === 'canceled' ? '任务已取消，不生成报告' : '模拟执行中，完成后将在此显示报告'} description={data.failure?.message ?? '演示过程不执行真实工具，也不向服务器发送请求。'} action={data.status === 'failed' && <Link to="/jobs?new=1"><Button>新建任务</Button></Link>} />}
  </>;
}
