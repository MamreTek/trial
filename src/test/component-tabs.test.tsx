import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import Components from '../features/components/Components';

it.each([
  { tab: 'CPU', target: 'lab-dell-01 / CPU 0', spec: '模拟核心', metric: 'CPU bogo ops（ops/s）', excluded: 'P99 完成延迟（µs）', kind: 'CPU' },
  { tab: '内存', target: 'lab-dell-01 / MEMORY 0', spec: '模拟速率', metric: 'stream 读取速率（MB/s）', excluded: 'GPU 最高温度（°C）', kind: 'MEMORY' },
  { tab: '硬盘', target: 'lab-dell-01 / DISK 0', spec: '接口', metric: 'P99 完成延迟（µs）', excluded: 'CPU bogo ops（ops/s）', kind: 'DISK' },
  { tab: '网络', target: 'lab-dell-01 / NETWORK 0', spec: '模拟链路', metric: '接收吞吐（Gbit/s）', excluded: 'stream 读取速率（MB/s）', kind: 'NETWORK' },
  { tab: 'GPU', target: 'lab-gpu-01 / GPU 0', spec: '模拟显存', metric: '计算吞吐（GFLOP/s）', excluded: 'TCP 重传（次）', kind: 'GPU' },
])('shows only $tab parts with their relevant specification and metric columns', async ({ tab, target, spec, metric, excluded, kind }) => {
  const user = userEvent.setup();
  render(<MemoryRouter><Components /></MemoryRouter>);
  const selected = screen.getByRole('tab', { name: tab });
  if (tab !== 'CPU') await user.click(selected);
  const panel = screen.getByRole('tabpanel', { name: tab });
  const table = within(within(panel).getByRole('table'));
  expect(await table.findByText(target)).toBeVisible();
  expect(selected).toHaveAttribute('aria-selected', 'true');
  expect(table.getByRole('columnheader', { name: spec })).toBeVisible();
  expect(table.getByRole('columnheader', { name: metric })).toBeVisible();
  expect(table.queryByRole('columnheader', { name: excluded })).not.toBeInTheDocument();
  expect(screen.getAllByRole('table')).toHaveLength(1);
  const partButtons = table.getAllByRole('button', { name: /lab-.+ \/ (CPU|MEMORY|DISK|NETWORK|GPU) \d/ });
  expect(partButtons.length).toBeGreaterThan(0);
  expect(partButtons.every(button => button.textContent?.includes(`/ ${kind} `))).toBe(true);
}, 15000);

it('switches tabs by keyboard with selected state, focus and panel association', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><Components /></MemoryRouter>);
  const tabs = within(screen.getByRole('tablist'));
  const cpu = tabs.getByRole('tab', { name: 'CPU' });
  const memory = tabs.getByRole('tab', { name: '内存' });
  cpu.focus();
  await user.keyboard('{ArrowRight}{Enter}');
  expect(memory).toHaveAttribute('aria-selected', 'true');
  expect(memory).toHaveFocus();
  expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', memory.id);
  await user.keyboard('{ArrowLeft}{Enter}');
  expect(cpu).toHaveAttribute('aria-selected', 'true');
  expect(cpu).toHaveFocus();
  expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', cpu.id);
}, 15000);

it('preserves independent queries when switching between component types', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><Components /></MemoryRouter>);
  const tabs = within(screen.getByRole('tablist'));
  const cpu = tabs.getByRole('tab', { name: 'CPU' });
  const memory = tabs.getByRole('tab', { name: '内存' });
  fireEvent.change(screen.getByLabelText('搜索部件'), { target: { value: 'lab-dell-01' } });
  expect(await screen.findByText('lab-dell-01 / CPU 0')).toBeVisible();
  await user.click(memory);
  expect(screen.getByLabelText('搜索部件')).toHaveValue('');
  expect(await screen.findByText('lab-dell-01 / MEMORY 0')).toBeVisible();
  const memoryTable = within(screen.getByRole('table'));
  fireEvent.change(screen.getByLabelText('搜索部件'), { target: { value: 'Micron' } });
  expect(screen.getByLabelText('搜索部件')).toHaveValue('Micron');
  await waitFor(() => expect(memoryTable.queryByText('lab-dell-01 / MEMORY 0')).not.toBeInTheDocument());
  await user.click(cpu);
  expect(cpu).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByLabelText('搜索部件')).toHaveValue('lab-dell-01');
  expect(await screen.findByText('lab-dell-01 / CPU 0')).toBeVisible();
}, 15000);
