import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Input, DatePicker } from 'antd';
import { CalculatorOutlined, EyeOutlined } from '@ant-design/icons';
import Layout from '../../components/Layout/Layout';
import api from '../../services/api';

interface VaRItem {
  var_id: string;
  portfolio_name: string;
  calculation_type: string;
  confidence_level: number;
  time_horizon: number;
  var_value: number;
  var_percentage: number;
  calculated_at: string;
}

const VaRPage: React.FC = () => {
  const [data, setData] = useState<VaRItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/var/history?limit=100')
      .then(res => {
        const items = (res.data || []).map((v: any) => ({
          var_id: v.var_id,
          portfolio_name: v.portfolio?.name || '-',
          calculation_type: v.calculation_type,
          confidence_level: v.confidence_level,
          time_horizon: v.time_horizon,
          var_value: v.var_value,
          var_percentage: v.var_percentage,
          calculated_at: v.calculated_at?.split('T')[0] || '-',
        }));
        setData(items);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { title: '组合', dataIndex: 'portfolio_name', key: 'portfolio_name' },
    { title: '方法', dataIndex: 'calculation_type', key: 'calculation_type', render: (v: string) => <Tag>{v}</Tag> },
    { title: '置信度', dataIndex: 'confidence_level', key: 'confidence_level', render: (v: number) => `${(v * 100).toFixed(2)}%` },
    { title: '时间 horizon', dataIndex: 'time_horizon', key: 'time_horizon', render: (v: number) => `${v}天` },
    { title: 'VaR金额', dataIndex: 'var_value', key: 'var_value', render: (v: number) => `¥${v?.toLocaleString() || 0}` },
    { title: 'VaR比例', dataIndex: 'var_percentage', key: 'var_percentage', render: (v: number) => <Tag color="orange">{(v * 100).toFixed(2)}%</Tag> },
    { title: '计算时间', dataIndex: 'calculated_at', key: 'calculated_at' },
  ];

  const filtered = data.filter(d => d.portfolio_name.includes(search) || d.calculation_type.includes(search));

  return (
    <Layout>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input.Search placeholder="搜索VaR记录" style={{ width: 300 }} value={search} onChange={e => setSearch(e.target.value)} />
        <Button type="primary" icon={<CalculatorOutlined />}>计算VaR</Button>
      </div>
      <Table columns={columns} dataSource={filtered} loading={loading} rowKey="var_id" />
    </Layout>
  );
};

export default VaRPage;
