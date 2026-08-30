/**
 * [PRME-v1.3-RM-005] 风险事件提醒
 * 文件: RiskEventSource.ts
 * 需求描述: 风险事件外部来源配置
 * 最后更新: 2026-08-20
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index
} from 'typeorm';

@Entity('risk_event_sources')
export class RiskEventSource {
  @PrimaryGeneratedColumn('uuid')
  source_id!: string;

  @Column({ type: 'varchar', length: 30 })
  @Index()
  source_type!: 'announcement' | 'industry_policy' | 'macro_data';

  @Column({ type: 'varchar', length: 50 })
  provider!: 'tushare' | 'akshare' | 'manual';

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  config!: string | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ type: 'datetime', nullable: true })
  last_fetch_at!: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
