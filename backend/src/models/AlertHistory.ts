/**
 * [PRME-RM-002] 风险预警系统
 * 文件: AlertHistory.ts
 * 需求描述: 预警触发历史记录（设计文档命名对齐）
 * 最后更新: 2026-06-09
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';
import { Portfolio } from './Portfolio';
import { MonitorConfig } from './MonitorConfig';

@Entity('alert_history')
export class AlertHistory {
  @PrimaryGeneratedColumn('uuid') history_id!: string;

  @Column({ type: 'uuid' })
  portfolio_id!: string;
  @ManyToOne(() => Portfolio)
  @JoinColumn({ name: 'portfolio_id' })
  portfolio!: Portfolio;

  /**
   * UAT-BUG-20260729-001 修复：
   * rule_id 实际存储的是 monitor_configs.config_id，因此外键指向 MonitorConfig。
   */
  @Column({ type: 'uuid', nullable: true })
  rule_id!: string | null;
  @ManyToOne(() => MonitorConfig, { nullable: true })
  @JoinColumn({ name: 'rule_id' })
  monitor_config!: MonitorConfig | null;

  @Column({ type: 'uuid' })
  user_id!: string;
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 20 })
  alert_type!: string;

  @Column({ type: 'varchar', length: 20 })
  severity!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  message!: string | null;

  @Column({ type: 'simple-json', default: '{}' })
  trigger_details!: Record<string, any>;

  @Column({ type: 'simple-json', default: '{}' })
  notification_status!: Record<string, any>;

  @Column({ type: 'datetime' })
  triggered_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  resolved_at!: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @Column({ type: 'int', nullable: true })
  notification_latency_ms!: number | null;
}
