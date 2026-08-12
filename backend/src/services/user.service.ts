/**
 * [PRME-TS-002] 用户设置
 * 文件: user.service.ts
 * 需求描述: 用户设置功能实现
 * 最后更新: 2026-06-09
 */
import { AppDataSource } from '../config/database';
import { User } from '../models/User';
import { Like } from 'typeorm';
import logger from '../utils/logger';

const repo = () => AppDataSource.getRepository(User);

export class UserService {
  static async getProfile(userId: string) {
    const user = await repo().findOne({ where: { user_id: userId } });
    if (!user) throw new Error('User not found');
    const { password_hash, ...profile } = user;
    return profile;
  }

  static async updateProfile(userId: string, data: Partial<User>) {
    const user = await repo().findOne({ where: { user_id: userId } });
    if (!user) throw new Error('User not found');
    Object.assign(user, data);
    await repo().save(user);
    return this.getProfile(userId);
  }

  static async getPreferences(userId: string) {
    const user = await repo().findOne({ where: { user_id: userId } });
    return user?.preferences || {};
  }

  static async updatePreferences(userId: string, preferences: Record<string, any>) {
    const user = await repo().findOne({ where: { user_id: userId } });
    if (!user) throw new Error('User not found');
    user.preferences = { ...user.preferences, ...preferences };
    await repo().save(user);
    return user.preferences;
  }

  static async getUsers(page = 1, limit = 10, filters?: any) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.username = Like(`%${filters.search}%`);
    }
    const [users, total] = await repo().findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { users: users.map(u => { const { password_hash, ...rest } = u; return rest; }), total, page, limit };
  }

  static async deleteUser(userId: string) {
    const user = await repo().findOne({ where: { user_id: userId } });
    if (!user) throw new Error('User not found');
    user.status = 'deleted';
    await repo().save(user);
    return true;
  }
}
