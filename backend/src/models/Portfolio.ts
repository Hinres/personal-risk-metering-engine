/**
 * [PRME-PA-001] 组合结构分析
 * 文件: Portfolio.ts
 * 需求描述: 组合结构分析功能实现
 * 最后更新: 2026-06-09
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, OneToMany, Index, DeleteDateColumn
} from 'typeorm';
import { User } from './User';
import { Holding } from './Holding';
import { VaRCalculation } from './VaRCalculation';
import { StressTest } from './StressTest';
import { MonitorConfig } from './MonitorConfig';
import { AlertHistory } from './AlertHistory';
import { Report } from './Report';
import { OptimizationResult } from './OptimizationResult';

@Entity('portfolios')
export class Portfolio {
  @PrimaryGeneratedColumn('uuid')
  portfolio_id!: string;

  
  @Column({ type: 'uuid' })
  @Index()
  user_id!: string;

  @ManyToOne(() => User, (user) => user.portfolios, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'personal', comment: 'personal | demo | template' })
  @Index()
  type!: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  @Index()
  status!: string;

  @Column({ type: 'simple-json', default: '{}' })
  settings!: {
    risk_tolerance?: string;
    rebalancing?: boolean;
    auto_optimize?: boolean;
    alert_enabled?: boolean;
    base_currency?: string;
    benchmark?: string;
    investment_goal?: string;
  };

  @Column({ type: 'simple-json', nullable: true })
  statistics!: Record<string, any> | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  investment_goal!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  risk_level!: string | null;

  @Column({ type: 'uuid', nullable: true })
  template_id!: string | null;

  @DeleteDateColumn({ type: 'datetime', nullable: true })
  deleted_at!: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;

  // Relations
  @OneToMany(() => Holding, (holding) => holding.portfolio)
  holdings!: Holding[];

  @OneToMany(() => VaRCalculation, (varCalc) => varCalc.portfolio)
  varCalculations!: VaRCalculation[];

  @OneToMany(() => StressTest, (stress) => stress.portfolio)
  stressTests!: StressTest[];

  // Naming-aligned relations (v2.0)
  @OneToMany(() => MonitorConfig, (monitor) => monitor.portfolio)
  monitors!: MonitorConfig[];

  @OneToMany(() => AlertHistory, (alert) => alert.portfolio)
  alerts!: AlertHistory[];

  @OneToMany(() => Report, (report) => report.portfolio)
  reports!: Report[];

  @OneToMany(() => OptimizationResult, (opt) => opt.portfolio)
  optimizations!: OptimizationResult[];
}
