/**
 * [PRME-v1.3-PA-003] 收益优化建议细分
 * 文件: OptimizationScenario.ts
 * 需求描述: 优化场景/目标配置
 * 最后更新: 2026-08-20
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index
} from 'typeorm';

@Entity('optimization_scenarios')
export class OptimizationScenario {
  @PrimaryGeneratedColumn('uuid')
  scenario_id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 30 })
  @Index()
  objective!: 'risk' | 'return_high_yield' | 'return_growth' | 'return_value' | 'return_dividend' | 'balanced';

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  constraints!: string | null;

  @Column({ type: 'text', nullable: true })
  scoring_model!: string | null;

  @Column({ type: 'text', nullable: true })
  filter_rules!: string | null;

  @Column({ type: 'int', default: 252 })
  backtest_period_days!: number;

  @Column({ type: 'text' })
  disclaimer!: string;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
