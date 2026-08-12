import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, WarningOutlined, TeamOutlined, WalletOutlined, SafetyOutlined, FileTextOutlined } from '@ant-design/icons';
import Layout from '../../components/Layout/Layout';
import api from '../../services/api';

interface DashboardStats {
  total_users: number;
  total_portfolios: number;
  active_monitors: number;
  today_alerts: number;
}

interface AlertItem {
  alert_id: string;
  created_at: string;
  portfolio_name: string;
  alert_type: string;
  severity: string;
  message: string;
}

const alertColumns = [
  { title: '时间', dataIndex: 'created_at', key: 'created_at' },
  { title: '组合', dataIndex: 'portfolio_name', key: 'portfolio_name' },
  { title: '类型', dataIndex: 'alert_type', key: 'alert_type' },
  { title: '严重程度', dataIndex: 'severity', key: 'severity', render: (s: string) => (
    <Tag color={s === 'critical' ? 'red' : s === 'high' ? 'orange' : 'yellow'}>{s}</Tag>
  )},
  { title: '描述', dataIndex: 'message', key: 'message' },
];

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [statsRes, alertsRes] = await Promise.all([
          api.get('/admin/dashboard').catch(() => null),
          api.get('/alerts/recent?limit=5').catch(() => null),
        ]);
        if (statsRes?.data) setStats(statsRes.data);
        if (alertsRes?.data) setAlerts(alertsRes.data.alerts || []);
      } catch {
        // fallback: keep empty
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const statItems = stats ? [
    { title: '总用户数', value: stats.total_users, icon: <TeamOutlined />, color: '#1890ff' },
    { title: '投资组合数', value: stats.total_portfolios, icon: <WalletOutlined />, color: '#52c41a' },
    { title: '活跃监控', value: stats.active_monitors, icon: <SafetyOutlined />, color: '#faad14' },
    { title: '今日预警', value: stats.today_alerts, icon: <WarningOutlined />, color: '#ff4d4f' },
  ] : [];

  return (
    <Layout>
      <Row gutter={[16, 16]}>
        {statItems.map((stat, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card loading={loading}>
              <Statistic
                title={stat.title}
                value={stat.value}
                prefix={stat.icon}
                valueStyle={{ color: stat.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>
      <Card title="最新预警" style={{ marginTop: 16 }} loading={loading} extra={<a href="/monitoring">查看全部</a>}>
        <Table columns={alertColumns} dataSource={alerts} pagination={false} size="small" />
      </Card>
    </Layout>
  );
};

export default Dashboard;
