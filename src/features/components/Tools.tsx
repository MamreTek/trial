import { useCallback } from 'react';
import { Alert, Card, Table, Tag } from 'antd';
import { api } from '../../shared/api/client';
import { workloadLabels } from '../../shared/api/contracts';
import { useResource } from '../../shared/useResource';
import { ErrorNotice, PageTitle } from '../../shared/ui';

export default function Tools() {
  const load = useCallback(() => api.tools(), []);
  const { data, loading, error, refresh } = useResource(load);
  return <><PageTitle title="工具目录" description="官方资料、许可证与固定参考修订。仅工具建模，没有安装、打包或执行任何工具。" />
    <ErrorNotice error={error} retry={() => void refresh()} />
    <Alert type="info" showIcon title="参考修订用于保存计划，不是本机已安装版本；真实接入需探测环境、许可证和实际工具输出。" style={{ marginBottom: 16 }} />
    <Card title="压测工具与适用范围"><Table rowKey="id" loading={loading} dataSource={data} pagination={false} scroll={{ x: 1080 }} columns={[
      { title: '工具 / 参考版本', render: (_, t) => <><a href={t.docsUrl} target="_blank" rel="noreferrer">{t.name}</a><div className="muted revision">{t.revision}</div></> },
      { title: '部件 / 许可', render: (_, t) => <>{t.workloads.map(w => workloadLabels[w]).join('、')}<div><a href={t.licenseUrl} target="_blank" rel="noreferrer">{t.license}</a></div></> },
      { title: '当前状态', render: (_, t) => <Tag color={t.availability === 'mock' ? 'blue' : 'warning'}>{t.availability === 'mock' ? '可模拟' : t.availability === 'external' ? '需离线流程' : '版本 / 许可待确认'}</Tag> },
      { title: '支持边界与参数', render: (_, t) => <div>{t.notes}<div className="muted">{Object.entries(t.schemas).map(([kind, fields]) => <div key={kind}>{workloadLabels[kind as keyof typeof workloadLabels]}：{fields?.map(p => `${p.label}${p.unit ? ` (${p.unit})` : ''}`).join('、') || '仅基础计划字段'}</div>)}</div></div> },
    ]} /></Card></>;
}
