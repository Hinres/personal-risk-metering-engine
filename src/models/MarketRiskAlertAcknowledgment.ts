/**
 * [PRME-RM-002] 风险预警系统
 * 文件: MarketRiskAlertAcknowledgment.ts
 * 需求描述: 市场波动预警用户级确认记录
 * 最后更新: 2026-06-11
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { MarketRiskAlert } from './MarketRiskAlert';
import { User } from './User';

@Entity('market_risk_alert_acknowledgments')
export class MarketRiskAlertAcknowledgment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  alert_id!: string;
  @ManyToOne(() => MarketRiskAlert, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'alert_id' })
  alert!: MarketRiskAlert;

  @Column({ type: 'uuid' })
  @Index()
  user_id!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @CreateDateColumn({ type: 'datetime' })
  acknowledged_at!: Date;
}
