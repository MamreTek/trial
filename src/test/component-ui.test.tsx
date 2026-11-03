import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import Components from '../features/components/Components';
import Scenarios from '../features/scenarios/Scenarios';
import Jobs from '../features/jobs/Jobs';
import { api } from '../shared/api/client';

// These cases assert click/form behavior, not hover; keep default pointer checks.

it('queries component models and shows unit-bearing specifications in a detail drawer', async () => {
  const user = userEvent.setup({ skipHover: true });
  render(<MemoryRouter><Components /></MemoryRouter>);
  await user.click(screen.getByRole('tab', { name: '网络' }));
  fireEvent.change(screen.getByRole('searchbox', { name: '搜索部件' }), { target: { value: 'Demo-NIC-25G' } });
  const table = within(screen.getByRole('table'));
  const target = await table.findByText('lab-dell-01 / NETWORK 0');
  await user.click(target);
  const drawer = within(await screen.findByRole('dialog'));
  expect(await drawer.findByText('模拟链路')).toBeVisible();
  expect(drawer.getByText('25 Gbit/s')).toBeVisible();
  expect(drawer.getByText('iperf3；仅产品兼容性建模，真实安装/驱动尚未探测。')).toBeVisible();
  expect(drawer.getByRole('button', { name: '配置此部件的模拟任务' })).toBeEnabled();
}, 15000);

it('switches from CPU to memory and saves only the matching tool parameters', async () => {
  const user = userEvent.setup({ skipHover: true });
  render(<Scenarios />);
  const open = screen.getByText('新建场景').closest('button')!;
  expect(open).toHaveRole('button'); expect(open).toBeVisible();
  await user.click(open);
  const dialog = await screen.findByRole('dialog'), form = within(dialog);
  const save = form.getByRole('button', { name: /保存场景/ });
  fireEvent.change(form.getByLabelText('场景名称'), { target: { value: '内存参数验收' } });
  await user.click(form.getByLabelText('负载类型'));
  await user.click(await screen.findByTitle('内存'));
  await user.click(form.getByLabelText('内存模式'));
  await user.click(await screen.findByTitle('vm'));
  fireEvent.change(form.getByLabelText('vm 总分配量（MiB）'), { target: { value: '2048' } });
  await user.click(save);
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  const saved = (await api.scenarios({ q: '内存参数验收' })).items[0];
  expect(saved).toMatchObject({ workload: 'memory', parameters: { memoryMode: 'vm', memoryMiB: 2048 }, termination: { mode: 'duration' } });
  expect(saved.parameters).not.toHaveProperty('cpuMethod');
}, 15000);

it('edits round termination while retaining the saved memory parameters', async () => {
  await api.saveScenario({ name: '内存轮次参数验收', workload: 'memory', tool: 'stress-ng', durationMinutes: 10, concurrency: 1, intensityPercent: 80, parameters: { memoryMode: 'vm', memoryMiB: 2048 } });
  const user = userEvent.setup({ skipHover: true });
  render(<Scenarios />);
  fireEvent.change(screen.getByLabelText('搜索场景'), { target: { value: '内存轮次参数验收' } });
  const row = await within(screen.getByRole('table')).findByText('内存轮次参数验收');
  await user.click(row);
  const dialog = await screen.findByRole('dialog'), form = within(dialog);
  const save = form.getByRole('button', { name: /保存场景/ });
  await user.click(form.getByLabelText('终止条件'));
  await user.click(await screen.findByTitle('完成指定轮数'));
  fireEvent.change(form.getByLabelText('测试轮数'), { target: { value: '3' } });
  fireEvent.change(form.getByLabelText('每轮运行时长（秒）'), { target: { value: '20' } });
  await user.click(save);
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  const saved = (await api.scenarios({ q: '内存轮次参数验收' })).items[0];
  expect(saved).toMatchObject({ workload: 'memory', parameters: { memoryMode: 'vm', memoryMiB: 2048 }, termination: { mode: 'rounds', rounds: 3, roundSeconds: 20 } });
  expect(saved.parameters).not.toHaveProperty('cpuMethod');
}, 15000);

it('creates a component-specific job from the inventory handoff', async () => {
  const user = userEvent.setup({ skipHover: true });
  render(<MemoryRouter initialEntries={['/jobs?new=1&componentId=cpu-srv-001-0']}><Jobs /></MemoryRouter>);
  const dialog = await screen.findByRole('dialog'), form = within(dialog);
  const name = form.getByRole('textbox', { name: '任务名称' });
  await waitFor(() => expect(name).toHaveValue('CPU / lab-dell-01'));
  const create = form.getByRole('button', { name: '创建模拟任务' });
  expect(create).toBeEnabled();
  await user.click(create);
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  const job = (await api.jobs({ q: 'CPU / lab-dell-01' })).items[0];
  expect(job).toMatchObject({ components: [{ id: 'cpu-srv-001-0', serverId: 'srv-001' }], scenario: { parameters: { cpuMethod: 'all' }, termination: { mode: 'duration' } } });
}, 15000);
