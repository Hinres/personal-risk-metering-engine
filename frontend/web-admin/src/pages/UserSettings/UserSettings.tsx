import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Select, Button, message, Switch, Table, Tag } from 'antd';
import Layout from '../../components/Layout/Layout';
import api from '../../services/api';

interface SettingHistoryItem {
  log_id: string;
  user_id: string | null;
  operation_type: string;
  resource_type: string;
  details: any;
  created_at: string;
}

const UserSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // V2-05：设置变更历史
  const [history, setHistory] = useState<SettingHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    loadSettings();
    loadHistory();
  }, []);

  const loadHistory = () => {
    setHistoryLoading(true);
    api.get('/audit-logs', { params: { resource_type: 'user_setting', limit: 50 } })
      .then(res => setHistory(res.data?.logs || res.data || []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  };

  const loadSettings = () => {
    api.get('/users/preferences')
      .then(res => {
        form.setFieldsValue(res.data || {});
      })
      .catch(() => {});
  };

  const handleSave = async (values: any) => {
    setLoading(true);
    try {
      await api.put('/users/preferences', values);
      message.success('设置已保存');
    } catch (e: any) {
      message.error('保存失败: ' + (e.response?.data?.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <Card title="用户设置" bordered={false} style={{ maxWidth: 600 }}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item label="风险承受能力" name="risk_tolerance" initialValue="moderate">
            <Select>
              <Select.Option value="conservative">保守型</Select.Option>
              <Select.Option value="moderate">稳健型</Select.Option>
              <Select.Option value="aggressive">激进型</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="默认置信度" name="default_confidence" initialValue={0.95}>
            <Select>
              <Select.Option value={0.90}>90%</Select.Option>
              <Select.Option value={0.95}>95%</Select.Option>
              <Select.Option value={0.99}>99%</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="默认时间周期 (天)" name="default_horizon" initialValue={1}>
            <Input type="number" />
          </Form.Item>
          <Form.Item label="通知渠道" name="notification_channels" initialValue={['app']}>
            <Select mode="multiple">
              <Select.Option value="app">App 推送</Select.Option>
              <Select.Option value="email">邮件</Select.Option>
              <Select.Option value="sms">短信</Select.Option>
              <Select.Option value="wechat">微信</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="开启预警" name="alert_enabled" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>保存设置</Button>
          </Form.Item>
        </Form>
      </Card>

      {/* V2-05：设置变更历史（audit resource_type='user_setting'） */}
      <Card title="设置变更历史" bordered={false} style={{ maxWidth: 600, marginTop: 16 }}>
        <Table
          rowKey="log_id"
          size="small"
          loading={historyLoading}
          dataSource={history}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 180,
              render: (v: string) => (v ? new Date(v).toLocaleString('zh-CN') : '-') },
            { title: '用户', dataIndex: 'user_id', key: 'user_id', width: 100,
              render: (v: string | null) => (v ? v.substring(0, 8) + '…' : '-') },
            { title: '设置项', key: 'key', width: 110,
              render: (_: any, r: SettingHistoryItem) => (
                <Tag>{(r.details?.key === 'consent' ? `consent:${r.details?.consent_type}` : r.details?.key) || '-'}</Tag>
              ) },
            { title: '动作', key: 'action', width: 100,
              render: (_: any, r: SettingHistoryItem) => (
                <Tag color={r.details?.action === 'revoked' ? 'orange' : 'blue'}>
                  {r.details?.action || r.operation_type}
                </Tag>
              ) },
            { title: '明细', key: 'details', ellipsis: true,
              render: (_: any, r: SettingHistoryItem) => (
                <span style={{ fontSize: 12, color: '#666' }}>{JSON.stringify(r.details)}</span>
              ) },
          ]}
        />
      </Card>
    </Layout>
  );
};

export default UserSettings;
