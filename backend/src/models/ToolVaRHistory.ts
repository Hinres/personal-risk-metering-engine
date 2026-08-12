/**
 * [PRME-TS-001] VaR计算器
 * 文件: ToolVaRHistory.ts
 * 需求描述: VaR计算器功能实现
 * 最后更新: 2026-06-09
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index
} from 'typeorm';
import { JsonColumn } from '../utils/dbTypes';

@Entity('tool_var_history')
export class ToolVaRHistory {
  @PrimaryGeneratedColumn('uuid')
  history_id!: string;

  @Column({ type: 'varchar', length: 36 })
  @Index()
  user_id!: string;

  @Column({ type: 'varchar', length: 50 })
  method!: string; // 'historical', 'parametric', 'monte_carlo', 'extreme_value'

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  confidence_level!: number;

  @Column({ type: 'int' })
  time_horizon!: number; // 天数

  @Column({ type: 'int', nullable: true })
  monte_carlo_iterations!: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  distribution!: string | null; // 'normal', 't-distribution', 'historical'

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  var_value!: number;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  var_percentage!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  expected_return!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  volatility!: number | null;

  @JsonColumn({ nullable: true })
  holdings!: Record<string, any>[] | null; // 临时持仓快照

  @JsonColumn({ nullable: true })
  components!: Record<string, any>[] | null; // VaR成分

  @JsonColumn({ nullable: true })
  risk_factors!: Record<string, any>[] | null; // 风险因子

  @Column({ type: 'int', nullable: true })
  random_seed!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  calculation_time_ms!: number | null; // 计算耗时

  @Column({ type: 'varchar', length: 20, default: 'completed' })
  status!: string; // 'completed', 'failed', 'fallback'

  @Column({ type: 'text', nullable: true })
  error_message!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
