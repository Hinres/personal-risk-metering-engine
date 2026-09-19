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
import { AuditService } from './audit.service';

const repo = () => AppDataSource.getRepository(User);

// V2-05：preferences.data 段校验常量
const VALID_DATA_SOURCES = ['auto', 'local_only'];

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

  /**
   * V2-05：更新用户偏好。
   * - data 段一层深合并（前端只提交部分子键时不误清其余键）；其余顶层键维持浅合并；
   * - 校验：data_source ∈ auto/local_only，data_quality_alerts 为 boolean（非法 400）；
   * - 埋点：data 段任一子键变化 → audit（resource_type='user_setting'）。
   */
  static async updatePreferences(userId: string, preferences: Record<string, any>) {
    const user = await repo().findOne({ where: { user_id: userId } });
    if (!user) throw new Error('User not found');

    const incoming = preferences || {};

    // data 段校验
    if (incoming.data !== undefined) {
      if (incoming.data === null || typeof incoming.data !== 'object' || Array.isArray(incoming.data)) {
        throw Object.assign(new Error('data 必须是对象'), { statusCode: 400 });
      }
      if (incoming.data.data_source !== undefined && !VALID_DATA_SOURCES.includes(incoming.data.data_source)) {
        throw Object.assign(
          new Error(`data_source 必须是 ${VALID_DATA_SOURCES.join(' / ')}`),
          { statusCode: 400 }
        );
      }
      if (incoming.data.data_quality_alerts !== undefined && typeof incoming.data.data_quality_alerts !== 'boolean') {
        throw Object.assign(new Error('data_quality_alerts 必须是 boolean'), { statusCode: 400 });
      }
    }

    const oldData = (user.preferences && (user.preferences as any).data) || {};
    const newData = incoming.data || {};
    const hasDataSection =
      incoming.data !== undefined ||
      (user.preferences && typeof (user.preferences as any).data === 'object' && (user.preferences as any).data !== null);
    const dataChanged = hasDataSection && JSON.stringify(oldData) !== JSON.stringify({ ...oldData, ...newData });

    user.preferences = {
      ...user.preferences,
      ...incoming,
      // 深合并仅在有 data 段（旧值或本次提交）时应用，避免无意义新增空段
      ...(hasDataSection ? { data: { ...oldData, ...newData } } : {}),
    };
    await repo().save(user);

    if (dataChanged) {
      await AuditService.log('UPDATE', 'user_setting', userId, {
        key: 'preferences',
        changed: { data: newData },
      }, { userId });
    }

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
