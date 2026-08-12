/**
 * [PRME-RM-002] 风险预警系统
 * 文件: AlertRule.ts
 * 需求描述: 预警规则配置（设计文档命名对齐）
 * 最后更新: 2026-06-09
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';
import { Portfolio } from './Portfolio';

@Entity('alert_rules')
export class AlertRule {
  @PrimaryGeneratedColumn('uuid') rule_id!: string;

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
  rule_name!: string;

  @Column({ type: 'varchar', length: 20 })
  rule_type!: string;

  @Column({ type: 'varchar', length: 20 })
  monitor_type!: string;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  threshold!: number;

  @Column({ type: 'varchar', length: 10, default: '>' })
  operator!: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @Column({ type: 'simple-json', default: '{}' })
  notification_config!: Record<string, any>;

  @Column({ type: 'simple-json', default: '{}' })
  rules!: Record<string, any>;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
