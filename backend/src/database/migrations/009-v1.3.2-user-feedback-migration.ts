/**
 * [PRME-v1.3.2-V2-01] user_feedbacks 表迁移
 * 文件: 009-v1.3.2-user-feedback-migration.ts
 * 范围: 新增用户反馈表（feedback/question/suggestion/rating 四类 + 管理端回复闭环）
 * 设计来源: PRME-v1.3.2-Detailed-Design-20260919.md §1.2
 * 日期: 2026-09-19
 * 修订(2026-09-29): 移除 PostgreSQL 分支，SQLite 单库（REQ-DEC-20260926-001）
 */
import { MigrationInterface, QueryRunner } from 'typeorm';
import logger from '../../utils/logger';

export class UserFeedbackMigration1718000000009 implements MigrationInterface {
  name = 'UserFeedbackMigration1718000000009';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.connect();
    logger.info('[009] Starting user_feedbacks migration...');

    const uuid = 'varchar(36)';
    const uuidDefault = 'DEFAULT (lower(hex(randomblob(16))))';
    const nowDefault = "DEFAULT (datetime('now'))";

    const hasTable = async (): Promise<boolean> => {
      const rows: any[] = await queryRunner.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='user_feedbacks'`
      );
      return rows.length > 0;
    };

    if (!(await hasTable())) {
      await queryRunner.query(`
        CREATE TABLE user_feedbacks (
          feedback_id ${uuid} PRIMARY KEY ${uuidDefault},
          user_id ${uuid} NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          type varchar(20) NOT NULL,
          content text NOT NULL,
          rating smallint NULL,
          status varchar(20) NOT NULL DEFAULT 'new',
          admin_reply text NULL,
          replied_by ${uuid} NULL,
          replied_at datetime NULL,
          created_at datetime NOT NULL ${nowDefault},
          updated_at datetime NOT NULL ${nowDefault}
        )
      `);
      await queryRunner.query(
        `CREATE INDEX idx_uf_user_created ON user_feedbacks(user_id, created_at DESC)`
      );
      await queryRunner.query(
        `CREATE INDEX idx_uf_status ON user_feedbacks(status)`
      );
      logger.info('[009] user_feedbacks table created.');
    } else {
      logger.info('[009] user_feedbacks already exists, skipping DDL.');
    }

    logger.info('[009] user_feedbacks migration completed.');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // 与 008 策略一致：down 清空数据，表结构保留（避免 SQLite 方言限制）
    await queryRunner.query(`DELETE FROM user_feedbacks`);
    logger.info('[009] down: user_feedbacks data cleared (table retained).');
  }
}
