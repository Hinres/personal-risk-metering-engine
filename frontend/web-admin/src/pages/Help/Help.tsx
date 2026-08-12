import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Input, Tag } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import Layout from '../../components/Layout/Layout';
import api from '../../services/api';

interface HelpItem {
  content_id: string;
  topic: string;
  title: string;
  content_type: string;
  status: string;
  created_at: string;
}

const Help: React.FC = () => {
  const [data, setData] = useState<HelpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadHelpContent();
  }, []);

  const loadHelpContent = () => {
    api.get('/help?limit=100')
      .then(res => {
        const items = (res.data || []).map((h: any) => ({
          content_id: h.content_id,
          topic: h.topic,
          title: h.title,
          content_type: h.content_type,
          status: h.status,
          created_at: h.created_at,
        }));
        setData(items);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定删除该帮助内容?')) return;
    try {
      await api.delete(`/help/${id}`);
      loadHelpContent();
    } catch (e: any) {
      alert('删除失败: ' + (e.response?.data?.message || '未知错误'));
    }
  };

  const columns = [
    { title: '主题', dataIndex: 'topic', key: 'topic', render: (v: string) => <Tag>{v}</Tag> },
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '类型', dataIndex: 'content_type', key: 'content_type' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'published' ? 'green' : 'default'}>{v}</Tag> },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
    { title: '操作', key: 'action', render: (_: any, record: HelpItem) => (
      <Space>
        <Button icon={<EditOutlined />} size="small">编辑</Button>
        <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record.content_id)}>删除</Button>
      </Space>
    )},
  ];

  const filtered = data.filter(d => d.title.includes(search) || d.topic.includes(search));

  return (
    <Layout>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input.Search placeholder="搜索帮助内容" style={{ width: 300 }} value={search} onChange={e => setSearch(e.target.value)} />
        <Button type="primary">新增内容</Button>
      </div>
      <Table columns={columns} dataSource={filtered} loading={loading} rowKey="content_id" />
    </Layout>
  );
};

export default Help;
