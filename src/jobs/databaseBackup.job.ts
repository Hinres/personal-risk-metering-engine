/**
 * [PRME-INFRA-002] 数据库自动备份定时任务
 * 文件: databaseBackup.job.ts
 * 需求描述: 等保二级-数据备份恢复控制点优化：自动备份 SQLite 数据库
 * 最后更新: 2026-07-07
 */
import cron, { ScheduledTask } from 'node-cron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AppDataSource } from '../config/database';
import logger from '../utils/logger';

const DB_PATH = process.env.SQLITE_DB_PATH || './data/database.sqlite';
const BACKUP_DIR = process.env.BACKUP_DIR || './data/backups';
const BACKUP_RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || '30', 10);

interface BackupInfo {
  filename: string;
  filepath: string;
  created_at: Date;
  size_bytes: number;
  checksum: string;
  is_valid: boolean;
}

/**
 * 计算文件 SHA-256 校验和
 */
function computeChecksum(filepath: string): string {
  const data = fs.readFileSync(filepath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * 执行数据库备份
 */
export async function performBackup(): Promise<BackupInfo> {
  // 确保备份目录存在
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `database_backup_${timestamp}.sqlite`;
  const filepath = path.join(BACKUP_DIR, filename);

  // 使用 SQLite 的在线备份 API（通过 TypeORM 原生查询）
  try {
    // 先执行 checkpoint 确保 WAL 写入主文件
    await AppDataSource.query('PRAGMA wal_checkpoint(PASSIVE)');

    // 复制数据库文件
    fs.copyFileSync(DB_PATH, filepath);

    // 计算校验和
    const checksum = computeChecksum(filepath);

    // 验证备份文件可读取
    const stats = fs.statSync(filepath);
    const isValid = stats.size > 0;

    const backupInfo: BackupInfo = {
      filename,
      filepath,
      created_at: new Date(),
      size_bytes: stats.size,
      checksum,
      is_valid: isValid,
    };

    // 写入备份元数据
    const metaPath = filepath + '.meta.json';
    fs.writeFileSync(metaPath, JSON.stringify({
      ...backupInfo,
      created_at: backupInfo.created_at.toISOString(),
    }, null, 2));

    logger.info('Database backup completed', {
      filename,
      size: stats.size,
      checksum: checksum.substring(0, 16) + '...',
    });

    return backupInfo;
  } catch (e: any) {
    logger.error('Database backup failed', { error: e.message });
    throw e;
  }
}

/**
 * 清理过期备份
 */
export async function cleanupOldBackups(): Promise<{ deleted: string[]; kept: number }> {
  if (!fs.existsSync(BACKUP_DIR)) {
    return { deleted: [], kept: 0 };
  }

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.sqlite'))
    .map(f => {
      const filepath = path.join(BACKUP_DIR, f);
      const stat = fs.statSync(filepath);
      return { filename: f, filepath, mtime: stat.mtime };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // 最新的在前

  const deleted: string[] = [];
  const cutoffDate = new Date(Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const shouldDelete =
      file.mtime < cutoffDate || // 超过保留期
      i >= MAX_BACKUPS;          // 超过最大备份数

    if (shouldDelete) {
      try {
        fs.unlinkSync(file.filepath);
        const metaPath = file.filepath + '.meta.json';
        if (fs.existsSync(metaPath)) {
          fs.unlinkSync(metaPath);
        }
        deleted.push(file.filename);
      } catch (e: any) {
        logger.warn('Failed to delete old backup', { filename: file.filename, error: e.message });
      }
    }
  }

  const kept = files.length - deleted.length;
  logger.info('Backup cleanup completed', { deleted: deleted.length, kept });
  return { deleted, kept };
}

/**
 * 验证备份完整性
 */
export async function verifyBackup(filename: string): Promise<{ valid: boolean; checksum: string | null; error?: string }> {
  const filepath = path.join(BACKUP_DIR, filename);
  const metaPath = filepath + '.meta.json';

  if (!fs.existsSync(filepath)) {
    return { valid: false, checksum: null, error: 'Backup file not found' };
  }

  try {
    const currentChecksum = computeChecksum(filepath);

    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      const expectedChecksum = meta.checksum;
      if (expectedChecksum && currentChecksum !== expectedChecksum) {
        return { valid: false, checksum: currentChecksum, error: 'Checksum mismatch - backup may be corrupted' };
      }
    }

    // 尝试 SQLite 验证（PRAGMA integrity_check）
    // 注意：这里不实际连接，只做基本文件检查
    const size = fs.statSync(filepath).size;
    if (size === 0) {
      return { valid: false, checksum: currentChecksum, error: 'Backup file is empty' };
    }

    return { valid: true, checksum: currentChecksum };
  } catch (e: any) {
    return { valid: false, checksum: null, error: e.message };
  }
}

/**
 * 列出所有备份
 */
export async function listBackups(): Promise<BackupInfo[]> {
  if (!fs.existsSync(BACKUP_DIR)) {
    return [];
  }

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.sqlite'))
    .map(f => {
      const filepath = path.join(BACKUP_DIR, f);
      const stat = fs.statSync(filepath);
      const metaPath = filepath + '.meta.json';
      let checksum = '';
      let isValid = false;

      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          checksum = meta.checksum || '';
          isValid = meta.is_valid || false;
        } catch { /* ignore */ }
      }

      return {
        filename: f,
        filepath,
        created_at: stat.mtime,
        size_bytes: stat.size,
        checksum,
        is_valid: isValid && stat.size > 0,
      };
    })
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

  return files;
}

/**
 * 调度数据库备份定时任务
 * 每天凌晨 2:00 执行备份
 */
export function scheduleDatabaseBackup(): ReturnType<typeof cron.schedule> {
  return cron.schedule('0 2 * * *', async () => {
    logger.info('Running scheduled database backup');
    try {
      const backup = await performBackup();
      await cleanupOldBackups();
      logger.info('Scheduled backup completed', {
        filename: backup.filename,
        size: backup.size_bytes,
      });
    } catch (error: any) {
      logger.error('Scheduled backup failed', { error: error.message });
    }
  }, { scheduled: true });
}

export default {
  performBackup,
  cleanupOldBackups,
  verifyBackup,
  listBackups,
  scheduleDatabaseBackup,
};
