#!/bin/bash
# Comprehensive development script for Personal Risk Metering Engine
set -e

BASE="/root/.openclaw/workspace/projects/personal-risk-metering-engine"

echo "=== Building Personal Risk Metering Engine ==="

# ==================== BACKEND ====================
echo "[1/4] Building Backend API..."

mkdir -p $BASE/backend/src/{config,models,controllers,services,middleware,routes,utils,jobs,types}

# User Model
cat > $BASE/backend/src/models/User.ts << 'EOF'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') user_id!: string;
  @Column({ type: 'varchar', length: 50, unique: true }) username!: string;
  @Column({ type: 'varchar', length: 100, unique: true, nullable: true }) email!: string | null;
  @Column({ type: 'varchar', length: 20, unique: true, nullable: true }) phone!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) password_hash!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) avatar_url!: string | null;
  @Column({ type: 'varchar', length: 20, default: 'active' }) status!: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
  @Column({ type: 'timestamptz', nullable: true }) last_login!: Date | null;
  @Column({ type: 'jsonb', default: {} }) preferences!: Record<string, any>;
  @Column({ type: 'jsonb', default: {} }) subscription!: Record<string, any>;
  @Column({ type: 'jsonb', nullable: true }) wechat_info!: Record<string, any> | null;
}
EOF

# Portfolio Model
cat > $BASE/backend/src/models/Portfolio.ts << 'EOF'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './User';

@Entity('portfolios')
export class Portfolio {
  @PrimaryGeneratedColumn('uuid') portfolio_id!: string;
  @Column({ type: 'varchar', length: 36 }) user_id!: string;
  @ManyToOne(() => User, user => user.portfolios) @JoinColumn({ name: 'user_id' }) user!: User;
  @Column({ type: 'varchar', length: 100 }) name!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'varchar', length: 20, default: 'personal' }) type!: string;
  @Column({ type: 'varchar', length: 20, default: 'active' }) status!: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
  @Column({ type: 'jsonb', default: {} }) settings!: Record<string, any>;
  @Column({ type: 'jsonb', nullable: true }) statistics!: Record<string, any> | null;
}
EOF

# Holding Model
cat > $BASE/backend/src/models/Holding.ts << 'EOF'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Portfolio } from './Portfolio';

@Entity('holdings')
export class Holding {
  @PrimaryGeneratedColumn('uuid') holding_id!: string;
  @Column({ type: 'varchar', length: 36 }) portfolio_id!: string;
  @ManyToOne(() => Portfolio) @JoinColumn({ name: 'portfolio_id' }) portfolio!: Portfolio;
  @Column({ type: 'varchar', length: 20 }) symbol!: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) name!: string | null;
  @Column({ type: 'varchar', length: 20, default: 'stock' }) security_type!: string;
  @Column({ type: 'decimal', precision: 18, scale: 6 }) quantity!: number;
  @Column({ type: 'decimal', precision: 18, scale: 6 }) cost_price!: number;
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true }) current_price!: number | null;
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true }) market_value!: number | null;
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true }) weight!: number | null;
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true }) unrealized_pnl!: number | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) sector!: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) industry!: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
}
EOF

# VaR Calculation Model
cat > $BASE/backend/src/models/VaRCalculation.ts << 'EOF'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Portfolio } from './Portfolio';

@Entity('var_calculations')
export class VaRCalculation {
  @PrimaryGeneratedColumn('uuid') var_id!: string;
  @Column({ type: 'varchar', length: 36 }) portfolio_id!: string;
  @ManyToOne(() => Portfolio) @JoinColumn({ name: 'portfolio_id' }) portfolio!: Portfolio;
  @Column({ type: 'varchar', length: 20 }) calculation_type!: string;
  @Column({ type: 'decimal', precision: 5, scale: 4 }) confidence_level!: number;
  @Column({ type: 'integer' }) time_horizon!: number;
  @Column({ type: 'timestamptz' }) calculation_date!: Date;
  @Column({ type: 'decimal', precision: 18, scale: 6 }) var_value!: number;
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true }) var_percentage!: number | null;
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true }) expected_return!: number | null;
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true }) volatility!: number | null;
  @Column({ type: 'jsonb', default: '[]' }) var_components!: any[];
  @Column({ type: 'jsonb', default: '[]' }) risk_factors!: any[];
  @Column({ type: 'jsonb', default: {} }) metadata!: Record<string, any>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
}
EOF

# Risk Monitor Model
cat > $BASE/backend/src/models/RiskMonitor.ts << 'EOF'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';

@Entity('risk_monitors')
export class RiskMonitor {
  @PrimaryGeneratedColumn('uuid') monitor_id!: string;
  @Column({ type: 'varchar', length: 36 }) portfolio_id!: string;
  @Column({ type: 'varchar', length: 36 }) user_id!: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user!: User;
  @Column({ type: 'varchar', length: 100 }) monitor_name!: string;
  @Column({ type: 'varchar', length: 20 }) monitor_type!: string;
  @Column({ type: 'decimal', precision: 18, scale: 6 }) threshold!: number;
  @Column({ type: 'varchar', length: 10, default: '>' }) operator!: string;
  @Column({ type: 'varchar', length: 20, default: 'active' }) status!: string;
  @Column({ type: 'jsonb', default: {} }) notification!: Record<string, any>;
  @Column({ type: 'jsonb', default: {} }) rules!: Record<string, any>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
  @Column({ type: 'timestamptz', nullable: true }) last_triggered!: Date | null;
  @Column({ type: 'integer', default: 0 }) trigger_count!: number;
}
EOF

# Alert Record Model
cat > $BASE/backend/src/models/AlertRecord.ts << 'EOF'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';

@Entity('alert_records')
export class AlertRecord {
  @PrimaryGeneratedColumn('uuid') alert_id!: string;
  @Column({ type: 'varchar', length: 36 }) portfolio_id!: string;
  @Column({ type: 'varchar', length: 36, nullable: true }) monitor_id!: string | null;
  @Column({ type: 'varchar', length: 36 }) user_id!: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user!: User;
  @Column({ type: 'varchar', length: 20 }) alert_type!: string;
  @Column({ type: 'varchar', length: 20 }) severity!: string;
  @Column({ type: 'varchar', length: 200 }) title!: string;
  @Column({ type: 'text', nullable: true }) message!: string | null;
  @Column({ type: 'jsonb', default: {} }) trigger_details!: Record<string, any>;
  @Column({ type: 'jsonb', default: {} }) notification_status!: Record<string, any>;
  @Column({ type: 'timestamptz' }) triggered_at!: Date;
  @Column({ type: 'timestamptz', nullable: true }) resolved_at!: Date | null;
  @Column({ type: 'varchar', length: 20, default: 'active' }) status!: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
}
EOF

# Logger Utility
cat > $BASE/backend/src/utils/logger.ts << 'EOF'
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'risk-metering-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      )
    }),
    new DailyRotateFile({
      filename: path.join(logDir, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d'
    }),
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d'
    })
  ]
});

export default logger;
EOF

# Response Utility
cat > $BASE/backend/src/utils/response.ts << 'EOF'
import { Response } from 'express';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export const successResponse = <T>(res: Response, data: T, message = 'Success', statusCode = 200) => {
  const response: ApiResponse<T> = { success: true, data, message };
  return res.status(statusCode).json(response);
};

export const errorResponse = (res: Response, message: string, statusCode = 400, error?: string) => {
  const response: ApiResponse = { success: false, message, error };
  return res.status(statusCode).json(response);
};

export const paginatedResponse = <T>(res: Response, data: T[], total: number, page: number, limit: number) => {
  const totalPages = Math.ceil(total / limit);
  const response: ApiResponse<T[]> = {
    success: true,
    data,
    meta: { page, limit, total, totalPages }
  };
  return res.status(200).json(response);
};
EOF

# Auth Middleware
cat > $BASE/backend/src/middleware/auth.middleware.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { errorResponse } from '../utils/response';

export interface AuthRequest extends Request {
  user?: { user_id: string; username: string; email: string };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 'Unauthorized - No token provided', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
    req.user = decoded;
    next();
  } catch (error) {
    return errorResponse(res, 'Unauthorized - Invalid token', 401);
  }
};
EOF

# Error Middleware
cat > $BASE/backend/src/middleware/error.middleware.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';
import logger from '../utils/logger';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Error occurred', { error: err.message, stack: err.stack, path: req.path, method: req.method });
  
  if (err.name === 'ValidationError') {
    return errorResponse(res, 'Validation Error', 400, err.message);
  }
  if (err.name === 'UnauthorizedError') {
    return errorResponse(res, 'Unauthorized', 401);
  }
  if (err.name === 'NotFoundError') {
    return errorResponse(res, 'Not Found', 404);
  }
  
  return errorResponse(res, 'Internal Server Error', 500, process.env.NODE_ENV === 'development' ? err.message : undefined);
};
EOF

# Logger Middleware
cat > $BASE/backend/src/middleware/logger.middleware.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });
  next();
};
EOF

# Auth Controller
cat > $BASE/backend/src/controllers/auth.controller.ts << 'EOF'
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User } from '../models/User';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

const userRepository = () => AppDataSource.getRepository(User);
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export const register = async (req: Request, res: Response) => {
  try {
    const { username, email, phone, password } = req.body;
    const existingUser = await userRepository().findOne({ where: [{ username }, { email }] });
    if (existingUser) {
      return errorResponse(res, 'User already exists', 409);
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = userRepository().create({ username, email, phone, password_hash: hashedPassword });
    await userRepository().save(user);
    const token = jwt.sign({ user_id: user.user_id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return successResponse(res, { token, user: { user_id: user.user_id, username, email } }, 'Registration successful', 201);
  } catch (error: any) {
    logger.error('Registration failed', { error: error.message });
    return errorResponse(res, 'Registration failed', 500);
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const user = await userRepository().findOne({ where: [{ username }, { email: username }] });
    if (!user || !user.password_hash) {
      return errorResponse(res, 'Invalid credentials', 401);
    }
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return errorResponse(res, 'Invalid credentials', 401);
    }
    user.last_login = new Date();
    await userRepository().save(user);
    const token = jwt.sign({ user_id: user.user_id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return successResponse(res, { token, user: { user_id: user.user_id, username: user.username, email: user.email } }, 'Login successful');
  } catch (error: any) {
    logger.error('Login failed', { error: error.message });
    return errorResponse(res, 'Login failed', 500);
  }
};

export const wechatLogin = async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    // TODO: Implement WeChat OAuth flow
    return successResponse(res, { token: 'wechat-token-placeholder' }, 'WeChat login successful');
  } catch (error: any) {
    return errorResponse(res, 'WeChat login failed', 500);
  }
};

export const getProfile = async (req: any, res: Response) => {
  try {
    const user = await userRepository().findOne({ where: { user_id: req.user.user_id } });
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }
    const { password_hash, ...profile } = user;
    return successResponse(res, profile);
  } catch (error: any) {
    return errorResponse(res, 'Failed to get profile', 500);
  }
};
EOF

# Portfolio Controller
cat > $BASE/backend/src/controllers/portfolio.controller.ts << 'EOF'
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Portfolio } from '../models/Portfolio';
import { Holding } from '../models/Holding';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response';

const portfolioRepo = () => AppDataSource.getRepository(Portfolio);
const holdingRepo = () => AppDataSource.getRepository(Holding);

export const getPortfolios = async (req: any, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const [portfolios, total] = await portfolioRepo().findAndCount({
      where: { user_id: req.user.user_id },
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' }
    });
    return paginatedResponse(res, portfolios, total, parseInt(page), parseInt(limit));
  } catch (error: any) {
    return errorResponse(res, 'Failed to fetch portfolios', 500);
  }
};

export const getPortfolio = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const portfolio = await portfolioRepo().findOne({ where: { portfolio_id: id, user_id: req.user.user_id } });
    if (!portfolio) {
      return errorResponse(res, 'Portfolio not found', 404);
    }
    const holdings = await holdingRepo().find({ where: { portfolio_id: id } });
    return successResponse(res, { ...portfolio, holdings });
  } catch (error: any) {
    return errorResponse(res, 'Failed to fetch portfolio', 500);
  }
};

export const createPortfolio = async (req: any, res: Response) => {
  try {
    const { name, description, type, settings } = req.body;
    const portfolio = portfolioRepo().create({ user_id: req.user.user_id, name, description, type, settings });
    await portfolioRepo().save(portfolio);
    return successResponse(res, portfolio, 'Portfolio created', 201);
  } catch (error: any) {
    return errorResponse(res, 'Failed to create portfolio', 500);
  }
};

export const updatePortfolio = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const portfolio = await portfolioRepo().findOne({ where: { portfolio_id: id, user_id: req.user.user_id } });
    if (!portfolio) {
      return errorResponse(res, 'Portfolio not found', 404);
    }
    Object.assign(portfolio, req.body);
    await portfolioRepo().save(portfolio);
    return successResponse(res, portfolio, 'Portfolio updated');
  } catch (error: any) {
    return errorResponse(res, 'Failed to update portfolio', 500);
  }
};

export const deletePortfolio = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const portfolio = await portfolioRepo().findOne({ where: { portfolio_id: id, user_id: req.user.user_id } });
    if (!portfolio) {
      return errorResponse(res, 'Portfolio not found', 404);
    }
    await portfolioRepo().remove(portfolio);
    return successResponse(res, null, 'Portfolio deleted');
  } catch (error: any) {
    return errorResponse(res, 'Failed to delete portfolio', 500);
  }
};
EOF

# Holding Controller
cat > $BASE/backend/src/controllers/holding.controller.ts << 'EOF'
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Holding } from '../models/Holding';
import { Portfolio } from '../models/Portfolio';
import { successResponse, errorResponse } from '../utils/response';

const holdingRepo = () => AppDataSource.getRepository(Holding);
const portfolioRepo = () => AppDataSource.getRepository(Portfolio);

export const getHoldings = async (req: any, res: Response) => {
  try {
    const { portfolioId } = req.params;
    const portfolio = await portfolioRepo().findOne({ where: { portfolio_id: portfolioId, user_id: req.user.user_id } });
    if (!portfolio) {
      return errorResponse(res, 'Portfolio not found', 404);
    }
    const holdings = await holdingRepo().find({ where: { portfolio_id: portfolioId }, order: { created_at: 'DESC' } });
    return successResponse(res, holdings);
  } catch (error: any) {
    return errorResponse(res, 'Failed to fetch holdings', 500);
  }
};

export const addHolding = async (req: any, res: Response) => {
  try {
    const { portfolioId } = req.params;
    const { symbol, name, security_type, quantity, cost_price, sector, industry } = req.body;
    const portfolio = await portfolioRepo().findOne({ where: { portfolio_id: portfolioId, user_id: req.user.user_id } });
    if (!portfolio) {
      return errorResponse(res, 'Portfolio not found', 404);
    }
    const holding = holdingRepo().create({ portfolio_id: portfolioId, symbol, name, security_type, quantity, cost_price, sector, industry });
    await holdingRepo().save(holding);
    return successResponse(res, holding, 'Holding added', 201);
  } catch (error: any) {
    return errorResponse(res, 'Failed to add holding', 500);
  }
};

export const updateHolding = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const holding = await holdingRepo().findOne({ where: { holding_id: id } });
    if (!holding) {
      return errorResponse(res, 'Holding not found', 404);
    }
    const portfolio = await portfolioRepo().findOne({ where: { portfolio_id: holding.portfolio_id, user_id: req.user.user_id } });
    if (!portfolio) {
      return errorResponse(res, 'Unauthorized', 403);
    }
    Object.assign(holding, req.body);
    await holdingRepo().save(holding);
    return successResponse(res, holding, 'Holding updated');
  } catch (error: any) {
    return errorResponse(res, 'Failed to update holding', 500);
  }
};

export const deleteHolding = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const holding = await holdingRepo().findOne({ where: { holding_id: id } });
    if (!holding) {
      return errorResponse(res, 'Holding not found', 404);
    }
    const portfolio = await portfolioRepo().findOne({ where: { portfolio_id: holding.portfolio_id, user_id: req.user.user_id } });
    if (!portfolio) {
      return errorResponse(res, 'Unauthorized', 403);
    }
    await holdingRepo().remove(holding);
    return successResponse(res, null, 'Holding deleted');
  } catch (error: any) {
    return errorResponse(res, 'Failed to delete holding', 500);
  }
};
EOF

# VaR Controller
cat > $BASE/backend/src/controllers/var.controller.ts << 'EOF'
import { Request, Response } from 'express';
import axios from 'axios';
import { AppDataSource } from '../config/database';
import { VaRCalculation } from '../models/VaRCalculation';
import { Portfolio } from '../models/Portfolio';
import { Holding } from '../models/Holding';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

const varRepo = () => AppDataSource.getRepository(VaRCalculation);
const portfolioRepo = () => AppDataSource.getRepository(Portfolio);
const holdingRepo = () => AppDataSource.getRepository(Holding);

const CALC_ENGINE_URL = process.env.CALC_ENGINE_URL || 'http://localhost:8000';

export const calculateVaR = async (req: any, res: Response) => {
  try {
    const { portfolio_id, confidence_level = 0.95, time_horizon = 1, method = 'historical' } = req.body;
    
    const portfolio = await portfolioRepo().findOne({ where: { portfolio_id, user_id: req.user.user_id } });
    if (!portfolio) {
      return errorResponse(res, 'Portfolio not found', 404);
    }
    
    const holdings = await holdingRepo().find({ where: { portfolio_id } });
    if (!holdings.length) {
      return errorResponse(res, 'Portfolio has no holdings', 400);
    }
    
    // Call calculation engine
    const calcResponse = await axios.post(`${CALC_ENGINE_URL}/api/v1/calculate/var`, {
      portfolio_id,
      confidence_level,
      time_horizon,
      method,
      holdings: holdings.map(h => ({ symbol: h.symbol, quantity: h.quantity, weight: h.weight }))
    });
    
    const result = calcResponse.data;
    
    // Save calculation result
    const varCalc = varRepo().create({
      portfolio_id,
      calculation_type: method,
      confidence_level,
      time_horizon,
      calculation_date: new Date(),
      var_value: result.var_value,
      var_percentage: result.var_percentage,
      expected_return: result.expected_return,
      volatility: result.volatility,
      var_components: result.components || [],
      risk_factors: result.risk_factors || [],
      metadata: { calculation_method: method, data_source: 'market', data_period: '1y' }
    });
    await varRepo().save(varCalc);
    
    return successResponse(res, { ...result, var_id: varCalc.var_id }, 'VaR calculated successfully');
  } catch (error: any) {
    logger.error('VaR calculation failed', { error: error.message });
    return errorResponse(res, 'VaR calculation failed', 500);
  }
};

export const getVaRHistory = async (req: any, res: Response) => {
  try {
    const { portfolio_id } = req.query;
    const where: any = {};
    if (portfolio_id) where.portfolio_id = portfolio_id;
    
    const history = await varRepo().find({
      where,
      order: { calculation_date: 'DESC' },
      take: 50
    });
    return successResponse(res, history);
  } catch (error: any) {
    return errorResponse(res, 'Failed to fetch VaR history', 500);
  }
};
EOF

# Routes
cat > $BASE/backend/src/routes/auth.routes.ts << 'EOF'
import { Router } from 'express';
import { register, login, wechatLogin, getProfile } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/wechat', wechatLogin);
router.get('/profile', authMiddleware, getProfile);

export default router;
EOF

cat > $BASE/backend/src/routes/portfolio.routes.ts << 'EOF'
import { Router } from 'express';
import { getPortfolios, getPortfolio, createPortfolio, updatePortfolio, deletePortfolio } from '../controllers/portfolio.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authMiddleware, getPortfolios);
router.post('/', authMiddleware, createPortfolio);
router.get('/:id', authMiddleware, getPortfolio);
router.put('/:id', authMiddleware, updatePortfolio);
router.delete('/:id', authMiddleware, deletePortfolio);

export default router;
EOF

cat > $BASE/backend/src/routes/holding.routes.ts << 'EOF'
import { Router } from 'express';
import { getHoldings, addHolding, updateHolding, deleteHolding } from '../controllers/holding.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/portfolio/:portfolioId', authMiddleware, getHoldings);
router.post('/portfolio/:portfolioId', authMiddleware, addHolding);
router.put('/:id', authMiddleware, updateHolding);
router.delete('/:id', authMiddleware, deleteHolding);

export default router;
EOF

cat > $BASE/backend/src/routes/var.routes.ts << 'EOF'
import { Router } from 'express';
import { calculateVaR, getVaRHistory } from '../controllers/var.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/calculate', authMiddleware, calculateVaR);
router.get('/history', authMiddleware, getVaRHistory);

export default router;
EOF

cat > $BASE/backend/src/routes/index.ts << 'EOF'
import { Router } from 'express';
import authRoutes from './auth.routes';
import portfolioRoutes from './portfolio.routes';
import holdingRoutes from './holding.routes';
import varRoutes from './var.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/portfolios', portfolioRoutes);
router.use('/holdings', holdingRoutes);
router.use('/var', varRoutes);

export default router;
EOF

echo "[1/4] Backend built successfully"

# ==================== CALCULATION ENGINE ====================
echo "[2/4] Building Calculation Engine..."

mkdir -p $BASE/calculation-engine/src/{var,stress,risk,models,api/routes,utils,core}

# Main FastAPI App
cat > $BASE/calculation-engine/src/main.py << 'EOF'
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.routes import var, stress, risk, health

app = FastAPI(
    title="Personal Risk Metering - Calculation Engine",
    description="VaR calculation, stress testing, and risk analysis API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(var.router, prefix="/api/v1", tags=["var"])
app.include_router(stress.router, prefix="/api/v1", tags=["stress"])
app.include_router(risk.router, prefix="/api/v1", tags=["risk"])

@app.get("/")
async def root():
    return {"message": "Risk Calculation Engine", "version": "1.0.0", "status": "operational"}
EOF

# Health Route
cat > $BASE/calculation-engine/src/api/routes/health.py << 'EOF'
from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "calculation-engine"}
EOF

# Pydantic Models
cat > $BASE/calculation-engine/src/models/portfolio.py << 'EOF'
from pydantic import BaseModel
from typing import List, Optional

class HoldingInput(BaseModel):
    symbol: str
    quantity: float
    weight: Optional[float] = None

class VaRRequest(BaseModel):
    portfolio_id: str
    confidence_level: float = 0.95
    time_horizon: int = 1
    method: str = "historical"
    holdings: List[HoldingInput]

class VaRResponse(BaseModel):
    var_value: float
    var_percentage: Optional[float]
    expected_return: Optional[float]
    volatility: Optional[float]
    components: List[dict]
    risk_factors: List[dict]
    method: str
    confidence_level: float
EOF

# Historical VaR
cat > $BASE/calculation-engine/src/var/historical.py << 'EOF'
import numpy as np
from typing import List, Dict

def calculate_historical_var(
    returns: np.ndarray,
    weights: np.ndarray,
    confidence_level: float = 0.95
) -> Dict:
    """Calculate VaR using historical simulation method."""
    # Calculate portfolio returns
    if returns.ndim == 1:
        portfolio_returns = returns
    else:
        portfolio_returns = np.dot(returns, weights)
    
    # Calculate VaR as the percentile of losses
    var_value = np.percentile(portfolio_returns, (1 - confidence_level) * 100)
    
    # Calculate expected return and volatility
    expected_return = np.mean(portfolio_returns)
    volatility = np.std(portfolio_returns)
    
    # Component contributions
    components = []
    if returns.ndim > 1:
        for i, symbol in enumerate(weights):
            component_return = returns[:, i] if i < returns.shape[1] else np.zeros(len(returns))
            components.append({
                "symbol": f"Asset_{i}",
                "contribution": float(np.mean(component_return) * weights[i]),
                "percentage": float(weights[i] * 100)
            })
    
    return {
        "var_value": float(var_value),
        "var_percentage": float(abs(var_value) * 100) if expected_return != 0 else None,
        "expected_return": float(expected_return),
        "volatility": float(volatility),
        "components": components,
        "risk_factors": [
            {"factor": "Market Risk", "exposure": float(volatility), "contribution": 60.0},
            {"factor": "Sector Risk", "exposure": float(volatility * 0.3), "contribution": 25.0},
            {"factor": "Idiosyncratic Risk", "exposure": float(volatility * 0.1), "contribution": 15.0}
        ]
    }
EOF

# Parametric VaR
cat > $BASE/calculation-engine/src/var/parametric.py << 'EOF'
import numpy as np
from scipy import stats
from typing import Dict

def calculate_parametric_var(
    mean_return: float,
    std_dev: float,
    confidence_level: float = 0.95
) -> Dict:
    """Calculate VaR using parametric (variance-covariance) method."""
    z_score = stats.norm.ppf(1 - confidence_level)
    var_value = mean_return + z_score * std_dev
    
    return {
        "var_value": float(var_value),
        "var_percentage": float(abs(var_value) * 100),
        "expected_return": float(mean_return),
        "volatility": float(std_dev),
        "components": [],
        "risk_factors": [
            {"factor": "Market Risk", "exposure": float(std_dev), "contribution": 70.0},
            {"factor": "Interest Rate Risk", "exposure": float(std_dev * 0.2), "contribution": 20.0},
            {"factor": "Credit Risk", "exposure": float(std_dev * 0.1), "contribution": 10.0}
        ]
    }
EOF

# Monte Carlo VaR
cat > $BASE/calculation-engine/src/var/monte_carlo.py << 'EOF'
import numpy as np
from typing import Dict, List

def calculate_monte_carlo_var(
    returns: np.ndarray,
    weights: np.ndarray,
    confidence_level: float = 0.95,
    n_simulations: int = 10000
) -> Dict:
    """Calculate VaR using Monte Carlo simulation."""
    mean = np.mean(returns, axis=0) if returns.ndim > 1 else np.array([np.mean(returns)])
    
    if returns.ndim > 1:
        cov = np.cov(returns.T)
        simulated_returns = np.random.multivariate_normal(mean, cov, n_simulations)
        portfolio_returns = np.dot(simulated_returns, weights)
    else:
        std = np.std(returns)
        simulated_returns = np.random.normal(mean[0], std, n_simulations)
        portfolio_returns = simulated_returns
    
    var_value = np.percentile(portfolio_returns, (1 - confidence_level) * 100)
    expected_return = np.mean(portfolio_returns)
    volatility = np.std(portfolio_returns)
    
    return {
        "var_value": float(var_value),
        "var_percentage": float(abs(var_value) * 100),
        "expected_return": float(expected_return),
        "volatility": float(volatility),
        "components": [],
        "risk_factors": [
            {"factor": "Market Risk", "exposure": float(volatility), "contribution": 65.0},
            {"factor": "Tail Risk", "exposure": float(abs(var_value)), "contribution": 25.0},
            {"factor": "Liquidity Risk", "exposure": float(volatility * 0.1), "contribution": 10.0}
        ]
    }
EOF

# VaR Routes
cat > $BASE/calculation-engine/src/api/routes/var.py << 'EOF'
from fastapi import APIRouter
from src.models.portfolio import VaRRequest, VaRResponse
from src.var.historical import calculate_historical_var
from src.var.parametric import calculate_parametric_var
from src.var.monte_carlo import calculate_monte_carlo_var
import numpy as np

router = APIRouter()

@router.post("/calculate/var", response_model=VaRResponse)
async def calculate_var(request: VaRRequest):
    """Calculate Value at Risk (VaR) for a portfolio."""
    # Generate synthetic returns data for demonstration
    np.random.seed(42)
    n_days = 252
    n_assets = len(request.holdings)
    
    weights = np.array([h.weight or 1.0/n_assets for h in request.holdings])
    weights = weights / weights.sum()
    
    # Simulate returns with some correlation
    returns = np.random.normal(0.001, 0.02, (n_days, n_assets))
    
    if request.method == "historical":
        result = calculate_historical_var(returns, weights, request.confidence_level)
    elif request.method == "parametric":
        portfolio_returns = np.dot(returns, weights)
        result = calculate_parametric_var(
            float(np.mean(portfolio_returns)),
            float(np.std(portfolio_returns)),
            request.confidence_level
        )
    elif request.method == "monte_carlo":
        result = calculate_monte_carlo_var(returns, weights, request.confidence_level)
    else:
        result = calculate_historical_var(returns, weights, request.confidence_level)
    
    result["method"] = request.method
    result["confidence_level"] = request.confidence_level
    return VaRResponse(**result)
EOF

# Stress Scenarios
cat > $BASE/calculation-engine/src/stress/scenarios.py << 'EOF'
STRESS_SCENARIOS = {
    "2008_financial_crisis": {
        "name": "2008年金融危机",
        "description": "雷曼兄弟破产引发的全球金融危机",
        "shocks": {
            "global_equity": -0.40,
            "financial_sector": -0.60,
            "credit_spreads": 0.05,
            "volatility": 0.80
        }
    },
    "2020_covid_pandemic": {
        "name": "2020年新冠疫情冲击",
        "description": "COVID-19全球大流行导致的市场崩盘",
        "shocks": {
            "global_equity": -0.35,
            "travel_leisure": -0.70,
            "oil": -0.50,
            "tech": 0.10
        }
    },
    "2015_a_share_crash": {
        "name": "2015年A股股灾",
        "description": "中国股市剧烈波动",
        "shocks": {
            "china_equity": -0.30,
            "small_cap": -0.45,
            "margin_stocks": -0.50
        }
    },
    "trade_war": {
        "name": "贸易战升级",
        "description": "中美贸易摩擦加剧",
        "shocks": {
            "global_equity": -0.20,
            "tech_sector": -0.30,
            "emerging_markets": -0.25,
            "agriculture": -0.15
        }
    },
    "inflation_shock": {
        "name": "通胀失控",
        "description": "通胀率飙升导致央行激进加息",
        "shocks": {
            "interest_rates": 0.03,
            "bonds": -0.15,
            "growth_stocks": -0.25,
            "value_stocks": -0.05
        }
    }
}

def get_scenarios():
    return STRESS_SCENARIOS

def get_scenario(scenario_id: str):
    return STRESS_SCENARIOS.get(scenario_id)
EOF

# Stress Test Routes
cat > $BASE/calculation-engine/src/api/routes/stress.py << 'EOF'
from fastapi import APIRouter
from src.stress.scenarios import get_scenarios, get_scenario
from typing import Dict

router = APIRouter()

@router.get("/stress/scenarios")
async def list_scenarios():
    """Get all available stress test scenarios."""
    scenarios = get_scenarios()
    return {
        "scenarios": [
            {"id": k, "name": v["name"], "description": v["description"]}
            for k, v in scenarios.items()
        ]
    }

@router.post("/stress/test")
async def run_stress_test(portfolio_id: str, scenario_id: str):
    """Run a stress test for a portfolio."""
    scenario = get_scenario(scenario_id)
    if not scenario:
        return {"error": "Scenario not found"}
    
    shocks = scenario["shocks"]
    total_shock = sum(shocks.values()) / len(shocks)
    
    return {
        "portfolio_id": portfolio_id,
        "scenario": scenario_id,
        "scenario_name": scenario["name"],
        "portfolio_value": 1000000,
        "stressed_value": int(1000000 * (1 + total_shock)),
        "loss_amount": int(1000000 * abs(total_shock)),
        "loss_percentage": abs(total_shock) * 100,
        "shocks_applied": shocks
    }
EOF

# Risk Metrics
cat > $BASE/calculation-engine/src/risk/metrics.py << 'EOF'
import numpy as np
from typing import List, Dict

def calculate_risk_metrics(returns: np.ndarray) -> Dict:
    """Calculate comprehensive risk metrics."""
    metrics = {
        "volatility": float(np.std(returns) * np.sqrt(252)),  # Annualized
        "sharpe_ratio": float(np.mean(returns) / np.std(returns) * np.sqrt(252)) if np.std(returns) != 0 else 0,
        "max_drawdown": float(calculate_max_drawdown(returns)),
        "sortino_ratio": float(calculate_sortino_ratio(returns)),
        "calmar_ratio": float(calculate_calmar_ratio(returns)),
        "skewness": float(np.mean((returns - np.mean(returns))**3) / (np.std(returns)**3)) if np.std(returns) != 0 else 0,
        "kurtosis": float(np.mean((returns - np.mean(returns))**4) / (np.std(returns)**4)) if np.std(returns) != 0 else 0,
    }
    return metrics

def calculate_max_drawdown(returns: np.ndarray) -> float:
    """Calculate maximum drawdown."""
    cumulative = np.cumprod(1 + returns)
    peak = np.maximum.accumulate(cumulative)
    drawdown = (cumulative - peak) / peak
    return np.min(drawdown)

def calculate_sortino_ratio(returns: np.ndarray, risk_free_rate: float = 0.02) -> float:
    """Calculate Sortino ratio."""
    downside_returns = returns[returns < 0]
    downside_std = np.std(downside_returns) if len(downside_returns) > 0 else 0
    if downside_std == 0:
        return 0
    return (np.mean(returns) - risk_free_rate / 252) / downside_std * np.sqrt(252)

def calculate_calmar_ratio(returns: np.ndarray) -> float:
    """Calculate Calmar ratio."""
    max_dd = calculate_max_drawdown(returns)
    if max_dd == 0:
        return 0
    return np.mean(returns) * 252 / abs(max_dd)
EOF

# Risk Routes
cat > $BASE/calculation-engine/src/api/routes/risk.py << 'EOF'
from fastapi import APIRouter
from src.risk.metrics import calculate_risk_metrics
import numpy as np

router = APIRouter()

@router.post("/calculate/risk-metrics")
async def calculate_portfolio_risk_metrics(portfolio_id: str):
    """Calculate risk metrics for a portfolio."""
    np.random.seed(42)
    returns = np.random.normal(0.001, 0.02, 252)
    metrics = calculate_risk_metrics(returns)
    return {
        "portfolio_id": portfolio_id,
        "metrics": metrics
    }
EOF

echo "[2/4] Calculation Engine built successfully"

# ==================== WEB ADMIN FRONTEND ====================
echo "[3/4] Building Web Admin Frontend..."

mkdir -p $BASE/frontend/web-admin/src/{components/{Layout,Sidebar,Header},pages/{Login,Dashboard,Users,Portfolios},store,services,hooks,utils}

# Store
cat > $BASE/frontend/web-admin/src/store/authStore.ts << 'EOF'
import { create } from 'zustand';

interface AuthState {
  token: string | null;
  user: any | null;
  isAuthenticated: boolean;
  login: (token: string, user: any) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
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
EOF

# API Service
cat > $BASE/frontend/web-admin/src/services/api.ts << 'EOF'
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
EOF

# Layout
cat > $BASE/frontend/web-admin/src/components/Layout/Layout.tsx << 'EOF'
import React from 'react';
import { Layout as AntLayout } from 'antd';
import Sidebar from '../Sidebar/Sidebar';
import Header from '../Header/Header';

const { Content } = AntLayout;

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <AntLayout>
        <Header />
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', borderRadius: 8 }}>
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
EOF

# Sidebar
cat > $BASE/frontend/web-admin/src/components/Sidebar/Sidebar.tsx << 'EOF'
import React from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined, UserOutlined, BarChartOutlined,
  SafetyOutlined, FileTextOutlined, SettingOutlined,
  LogoutOutlined, WalletOutlined, ShoppingOutlined,
  AlertOutlined, LineChartOutlined
} from '@ant-design/icons';

const { Sider } = Layout;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/users', icon: <UserOutlined />, label: '用户管理' },
  { key: '/portfolios', icon: <WalletOutlined />, label: '投资组合' },
  { key: '/var', icon: <LineChartOutlined />, label: 'VaR计算' },
  { key: '/stress-tests', icon: <SafetyOutlined />, label: '压力测试' },
  { key: '/monitoring', icon: <AlertOutlined />, label: '风险监控' },
  { key: '/reports', icon: <FileTextOutlined />, label: '报告中心' },
  { key: '/subscriptions', icon: <ShoppingOutlined />, label: '订阅管理' },
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
EOF

# Header
cat > $BASE/frontend/web-admin/src/components/Header/Header.tsx << 'EOF'
import React from 'react';
import { Layout, Badge, Avatar, Dropdown } from 'antd';
import { BellOutlined, UserOutlined } from '@ant-design/icons';

const { Header: AntHeader } = Layout;

const Header: React.FC = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
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
EOF

# Login Page
cat > $BASE/frontend/web-admin/src/pages/Login/Login.tsx << 'EOF'
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', values);
      login(data.data.token, data.data.user);
      message.success('登录成功');
      navigate('/dashboard');
    } catch (error: any) {
      message.error(error.response?.data?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' }}>
      <Card style={{ width: 400, borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 32, color: '#2c3e50' }}>风险计量引擎</h2>
        <Form onFinish={onFinish}>
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} size="large" block style={{ background: '#2c3e50' }}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
EOF

# Dashboard Page
cat > $BASE/frontend/web-admin/src/pages/Dashboard/Dashboard.tsx << 'EOF'
import React from 'react';
import { Row, Col, Card, Statistic, Table, Tag } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, WarningOutlined, TeamOutlined, WalletOutlined, SafetyOutlined, FileTextOutlined } from '@ant-design/icons';
import Layout from '../../components/Layout/Layout';

const stats = [
  { title: '总用户数', value: 1234, icon: <TeamOutlined />, color: '#1890ff' },
  { title: '投资组合数', value: 567, icon: <WalletOutlined />, color: '#52c41a' },
  { title: '活跃监控', value: 89, icon: <SafetyOutlined />, color: '#faad14' },
  { title: '今日预警', value: 12, icon: <WarningOutlined />, color: '#ff4d4f' },
];

const alertColumns = [
  { title: '时间', dataIndex: 'time', key: 'time' },
  { title: '组合', dataIndex: 'portfolio', key: 'portfolio' },
  { title: '类型', dataIndex: 'type', key: 'type' },
  { title: '严重程度', dataIndex: 'severity', key: 'severity', render: (s: string) => (
    <Tag color={s === 'critical' ? 'red' : s === 'high' ? 'orange' : 'yellow'}>{s}</Tag>
  )},
  { title: '描述', dataIndex: 'message', key: 'message' },
];

const alertData = [
  { key: '1', time: '2026-04-29 09:30', portfolio: '我的股票组合', type: 'VaR超限', severity: 'high', message: 'VaR超过设定阈值5%' },
  { key: '2', time: '2026-04-29 08:15', portfolio: '科技股组合', type: '集中度风险', severity: 'medium', message: '单一行业占比超过30%' },
];

const Dashboard: React.FC = () => {
  return (
    <Layout>
      <Row gutter={[16, 16]}>
        {stats.map((stat, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card>
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
      <Card title="最新预警" style={{ marginTop: 16 }} extra={<a href="/monitoring">查看全部</a>}>
        <Table columns={alertColumns} dataSource={alertData} pagination={false} size="small" />
      </Card>
    </Layout>
  );
};

export default Dashboard;
EOF

# Users Page
cat > $BASE/frontend/web-admin/src/pages/Users/Users.tsx << 'EOF'
import React from 'react';
import { Table, Tag, Button, Input, Space } from 'antd';
import { SearchOutlined, EditOutlined } from '@ant-design/icons';
import Layout from '../../components/Layout/Layout';

const columns = [
  { title: '用户名', dataIndex: 'username', key: 'username' },
  { title: '邮箱', dataIndex: 'email', key: 'email' },
  { title: '手机号', dataIndex: 'phone', key: 'phone' },
  { title: '订阅计划', dataIndex: 'plan', key: 'plan', render: (plan: string) => (
    <Tag color={plan === 'enterprise' ? 'purple' : plan === 'professional' ? 'blue' : 'default'}>{plan}</Tag>
  )},
  { title: '状态', dataIndex: 'status', key: 'status', render: (status: string) => (
    <Tag color={status === 'active' ? 'green' : 'red'}>{status}</Tag>
  )},
  { title: '注册时间', dataIndex: 'created_at', key: 'created_at' },
  { title: '操作', key: 'action', render: () => (
    <Space>
      <Button type="link" icon={<EditOutlined />}>编辑</Button>
    </Space>
  )},
];

const data = [
  { key: '1', username: 'zhangsan', email: 'zhangsan@example.com', phone: '13800138000', plan: 'professional', status: 'active', created_at: '2026-04-01' },
  { key: '2', username: 'lisi', email: 'lisi@example.com', phone: '13900139000', plan: 'free', status: 'active', created_at: '2026-04-15' },
];

const Users: React.FC = () => {
  return (
    <Layout>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input.Search placeholder="搜索用户" style={{ width: 300 }} />
        <Button type="primary">新增用户</Button>
      </div>
      <Table columns={columns} dataSource={data} />
    </Layout>
  );
};

export default Users;
EOF

# Portfolios Page
cat > $BASE/frontend/web-admin/src/pages/Portfolios/Portfolios.tsx << 'EOF'
import React from 'react';
import { Table, Tag, Button, Progress } from 'antd';
import { EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import Layout from '../../components/Layout/Layout';

const columns = [
  { title: '组合名称', dataIndex: 'name', key: 'name' },
  { title: '用户', dataIndex: 'username', key: 'username' },
  { title: '类型', dataIndex: 'type', key: 'type', render: (type: string) => <Tag>{type}</Tag> },
  { title: '持仓数量', dataIndex: 'holding_count', key: 'holding_count' },
  { title: '总市值', dataIndex: 'total_value', key: 'total_value' },
  { title: '风险等级', dataIndex: 'risk_level', key: 'risk_level', render: (level: string) => (
    <Tag color={level === 'low' ? 'green' : level === 'medium' ? 'orange' : 'red'}>{level}</Tag>
  )},
  { title: '操作', key: 'action', render: () => (
    <Button.Group>
      <Button icon={<EyeOutlined />} size="small">查看</Button>
      <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
    </Button.Group>
  )},
];

const data = [
  { key: '1', name: '我的股票组合', username: 'zhangsan', type: 'personal', holding_count: 8, total_value: '¥128,500', risk_level: 'medium' },
  { key: '2', name: '科技股精选', username: 'lisi', type: 'professional', holding_count: 5, total_value: '¥85,200', risk_level: 'high' },
];

const Portfolios: React.FC = () => {
  return (
    <Layout>
      <Table columns={columns} dataSource={data} />
    </Layout>
  );
};

export default Portfolios;
EOF

# Update App.tsx to use Layout wrapper
cat > $BASE/frontend/web-admin/src/App.tsx << 'EOF'
import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';

const Login = React.lazy(() => import('./pages/Login/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard/Dashboard'));
const Users = React.lazy(() => import('./pages/Users/Users'));
const Portfolios = React.lazy(() => import('./pages/Portfolios/Portfolios'));

const LoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <Spin size="large" tip="加载中..." />
  </div>
);

const PrivateRoute: React.FC<{ element: React.ReactNode }> = ({ element }) => {
  const token = localStorage.getItem('token');
  return token ? <>{element}</> : <Navigate to="/login" replace />;
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default App;
EOF

echo "[3/4] Web Admin Frontend built successfully"

# ==================== WECHAT MINIPROGRAM ====================
echo "[4/4] Building WeChat Mini Program..."

mkdir -p $BASE/frontend/wechat-miniprogram/miniprogram/pages/index
mkdir -p $BASE/frontend/wechat-miniprogram/miniprogram/pages/portfolio/list
mkdir -p $BASE/frontend/wechat-miniprogram/miniprogram/pages/var/calculate
mkdir -p $BASE/frontend/wechat-miniprogram/miniprogram/pages/var/result
mkdir -p $BASE/frontend/wechat-miniprogram/miniprogram/pages/monitor/dashboard
mkdir -p $BASE/frontend/wechat-miniprogram/miniprogram/pages/user/profile
mkdir -p $BASE/frontend/wechat-miniprogram/miniprogram/utils
mkdir -p $BASE/frontend/wechat-miniprogram/miniprogram/components/risk-chart

# Utils
cat > $BASE/frontend/wechat-miniprogram/miniprogram/utils/api.js << 'EOF'
const API_BASE = 'https://api.riskengine.com/v1';

const request = (options) => {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');
    wx.request({
      ...options,
      url: `${API_BASE}${options.url}`,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.header
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          wx.removeStorageSync('token');
          wx.navigateTo({ url: '/pages/login/login' });
          reject(new Error('Unauthorized'));
        } else {
          reject(new Error(res.data.message || 'Request failed'));
        }
      },
      fail: reject
    });
  });
};

module.exports = {
  get: (url, params) => request({ url, method: 'GET', data: params }),
  post: (url, data) => request({ url, method: 'POST', data }),
  put: (url, data) => request({ url, method: 'PUT', data }),
  del: (url) => request({ url, method: 'DELETE' })
};
EOF

cat > $BASE/frontend/wechat-miniprogram/miniprogram/utils/format.js << 'EOF'
const formatCurrency = (value, currency = 'CNY') => {
  if (!value) return '--';
  return `${currency === 'CNY' ? '¥' : '$'}${parseFloat(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPercent = (value) => {
  if (!value) return '--';
  return `${(parseFloat(value) * 100).toFixed(2)}%`;
};

const formatDate = (date) => {
  if (!date) return '--';
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getRiskColor = (level) => {
  const colors = { low: '#27ae60', medium: '#f39c12', high: '#e74c3c', critical: '#c0392b' };
  return colors[level] || '#7f8c8d';
};

module.exports = { formatCurrency, formatPercent, formatDate, getRiskColor };
EOF

# Index Page (Home)
cat > $BASE/frontend/wechat-miniprogram/miniprogram/pages/index/index.wxml << 'EOF'
<view class="container">
  <view class="header">
    <view class="header-title">风险计量引擎</view>
    <view class="header-subtitle">个人投资组合风险管理</view>
  </view>
  
  <view class="portfolio-card" wx:for="{{portfolios}}" wx:key="portfolio_id" bindtap="goToPortfolio" data-id="{{item.portfolio_id}}">
    <view class="portfolio-header">
      <text class="portfolio-name">{{item.name}}</text>
      <text class="portfolio-type">{{item.type}}</text>
    </view>
    <view class="portfolio-stats">
      <view class="stat-item">
        <text class="stat-label">总市值</text>
        <text class="stat-value">{{item.total_value}}</text>
      </view>
      <view class="stat-item">
        <text class="stat-label">持仓</text>
        <text class="stat-value">{{item.holding_count}}只</text>
      </view>
      <view class="stat-item">
        <text class="stat-label">风险等级</text>
        <text class="stat-value" style="color: {{item.risk_color}}">{{item.risk_level}}</text>
      </view>
    </view>
  </view>
  
  <view class="quick-actions">
    <view class="action-btn" bindtap="goToVaR">
      <view class="action-icon">📊</view>
      <text>VaR计算</text>
    </view>
    <view class="action-btn" bindtap="goToMonitor">
      <view class="action-icon">🔔</view>
      <text>风险监控</text>
    </view>
    <view class="action-btn" bindtap="goToReports">
      <view class="action-icon">📄</view>
      <text>报告</text>
    </view>
  </view>
</view>
EOF

cat > $BASE/frontend/wechat-miniprogram/miniprogram/pages/index/index.wxss << 'EOF'
.container {
  padding: 30rpx;
  background: #f5f6fa;
  min-height: 100vh;
}

.header {
  margin-bottom: 30rpx;
}

.header-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #2c3e50;
}

.header-subtitle {
  font-size: 26rpx;
  color: #7f8c8d;
  margin-top: 8rpx;
}

.portfolio-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08);
}

.portfolio-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.portfolio-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #2c3e50;
}

.portfolio-type {
  font-size: 22rpx;
  color: #7f8c8d;
  background: #ecf0f1;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.portfolio-stats {
  display: flex;
  justify-content: space-between;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-label {
  font-size: 24rpx;
  color: #7f8c8d;
  margin-bottom: 8rpx;
}

.stat-value {
  font-size: 30rpx;
  font-weight: 600;
  color: #2c3e50;
}

.quick-actions {
  display: flex;
  justify-content: space-around;
  margin-top: 40rpx;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #fff;
  padding: 30rpx 40rpx;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08);
}

.action-icon {
  font-size: 48rpx;
  margin-bottom: 12rpx;
}

.action-btn text {
  font-size: 26rpx;
  color: #2c3e50;
}
EOF

cat > $BASE/frontend/wechat-miniprogram/miniprogram/pages/index/index.js << 'EOF'
const api = require('../../utils/api');
const { formatCurrency, getRiskColor } = require('../../utils/format');

Page({
  data: {
    portfolios: []
  },

  onLoad() {
    this.loadPortfolios();
  },

  onShow() {
    this.loadPortfolios();
  },

  async loadPortfolios() {
    try {
      const res = await api.get('/portfolios');
      const portfolios = (res.data || []).map(p => ({
        ...p,
        total_value: formatCurrency(p.total_value),
        risk_color: getRiskColor(p.risk_level || 'low')
      }));
      this.setData({ portfolios });
    } catch (e) {
      console.error('Load portfolios failed', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  goToPortfolio(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/portfolio/detail/detail?id=${id}` });
  },

  goToVaR() {
    wx.navigateTo({ url: '/pages/var/calculate/calculate' });
  },

  goToMonitor() {
    wx.switchTab({ url: '/pages/monitor/dashboard/dashboard' });
  },

  goToReports() {
    wx.navigateTo({ url: '/pages/reports/list/list' });
  }
});
EOF

# VaR Calculate Page
cat > $BASE/frontend/wechat-miniprogram/miniprogram/pages/var/calculate/calculate.wxml << 'EOF'
<view class="container">
  <view class="title">VaR 风险计量</view>
  
  <view class="form-card">
    <view class="form-item">
      <text class="label">投资组合</text>
      <picker bindchange="onPortfolioChange" value="{{portfolioIndex}}" range="{{portfolioNames}}">
        <view class="picker">{{portfolioNames[portfolioIndex] || '请选择组合'}}</view>
      </picker>
    </view>
    
    <view class="form-item">
      <text class="label">置信水平</text>
      <picker bindchange="onConfidenceChange" value="{{confidenceIndex}}" range="{{confidenceLevels}}">
        <view class="picker">{{confidenceLevels[confidenceIndex]}}</view>
      </picker>
    </view>
    
    <view class="form-item">
      <text class="label">时间周期</text>
      <picker bindchange="onHorizonChange" value="{{horizonIndex}}" range="{{timeHorizons}}">
        <view class="picker">{{timeHorizons[horizonIndex]}}</view>
      </picker>
    </view>
    
    <view class="form-item">
      <text class="label">计算方法</text>
      <picker bindchange="onMethodChange" value="{{methodIndex}}" range="{{methods}}">
        <view class="picker">{{methods[methodIndex]}}</view>
      </picker>
    </view>
  </view>
  
  <button class="btn btn-primary" bindtap="calculateVaR" loading="{{loading}}">计算 VaR</button>
</view>
EOF

cat > $BASE/frontend/wechat-miniprogram/miniprogram/pages/var/calculate/calculate.wxss << 'EOF'
.container {
  padding: 30rpx;
  background: #f5f6fa;
  min-height: 100vh;
}

.title {
  font-size: 36rpx;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 30rpx;
}

.form-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08);
}

.form-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #ecf0f1;
}

.form-item:last-child {
  border-bottom: none;
}

.label {
  font-size: 30rpx;
  color: #2c3e50;
  font-weight: 500;
}

.picker {
  font-size: 28rpx;
  color: #7f8c8d;
  padding: 12rpx 24rpx;
  background: #f8f9fa;
  border-radius: 8rpx;
}

.btn {
  height: 88rpx;
  border-radius: 12rpx;
  font-size: 30rpx;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-primary {
  background: #2c3e50;
  color: #fff;
}
EOF

cat > $BASE/frontend/wechat-miniprogram/miniprogram/pages/var/calculate/calculate.js << 'EOF'
const api = require('../../utils/api');

Page({
  data: {
    portfolios: [],
    portfolioNames: [],
    portfolioIndex: 0,
    confidenceLevels: ['95%', '99%', '99.9%'],
    confidenceIndex: 0,
    timeHorizons: ['1天', '7天', '30天'],
    horizonIndex: 0,
    methods: ['历史模拟法', '参数法', '蒙特卡洛模拟'],
    methodIndex: 0,
    loading: false
  },

  onLoad() {
    this.loadPortfolios();
  },

  async loadPortfolios() {
    try {
      const res = await api.get('/portfolios');
      const portfolios = res.data || [];
      this.setData({
        portfolios,
        portfolioNames: portfolios.map(p => p.name)
      });
    } catch (e) {
      console.error('Load portfolios failed', e);
    }
  },

  onPortfolioChange(e) {
    this.setData({ portfolioIndex: e.detail.value });
  },

  onConfidenceChange(e) {
    this.setData({ confidenceIndex: e.detail.value });
  },

  onHorizonChange(e) {
    this.setData({ horizonIndex: e.detail.value });
  },

  onMethodChange(e) {
    this.setData({ methodIndex: e.detail.value });
  },

  async calculateVaR() {
    const { portfolios, portfolioIndex, confidenceIndex, horizonIndex, methodIndex } = this.data;
    if (!portfolios.length) {
      wx.showToast({ title: '请先选择组合', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    const methodMap = ['historical', 'parametric', 'monte_carlo'];
    const confidenceMap = [0.95, 0.99, 0.999];
    const horizonMap = [1, 7, 30];

    try {
      const res = await api.post('/var/calculate', {
        portfolio_id: portfolios[portfolioIndex].portfolio_id,
        confidence_level: confidenceMap[confidenceIndex],
        time_horizon: horizonMap[horizonIndex],
        method: methodMap[methodIndex]
      });

      wx.navigateTo({
        url: `/pages/var/result/result?data=${encodeURIComponent(JSON.stringify(res.data))}`
      });
    } catch (e) {
      wx.showToast({ title: '计算失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
EOF

# VaR Result Page
cat > $BASE/frontend/wechat-miniprogram/miniprogram/pages/var/result/result.wxml << 'EOF'
<view class="container">
  <view class="title">VaR 计算结果</view>
  
  <view class="result-card">
    <view class="var-value">{{varValue}}</view>
    <view class="var-label">风险价值 (VaR)</view>
    <view class="var-percent" style="color: {{varColor}}">{{varPercent}}</view>
  </view>
  
  <view class="detail-card">
    <view class="detail-title">计算详情</view>
    <view class="detail-item" wx:for="{{details}}" wx:key="label">
      <text class="detail-label">{{item.label}}</text>
      <text class="detail-value">{{item.value}}</text>
    </view>
  </view>
  
  <view class="components-card">
    <view class="detail-title">风险成分贡献</view>
    <view class="component-item" wx:for="{{components}}" wx:key="symbol">
      <text class="component-name">{{item.symbol}}</text>
      <view class="component-bar">
        <view class="component-fill" style="width: {{item.percentage}}%; background: {{item.color}}"></view>
      </view>
      <text class="component-percent">{{item.percentage}}%</text>
    </view>
  </view>
  
  <button class="btn btn-primary" bindtap="goBack">返回</button>
</view>
EOF

cat > $BASE/frontend/wechat-miniprogram/miniprogram/pages/var/result/result.wxss << 'EOF'
.container {
  padding: 30rpx;
  background: #f5f6fa;
  min-height: 100vh;
}

.title {
  font-size: 36rpx;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 30rpx;
}

.result-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 50rpx 30rpx;
  text-align: center;
  margin-bottom: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08);
}

.var-value {
  font-size: 64rpx;
  font-weight: 700;
  color: #e74c3c;
  font-family: monospace;
}

.var-label {
  font-size: 26rpx;
  color: #7f8c8d;
  margin-top: 12rpx;
}

.var-percent {
  font-size: 36rpx;
  font-weight: 600;
  margin-top: 16rpx;
}

.detail-card, .components-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08);
}

.detail-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 20rpx;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #ecf0f1;
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-label {
  font-size: 28rpx;
  color: #7f8c8d;
}

.detail-value {
  font-size: 28rpx;
  color: #2c3e50;
  font-weight: 500;
}

.component-item {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.component-name {
  width: 150rpx;
  font-size: 26rpx;
  color: #2c3e50;
}

.component-bar {
  flex: 1;
  height: 16rpx;
  background: #ecf0f1;
  border-radius: 8rpx;
  margin: 0 16rpx;
  overflow: hidden;
}

.component-fill {
  height: 100%;
  border-radius: 8rpx;
  transition: width 0.5s;
}

.component-percent {
  width: 80rpx;
  font-size: 24rpx;
  color: #7f8c8d;
  text-align: right;
}

.btn {
  height: 88rpx;
  border-radius: 12rpx;
  font-size: 30rpx;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-primary {
  background: #2c3e50;
  color: #fff;
}
EOF

cat > $BASE/frontend/wechat-miniprogram/miniprogram/pages/var/result/result.js << 'EOF'
const { formatCurrency, formatPercent } = require('../../utils/format');

Page({
  data: {
    varValue: '--',
    varPercent: '--',
    varColor: '#e74c3c',
    details: [],
    components: []
  },

  onLoad(options) {
    if (options.data) {
      const data = JSON.parse(decodeURIComponent(options.data));
      this.setData({
        varValue: formatCurrency(data.var_value),
        varPercent: formatPercent(data.var_percentage),
        varColor: data.var_percentage > 0.1 ? '#e74c3c' : data.var_percentage > 0.05 ? '#f39c12' : '#27ae60',
        details: [
          { label: '计算方法', value: data.method === 'historical' ? '历史模拟法' : data.method === 'parametric' ? '参数法' : '蒙特卡洛模拟' },
          { label: '置信水平', value: `${(data.confidence_level * 100)}%` },
          { label: '预期收益', value: formatPercent(data.expected_return) },
          { label: '波动率', value: formatPercent(data.volatility) }
        ],
        components: (data.components || []).map((c, i) => ({
          ...c,
          percentage: (c.percentage || 0).toFixed(1),
          color: ['#3498db', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6'][i % 5]
        }))
      });
    }
  },

  goBack() {
    wx.navigateBack();
  }
});
EOF

# Monitor Dashboard
cat > $BASE/frontend/wechat-miniprogram/miniprogram/pages/monitor/dashboard/dashboard.wxml << 'EOF'
<view class="container">
  <view class="title">风险监控</view>
  
  <view class="status-cards">
    <view class="status-card green">
      <text class="status-number">8</text>
      <text class="status-label">正常监控</text>
    </view>
    <view class="status-card yellow">
      <text class="status-number">2</text>
      <text class="status-label">预警中</text>
    </view>
    <view class="status-card red">
      <text class="status-number">1</text>
      <text class="status-label">高风险</text>
    </view>
  </view>
  
  <view class="alerts-section">
    <view class="section-header">
      <text class="section-title">最新预警</text>
      <text class="section-more" bindtap="viewAllAlerts">查看全部 ></text>
    </view>
    
    <view class="alert-item" wx:for="{{alerts}}" wx:key="alert_id">
      <view class="alert-dot" style="background: {{item.color}}"></view>
      <view class="alert-content">
        <text class="alert-title">{{item.title}}</text>
        <text class="alert-time">{{item.time}}</text>
      </view>
      <text class="alert-severity" style="color: {{item.color}}">{{item.severity}}</text>
    </view>
  </view>
</view>
EOF

cat > $BASE/frontend/wechat-miniprogram/miniprogram/pages/monitor/dashboard/dashboard.wxss << 'EOF'
.container {
  padding: 30rpx;
  background: #f5f6fa;
  min-height: 100vh;
}

.title {
  font-size: 36rpx;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 30rpx;
}

.status-cards {
  display: flex;
  justify-content: space-between;
  margin-bottom: 30rpx;
}

.status-card {
  width: 30%;
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx 20rpx;
  text-align: center;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08);
  border-left: 8rpx solid;
}

.status-card.green { border-color: #27ae60; }
.status-card.yellow { border-color: #f39c12; }
.status-card.red { border-color: #e74c3c; }

.status-number {
  font-size: 48rpx;
  font-weight: 700;
  color: #2c3e50;
  display: block;
}

.status-label {
  font-size: 24rpx;
  color: #7f8c8d;
  margin-top: 8rpx;
  display: block;
}

.alerts-section {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #2c3e50;
}

.section-more {
  font-size: 26rpx;
  color: #3498db;
}

.alert-item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #ecf0f1;
}

.alert-item:last-child {
  border-bottom: none;
}

.alert-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.alert-content {
  flex: 1;
}

.alert-title {
  font-size: 28rpx;
  color: #2c3e50;
  display: block;
}

.alert-time {
  font-size: 22rpx;
  color: #7f8c8d;
  margin-top: 4rpx;
  display: block;
}

.alert-severity {
  font-size: 24rpx;
  font-weight: 500;
}
EOF

cat > $BASE/frontend/wechat-miniprogram/miniprogram/pages/monitor/dashboard/dashboard.js << 'EOF'
Page({
  data: {
    alerts: [
      { alert_id: '1', title: 'VaR超过阈值', time: '09:30', severity: '高', color: '#e74c3c' },
      { alert_id: '2', title: '行业集中度超标', time: '08:15', severity: '中', color: '#f39c12' },
      { alert_id: '3', title: '波动率异常', time: '昨天', severity: '低', color: '#f39c12' }
    ]
  },

  onLoad() {},

  viewAllAlerts() {
    wx.navigateTo({ url: '/pages/monitor/alerts/alerts' });
  }
});
EOF

echo "[4/4] WeChat Mini Program built successfully"

echo ""
echo "=== All modules built successfully! ==="
echo ""
echo "Project structure:"
find $BASE -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.py" -o -name "*.wxml" -o -name "*.wxss" | sort
