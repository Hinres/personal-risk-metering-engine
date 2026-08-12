import React from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined, UserOutlined, BarChartOutlined,
  SafetyOutlined, FileTextOutlined, SettingOutlined,
  LogoutOutlined, WalletOutlined, ShoppingOutlined,
  AlertOutlined, LineChartOutlined, BellOutlined,
  FundOutlined, ToolOutlined, QuestionCircleOutlined,
  AuditOutlined, CalculatorOutlined
} from '@ant-design/icons';

const { Sider } = Layout;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/users', icon: <UserOutlined />, label: '用户管理' },
  { key: '/portfolios', icon: <WalletOutlined />, label: '投资组合' },
  { key: '/var', icon: <LineChartOutlined />, label: 'VaR计算' },
  { key: '/stress-tests', icon: <SafetyOutlined />, label: '压力测试' },
  { key: '/monitoring', icon: <AlertOutlined />, label: '风险监控' },
  { key: '/alerts', icon: <BellOutlined />, label: '预警管理' },
  { key: '/analysis', icon: <BarChartOutlined />, label: '风险收益分析' },
  { key: '/optimization', icon: <FundOutlined />, label: '优化建议' },
  { key: '/var-calculator', icon: <CalculatorOutlined />, label: '独立计算器' },
  { key: '/reports', icon: <FileTextOutlined />, label: '报告中心' },
  { key: '/subscriptions', icon: <ShoppingOutlined />, label: '订阅管理' },
  { key: '/user-settings', icon: <ToolOutlined />, label: '用户设置' },
  { key: '/help', icon: <QuestionCircleOutlined />, label: '帮助教程' },
  { key: '/audit-logs', icon: <AuditOutlined />, label: '审计日志' },
  { key: '/system', icon: <SettingOutlined />, label: '系统设置' },
  { key: '/login', icon: <LogoutOutlined />, label: '退出登录' },
];

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  return (
    <Sider theme="dark" collapsible>
      <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
        风险计量引擎
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => {
          if (key === '/login') {
            localStorage.clear();
            navigate('/login');
          } else {
            navigate(key);
          }
        }}
      />
    </Sider>
  );
};

export default Sidebar;
