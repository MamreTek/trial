import { useState } from 'react';
import { Alert, Button, ConfigProvider, Drawer, Layout, Menu, Select, Space, Tag, Tooltip } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AppstoreOutlined, DatabaseOutlined, ExperimentOutlined, FileTextOutlined, MenuOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Dashboard from '../features/dashboard/Dashboard';
import Servers from '../features/servers/Servers';
import Scenarios from '../features/scenarios/Scenarios';
import Jobs from '../features/jobs/Jobs';
import JobDetail from '../features/jobs/JobDetail';
import { store } from '../mocks/store';

const items = [
  { key: '/', icon: <AppstoreOutlined />, label: '工作台' }, { key: '/servers', icon: <DatabaseOutlined />, label: '服务器' },
  { key: '/scenarios', icon: <ExperimentOutlined />, label: '压测场景' }, { key: '/jobs', icon: <PlayCircleOutlined />, label: '压测任务' }, { key: '/reports', icon: <FileTextOutlined />, label: '压测报告' },
];
function Shell() {
  const location = useLocation(), navigate = useNavigate();
  const [mobile, setMobile] = useState(false), [mode, setMode] = useState<'normal' | 'empty' | 'fail'>('normal');
  const selected = location.pathname.startsWith('/jobs') ? '/jobs' : location.pathname;
  function mockMode(value: 'normal' | 'empty' | 'fail') { store.control(value); setMode(value === 'fail' ? 'normal' : value); window.dispatchEvent(new Event('trial:mock-change')); }
  const navigation = <><Link to="/" className="brand"><span className="brand-glyph">t<span>r</span></span><div>Trial<small>MAMRETEK / PERFORMANCE LAB</small></div></Link><div className="nav-section">实验工作区</div><Menu theme="dark" selectedKeys={[selected]} mode="inline" items={items} onClick={({ key }) => { navigate(key); setMobile(false); }} /><div className="sidebar-footer"><span className="connection-dot" /> 本地模拟环境<p>Prototype v0.1<br />不连接真实基础设施</p></div></>;
  return <Layout className="app-shell"><Layout.Sider width={232} className="desktop-sidebar">{navigation}</Layout.Sider><Drawer placement="left" open={mobile} onClose={() => setMobile(false)} styles={{ body: { padding: 0, background: '#101827' } }} width={250} title="Trial 导航">{navigation}</Drawer><Layout className="main-layout"><Layout.Header className="topbar"><Space><Button className="mobile-menu" type="text" aria-label="打开导航" icon={<MenuOutlined />} onClick={() => setMobile(true)} /><span className="breadcrumb">MamreTek <span>/</span> Trial</span><Tag color="cyan">产品原型</Tag></Space><Space wrap><span className="mock-label">Mock 演示</span><Select size="small" aria-label="Mock 演示状态" value={mode} onChange={mockMode} style={{ width: 136 }} options={[{ value: 'normal', label: '正常数据' }, { value: 'empty', label: '空数据' }, { value: 'fail', label: '下一次请求失败' }]} /><Tooltip title="重置所有模拟数据"><Button size="small" aria-label="重置模拟数据" icon={<ReloadOutlined />} onClick={() => { store.reset(); setMode('normal'); window.dispatchEvent(new Event('trial:mock-change')); }} /></Tooltip></Space></Layout.Header><Layout.Content className="content"><Alert className="prototype-alert" showIcon type="warning" title="产品原型 / 模拟数据" description="仅验证产品流程，无真实压测、持久化或权限保护。请勿接入生产服务器与生产数据。" /><main><Outlet /></main><footer className="page-footer">TRIAL · MAMRETEK <span>所有执行与结果均为模拟 · 时间统一展示为 UTC</span></footer></Layout.Content></Layout></Layout>;
}
export default function App() {
  return <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#078f80', borderRadius: 8, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif', colorText: '#213247', colorBgLayout: '#f4f7fa' }, components: { Layout: { siderBg: '#101827' }, Menu: { darkItemBg: '#101827', darkItemSelectedBg: '#183b3c', darkItemSelectedColor: '#5ce0c7' }, Table: { headerBg: '#f8fafb' } } }}><BrowserRouter><Routes><Route element={<Shell />}><Route index element={<Dashboard />} /><Route path="servers" element={<Servers />} /><Route path="scenarios" element={<Scenarios />} /><Route path="jobs" element={<Jobs />} /><Route path="jobs/:id" element={<JobDetail />} /><Route path="reports" element={<Jobs key="reports" reports />} /><Route path="*" element={<Navigate to="/" replace />} /></Route></Routes></BrowserRouter></ConfigProvider>;
}
