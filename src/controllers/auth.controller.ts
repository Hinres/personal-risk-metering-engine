/**
 * [PRME-TS-002] 用户设置
 * 文件: auth.controller.ts
 * 需求描述: 用户设置功能实现
 * 最后更新: 2026-06-09
 */
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { successResponse, errorResponse } from '../utils/response';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';

export const register = async (req: Request, res: Response) => {
  try {
    const { username, email, phone, password } = req.body;
    const result = await AuthService.register({ username, email, phone, password });
    return successResponse(res, result, 'Registration successful', 201);
  } catch (error: any) {
    if (error instanceof ValidationError) {
      logger.warn('Registration failed', { error: error.message });
    } else {
      logger.error('Registration failed', { error: error.message });
    }
    return errorResponse(res, error.message, 409);
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.get('user-agent') || '';
    const result = await AuthService.login(username, password, ipAddress, userAgent);
    return successResponse(res, result, 'Login successful');
  } catch (error: any) {
    if (error instanceof ValidationError) {
      logger.warn('Login failed', { error: error.message });
    } else {
      logger.error('Login failed', { error: error.message });
    }
    return errorResponse(res, error.message, 401);
  }
};

export const logout = async (req: any, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) await AuthService.logout(token);
    return successResponse(res, null, 'Logout successful');
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body;
    const result = await AuthService.refresh(refresh_token);
    return successResponse(res, result, 'Token refreshed');
  } catch (error: any) {
    return errorResponse(res, error.message, 401);
  }
};

export const wechatLogin = async (req: Request, res: Response) => {
  try {
    const { code, userInfo } = req.body;
    if (!code) {
      return errorResponse(res, 'Missing code parameter', 400);
    }
    const result = await AuthService.wechatLogin(code, userInfo);
    return successResponse(res, result, 'WeChat login successful');
  } catch (error: any) {
    logger.error('WeChat login failed', { error: error.message });
    return errorResponse(res, error.message || 'WeChat login failed', 500);
  }
};

export const getProfile = async (req: any, res: Response) => {
  try {
    const profile = await UserService.getProfile(req.user.user_id);
    return successResponse(res, profile);
  } catch (error: any) {
    return errorResponse(res, error.message, 404);
  }
};
