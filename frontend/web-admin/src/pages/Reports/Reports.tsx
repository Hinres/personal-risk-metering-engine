import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Input, DatePicker } from 'antd';
import { EyeOutlined, DownloadOutlined } from '@ant-design/icons';
import Layout from '../../components/Layout/Layout';
import api from '../../services/api';

interface ReportItem {
  report_id: string;
  report_type: string;
  portfolio_name: string;
  format: string;
  status: string;
  created_at: string;
}

const Reports: React.FC = () => {
  const [data, setData] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/reports?limit=100')
      .then(res => {
        const items = (res.data?.data || []).map((r: any) => ({
          report_id: r.report_id,
          report_type: r.report_type,
          portfolio_name: r.portfolio?.name || '-',
          format: r.format,
          status: r.status,
          created_at: r.created_at?.split('T')[0] || '-',
        }));
        setData(items);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { title: '报告类型', dataIndex: 'report_type', key: 'report_type', render: (v: string) => <Tag>{v}</Tag> },
    { title: '组合', dataIndex: 'portfolio_name', key: 'portfolio_name' },
    { title: '格式', dataIndex: 'format', key: 'format', render: (v: string) => <Tag color={v === 'pdf' ? 'blue' : 'green'}>{v.toUpperCase()}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'completed' ? 'green' : 'orange'}>{v}</Tag> },
    { title: '生成时间', dataIndex: 'created_at', key: 'created_at' },
    { title: '操作', key: 'action', render: (_: any, record: ReportItem) => (
      <Button icon={<DownloadOutlined />} size="small" onClick={() => handleDownload(record.report_id, record.format)}>下载</Button>
    )},
  ];

  const handleDownload = async (id: string, format: string) => {
    try {
      const res = await api.get(`/reports/${id}/export?format=${format}`);
      window.open(res.data?.download_url, '_blank');
    } catch (e: any) {
      alert('下载失败: ' + (e.response?.data?.message || '未知错误'));
    }
  };

  const filtered = data.filter(d => d.report_type.includes(search) || d.portfolio_name.includes(search));

  return (
    <Layout>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input.Search placeholder="搜索报告" style={{ width: 300 }} value={search} onChange={e => setSearch(e.target.value)} />
        <Button type="primary">生成报告</Button>
      </div>
      <Table columns={columns} dataSource={filtered} loading={loading} rowKey="report_id" />
    </Layout>
  );
};

export default Reports;
