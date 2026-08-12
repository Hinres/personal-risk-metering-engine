/**
 * [PRME-RM-002] 风险预警系统
 * 文件: MarketRiskAlertTemplate.ts
 * 需求描述: 风险预警系统功能实现
 * 最后更新: 2026-06-09
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('market_risk_alert_templates')
export class MarketRiskAlertTemplate {
  @PrimaryGeneratedColumn('uuid')
  template_id!: string;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  index_symbol!: string;

  @Column({ type: 'varchar', length: 50 })
  index_name!: string;

  @Column({ type: 'varchar', length: 200 })
  title_template!: string;

  @Column({ type: 'text' })
  message_template!: string;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
