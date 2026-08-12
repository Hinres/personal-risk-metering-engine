import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Input } from 'antd';
import { PlayCircleOutlined, HistoryOutlined } from '@ant-design/icons';
import Layout from '../../components/Layout/Layout';
import api from '../../services/api';

interface StressItem {
  stress_id: string;
  scenario_name: string;
  portfolio_name: string;
  loss_amount: number;
  loss_percentage: number;
  test_date: string;
}

const StressTests: React.FC = () => {
  const [data, setData] = useState<StressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/stress/history?limit=100')
      .then(res => {
        const items = (res.data || []).map((s: any) => ({
          stress_id: s.stress_id,
          scenario_name: s.scenario_name,
          portfolio_name: s.portfolio?.name || '-',
          loss_amount: s.loss_amount,
          loss_percentage: s.loss_percentage,
          test_date: s.test_date?.split('T')[0] || '-',
        }));
        setData(items);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { title: '情景名称', dataIndex: 'scenario_name', key: 'scenario_name' },
    { title: '组合', dataIndex: 'portfolio_name', key: 'portfolio_name' },
    { title: '损失金额', dataIndex: 'loss_amount', key: 'loss_amount', render: (v: number) => `¥${v?.toLocaleString() || 0}` },
    { title: '损失比例', dataIndex: 'loss_percentage', key: 'loss_percentage', render: (v: number) => <Tag color="red">{(v * 100).toFixed(2)}%</Tag> },
    { title: '测试时间', dataIndex: 'test_date', key: 'test_date' },
  ];

  const filtered = data.filter(d => d.scenario_name.includes(search) || d.portfolio_name.includes(search));

  return (
    <Layout>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input.Search placeholder="搜索压力测试" style={{ width: 300 }} value={search} onChange={e => setSearch(e.target.value)} />
        <Button type="primary" icon={<PlayCircleOutlined />}>运行测试</Button>
      </div>
      <Table columns={columns} dataSource={filtered} loading={loading} rowKey="stress_id" />
    </Layout>
  );
};

export default StressTests;
