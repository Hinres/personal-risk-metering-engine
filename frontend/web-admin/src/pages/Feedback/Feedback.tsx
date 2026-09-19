import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Tag, Modal, Input, Select, message } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import Layout from '../../components/Layout/Layout';
import api from '../../services/api';

const { TextArea } = Input;
const { Option } = Select;

interface FeedbackItem {
  feedback_id: string;
  user_id: string;
  username: string | null;
  type: 'feedback' | 'question' | 'suggestion' | 'rating';
  content: string;
  rating: number | null;
  status: 'new' | 'replied' | 'closed';
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  feedback: '反馈收集',
  question: '问题解答',
  suggestion: '改进建议',
  rating: '用户评价',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'orange',
  replied: 'green',
  closed: 'default',
};

const Feedback: React.FC = () => {
  const [data, setData] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [replyTarget, setReplyTarget] = useState<FeedbackItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState<'replied' | 'closed'>('replied');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadFeedbacks(page, statusFilter, typeFilter);
  }, [page, statusFilter, typeFilter]);

  const loadFeedbacks = (p: number, status?: string, type?: string) => {
    setLoading(true);
    const params: any = { page: p, pageSize: 20 };
    if (status) params.status = status;
    if (type) params.type = type;
    api.get('/admin/feedbacks', { params })
      .then(res => {
        const d = res.data || {};
        setData(d.items || []);
        setTotal(d.total || 0);
      })
      .catch(() => {
        setData([]);
        message.error('加载反馈列表失败');
      })
      .finally(() => setLoading(false));
  };

  const openReply = (record: FeedbackItem) => {
    setReplyTarget(record);
    setReplyText(record.admin_reply || '');
    setReplyStatus('replied');
  };

  const submitReply = async () => {
    if (!replyTarget) return;
    if (replyStatus === 'replied' && !replyText.trim()) {
      message.warning('回复内容不能为空');
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/admin/feedbacks/${replyTarget.feedback_id}/reply`, {
        admin_reply: replyText.trim() || undefined,
        status: replyStatus,
      });
      message.success('操作成功');
      setReplyTarget(null);
      loadFeedbacks(page, statusFilter, typeFilter);
    } catch (e: any) {
      message.error('操作失败: ' + (e.response?.data?.message || '未知错误'));
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (v: string) => <Tag>{TYPE_LABELS[v] || v}</Tag>,
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (v: string | null) => v || '-',
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
    },
    {
      title: '评分',
      dataIndex: 'rating',
      key: 'rating',
      width: 80,
      render: (v: number | null) => (v ? `★${v}` : '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: string) => <Tag color={STATUS_COLORS[v]}>{v}</Tag>,
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (v: string) => (v ? new Date(v).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: FeedbackItem) => (
        <Button icon={<MessageOutlined />} size="small" onClick={() => openReply(record)}>
          回复
        </Button>
      ),
    },
  ];

  return (
    <Layout>
      <Card
        title="反馈管理"
        extra={
          <Space>
            <Select
              allowClear
              placeholder="状态筛选"
              style={{ width: 120 }}
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1); }}
            >
              <Option value="new">new</Option>
              <Option value="replied">replied</Option>
              <Option value="closed">closed</Option>
            </Select>
            <Select
              allowClear
              placeholder="类型筛选"
              style={{ width: 120 }}
              value={typeFilter}
              onChange={(v) => { setTypeFilter(v); setPage(1); }}
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <Option key={value} value={value}>{label}</Option>
              ))}
            </Select>
          </Space>
        }
      >
        <Table
          rowKey="feedback_id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Card>

      <Modal
        title={replyTarget ? `回复反馈（${TYPE_LABELS[replyTarget.type] || replyTarget.type}）` : ''}
        open={!!replyTarget}
        onOk={submitReply}
        onCancel={() => setReplyTarget(null)}
        confirmLoading={submitting}
        okText="提交"
        cancelText="取消"
      >
        {replyTarget && (
          <>
            <div style={{ marginBottom: 12, color: '#666' }}>
              <div><strong>{replyTarget.username || '匿名用户'}</strong>：{replyTarget.content}</div>
              {replyTarget.rating && <div>评分：★{replyTarget.rating}</div>}
            </div>
            <TextArea
              rows={4}
              placeholder="回复内容（状态选择 replied 时必填）"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <Select
              value={replyStatus}
              onChange={(v) => setReplyStatus(v)}
              style={{ width: '100%' }}
            >
              <Option value="replied">回复用户（replied）</Option>
              <Option value="closed">直接关闭（closed）</Option>
            </Select>
          </>
        )}
      </Modal>
    </Layout>
  );
};

export default Feedback;
