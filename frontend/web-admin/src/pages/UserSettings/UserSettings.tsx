import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Select, Button, message, Switch } from 'antd';
import Layout from '../../components/Layout/Layout';
import api from '../../services/api';

const UserSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

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
    </Layout>
  );
};

export default UserSettings;
