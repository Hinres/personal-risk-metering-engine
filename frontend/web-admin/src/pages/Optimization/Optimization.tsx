import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Input } from 'antd';
import Layout from '../../components/Layout/Layout';
import api from '../../services/api';

interface OptimizationItem {
  optimization_id: string;
  portfolio_name: string;
  optimization_type: string;
  risk_tolerance: string;
  expected_return: string;
  expected_risk: string;
  status: string;
  created_at: string;
}

const Optimization: React.FC = () => {
  const [data, setData] = useState<OptimizationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadOptimizations();
  }, []);

  const loadOptimizations = () => {
    api.get('/optimization?limit=100')
      .then(res => {
        const items = (res.data || []).map((o: any) => ({
          optimization_id: o.optimization_id,
          portfolio_name: o.portfolio?.name || '-',
          optimization_type: o.optimization_type,
          risk_tolerance: o.risk_tolerance,
          expected_return: o.expected_return,
          expected_risk: o.expected_risk,
          status: o.status,
          created_at: o.created_at,
        }));
        setData(items);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  };

  const columns = [
    { title: '组合', dataIndex: 'portfolio_name', key: 'portfolio_name' },
    { title: '优化类型', dataIndex: 'optimization_type', key: 'optimization_type', render: (v: string) => <Tag>{v}</Tag> },
    { title: '风险偏好', dataIndex: 'risk_tolerance', key: 'risk_tolerance', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '预期收益', dataIndex: 'expected_return', key: 'expected_return' },
    { title: '预期风险', dataIndex: 'expected_risk', key: 'expected_risk' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'completed' ? 'green' : 'blue'}>{v}</Tag> },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
    { title: '操作', key: 'action', render: (_: any, record: OptimizationItem) => (
      <Button size="small">查看</Button>
    )},
  ];

  const filtered = data.filter(d => d.portfolio_name.includes(search) || d.optimization_type.includes(search));

  return (
    <Layout>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input.Search placeholder="搜索优化记录" style={{ width: 300 }} value={search} onChange={e => setSearch(e.target.value)} />
        <Button type="primary">新建优化</Button>
      </div>
      <Table columns={columns} dataSource={filtered} loading={loading} rowKey="optimization_id" />
    </Layout>
  );
};

export default Optimization;
