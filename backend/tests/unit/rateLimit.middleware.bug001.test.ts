/**
 * [PRME-INFRA-001] BUG-001 修复验证 — 每个 limiter 使用独立的 MemoryRateLimitStore 实例
 * 文件: rateLimit.middleware.bug001.test.ts
 * 最后更新: 2026-07-24
 */
import express from 'express';
import request from 'supertest';
import { apiLimiter, authLimiter, calcLimiter } from '../../src/middleware/rateLimit.middleware';

describe('BUG-001: 每个 limiter 应有独立的 MemoryRateLimitStore 实例', () => {
  function createTestApp(limiter: any) {
    const app = express();
    app.use(express.json());
    app.use(limiter);
    app.post('/test', (req, res) => res.json({ ok: true }));
    return app;
  }

  it('authLimiter 达到上限后，calcLimiter 对同一客户端仍不受影响', async () => {
    const authApp = createTestApp(authLimiter);
    const calcApp = createTestApp(calcLimiter);

    // 在测试环境下 authLimiter 的 max 为 50
    for (let i = 0; i < 51; i++) {
      await request(authApp).post('/test');
    }
    const blockedAuth = await request(authApp).post('/test');
    expect(blockedAuth.status).toBe(429);

    // calcLimiter 使用独立的 store，对同一客户端仍为首次请求
    const calcRes = await request(calcApp).post('/test');
    expect(calcRes.status).toBe(200);
    expect(calcRes.body.ok).toBe(true);
  });

  it('apiLimiter 与 calcLimiter 的计数器互相隔离', async () => {
    const apiApp = createTestApp(apiLimiter);
    const calcApp = createTestApp(calcLimiter);

    // 命中 apiLimiter 15 次（上限 100）
    for (let i = 0; i < 15; i++) {
      const apiRes = await request(apiApp).post('/test');
      expect(apiRes.status).toBe(200);
    }

    // calcLimiter 对同一客户端仍为首次请求
    const calcRes = await request(calcApp).post('/test');
    expect(calcRes.status).toBe(200);
    expect(calcRes.body.ok).toBe(true);
  });
});
