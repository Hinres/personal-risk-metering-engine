import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Input, Switch } from 'antd';
import { PauseCircleOutlined, PlayCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import Layout from '../../components/Layout/Layout';
import api from '../../services/api';

interface MonitorItem {
  monitor_id: string;
  monitor_name: string;
  monitor_type: string;
  portfolio_name: string;
  threshold: number;
  operator: string;
  status: string;
  trigger_count: number;
}

const Monitoring: React.FC = () => {
  const [data, setData] = useState<MonitorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadMonitors();
  }, []);

  const loadMonitors = () => {
    api.get('/monitors?limit=100')
      .then(res => {
        const items = (res.data || []).map((m: any) => ({
          monitor_id: m.monitor_id,
          monitor_name: m.monitor_name,
          monitor_type: m.monitor_type,
          portfolio_name: m.portfolio?.name || '-',
          threshold: m.threshold,
          operator: m.operator,
          status: m.status,
          trigger_count: m.trigger_count || 0,
        }));
        setData(items);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定删除该监控规则?')) return;
    try {
      await api.delete(`/monitors/${id}`);
      loadMonitors();
    } catch (e: any) {
      alert('删除失败: ' + (e.response?.data?.message || '未知错误'));
    }
  };

  const columns = [
    { title: '规则名称', dataIndex: 'monitor_name', key: 'monitor_name' },
    { title: '类型', dataIndex: 'monitor_type', key: 'monitor_type', render: (v: string) => <Tag>{v}</Tag> },
    { title: '组合', dataIndex: 'portfolio_name', key: 'portfolio_name' },
    { title: '阈值', dataIndex: 'threshold', key: 'threshold', render: (v: number, r: MonitorItem) => `${r.operator} ${(v * 100).toFixed(2)}%` },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'active' ? 'green' : 'default'}>{v}</Tag> },
    { title: '触发次数', dataIndex: 'trigger_count', key: 'trigger_count' },
    { title: '操作', key: 'action', render: (_: any, record: MonitorItem) => (
      <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record.monitor_id)}>删除</Button>
    )},
  ];

  const filtered = data.filter(d => d.monitor_name.includes(search) || d.portfolio_name.includes(search));

  return (
    <Layout>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input.Search placeholder="搜索监控规则" style={{ width: 300 }} value={search} onChange={e => setSearch(e.target.value)} />
        <Button type="primary">新增规则</Button>
      </div>
      <Table columns={columns} dataSource={filtered} loading={loading} rowKey="monitor_id" />
    </Layout>
  );
};

export default Monitoring;
