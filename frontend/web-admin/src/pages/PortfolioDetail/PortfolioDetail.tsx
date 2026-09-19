import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Descriptions, Spin, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';
import api from '../../services/api';

interface HoldingItem {
  holding_id: string;
  symbol: string;
  name: string | null;
  quantity: number;
  cost_price: number;
  current_price: number | null;
  market_value: number | null;
  weight: number | null;
  sector: string | null;
  purchase_date: string | null;
  status: string;
}

interface PortfolioDetail {
  portfolio_id: string;
  name: string;
  username: string;
  type: string;
  total_value: number;
  risk_level: string;
  holdings: HoldingItem[];
}

/** purchase_date 兼容 Date 序列化（ISO 带时间）与 YYYY-MM-DD 字符串 */
const formatPurchaseDate = (v: any): string => {
  if (!v) return '-';
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
};

const PortfolioDetailPage: React.FC = () => {
  const { portfolioId } = useParams<{ portfolioId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<PortfolioDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // V2-03：管理后台 admin 视角——GET /portfolios 列表内嵌 holdings 与 statistics。
    // （GET /portfolios/:id/holdings 为属主校验，管理端跨用户查看会被 403，故用内嵌模式）
    api.get('/portfolios?limit=100')
      .then(res => {
        const list = res.data.portfolios || [];
        const target = list.find((p: any) => p.portfolio_id === portfolioId);
        if (!target) {
          setError('组合不存在或无权限查看');
          return;
        }
        setDetail({
          portfolio_id: target.portfolio_id,
          name: target.name,
          username: target.user?.username || '-',
          type: target.type || 'personal',
          total_value: target.statistics?.total_value || 0,
          risk_level: target.statistics?.risk_level || 'low',
          holdings: (target.holdings || []).map((h: any) => ({
            holding_id: h.holding_id,
            symbol: h.symbol,
            name: h.name,
            quantity: h.quantity,
            cost_price: h.cost_price,
            current_price: h.current_price,
            market_value: h.market_value,
            weight: h.weight,
            sector: h.sector,
            purchase_date: h.purchase_date || h.metadata?.purchase_date || null,
            status: h.status || 'active',
          })),
        });
      })
      .catch(() => setError('加载组合详情失败'))
      .finally(() => setLoading(false));
  }, [portfolioId]);

  const columns = [
    { title: '代码', dataIndex: 'symbol', key: 'symbol', render: (v: string) => <Tag>{v}</Tag> },
    { title: '名称', dataIndex: 'name', key: 'name', render: (v: string | null) => v || '-' },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', align: 'right' as const },
    { title: '成本价', dataIndex: 'cost_price', key: 'cost_price', align: 'right' as const, render: (v: number) => `¥${Number(v).toFixed(2)}` },
    { title: '现价', dataIndex: 'current_price', key: 'current_price', align: 'right' as const, render: (v: number | null) => (v ? `¥${Number(v).toFixed(2)}` : '-') },
    { title: '市值', dataIndex: 'market_value', key: 'market_value', align: 'right' as const, render: (v: number | null) => (v ? `¥${Number(v).toLocaleString()}` : '-') },
    { title: '权重', dataIndex: 'weight', key: 'weight', align: 'right' as const, render: (v: number | null) => (v !== null && v !== undefined ? `${(Number(v) * 100).toFixed(2)}%` : '-') },
    { title: '行业', dataIndex: 'sector', key: 'sector', render: (v: string | null) => v || '-' },
    // V2-03 核心列：买入日期（F-01 后端已统一序列化，null 显示 -）
    { title: '买入日期', dataIndex: 'purchase_date', key: 'purchase_date', render: formatPurchaseDate },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'active' ? 'green' : 'default'}>{v}</Tag> },
  ];

  return (
    <Layout>
      <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }} onClick={() => navigate('/portfolios')}>
        返回列表
      </Button>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : error ? (
        <Card>{error}</Card>
      ) : detail ? (
        <>
          <Card title="组合信息" style={{ marginBottom: 16 }}>
            <Descriptions column={4}>
              <Descriptions.Item label="名称">{detail.name}</Descriptions.Item>
              <Descriptions.Item label="用户">{detail.username}</Descriptions.Item>
              <Descriptions.Item label="类型">{detail.type}</Descriptions.Item>
              <Descriptions.Item label="总市值">¥{detail.total_value.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="风险等级">
                <Tag color={detail.risk_level === 'low' ? 'green' : detail.risk_level === 'medium' ? 'orange' : 'red'}>{detail.risk_level}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="持仓数">{detail.holdings.length}</Descriptions.Item>
            </Descriptions>
          </Card>
          <Card title="持仓明细">
            <Table
              rowKey="holding_id"
              columns={columns}
              dataSource={detail.holdings}
              pagination={false}
            />
          </Card>
        </>
      ) : null}
    </Layout>
  );
};

export default PortfolioDetailPage;
