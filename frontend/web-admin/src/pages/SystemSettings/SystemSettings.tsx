import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Switch, Button, message, Tabs } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import Layout from '../../components/Layout/Layout';
import api from '../../services/api';

const SystemSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/system/config')
      .then(res => {
        const config = res.data?.config || {};
        form.setFieldsValue({
          app_name: config.app_name || '风险计量引擎',
          contact_email: config.contact_email || '',
          maintenance_mode: config.maintenance_mode || false,
          allow_registration: config.allow_registration !== false,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [form]);

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      await api.post('/system/config', values);
      message.success('设置已保存');
    } catch (e: any) {
      message.error('保存失败: ' + (e.response?.data?.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <Card title="系统设置" loading={loading}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="应用名称" name="app_name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="联系邮箱" name="contact_email" rules={[{ type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="维护模式" name="maintenance_mode" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="允许注册" name="allow_registration" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Layout>
  );
};

export default SystemSettings;
