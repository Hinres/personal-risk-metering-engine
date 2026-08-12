/**
 * [PRME-INFRA-003] websocket.service 单元测试（增强版）
 * 测试范围: getInstance, getStats, push methods, close, initialize, handleConnection, handleMessage, heartbeat
 * 最后更新: 2026-06-26
 */
import { WebSocketService } from '../../src/services/websocket.service';

const mockSocketSend = jest.fn();
const mockSocketTerminate = jest.fn();
const mockSocketClose = jest.fn();
const mockSocketOn = jest.fn();
const mockSocketPing = jest.fn();

const mockWssOn = jest.fn();
const mockWssClose = jest.fn();

jest.mock('ws', () => ({
  WebSocketServer: jest.fn().mockImplementation(() => ({
    on: mockWssOn,
    close: mockWssClose,
  })),
  WebSocket: {
    OPEN: 1,
  },
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockImplementation((token: string) => {
    if (token === 'valid-token') return { user_id: 'u1' };
    if (token === 'invalid') throw new Error('invalid token');
    return { sub: 'user123' };
  }),
}));

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('WebSocketService', () => {
  let service: WebSocketService;
  let connectionHandler: ((socket: any, req: any) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton
    (WebSocketService as any).instance = null;
    service = WebSocketService.getInstance();

    // Capture the connection handler when initialize is called
    mockWssOn.mockImplementation((event: string, handler: any) => {
      if (event === 'connection') {
        connectionHandler = handler;
      }
    });
  });

  afterEach(() => {
    service.close();
    connectionHandler = null;
  });

  describe('getInstance', () => {
    it('should return singleton', () => {
      const s1 = WebSocketService.getInstance();
      const s2 = WebSocketService.getInstance();
      expect(s1).toBe(s2);
    });
  });

  describe('initialize', () => {
    it('should create WebSocketServer and bind connection event', () => {
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);
      expect(mockWssOn).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should setup heartbeat interval', () => {
      jest.useFakeTimers();
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);
      expect(jest.getTimerCount()).toBeGreaterThan(0);
      jest.useRealTimers();
    });
  });

  describe('handleConnection', () => {
    const createMockSocket = () => ({
      send: mockSocketSend,
      on: mockSocketOn,
      terminate: mockSocketTerminate,
      close: mockSocketClose,
      ping: mockSocketPing,
      readyState: 1,
    });

    const createMockReq = (url: string) => ({ url });

    it('should handle connection without token', () => {
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);

      const socket = createMockSocket();
      const req = createMockReq('/ws');

      connectionHandler!(socket, req);

      expect(service.getStats().totalConnections).toBe(1);
      expect(mockSocketSend).toHaveBeenCalled();
      const sent = JSON.parse(mockSocketSend.mock.calls[0][0]);
      expect(sent.type).toBe('connection');
      expect(sent.authenticated).toBe(false);
    });

    it('should handle connection with valid token', () => {
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);

      const socket = createMockSocket();
      const req = createMockReq('/ws?token=valid-token');

      connectionHandler!(socket, req);

      expect(service.getStats().authenticated).toBe(1);
      const sent = JSON.parse(mockSocketSend.mock.calls[0][0]);
      expect(sent.authenticated).toBe(true);
    });

    it('should handle connection with invalid token', () => {
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);

      const socket = createMockSocket();
      const req = createMockReq('/ws?token=invalid');

      connectionHandler!(socket, req);

      expect(service.getStats().authenticated).toBe(0);
    });

    it('should handle subscribe message', () => {
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);

      const socket = createMockSocket();
      const req = createMockReq('/ws?token=valid-token');
      connectionHandler!(socket, req);

      // Capture message handler
      const messageHandler = mockSocketOn.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];
      expect(messageHandler).toBeDefined();

      messageHandler(Buffer.from(JSON.stringify({ type: 'subscribe', portfolio_id: 'p1' })));

      const lastSent = JSON.parse(mockSocketSend.mock.calls[mockSocketSend.mock.calls.length - 1][0]);
      expect(lastSent.type).toBe('subscribed');
      expect(lastSent.portfolio_id).toBe('p1');
      expect(service.getStats().subscriptions).toBe(1);
    });

    it('should handle unsubscribe message', () => {
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);

      const socket = createMockSocket();
      const req = createMockReq('/ws?token=valid-token');
      connectionHandler!(socket, req);

      const messageHandler = mockSocketOn.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];

      // Subscribe first
      messageHandler(Buffer.from(JSON.stringify({ type: 'subscribe', portfolio_id: 'p1' })));
      expect(service.getStats().subscriptions).toBe(1);

      // Unsubscribe
      messageHandler(Buffer.from(JSON.stringify({ type: 'unsubscribe', portfolio_id: 'p1' })));
      const lastSent = JSON.parse(mockSocketSend.mock.calls[mockSocketSend.mock.calls.length - 1][0]);
      expect(lastSent.type).toBe('unsubscribed');
      expect(service.getStats().subscriptions).toBe(0);
    });

    it('should handle ping message', () => {
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);

      const socket = createMockSocket();
      const req = createMockReq('/ws');
      connectionHandler!(socket, req);

      const messageHandler = mockSocketOn.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ping' })));

      const lastSent = JSON.parse(mockSocketSend.mock.calls[mockSocketSend.mock.calls.length - 1][0]);
      expect(lastSent.type).toBe('pong');
    });

    it('should handle get_dashboard message', () => {
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);

      const socket = createMockSocket();
      const req = createMockReq('/ws');
      connectionHandler!(socket, req);

      const messageHandler = mockSocketOn.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'get_dashboard' })));

      const lastSent = JSON.parse(mockSocketSend.mock.calls[mockSocketSend.mock.calls.length - 1][0]);
      expect(lastSent.type).toBe('dashboard_request');
    });

    it('should handle unknown message type', () => {
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);

      const socket = createMockSocket();
      const req = createMockReq('/ws');
      connectionHandler!(socket, req);

      const messageHandler = mockSocketOn.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'unknown_type' })));

      const lastSent = JSON.parse(mockSocketSend.mock.calls[mockSocketSend.mock.calls.length - 1][0]);
      expect(lastSent.type).toBe('error');
    });

    it('should handle invalid JSON message', () => {
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);

      const socket = createMockSocket();
      const req = createMockReq('/ws');
      connectionHandler!(socket, req);

      const messageHandler = mockSocketOn.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];
      messageHandler(Buffer.from('not json'));

      const lastSent = JSON.parse(mockSocketSend.mock.calls[mockSocketSend.mock.calls.length - 1][0]);
      expect(lastSent.type).toBe('error');
      expect(lastSent.message).toBe('Invalid JSON message');
    });

    it('should handle subscribe without portfolio_id', () => {
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);

      const socket = createMockSocket();
      const req = createMockReq('/ws');
      connectionHandler!(socket, req);

      const messageHandler = mockSocketOn.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'subscribe' })));

      const lastSent = JSON.parse(mockSocketSend.mock.calls[mockSocketSend.mock.calls.length - 1][0]);
      expect(lastSent.type).toBe('error');
      expect(lastSent.message).toContain('portfolio_id is required');
    });

    it('should handle client close event', () => {
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);

      const socket = createMockSocket();
      const req = createMockReq('/ws');
      connectionHandler!(socket, req);

      expect(service.getStats().totalConnections).toBe(1);

      const closeHandler = mockSocketOn.mock.calls.find((c: any[]) => c[0] === 'close')?.[1];
      closeHandler();

      expect(service.getStats().totalConnections).toBe(0);
    });

    it('should handle socket error event', () => {
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);

      const socket = createMockSocket();
      const req = createMockReq('/ws');
      connectionHandler!(socket, req);

      const errorHandler = mockSocketOn.mock.calls.find((c: any[]) => c[0] === 'error')?.[1];
      expect(() => errorHandler(new Error('socket error'))).not.toThrow();
    });

    it('should handle pong event for heartbeat', () => {
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);

      const socket = createMockSocket();
      const req = createMockReq('/ws');
      connectionHandler!(socket, req);

      const pongHandler = mockSocketOn.mock.calls.find((c: any[]) => c[0] === 'pong')?.[1];
      pongHandler();

      // isAlive should be set to true; verify by triggering heartbeat check
      jest.useFakeTimers();
      jest.advanceTimersByTime(30000);
      jest.useRealTimers();

      // After heartbeat, connection should still exist (isAlive was true)
      expect(service.getStats().totalConnections).toBe(1);
    });
  });

  describe('heartbeat', () => {
    it('should terminate dead connections', () => {
      jest.useFakeTimers();
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);

      const socket = {
        send: mockSocketSend,
        on: mockSocketOn,
        terminate: mockSocketTerminate,
        close: mockSocketClose,
        ping: mockSocketPing,
        readyState: 1,
      };
      const req = { url: '/ws' };
      connectionHandler!(socket, req);

      // Get pong handler
      const pongHandler = mockSocketOn.mock.calls.find((c: any[]) => c[0] === 'pong')?.[1];

      // Trigger heartbeat interval without sending pong
      jest.advanceTimersByTime(30000);

      // After first check, isAlive was true initially, set to false, ping sent
      expect(mockSocketPing).toHaveBeenCalled();

      // Advance another 30s without pong
      jest.advanceTimersByTime(30000);

      // Connection should be terminated
      expect(mockSocketTerminate).toHaveBeenCalled();
      expect(service.getStats().totalConnections).toBe(0);

      jest.useRealTimers();
    });
  });

  describe('getStats', () => {
    it('should return zero stats when empty', () => {
      const stats = service.getStats();
      expect(stats.totalConnections).toBe(0);
      expect(stats.authenticated).toBe(0);
      expect(stats.subscriptions).toBe(0);
    });

    it('should return correct stats with connections', () => {
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);

      const socket = {
        send: mockSocketSend,
        on: mockSocketOn,
        terminate: mockSocketTerminate,
        close: mockSocketClose,
        ping: mockSocketPing,
        readyState: 1,
      };
      connectionHandler!(socket, { url: '/ws?token=valid-token' });

      const messageHandler = mockSocketOn.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'subscribe', portfolio_id: 'p1' })));

      const stats = service.getStats();
      expect(stats.totalConnections).toBe(1);
      expect(stats.authenticated).toBe(1);
      expect(stats.subscriptions).toBe(1);
    });
  });

  describe('push methods', () => {
    it('should push VaR result to subscribed client', () => {
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);

      const socket = {
        send: mockSocketSend,
        on: mockSocketOn,
        terminate: mockSocketTerminate,
        close: mockSocketClose,
        ping: mockSocketPing,
        readyState: 1,
      };
      connectionHandler!(socket, { url: '/ws?token=valid-token' });

      const messageHandler = mockSocketOn.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'subscribe', portfolio_id: 'p1' })));

      mockSocketSend.mockClear();
      service.pushVaRResult('p1', { var: 100 });

      expect(mockSocketSend).toHaveBeenCalled();
      const sent = JSON.parse(mockSocketSend.mock.calls[0][0]);
      expect(sent.type).toBe('var_update');
    });

    it('should push alert without subscribers', () => {
      expect(() => service.pushAlert('p1', { title: 'Alert' })).not.toThrow();
    });

    it('should push holding update without error', () => {
      expect(() => service.pushHoldingUpdate('p1', { symbol: 'AAPL' })).not.toThrow();
    });

    it('should push market data without error', () => {
      expect(() => service.pushMarketData('AAPL', { price: 150 })).not.toThrow();
    });

    it('should push dashboard update to specific user', () => {
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);

      const socket = {
        send: mockSocketSend,
        on: mockSocketOn,
        terminate: mockSocketTerminate,
        close: mockSocketClose,
        ping: mockSocketPing,
        readyState: 1,
      };
      connectionHandler!(socket, { url: '/ws?token=valid-token' });

      mockSocketSend.mockClear();
      service.pushDashboardUpdate('u1', { summary: {} });

      expect(mockSocketSend).toHaveBeenCalled();
      const sent = JSON.parse(mockSocketSend.mock.calls[0][0]);
      expect(sent.type).toBe('dashboard_update');
    });

    it('should push system notification to user', () => {
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);

      const socket = {
        send: mockSocketSend,
        on: mockSocketOn,
        terminate: mockSocketTerminate,
        close: mockSocketClose,
        ping: mockSocketPing,
        readyState: 1,
      };
      connectionHandler!(socket, { url: '/ws?token=valid-token' });

      mockSocketSend.mockClear();
      service.pushSystemNotification('u1', { msg: 'test' });

      expect(mockSocketSend).toHaveBeenCalled();
    });

    it('should push system notification to all users', () => {
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);

      const socket = {
        send: mockSocketSend,
        on: mockSocketOn,
        terminate: mockSocketTerminate,
        close: mockSocketClose,
        ping: mockSocketPing,
        readyState: 1,
      };
      connectionHandler!(socket, { url: '/ws' });

      mockSocketSend.mockClear();
      service.pushSystemNotification(null, { msg: 'broadcast' });

      expect(mockSocketSend).toHaveBeenCalled();
    });

    it('should push monitor snapshot without error', () => {
      expect(() => service.pushMonitorSnapshot('p1', { metrics: [] })).not.toThrow();
    });
  });

  describe('close', () => {
    it('should close without error', () => {
      expect(() => service.close()).not.toThrow();
    });

    it('should handle double close', () => {
      service.close();
      expect(() => service.close()).not.toThrow();
    });

    it('should close all client sockets', () => {
      const mockServer = { listen: jest.fn() };
      service.initialize(mockServer);

      const socket = {
        send: mockSocketSend,
        on: mockSocketOn,
        terminate: mockSocketTerminate,
        close: mockSocketClose,
        ping: mockSocketPing,
        readyState: 1,
      };
      connectionHandler!(socket, { url: '/ws' });

      service.close();

      expect(mockSocketClose).toHaveBeenCalledWith(1000, 'Server shutting down');
    });
  });
});
