/**
 * [PRME-INFRA-003] 性能与缓存
 * 文件: websocket.service.ts
 * 需求描述: 性能与缓存功能实现
 * 最后更新: 2026-06-09
 */
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { verify } from 'jsonwebtoken';
import logger from '../utils/logger';

// JWT_SECRET 与 auth.middleware.ts 保持一致
const JWT_SECRET = process.env.JWT_SECRET || 'default-jwt-secret-change-in-production';

interface WSClient {
  socket: WebSocket;
  userId: string | null;
  subscribedPortfolios: Set<string>;
  connectedAt: Date;
  isAlive: boolean;
}

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, WSClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // 单例模式
  private static instance: WebSocketService;
  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * 初始化 WebSocket 服务器，绑定到 HTTP server
   */
  initialize(server: any): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (socket: WebSocket, req: IncomingMessage) => {
      this.handleConnection(socket, req);
    });

    // 心跳检测
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeat();
    }, 30000); // 30秒

    logger.info('WebSocket server initialized on /ws');
  }

  private handleConnection(socket: WebSocket, req: IncomingMessage): void {
    const client: WSClient = {
      socket,
      userId: null,
      subscribedPortfolios: new Set(),
      connectedAt: new Date(),
      isAlive: true,
    };

    this.clients.set(socket, client);

    // 尝试从 URL 查询参数获取 token
    const token = this.extractToken(req);
    if (token) {
      try {
        const decoded = verify(token, JWT_SECRET) as any;
        client.userId = decoded.user_id || decoded.sub || null;
        logger.info('WebSocket authenticated', { userId: client.userId });
      } catch (e) {
        logger.warn('WebSocket auth failed', { error: (e as Error).message });
      }
    }

    socket.on('message', (data: Buffer) => {
      this.handleMessage(client, data.toString());
    });

    socket.on('pong', () => {
      client.isAlive = true;
    });

    socket.on('close', () => {
      this.clients.delete(socket);
      logger.info('WebSocket client disconnected', { userId: client.userId });
    });

    socket.on('error', (err) => {
      logger.error('WebSocket error', { error: err.message });
    });

    // 发送连接确认
    this.sendToClient(socket, {
      type: 'connection',
      status: 'connected',
      authenticated: !!client.userId,
      timestamp: new Date().toISOString(),
    });
  }

  private extractToken(req: IncomingMessage): string | null {
    const url = req.url || '';
    const match = url.match(/[?&]token=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  private handleMessage(client: WSClient, raw: string): void {
    try {
      const message = JSON.parse(raw);
      logger.debug('WebSocket message received', { type: message.type, userId: client.userId });

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(client, message);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(client, message);
          break;
        case 'ping':
          this.sendToClient(client.socket, { type: 'pong', timestamp: new Date().toISOString() });
          break;
        case 'get_dashboard':
          this.sendToClient(client.socket, { type: 'dashboard_request', status: 'use_rest_api' });
          break;
        default:
          this.sendToClient(client.socket, { type: 'error', message: `Unknown message type: ${message.type}` });
      }
    } catch (e) {
      logger.warn('WebSocket message parse error', { error: (e as Error).message });
      this.sendToClient(client.socket, { type: 'error', message: 'Invalid JSON message' });
    }
  }

  private handleSubscribe(client: WSClient, message: any): void {
    const { portfolio_id } = message;
    if (!portfolio_id) {
      this.sendToClient(client.socket, { type: 'error', message: 'portfolio_id is required for subscription' });
      return;
    }
    client.subscribedPortfolios.add(portfolio_id);
    this.sendToClient(client.socket, {
      type: 'subscribed',
      portfolio_id,
      timestamp: new Date().toISOString(),
    });
    logger.info('Client subscribed to portfolio', { userId: client.userId, portfolioId: portfolio_id });
  }

  private handleUnsubscribe(client: WSClient, message: any): void {
    const { portfolio_id } = message;
    if (portfolio_id) {
      client.subscribedPortfolios.delete(portfolio_id);
      this.sendToClient(client.socket, {
        type: 'unsubscribed',
        portfolio_id,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private checkHeartbeat(): void {
    for (const [socket, client] of this.clients) {
      if (!client.isAlive) {
        socket.terminate();
        this.clients.delete(socket);
        continue;
      }
      client.isAlive = false;
      socket.ping();
    }
  }

  private sendToClient(socket: WebSocket, data: any): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  }

  // ==================== 广播 API ====================

  /**
   * 推送 VaR 计算结果到订阅了该组合的用户
   */
  pushVaRResult(portfolioId: string, data: any): void {
    this.broadcastToPortfolioSubscribers(portfolioId, {
      type: 'var_update',
      portfolio_id: portfolioId,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 推送监控预警到订阅了该组合的用户
   */
  pushAlert(portfolioId: string, alert: any): void {
    this.broadcastToPortfolioSubscribers(portfolioId, {
      type: 'alert',
      portfolio_id: portfolioId,
      alert,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 推送持仓更新到订阅了该组合的用户
   */
  pushHoldingUpdate(portfolioId: string, holding: any): void {
    this.broadcastToPortfolioSubscribers(portfolioId, {
      type: 'holding_update',
      portfolio_id: portfolioId,
      holding,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 推送市场数据更新
   */
  pushMarketData(symbol: string, data: any): void {
    this.broadcastToAll({
      type: 'market_data',
      symbol,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 推送仪表盘数据更新给特定用户
   */
  pushDashboardUpdate(userId: string, data: any): void {
    this.broadcastToUser(userId, {
      type: 'dashboard_update',
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 推送系统通知
   */
  pushSystemNotification(userId: string | null, notification: any): void {
    const message = {
      type: 'notification',
      notification,
      timestamp: new Date().toISOString(),
    };
    if (userId) {
      this.broadcastToUser(userId, message);
    } else {
      this.broadcastToAll(message);
    }
  }

  /**
   * 推送监控快照更新
   */
  pushMonitorSnapshot(portfolioId: string, snapshot: any): void {
    this.broadcastToPortfolioSubscribers(portfolioId, {
      type: 'monitor_snapshot',
      portfolio_id: portfolioId,
      snapshot,
      timestamp: new Date().toISOString(),
    });
  }

  // ==================== 广播工具 ====================

  private broadcastToPortfolioSubscribers(portfolioId: string, message: any): void {
    let sent = 0;
    for (const [socket, client] of this.clients) {
      if (client.subscribedPortfolios.has(portfolioId)) {
        this.sendToClient(socket, message);
        sent++;
      }
    }
    if (sent > 0) {
      logger.debug(`Broadcast to ${sent} subscribers for portfolio ${portfolioId}`, { type: message.type });
    }
  }

  private broadcastToUser(userId: string, message: any): void {
    let sent = 0;
    for (const [socket, client] of this.clients) {
      if (client.userId === userId) {
        this.sendToClient(socket, message);
        sent++;
      }
    }
    if (sent > 0) {
      logger.debug(`Broadcast to user ${userId} (${sent} clients)`, { type: message.type });
    }
  }

  private broadcastToAll(message: any): void {
    let sent = 0;
    for (const [socket] of this.clients) {
      this.sendToClient(socket, message);
      sent++;
    }
    logger.debug(`Broadcast to all ${sent} clients`, { type: message.type });
  }

  /**
   * 获取当前连接统计
   */
  getStats(): { totalConnections: number; authenticated: number; subscriptions: number } {
    let authenticated = 0;
    let subscriptions = 0;
    for (const [, client] of this.clients) {
      if (client.userId) authenticated++;
      subscriptions += client.subscribedPortfolios.size;
    }
    return {
      totalConnections: this.clients.size,
      authenticated,
      subscriptions,
    };
  }

  /**
   * 关闭所有连接
   */
  close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    for (const [socket] of this.clients) {
      socket.close(1000, 'Server shutting down');
    }
    this.clients.clear();
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    logger.info('WebSocket server closed');
  }
}

export default WebSocketService;
