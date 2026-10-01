/**
 * [PRME-RM-001] 实时风险监控
 * 文件: MonitorConfig.ts
 * 需求描述: 监控配置（设计文档命名对齐，替代 RiskMonitor）
 * 最后更新: 2026-06-09
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';
import { Portfolio } from './Portfolio';

@Entity('monitor_configs')
export class MonitorConfig {
  @PrimaryGeneratedColumn('uuid') config_id!: string;

  @Column({ type: 'uuid' })
  portfolio_id!: string;
  @ManyToOne(() => Portfolio)
  @JoinColumn({ name: 'portfolio_id' })
  portfolio!: Portfolio;

  @Column({ type: 'uuid' })
  user_id!: string;
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 100 })
  config_name!: string;

  @Column({ type: 'varchar', length: 20 })
  monitor_type!: string;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  threshold!: number;

  @Column({ type: 'varchar', length: 10, default: '>' })
  operator!: string;

  /** 多指标统一配置（v3.0，向后兼容） */
  @Column({ type: 'simple-json', default: '{}' })
  metrics!: Record<string, any>;

  /** 监控频率（秒），默认 30 */
  @Column({ type: 'integer', default: 30 })
  check_interval_seconds!: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @Column({ type: 'simple-json', default: '{}' })
  notification!: Record<string, any>;

  @Column({ type: 'simple-json', default: '{}' })
  rules!: Record<string, any>;

  /** 冷却期（分钟），默认 5，同一条件触发后在此时间内不再重复告警 */
  @Column({ type: 'integer', default: 5 })
  cooling_period_minutes!: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  last_triggered!: Date | null;

  @Column({ type: 'integer', default: 0 })
  trigger_count!: number;
}
