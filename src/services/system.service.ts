/**
 * [PRME-INFRA-005] 系统配置
 * 文件: system.service.ts
 * 需求描述: 系统配置功能实现
 * 最后更新: 2026-06-09
 */
import { AppDataSource } from '../config/database';
import { SystemConfig } from '../models/SystemConfig';

const configRepo = () => AppDataSource.getRepository(SystemConfig);

export class SystemService {
  static async getConfig(key: string) {
    const config = await configRepo().findOne({ where: { config_key: key } });
    return config?.config_value;
  }

  static async setConfig(key: string, value: any, type = 'system', description?: string) {
    let config = await configRepo().findOne({ where: { config_key: key } });
    if (config) {
      config.config_value = value;
      if (description) config.description = description;
    } else {
      config = configRepo().create({ config_key: key, config_value: value, config_type: type, description });
    }
    await configRepo().save(config);
    return config;
  }

  static async getAllConfigs(type?: string) {
    const where: any = {};
    if (type) where.config_type = type;
    return configRepo().find({ where });
  }

  static async deleteConfig(key: string) {
    const config = await configRepo().findOne({ where: { config_key: key } });
    if (config) {
      await configRepo().remove(config);
      return true;
    }
    return false;
  }
}
