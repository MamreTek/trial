import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import Servers from '../features/servers/Servers';
import { store } from '../mocks/store';

it('shows a one-time failure under StrictMode and recovers on retry', async () => {
  const user = userEvent.setup();
  render(<StrictMode><Servers /></StrictMode>);
  const asset = (await screen.findByText('lab-dell-01', {}, { timeout: 5000 })).closest('button');
  expect(asset).toHaveRole('button');
  expect(asset).toBeVisible();
  act(() => { store.control('fail'); window.dispatchEvent(new Event('trial:mock-change')); });
  expect(await screen.findByText('请求未完成')).toBeVisible();
  expect(screen.getByText(/模拟服务暂时不可用.*请求/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: /重.*试/ }));
  await waitFor(() => expect(screen.queryByText('请求未完成')).not.toBeInTheDocument());
  const recovered = (await screen.findByText('lab-dell-01', {}, { timeout: 5000 })).closest('button');
  expect(recovered).toHaveRole('button');
  expect(recovered).toBeVisible();
}, 15000);
