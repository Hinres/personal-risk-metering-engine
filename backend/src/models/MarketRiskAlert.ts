/**
 * [PRME-RM-002] 风险预警系统
 * 文件: MarketRiskAlert.ts
 * 需求描述: 风险预警系统功能实现
 * 最后更新: 2026-06-09
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('market_risk_alerts')
export class MarketRiskAlert {
  @PrimaryGeneratedColumn('uuid')
  alert_id!: string;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  index_symbol!: string;

  @Column({ type: 'varchar', length: 50 })
  index_name!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  previous_close!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  current_close!: number;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  change_percentage!: number;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'integer', default: 0 })
  pushed_count!: number;

  @Column({ type: 'integer', default: 0 })
  acknowledged_count!: number;

  @Column({ type: 'datetime' })
  triggered_at!: Date;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
