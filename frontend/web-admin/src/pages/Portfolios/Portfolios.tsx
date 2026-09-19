import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Progress } from 'antd';
import { EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';
import api from '../../services/api';

interface PortfolioItem {
  portfolio_id: string;
  name: string;
  username: string;
  type: string;
  holding_count: number;
  total_value: number;
  risk_level: string;
}

const Portfolios: React.FC = () => {
  const [data, setData] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // V2-03：查看按钮改 SPA 导航（columns 依赖组件内 navigate，故定义在组件内）
  const columns = [
    { title: '组合名称', dataIndex: 'name', key: 'name' },
    { title: '用户', dataIndex: 'username', key: 'username' },
    { title: '类型', dataIndex: 'type', key: 'type', render: (type: string) => <Tag>{type}</Tag> },
    { title: '持仓数量', dataIndex: 'holding_count', key: 'holding_count' },
    { title: '总市值', dataIndex: 'total_value', key: 'total_value', render: (v: number) => `¥${v?.toLocaleString() || 0}` },
    { title: '风险等级', dataIndex: 'risk_level', key: 'risk_level', render: (level: string) => (
      <Tag color={level === 'low' ? 'green' : level === 'medium' ? 'orange' : 'red'}>{level}</Tag>
    )},
    { title: '操作', key: 'action', render: (_: any, record: PortfolioItem) => (
      <Button.Group>
        <Button icon={<EyeOutlined />} size="small" onClick={() => navigate(`/portfolios/${record.portfolio_id}`)}>查看</Button>
        <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
      </Button.Group>
    )},
  ];

  useEffect(() => {
    api.get('/portfolios?limit=100')
      .then(res => {
        const items = (res.data.portfolios || []).map((p: any) => ({
          portfolio_id: p.portfolio_id,
          name: p.name,
          username: p.user?.username || '-',
          type: p.type || 'personal',
          holding_count: p.holdings?.length || 0,
          total_value: p.statistics?.total_value || 0,
          risk_level: p.statistics?.risk_level || 'low',
        }));
        setData(items);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <Table columns={columns} dataSource={data} loading={loading} rowKey="portfolio_id" />
    </Layout>
  );
};

export default Portfolios;
