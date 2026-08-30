/**
 * [PRME-PA-003] 优化建议
 * 文件: OptimizationResult.ts
 * 需求描述: 优化建议功能实现
 * 最后更新: 2026-06-09
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index
} from 'typeorm';
import { JsonColumn } from '../utils/dbTypes';
import { Portfolio } from './Portfolio';

@Entity('optimization_results')
export class OptimizationResult {
  @PrimaryGeneratedColumn('uuid')
  optimization_id!: string;

  @Column({ type: 'varchar', length: 36 })
  @Index()
  portfolio_id!: string;

  @Column({ type: 'varchar', length: 36 })
  @Index()
  user_id!: string;

  @Column({ type: 'varchar', length: 50 })
  method!: string; // 'mean_variance', 'risk_parity', 'min_variance', 'max_sharpe', 'max_sortino'

  @Column({ type: 'varchar', length: 30, nullable: true })
  objective_detail!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  scoring_model!: string | null;

  @Column({ type: 'text', nullable: true })
  filter_rules!: string | null;

  @Column({ type: 'uuid', nullable: true })
  backtest_scenario_id!: string | null;

  @Column({ type: 'text', nullable: true })
  backtest_metrics!: string | null;

  @JsonColumn({ nullable: true })
  current_portfolio!: Record<string, any> | null;

  @JsonColumn({ nullable: true })
  optimized_portfolio!: Record<string, any> | null;

  @JsonColumn({ nullable: true })
  suggestions!: Record<string, any>[] | null;

  @JsonColumn({ nullable: true })
  backtest_data!: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  disclaimer!: string | null;

  @Column({ type: 'text', nullable: true })
  compliance_note!: string | null; // 合规处理记录：过滤了哪些关键词等

  @JsonColumn({ nullable: true })
  risk_constraints!: Record<string, any> | null; // 用户风险偏好映射的约束

  @Column({ type: 'boolean', default: false })
  has_investment_keywords!: boolean; // 是否命中投资建议关键词

  @Column({ type: 'varchar', length: 20, default: 'completed' })
  status!: string; // 'completed', 'failed', 'filtered'

  @Column({ type: 'text', nullable: true })
  error_message!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;

  @ManyToOne(() => Portfolio, (portfolio) => portfolio.optimizations, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portfolio_id' })
  portfolio!: Portfolio | null;
}
