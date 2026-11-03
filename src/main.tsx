import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import 'antd/dist/reset.css';
import './app/styles.css';

async function start() {
  if (!(import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCK === 'true')) {
    document.getElementById('root')!.textContent = 'Trial 产品原型：此构建未启用模拟数据。仅供本地评审；使用 npm run dev 或以 VITE_ENABLE_MOCK=true 构建。'; return;
  }
  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledRequest(request) { if (new URL(request.url).pathname.startsWith('/api/')) throw new Error(`未定义的原型 API：${request.method} ${request.url}`); } });
  ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
}
start().catch(error => { console.error(error); document.getElementById('root')!.textContent = '模拟数据启动失败。请在 localhost 打开，并检查浏览器是否允许 Service Worker。'; });
