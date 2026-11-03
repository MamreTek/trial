import { useCallback } from 'react';
import { Button, Card, Col, Empty, Row, Space, Statistic, Table, Tag } from 'antd';
import { ArrowRightOutlined, ExperimentOutlined, PlusOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/client';
import { useResource } from '../../shared/useResource';
import { ErrorNotice, JobTag, PageTitle } from '../../shared/ui';
import { workloadLabels } from '../../shared/api/contracts';

export default function Dashboard() {
  const load = useCallback(async () => { const [servers, scenarios, jobs] = await Promise.all([api.servers({ pageSize: 100 }), api.scenarios({ pageSize: 100 }), api.jobs({ pageSize: 100, sort: '-createdAt' })]); return { servers, scenarios, jobs }; }, []);
  const { data, loading, error, refresh } = useResource(load, 3000);
  const items = [
    ['实验室服务器', data?.servers.total ?? 0, `${data?.servers.items.filter(s => s.status === 'online').length ?? 0} 台模拟在线`],
    ['压测场景', data?.scenarios.total ?? 0, 'CPU / HTTP / GPU'],
    ['正在执行', data?.jobs.items.filter(j => ['running', 'queued'].includes(j.status)).length ?? 0, '加速模拟 · 约 15 秒'],
    ['已完成任务', data?.jobs.items.filter(j => j.status === 'completed').length ?? 0, '结果仅用于产品演示'],
  ] as const;
  return <><PageTitle eyebrow="OVERVIEW / 工作台" title="把性能验证，变成可追溯的流程" description="从服务器到压测报告，在一个工作台完成实验。" action={<Link to="/jobs?new=1"><Button type="primary" icon={<PlusOutlined />}>新建压测任务</Button></Link>} />
    <ErrorNotice error={error} retry={() => void refresh()} />
    <Row gutter={[16, 16]}>{items.map(([title, value, note]) => <Col xs={24} sm={12} xl={6} key={title}><Card className="stat-card" loading={loading && !data}><Statistic title={title} value={value} /><div className="stat-note">{note}</div></Card></Col>)}</Row>
    <div className="lab-banner"><div className="lab-icon"><ExperimentOutlined /></div><div><span className="eyebrow">YOUR NEXT EXPERIMENT</span><h3>先定义场景，再运行一次模拟实验</h3><p>选择测试工具与压力参数，验证硬件兼容性，查看专属结果报告。</p></div><Link to="/scenarios"><Button>管理压测场景 <ArrowRightOutlined /></Button></Link></div>
    <Row gutter={[20, 20]}><Col xs={24} xl={16}><Card title="最近任务" extra={<Link to="/jobs">全部任务 <ArrowRightOutlined /></Link>}>
      <Table rowKey="id" loading={loading && !data} dataSource={data?.jobs.items.slice(0, 5)} pagination={false} locale={{ emptyText: <Empty description="还没有压测任务" /> }} scroll={{ x: 510 }} columns={[
        { title: '任务', dataIndex: 'name', render: (name, j) => <Link to={`/jobs/${j.id}`}>{name}</Link> },
        { title: '负载', render: (_, j) => workloadLabels[j.scenario.workload] },
        { title: '目标', render: (_, j) => `${j.servers.length} 台` },
        { title: '状态', render: (_, j) => <JobTag status={j.status} /> },
      ]} />
    </Card></Col><Col xs={24} xl={8}><Card title="实验流程" className="workflow-card">{[
      ['01', '确认服务器', '查看硬件配置与模拟在线状态', '/servers'], ['02', '定义压测场景', '选择工具、压力和持续时间', '/scenarios'], ['03', '运行与分析', '观察状态变化，回看模拟报告', '/jobs'],
    ].map(([n, title, desc, path]) => <Link to={path} className="workflow-step" key={n}><span className="step-number">{n}</span><div><strong>{title}</strong><p>{desc}</p></div><ArrowRightOutlined /></Link>)}<Space><Tag color="cyan">Mock API</Tag><span className="muted">刷新页面恢复示例数据</span></Space></Card></Col></Row>
  </>;
}
