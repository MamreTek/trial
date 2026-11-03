import { Alert, Button, Space, Tag, Typography } from 'antd';
import type { JobStatus } from './api/contracts';
import { jobLabels } from './api/contracts';
export function PageTitle({ title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><Typography.Title level={2}>{title}</Typography.Title><Typography.Text type="secondary">{description}</Typography.Text></div>{action}</div>;
}
export function ErrorNotice({ error, retry }: { error?: string; retry?: () => void }) {
  return error ? <Alert showIcon type="error" title="请求未完成" description={error} action={retry && <Button size="small" onClick={retry}>重试</Button>} style={{ marginBottom: 20 }} /> : null;
}
export function JobTag({ status }: { status: JobStatus }) {
  return <Tag color={{ queued: 'gold', running: 'processing', completed: 'success', canceled: 'default', failed: 'error' }[status]}>{jobLabels[status]}</Tag>;
}
export function utc(value: string) { return `${new Date(value).toISOString().replace('T', ' ').slice(0, 19)} UTC`; }
export function Meta({ items }: { items: string[] }) { return <Space wrap split={<span className="dot">·</span>}>{items.map(i => <span className="muted" key={i}>{i}</span>)}</Space>; }
