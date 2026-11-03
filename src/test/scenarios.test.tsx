import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import Scenarios from '../features/scenarios/Scenarios';
import { api } from '../shared/api/client';

it('creates a reusable scenario from the form and shows the saved result', async () => {
  const user = userEvent.setup();
  render(<Scenarios />);
  await user.click(screen.getByRole('button', { name: /新建场景/ }));
  const dialog = await screen.findByRole('dialog');
  const editor = within(dialog);
  const save = editor.getByRole('button', { name: /保存场景/ });
  await user.click(save);
  expect(await editor.findByText('请输入 2–60 个字符')).toBeVisible();
  fireEvent.change(editor.getByRole('textbox', { name: '场景名称' }), { target: { value: '界面验收新场景' } });
  await user.click(save);
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  expect(await screen.findByText('界面验收新场景')).toBeVisible();
  expect((await api.scenarios({ q: '界面验收' })).items[0]).toMatchObject({ name: '界面验收新场景', testType: 'stress', tool: 'stress-ng', workload: 'cpu' });
}, 15000);

it('saves a stability test independently of CPU workload', async () => {
  const user = userEvent.setup();
  render(<Scenarios />);
  await user.click(screen.getByRole('button', { name: /新建场景/ }));
  const dialog = await screen.findByRole('dialog'), editor = within(dialog);
  fireEvent.change(editor.getByRole('textbox', { name: '场景名称' }), { target: { value: 'CPU 稳定性验收' } });
  await user.click(editor.getByRole('combobox', { name: '测试类型' }));
  await user.click(await screen.findByTitle('稳定性测试'));
  expect(editor.getByTitle('稳定性测试')).toBeVisible();
  await user.click(editor.getByRole('button', { name: /保存场景/ }));
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  expect((await api.scenarios({ q: 'CPU 稳定性验收' })).items[0]).toMatchObject({ testType: 'stability', workload: 'cpu' });
  expect(await screen.findByText('CPU 稳定性验收')).toBeVisible();
}, 15000);

it('filters test types across workloads and resets the list', async () => {
  await api.saveScenario({ name: 'CPU 稳定性验收', testType: 'stability', workload: 'cpu', tool: 'stress-ng', durationMinutes: 30, concurrency: 64, intensityPercent: 85 });
  const user = userEvent.setup();
  render(<Scenarios />);
  const table = within(screen.getByRole('table'));
  expect(await table.findByText('CPU 基线压力测试')).toBeVisible();
  await user.click(screen.getByRole('combobox', { name: '测试类型筛选' }));
  await user.click(await screen.findByTitle('稳定性测试'));
  await waitFor(() => expect(table.queryByText('CPU 基线压力测试')).not.toBeInTheDocument());
  expect(table.getByText('CPU 稳定性验收')).toBeVisible();
  expect(table.getByText('GPU 长稳测试')).toBeVisible();
  await user.click(screen.getByRole('button', { name: /^重\s*置$/ }));
  expect(await table.findByText('CPU 基线压力测试')).toBeVisible();
}, 15000);
