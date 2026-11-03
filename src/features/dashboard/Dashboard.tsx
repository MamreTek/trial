import { useCallback } from 'react';
import { Button, Card, Col, Empty, Row, Statistic, Table } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/client';
import { useResource } from '../../shared/useResource';
import { ErrorNotice, JobTag, PageTitle } from '../../shared/ui';
import { workloadLabels } from '../../shared/api/contracts';

export default function Dashboard() {
  const load = useCallback(async () => {
    const [servers, scenarios, jobs] = await Promise.all([
      api.servers({ pageSize: 100 }), api.scenarios({ pageSize: 100 }), api.jobs({ pageSize: 100, sort: '-createdAt' }),
    ]);
    return { servers, scenarios, jobs };
  }, []);
  const { data, loading, error, refresh } = useResource(load, 3000);
  const items = [
    ['服务器总数', data?.servers.total ?? 0, `${data?.servers.items.filter(s => s.status === 'online').length ?? 0} 台模拟在线`],
    ['压测场景', data?.scenarios.total ?? 0, 'CPU / 内存、HTTP、GPU'],
    ['进行中任务', data?.jobs.items.filter(j => ['running', 'queued'].includes(j.status)).length ?? 0, '模拟任务约 15 秒完成'],
    ['已完成任务', data?.jobs.items.filter(j => j.status === 'completed').length ?? 0, '可查看模拟报告'],
  ] as const;
  return <>
    <PageTitle title="工作台" description="服务器资源、压测任务与结果概览。" action={<Link to="/jobs?new=1"><Button type="primary" icon={<PlusOutlined />}>新建压测任务</Button></Link>} />
    <ErrorNotice error={error} retry={() => void refresh()} />
    <Row gutter={[24, 16]}>{items.map(([title, value, note]) => <Col xs={24} sm={12} xl={6} key={title}>
      <Card className="stat-card" loading={loading && !data}><Statistic title={title} value={value} /><div className="stat-note">{note}</div></Card>
    </Col>)}</Row>
    <Row gutter={[24, 24]} className="dashboard-details">
      <Col xs={24} xl={18}><Card title="最近任务" extra={<Link to="/jobs">查看全部</Link>}>
        <Table rowKey="id" loading={loading && !data} dataSource={data?.jobs.items.slice(0, 5)} pagination={false} locale={{ emptyText: <Empty description="还没有压测任务" /> }} scroll={{ x: 510 }} columns={[
          { title: '任务名称', dataIndex: 'name', render: (name, j) => <Link to={`/jobs/${j.id}`}>{name}</Link> },
          { title: '负载类型', render: (_, j) => workloadLabels[j.scenario.workload] },
          { title: '目标服务器', render: (_, j) => `${j.servers.length} 台` },
          { title: '状态', render: (_, j) => <JobTag status={j.status} /> },
        ]} />
      </Card></Col>
      <Col xs={24} xl={6}><Card title="操作指引">{[
        ['服务器', '查看硬件配置与模拟在线状态', '/servers'],
        ['压测场景', '配置工具、压力与持续时间', '/scenarios'],
        ['压测任务', '创建任务、取消运行与查看报告', '/jobs'],
      ].map(([title, description, path]) => <Link to={path} className="quick-link" key={path}><strong>{title}</strong><p>{description}</p></Link>)}</Card></Col>
    </Row>
  </>;
}
