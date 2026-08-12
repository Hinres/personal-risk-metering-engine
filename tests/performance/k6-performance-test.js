import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// ==================== K6 性能测试脚本 ====================
// 使用方式: k6 run --vus 100 --duration 30s performance-test.js
// 或者: k6 run --stages "10s:10, 30s:100, 20s:200, 10s:0" performance-test.js

const errorRate = new Rate('errors');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '10s', target: 50 },   //  ramp up
    { duration: '30s', target: 200 },  //  sustain 200 VUs
    { duration: '10s', target: 0 },   //  ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000', 'p(99)<5000'], // 95% < 3s, 99% < 5s
    http_req_failed: ['rate<0.01'], // 错误率 < 1%
    errors: ['rate<0.05'], // 业务错误率 < 5%
  },
};

export function setup() {
  // 登录获取 token
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
    username: 'testuser',
    password: 'Password123!',
  }), { headers: { 'Content-Type': 'application/json' } });

  check(loginRes, {
    'login success': (r) => r.status === 200 && r.json('success') === true,
  });

  return { token: loginRes.json('data.token') };
}

export default function (data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // 1. Health check (高频)
  {
    const res = http.get(`${BASE_URL}/health`);
    const passed = check(res, {
      'health status 200': (r) => r.status === 200,
      'health ok': (r) => r.json('status') === 'ok',
    });
    errorRate.add(!passed);
  }

  sleep(1);

  // 2. 获取组合列表
  {
    const res = http.get(`${BASE_URL}/api/v1/portfolios`, { headers });
    const passed = check(res, {
      'portfolio list 200': (r) => r.status === 200,
    });
    errorRate.add(!passed);
  }

  sleep(1);

  // 3. 计算 VaR (计算密集型)
  {
    const res = http.post(`${BASE_URL}/api/v1/var/calculate`, JSON.stringify({
      portfolio_id: 'test-portfolio-id',
      confidence_level: 0.95,
      time_horizon: 1,
      method: 'historical',
    }), { headers });
    const passed = check(res, {
      'var calc 200 or 202': (r) => r.status === 200 || r.status === 202,
      'var calc has var_value': (r) => r.json('data.var_value') !== undefined,
    });
    errorRate.add(!passed);
  }

  sleep(1);

  // 4. 获取用户信息
  {
    const res = http.get(`${BASE_URL}/api/v1/users/profile`, { headers });
    const passed = check(res, {
      'profile 200': (r) => r.status === 200,
    });
    errorRate.add(!passed);
  }

  sleep(2);
}

export function teardown(data) {
  console.log(`Test completed. Token valid: ${!!data.token}`);
}
