import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Input } from 'antd';
import { EyeOutlined, CheckCircleOutlined } from '@ant-design/icons';
import Layout from '../../components/Layout/Layout';
import api from '../../services/api';

interface AlertItem {
  history_id: string;
  alert_type: string;
  severity: string;
  title: string;
  portfolio_name: string;
  triggered_at: string;
  status: string;
}

const Alerts: React.FC = () => {
  const [data, setData] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = () => {
    api.get('/notifications/history?limit=100')
      .then(res => {
        const items = (res.data || []).map((a: any) => ({
          history_id: a.history_id,
          alert_type: a.alert_type,
          severity: a.severity,
          title: a.title,
          portfolio_name: a.portfolio?.name || '-',
          triggered_at: a.triggered_at,
          status: a.status,
        }));
        setData(items);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  };

  const handleMarkRead = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/read`);
      loadAlerts();
    } catch (e: any) {
      alert('操作失败: ' + (e.response?.data?.message || '未知错误'));
    }
  };

  const severityColors: Record<string, string> = {
    critical: 'red',
    high: 'orange',
    medium: 'blue',
    low: 'green',
  };

  const columns = [
    { title: '预警类型', dataIndex: 'alert_type', key: 'alert_type', render: (v: string) => <Tag>{v}</Tag> },
    { title: '级别', dataIndex: 'severity', key: 'severity', render: (v: string) => <Tag color={severityColors[v] || 'default'}>{v}</Tag> },
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '组合', dataIndex: 'portfolio_name', key: 'portfolio_name' },
    { title: '触发时间', dataIndex: 'triggered_at', key: 'triggered_at' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'active' ? 'red' : 'default'}>{v}</Tag> },
    { title: '操作', key: 'action', render: (_: any, record: AlertItem) => (
      <Space>
        <Button icon={<EyeOutlined />} size="small">查看</Button>
        {record.status === 'active' && (
          <Button icon={<CheckCircleOutlined />} size="small" onClick={() => handleMarkRead(record.history_id)}>标记已读</Button>
        )}
      </Space>
    )},
  ];

  const filtered = data.filter(d => d.title.includes(search) || d.portfolio_name.includes(search));

  return (
    <Layout>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input.Search placeholder="搜索预警" style={{ width: 300 }} value={search} onChange={e => setSearch(e.target.value)} />
        <Button type="primary">批量处理</Button>
      </div>
      <Table columns={columns} dataSource={filtered} loading={loading} rowKey="history_id" />
    </Layout>
  );
};

export default Alerts;
