import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Input } from 'antd';
import { CrownOutlined, EditOutlined } from '@ant-design/icons';
import Layout from '../../components/Layout/Layout';
import api from '../../services/api';

interface SubscriptionItem {
  plan_id: string;
  plan_name: string;
  price: number;
  billing_cycle: string;
  features: string[];
  user_count: number;
  status: string;
}

const Subscriptions: React.FC = () => {
  const [data, setData] = useState<SubscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/system/plans')
      .then(res => {
        const items = (res.data?.plans || []).map((p: any) => ({
          plan_id: p.plan_id,
          plan_name: p.plan_name,
          price: p.price,
          billing_cycle: p.billing_cycle,
          features: p.features || [],
          user_count: p.user_count || 0,
          status: p.status || 'active',
        }));
        setData(items);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { title: '计划名称', dataIndex: 'plan_name', key: 'plan_name', render: (v: string) => (
      <Space><CrownOutlined /><span>{v}</span></Space>
    )},
    { title: '价格', dataIndex: 'price', key: 'price', render: (v: number, r: SubscriptionItem) => `¥${v}/${r.billing_cycle}` },
    { title: '用户数', dataIndex: 'user_count', key: 'user_count' },
    { title: '功能', dataIndex: 'features', key: 'features', render: (v: string[]) => (
      <Space wrap>{v.map((f, i) => <Tag key={i}>{f}</Tag>)}</Space>
    )},
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => (
      <Tag color={v === 'active' ? 'green' : 'red'}>{v}</Tag>
    )},
    { title: '操作', key: 'action', render: () => (
      <Button icon={<EditOutlined />} size="small">编辑</Button>
    )},
  ];

  return (
    <Layout>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input.Search placeholder="搜索订阅计划" style={{ width: 300 }} />
        <Button type="primary">新增计划</Button>
      </div>
      <Table columns={columns} dataSource={data} loading={loading} rowKey="plan_id" />
    </Layout>
  );
};

export default Subscriptions;
