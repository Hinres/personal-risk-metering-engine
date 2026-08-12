import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Select } from 'antd';
import Layout from '../../components/Layout/Layout';
import api from '../../services/api';

interface AnalysisItem {
  portfolio_id: string;
  portfolio_name: string;
  total_value: number;
  total_return: number;
  volatility: number;
  sharpe_ratio: number;
  max_drawdown: number;
  var_95: number;
}

const Analysis: React.FC = () => {
  const [data, setData] = useState<AnalysisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('1y');

  useEffect(() => {
    loadAnalysis();
  }, [period]);

  const loadAnalysis = () => {
    api.get(`/portfolios/analysis?period=${period}`)
      .then(res => {
        const items = (res.data || []).map((p: any) => ({
          portfolio_id: p.portfolio_id,
          portfolio_name: p.name,
          total_value: p.total_value || 0,
          total_return: p.total_return || 0,
          volatility: p.volatility || 0,
          sharpe_ratio: p.sharpe_ratio || 0,
          max_drawdown: p.max_drawdown || 0,
          var_95: p.var_95 || 0,
        }));
        setData(items);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  };

  const columns = [
    { title: '组合名称', dataIndex: 'portfolio_name', key: 'portfolio_name' },
    { title: '总市值', dataIndex: 'total_value', key: 'total_value', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '总收益', dataIndex: 'total_return', key: 'total_return', render: (v: number) => <Tag color={v >= 0 ? 'green' : 'red'}>{(v * 100).toFixed(2)}%</Tag> },
    { title: '波动率', dataIndex: 'volatility', key: 'volatility', render: (v: number) => `${(v * 100).toFixed(2)}%` },
    { title: '夏普比率', dataIndex: 'sharpe_ratio', key: 'sharpe_ratio', render: (v: number) => v.toFixed(2) },
    { title: '最大回撤', dataIndex: 'max_drawdown', key: 'max_drawdown', render: (v: number) => <Tag color="red">${(v * 100).toFixed(2)}%</Tag> },
    { title: 'VaR (95%)', dataIndex: 'var_95', key: 'var_95', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '操作', key: 'action', render: (_: any, record: AnalysisItem) => (
      <Button size="small" onClick={() => window.location.href = `/portfolios/${record.portfolio_id}`}>详情</Button>
    )},
  ];

  return (
    <Layout>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Select value={period} onChange={setPeriod} style={{ width: 120 }}>
          <Select.Option value="1m">近1月</Select.Option>
          <Select.Option value="3m">近3月</Select.Option>
          <Select.Option value="6m">近6月</Select.Option>
          <Select.Option value="1y">近1年</Select.Option>
          <Select.Option value="2y">近2年</Select.Option>
        </Select>
        <Button type="primary">导出报告</Button>
      </div>
      <Table columns={columns} dataSource={data} loading={loading} rowKey="portfolio_id" />
    </Layout>
  );
};

export default Analysis;
