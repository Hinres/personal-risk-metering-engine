import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Input, Space } from 'antd';
import { SearchOutlined, EditOutlined } from '@ant-design/icons';
import Layout from '../../components/Layout/Layout';
import api from '../../services/api';

interface UserItem {
  user_id: string;
  username: string;
  email: string;
  phone: string;
  plan: string;
  status: string;
  created_at: string;
}

const columns = [
  { title: '用户名', dataIndex: 'username', key: 'username' },
  { title: '邮箱', dataIndex: 'email', key: 'email' },
  { title: '手机号', dataIndex: 'phone', key: 'phone' },
  { title: '订阅计划', dataIndex: 'plan', key: 'plan', render: (plan: string) => (
    <Tag color={plan === 'enterprise' ? 'purple' : plan === 'professional' ? 'blue' : 'default'}>{plan}</Tag>
  )},
  { title: '状态', dataIndex: 'status', key: 'status', render: (status: string) => (
    <Tag color={status === 'active' ? 'green' : 'red'}>{status}</Tag>
  )},
  { title: '注册时间', dataIndex: 'created_at', key: 'created_at' },
  { title: '操作', key: 'action', render: () => (
    <Space>
      <Button type="link" icon={<EditOutlined />}>编辑</Button>
    </Space>
  )},
];

const Users: React.FC = () => {
  const [data, setData] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/users?limit=100')
      .then(res => {
        const items = (res.data.users || []).map((u: any) => ({
          user_id: u.user_id,
          username: u.username,
          email: u.email || '-',
          phone: u.phone || '-',
          plan: u.plan || 'free',
          status: u.status || 'active',
          created_at: u.created_at?.split('T')[0] || '-',
        }));
        setData(items);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input.Search placeholder="搜索用户" style={{ width: 300 }} />
        <Button type="primary">新增用户</Button>
      </div>
      <Table columns={columns} dataSource={data} loading={loading} rowKey="user_id" />
    </Layout>
  );
};

export default Users;
