import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';

const Login = React.lazy(() => import('./pages/Login/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard/Dashboard'));
const Users = React.lazy(() => import('./pages/Users/Users'));
const Portfolios = React.lazy(() => import('./pages/Portfolios/Portfolios'));
const VaRPage = React.lazy(() => import('./pages/VaR/VaR'));
const StressTests = React.lazy(() => import('./pages/StressTests/StressTests'));
const Monitoring = React.lazy(() => import('./pages/Monitoring/Monitoring'));
const Reports = React.lazy(() => import('./pages/Reports/Reports'));
const Subscriptions = React.lazy(() => import('./pages/Subscriptions/Subscriptions'));
const SystemSettings = React.lazy(() => import('./pages/SystemSettings/SystemSettings'));

// P1-2: 新增页面
const Alerts = React.lazy(() => import('./pages/Alerts/Alerts'));
const Analysis = React.lazy(() => import('./pages/Analysis/Analysis'));
const Optimization = React.lazy(() => import('./pages/Optimization/Optimization'));
const VarCalculator = React.lazy(() => import('./pages/VarCalculator/VarCalculator'));
const UserSettings = React.lazy(() => import('./pages/UserSettings/UserSettings'));
const Help = React.lazy(() => import('./pages/Help/Help'));
const AuditLogs = React.lazy(() => import('./pages/AuditLogs/AuditLogs'));
const Feedback = React.lazy(() => import('./pages/Feedback/Feedback'));
const PortfolioDetailPage = React.lazy(() => import('./pages/PortfolioDetail/PortfolioDetail'));

const LoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <Spin size="large" tip="加载中..." />
  </div>
);

/**
 * 验证 Token 是否有效
 * 检查 JWT 格式和过期时间（客户端侧预检）
 * 注意：最终有效性由后端验证，此处仅提升用户体验
 */
const isTokenValid = (token: string | null): boolean => {
  if (!token) return false;
  
  try {
    // JWT 格式：header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    // 解码 payload 检查过期时间
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
};

const PrivateRoute: React.FC<{ element: React.ReactNode }> = ({ element }) => {
  const token = localStorage.getItem('token');
  
  if (!isTokenValid(token)) {
    // Token 无效或过期，清除存储并跳转登录
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return <Navigate to="/login" replace />;
  }
  
  return <>{element}</>;
};

const App: React.FC = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute element={<Dashboard />} />} />
        <Route path="/dashboard" element={<PrivateRoute element={<Dashboard />} />} />
        <Route path="/users" element={<PrivateRoute element={<Users />} />} />
        <Route path="/portfolios" element={<PrivateRoute element={<Portfolios />} />} />
        <Route path="/portfolios/:portfolioId" element={<PrivateRoute element={<PortfolioDetailPage />} />} />
        <Route path="/var" element={<PrivateRoute element={<VaRPage />} />} />
        <Route path="/stress-tests" element={<PrivateRoute element={<StressTests />} />} />
        <Route path="/monitoring" element={<PrivateRoute element={<Monitoring />} />} />
        <Route path="/alerts" element={<PrivateRoute element={<Alerts />} />} />
        <Route path="/analysis" element={<PrivateRoute element={<Analysis />} />} />
        <Route path="/optimization" element={<PrivateRoute element={<Optimization />} />} />
        <Route path="/var-calculator" element={<PrivateRoute element={<VarCalculator />} />} />
        <Route path="/user-settings" element={<PrivateRoute element={<UserSettings />} />} />
        <Route path="/help" element={<PrivateRoute element={<Help />} />} />
        <Route path="/feedbacks" element={<PrivateRoute element={<Feedback />} />} />
        <Route path="/audit-logs" element={<PrivateRoute element={<AuditLogs />} />} />
        <Route path="/reports" element={<PrivateRoute element={<Reports />} />} />
        <Route path="/subscriptions" element={<PrivateRoute element={<Subscriptions />} />} />
        <Route path="/system" element={<PrivateRoute element={<SystemSettings />} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default App;
