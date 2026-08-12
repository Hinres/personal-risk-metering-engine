import React, { useState } from 'react';
import { Card, Form, Input, Select, Button, Row, Col, message, Tag } from 'antd';
import Layout from '../../components/Layout/Layout';
import api from '../../services/api';

const VarCalculator: React.FC = () => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleCalculate = async (values: any) => {
    setLoading(true);
    try {
      const res = await api.post('/tools/calculate', {
        holdings: values.holdings.split(',').map((s: string) => {
          const [symbol, quantity] = s.trim().split(':');
          return { symbol, quantity: Number(quantity) };
        }),
        confidence_level: Number(values.confidence),
        time_horizon: Number(values.horizon),
        method: values.method,
      });
      setResult(res.data);
      message.success('计算完成');
    } catch (e: any) {
      message.error('计算失败: ' + (e.response?.data?.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <Row gutter={24}>
        <Col span={12}>
          <Card title="VaR 独立计算器" bordered={false}>
            <Form layout="vertical" onFinish={handleCalculate}>
              <Form.Item label="持仓 (格式: 股票代码:数量, 逗号分隔)" name="holdings" rules={[{ required: true }]}>
                <Input.TextArea rows={3} placeholder="例如: 000001.SZ:100, 600000.SH:200" />
              </Form.Item>
              <Form.Item label="置信度" name="confidence" initialValue={0.95}>
                <Select>
                  <Select.Option value={0.90}>90%</Select.Option>
                  <Select.Option value={0.95}>95%</Select.Option>
                  <Select.Option value={0.99}>99%</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item label="时间周期 (天)" name="horizon" initialValue={1}>
                <Select>
                  <Select.Option value={1}>1天</Select.Option>
                  <Select.Option value={7}>7天</Select.Option>
                  <Select.Option value={30}>30天</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item label="计算方法" name="method" initialValue="historical">
                <Select>
                  <Select.Option value="historical">历史模拟法</Select.Option>
                  <Select.Option value="parametric">参数法</Select.Option>
                  <Select.Option value="monte_carlo">蒙特卡洛模拟</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block>计算 VaR</Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
        <Col span={12}>
          {result && (
            <Card title="计算结果" bordered={false}>
              <p><strong>VaR 值:</strong> ¥{result.var_value?.toFixed(2)}</p>
              <p><strong>VaR 百分比:</strong> {(result.var_percentage * 100).toFixed(2)}%</p>
              <p><strong>预期收益:</strong> {result.expected_return}</p>
              <p><strong>波动率:</strong> {result.volatility}</p>
              <p><strong>计算方法:</strong> {result.method}</p>
              {result.is_fallback && <p><Tag color="orange">降级计算</Tag></p>}
            </Card>
          )}
        </Col>
      </Row>
    </Layout>
  );
};

export default VarCalculator;
