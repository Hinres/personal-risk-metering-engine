import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, DatePicker, Input } from 'antd';
import Layout from '../../components/Layout/Layout';
import api from '../../services/api';

interface AuditItem {
  log_id: string;
  operation_type: string;
  resource_type: string;
  user_id: string;
  ip_address: string;
  created_at: string;
}

const AuditLogs: React.FC = () => {
  const [data, setData] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = () => {
    const params: any = { limit: 100 };
    if (dateRange) {
      params.start = dateRange[0]?.format('YYYY-MM-DD');
      params.end = dateRange[1]?.format('YYYY-MM-DD');
    }
    api.get('/system/audit-logs', { params })
      .then(res => {
        const items = (res.data || []).map((l: any) => ({
          log_id: l.log_id,
          operation_type: l.operation_type,
          resource_type: l.resource_type,
          user_id: l.user_id || 'system',
          ip_address: l.ip_address || '-',
          created_at: l.created_at,
        }));
        setData(items);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  };

  const operationColors: Record<string, string> = {
    CREATE: 'green',
    UPDATE: 'blue',
    DELETE: 'red',
    LOGIN: 'purple',
    LOGOUT: 'default',
    QUERY: 'default',
    CALCULATE: 'cyan',
  };

  const columns = [
    { title: '操作类型', dataIndex: 'operation_type', key: 'operation_type', render: (v: string) => <Tag color={operationColors[v] || 'default'}>{v}</Tag> },
    { title: '资源类型', dataIndex: 'resource_type', key: 'resource_type' },
    { title: '用户ID', dataIndex: 'user_id', key: 'user_id' },
    { title: 'IP地址', dataIndex: 'ip_address', key: 'ip_address' },
    { title: '时间', dataIndex: 'created_at', key: 'created_at' },
  ];

  const filtered = data.filter(d =>
    d.operation_type.includes(search) || d.resource_type.includes(search) || d.user_id.includes(search)
  );

  return (
    <Layout>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <Input.Search placeholder="搜索审计日志" style={{ width: 300 }} value={search} onChange={e => setSearch(e.target.value)} />
        <Space>
          <DatePicker.RangePicker onChange={setDateRange} />
          <Button type="primary" onClick={loadAuditLogs}>查询</Button>
          <Button>导出</Button>
        </Space>
      </div>
      <Table columns={columns} dataSource={filtered} loading={loading} rowKey="log_id" />
    </Layout>
  );
};

export default AuditLogs;
