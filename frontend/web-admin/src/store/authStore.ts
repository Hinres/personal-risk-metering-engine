import { create } from 'zustand';

interface AuthState {
  token: string | null;
  user: any | null;
  isAuthenticated: boolean;
  login: (token: string, user: any) => void;
  logout: () => void;
}

/**
 * 安全解析 localStorage JSON 数据
 * 防止存储的非法 JSON 导致应用崩溃
 */
const safeParse = (key: string): any => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch {
    console.warn(`[authStore] localStorage key "${key}" 包含非法 JSON，已清除`);
    localStorage.removeItem(key);
    return null;
  }
};

/**
 * ⚠️ 安全提示：当前使用 localStorage 存储 Token
 * 
 * 风险：Token 可能被 XSS 攻击窃取
 * 建议：生产环境应改为 httpOnly Cookie + CSRF Token 方案
 * 
 * 迁移步骤：
 * 1. 后端设置 httpOnly Cookie 存放 JWT
 * 2. 前端移除 localStorage 读写
 * 3. Axios 自动携带 Cookie（withCredentials: true）
 * 4. 增加 CSRF Token 防护
 */
export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  user: safeParse('user'),
  isAuthenticated: !!localStorage.getItem('token'),
  login: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null, isAuthenticated: false });
  },
}));