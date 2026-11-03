import { useEffect, useState } from 'react';
import { Alert, Breadcrumb, Button, ConfigProvider, Drawer, Layout, Menu, Select, Space, Tag, Tooltip } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AppstoreOutlined, DatabaseOutlined, ExperimentOutlined, FileTextOutlined, MenuOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Dashboard from '../features/dashboard/Dashboard';
import Servers from '../features/servers/Servers';
import Scenarios from '../features/scenarios/Scenarios';
import Jobs from '../features/jobs/Jobs';
import JobDetail from '../features/jobs/JobDetail';
import Components from '../features/components/Components';
import Tools from '../features/components/Tools';
import type { MockMode } from '../shared/api/contracts';
import { store } from '../mocks/store';

const items = [
  { key: '/', icon: <AppstoreOutlined />, label: '工作台' },
  { key: '/servers', icon: <DatabaseOutlined />, label: '服务器' },
  { key: '/components', icon: <DatabaseOutlined />, label: '部件清单' },
  { key: '/scenarios', icon: <ExperimentOutlined />, label: '场景与模板' },
  { key: '/tools', icon: <ExperimentOutlined />, label: '工具目录' },
  { key: '/jobs', icon: <PlayCircleOutlined />, label: '压测任务' },
  { key: '/reports', icon: <FileTextOutlined />, label: '压测报告' },
];

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(false);
  const [mode, setMode] = useState<MockMode>('normal');
  useEffect(() => {
    const created = () => setMode('normal');
    window.addEventListener('trial:mock-job-created', created);
    return () => window.removeEventListener('trial:mock-job-created', created);
  }, []);
  const selected = location.pathname.startsWith('/jobs') ? '/jobs' : location.pathname;
  const currentPage = items.find(item => item.key === selected)?.label ?? '工作台';
  const breadcrumbs = [
    { title: <Link to="/">Trial</Link> },
    { title: currentPage },
    ...(location.pathname.startsWith('/jobs/') ? [{ title: '任务详情' }] : []),
  ];
  function mockMode(value: MockMode) {
    store.control(value);
    setMode(value === 'fail' ? 'normal' : value);
    window.dispatchEvent(new Event('trial:mock-change'));
  }
  const navigation = <>
    <div className="nav-section">性能测试</div>
    <Menu selectedKeys={[selected]} mode="inline" items={items} onClick={({ key }) => { navigate(key); setMobile(false); }} />
    <div className="sidebar-footer"><Tag>Mock 环境</Tag><p>不连接真实服务器</p></div>
  </>;

  return <Layout className="app-shell">
    <Layout.Header className="topbar">
      <Space size={12}>
        <Button className="mobile-menu" type="text" aria-label="打开导航" icon={<MenuOutlined />} onClick={() => setMobile(true)} />
        <Link to="/" className="app-brand"><ExperimentOutlined /><span>Trial</span></Link>
        <span className="product-name">服务器压测平台</span>
        <Tag color="blue">产品原型</Tag>
      </Space>
      <Space className="preview-controls">
        <span className="mock-label">模拟数据</span>
        <Select size="small" aria-label="Mock 演示状态" value={mode} onChange={mockMode} style={{ width: 136 }} options={[
          { value: 'normal', label: '正常数据' }, { value: 'empty', label: '空数据' }, { value: 'fail', label: '下一次请求失败' },
          { value: 'tool-error', label: '下个任务工具失败' }, { value: 'timeout', label: '下个任务超时' },
        ]} />
        <Tooltip title="重置所有模拟数据"><Button size="small" aria-label="重置模拟数据" icon={<ReloadOutlined />} onClick={() => {
          store.reset(); setMode('normal'); window.dispatchEvent(new Event('trial:mock-change'));
        }} /></Tooltip>
      </Space>
    </Layout.Header>
    <Layout.Sider width={216} theme="light" className="desktop-sidebar">{navigation}</Layout.Sider>
    <Drawer placement="left" open={mobile} onClose={() => setMobile(false)} styles={{ body: { padding: 0 } }} width={240} title="Trial 导航">{navigation}</Drawer>
    <Layout className="main-layout">
      <Layout.Content className="content">
        <Breadcrumb className="page-breadcrumb" items={breadcrumbs} />
        <Alert className="prototype-alert" showIcon type="warning" title="产品原型 / 模拟数据：无真实压测、持久化及权限保护，请勿接入生产服务器或生产数据。" />
        <main><Outlet /></main>
        <footer className="page-footer"><span>MamreTek · Trial</span><span>模拟数据 · UTC 时间</span></footer>
      </Layout.Content>
    </Layout>
  </Layout>;
}

export default function App() {
  return <ConfigProvider locale={zhCN} theme={{
    token: { colorPrimary: '#1890ff', borderRadius: 6, colorBgLayout: '#f5f5f5' },
    components: {
      Layout: { headerBg: '#fff', siderBg: '#fff' },
      Menu: { itemSelectedBg: '#e6f4ff', itemSelectedColor: '#1890ff' },
      Table: { headerBg: '#fafafa', cellPaddingBlock: 12, cellPaddingInline: 16 },
      Card: { headerFontSize: 16 },
    },
  }}>
    <BrowserRouter><Routes><Route element={<Shell />}>
      <Route index element={<Dashboard />} />
      <Route path="servers" element={<Servers />} />
      <Route path="components" element={<Components />} />
      <Route path="tools" element={<Tools />} />
      <Route path="scenarios" element={<Scenarios />} />
      <Route path="jobs" element={<Jobs />} />
      <Route path="jobs/:id" element={<JobDetail />} />
      <Route path="reports" element={<Jobs key="reports" reports />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route></Routes></BrowserRouter>
  </ConfigProvider>;
}
