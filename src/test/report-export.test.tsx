import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import JobDetail from '../features/jobs/JobDetail';

it('exports a labeled JSON report matching the displayed completed job', async () => {
  let payload: Blob | undefined;
  let filename = '';
  const OriginalURL = URL;
  vi.stubGlobal('URL', class extends OriginalURL {
    static createObjectURL(blob: Blob) { payload = blob; return 'blob:trial-report'; }
    static revokeObjectURL() {}
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { filename = this.download; });
  try {
    render(<MemoryRouter initialEntries={['/jobs/job-001']}><Routes><Route path="/jobs/:id" element={<JobDetail />} /></Routes></MemoryRouter>);
    const button = await screen.findByRole('button', { name: /导出模拟报告/ });
    vi.useFakeTimers();
    fireEvent.click(button);
    act(() => vi.advanceTimersByTime(1000));
    vi.useRealTimers();
    expect(filename).toBe('trial-simulated-job-001.json');
    expect(payload?.type).toBe('application/json');
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsText(payload!);
    });
    expect(JSON.parse(text)).toMatchObject({
      jobId: 'job-001', simulated: true, workload: 'cpu',
      notice: '产品原型 / 模拟数据，不可用于真实硬件评估',
      scenario: { id: 'scn-001', testType: 'stress' }, servers: [{ id: 'srv-001' }],
    });
  } finally { vi.useRealTimers(); vi.unstubAllGlobals(); }
}, 15000);
