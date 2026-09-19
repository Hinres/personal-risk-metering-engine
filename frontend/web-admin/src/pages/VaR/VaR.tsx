import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Input, Select, Descriptions, Alert, Tabs } from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';
import Layout from '../../components/Layout/Layout';
import api from '../../services/api';

const { Option } = Select;

interface VaRItem {
  var_id: string;
  portfolio_name: string;
  calculation_type: string;
  confidence_level: number;
  time_horizon: number;
  var_value: number;
  var_percentage: number;
  calculated_at: string;
}

interface BacktestResult {
  portfolio_id: string;
  window_days: number;
  confidence_level: number;
  samples: number;
  exceedances: number;
  coverage: number;
  expected_frequency: number;
  kupiec: {
    lr_statistic: number | null;
    p_value: number | null;
    verdict: 'pass' | 'underestimate' | 'overestimate' | 'insufficient_data';
    message: string;
  };
  exceptions: Array<{ date: string; var_percentage: number; actual_return: number; loss_multiple: number }>;
}

const VERDICT_COLORS: Record<string, string> = {
  pass: 'success',
  underestimate: 'error',
  overestimate: 'warning',
  insufficient_data: 'default',
};

const VaRPage: React.FC = () => {
  const [data, setData] = useState<VaRItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // V2-04 回测 tab 状态
  const [portfolios, setPortfolios] = useState<Array<{ portfolio_id: string; name: string }>>([]);
  const [btPortfolioId, setBtPortfolioId] = useState<string>();
  const [btWindow, setBtWindow] = useState<number>(180);
  const [btLoading, setBtLoading] = useState(false);
  const [btResult, setBtResult] = useState<BacktestResult | null>(null);

  useEffect(() => {
    api.get('/var/history?limit=100')
      .then(res => {
        const items = (res.data || []).map((v: any) => ({
          var_id: v.var_id,
          portfolio_name: v.portfolio?.name || '-',
          calculation_type: v.calculation_type,
          confidence_level: v.confidence_level,
          time_horizon: v.time_horizon,
          var_value: v.var_value,
          var_percentage: v.var_percentage,
          calculated_at: v.calculated_at?.split('T')[0] || '-',
        }));
        setData(items);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));

    api.get('/portfolios?limit=100')
      .then(res => {
        const items = (res.data.portfolios || []).map((p: any) => ({ portfolio_id: p.portfolio_id, name: p.name }));
        setPortfolios(items);
        if (items.length > 0) setBtPortfolioId(items[0].portfolio_id);
      })
      .catch(() => setPortfolios([]));
  }, []);

  const runBacktest = () => {
    if (!btPortfolioId) return;
    setBtLoading(true);
    api.get('/var/backtest', { params: { portfolio_id: btPortfolioId, window_days: btWindow } })
      .then(res => setBtResult(res.data))
      .catch(() => setBtResult(null))
      .finally(() => setBtLoading(false));
  };

  const columns = [
    { title: '组合', dataIndex: 'portfolio_name', key: 'portfolio_name' },
    { title: '方法', dataIndex: 'calculation_type', key: 'calculation_type', render: (v: string) => <Tag>{v}</Tag> },
    { title: '置信度', dataIndex: 'confidence_level', key: 'confidence_level', render: (v: number) => `${(v * 100).toFixed(2)}%` },
    { title: '时间 horizon', dataIndex: 'time_horizon', key: 'time_horizon', render: (v: number) => `${v}天` },
    { title: 'VaR金额', dataIndex: 'var_value', key: 'var_value', render: (v: number) => `¥${v?.toLocaleString() || 0}` },
    { title: 'VaR比例', dataIndex: 'var_percentage', key: 'var_percentage', render: (v: number) => <Tag color="orange">{(v * 100).toFixed(2)}%</Tag> },
    { title: '计算时间', dataIndex: 'calculated_at', key: 'calculated_at' },
  ];

  const filtered = data.filter(d => d.portfolio_name.includes(search) || d.calculation_type.includes(search));

  const exceptionColumns = [
    { title: '日期', dataIndex: 'date', key: 'date' },
    { title: 'VaR%', dataIndex: 'var_percentage', key: 'var_percentage', render: (v: number) => `${(v * 100).toFixed(2)}%` },
    { title: '实际收益', dataIndex: 'actual_return', key: 'actual_return', render: (v: number) => <Tag color="red">{(v * 100).toFixed(2)}%</Tag> },
    { title: '损失倍数', dataIndex: 'loss_multiple', key: 'loss_multiple', render: (v: number) => <Tag color="volcano">{v}×</Tag> },
  ];

  return (
    <Layout>
      <Tabs defaultActiveKey="history">
        <Tabs.TabPane tab="VaR 记录" key="history">
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <Input.Search placeholder="搜索VaR记录" style={{ width: 300 }} value={search} onChange={e => setSearch(e.target.value)} />
            <Button type="primary" icon={<CalculatorOutlined />}>计算VaR</Button>
          </div>
          <Table columns={columns} dataSource={filtered} loading={loading} rowKey="var_id" />
        </Tabs.TabPane>

        {/* V2-04：VaR 回测（风险模型准确性验证） */}
        <Tabs.TabPane tab="回测" key="backtest">
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="回测验证的是风险模型的预测准确性（VaR 与实际损失对比），与组合收益回测（优化建议）不同。"
          />
          <Space style={{ marginBottom: 16 }}>
            <Select
              style={{ width: 240 }}
              placeholder="选择组合"
              value={btPortfolioId}
              onChange={setBtPortfolioId}
            >
              {portfolios.map(p => <Option key={p.portfolio_id} value={p.portfolio_id}>{p.name}</Option>)}
            </Select>
            <Select value={btWindow} onChange={setBtWindow} style={{ width: 140 }}>
              <Option value={90}>近 90 天</Option>
              <Option value={180}>近 180 天</Option>
              <Option value={365}>近 365 天</Option>
            </Select>
            <Button type="primary" loading={btLoading} onClick={runBacktest}>运行回测</Button>
          </Space>

          {btResult && (
            <>
              <Card style={{ marginBottom: 16, borderLeft: `4px solid ${btResult.kupiec.verdict === 'pass' ? '#52c41a' : btResult.kupiec.verdict === 'underestimate' ? '#f5222d' : btResult.kupiec.verdict === 'overestimate' ? '#faad14' : '#999'}` }}>
                <Descriptions column={4}>
                  <Descriptions.Item label="结论">
                    <Tag color={VERDICT_COLORS[btResult.kupiec.verdict]}>{btResult.kupiec.verdict}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="样本数">{btResult.samples}</Descriptions.Item>
                  <Descriptions.Item label="exceed 次数">{btResult.exceedances}</Descriptions.Item>
                  <Descriptions.Item label="置信水平">{(btResult.confidence_level * 100).toFixed(0)}%</Descriptions.Item>
                  <Descriptions.Item label="实际覆盖率">{`${(btResult.coverage * 100).toFixed(2)}%`}</Descriptions.Item>
                  <Descriptions.Item label="预期频率">{`${(btResult.expected_frequency * 100).toFixed(2)}%`}</Descriptions.Item>
                  {btResult.kupiec.lr_statistic !== null && (
                    <Descriptions.Item label="LR 统计量">{btResult.kupiec.lr_statistic}</Descriptions.Item>
                  )}
                  {btResult.kupiec.p_value !== null && (
                    <Descriptions.Item label="p 值">{btResult.kupiec.p_value}</Descriptions.Item>
                  )}
                </Descriptions>
                <Alert type={btResult.kupiec.verdict === 'pass' ? 'success' : btResult.kupiec.verdict === 'insufficient_data' ? 'info' : 'warning'} message={btResult.kupiec.message} style={{ marginTop: 8 }} />
              </Card>

              {btResult.exceptions.length > 0 && (
                <Card title={`异常值 Top ${btResult.exceptions.length}`}>
                  <Table
                    rowKey="date"
                    columns={exceptionColumns}
                    dataSource={btResult.exceptions}
                    pagination={false}
                    size="small"
                  />
                </Card>
              )}
            </>
          )}
        </Tabs.TabPane>
      </Tabs>
    </Layout>
  );
};

export default VaRPage;
