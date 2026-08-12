import React from 'react';
import { Layout, Badge, Avatar, Dropdown } from 'antd';
import { BellOutlined, UserOutlined } from '@ant-design/icons';

const { Header: AntHeader } = Layout;

const Header: React.FC = () => {
  const user = (() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  })();
  
  return (
    <AntHeader style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
      <Badge count={5} size="small">
        <BellOutlined style={{ fontSize: 20, marginRight: 24, cursor: 'pointer' }} />
      </Badge>
      <Dropdown menu={{ items: [{ key: 'profile', label: '个人资料' }, { key: 'logout', label: '退出登录' }] }}>
        <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar icon={<UserOutlined />} />
          <span>{user?.username || '管理员'}</span>
        </span>
      </Dropdown>
    </AntHeader>
  );
};

export default Header;
