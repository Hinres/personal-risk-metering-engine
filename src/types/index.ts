/**
 * [PRME-INFRA-006] 基础设施
 * 文件: index.ts
 * 需求描述: 基础设施功能实现
 * 最后更新: 2026-06-09
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface VaRParams {
  confidence_level: number;
  time_horizon: number;
  method: 'historical' | 'parametric' | 'monte_carlo' | 'cornish_fisher';
}

export interface MonitorConfigParams {
  portfolio_id: string;
  monitor_name: string;
  monitor_type: string;
  threshold: number;
  operator: string;
  notification?: Record<string, any>;
  rules?: Record<string, any>;
}
