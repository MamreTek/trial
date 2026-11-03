import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import Scenarios from '../features/scenarios/Scenarios';
import { api } from '../shared/api/client';

it('creates a reusable scenario from the form and shows the saved result', async () => {
  const user = userEvent.setup();
  render(<Scenarios />);
  await user.click(screen.getByRole('button', { name: /新建场景/ }));
  await user.click(screen.getByRole('button', { name: /保存场景/ }));
  expect(await screen.findByText('请输入 2–60 个字符')).toBeVisible();
  fireEvent.change(screen.getByRole('textbox', { name: '场景名称' }), { target: { value: '界面验收新场景' } });
  await user.click(screen.getByRole('button', { name: /保存场景/ }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await screen.findByText('界面验收新场景')).toBeVisible();
  expect((await api.scenarios({ q: '界面验收' })).items[0]).toMatchObject({ name: '界面验收新场景', tool: 'stress-ng', workload: 'cpu' });
}, 15000);
