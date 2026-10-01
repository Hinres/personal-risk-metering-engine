/**
 * [PRME-VAR-003] 压力测试和情景分析
 * 文件: StressScenario.ts
 * 需求描述: 压力测试和情景分析功能实现
 * 最后更新: 2026-06-09
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('stress_scenarios')
export class StressScenario {
  @PrimaryGeneratedColumn('uuid')
  scenario_id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 20 })
  scenario_type!: string;

  @Column({ type: 'simple-json', default: '{}' })
  params!: Record<string, any>;

  @Column({ type: 'date', nullable: true })
  historical_period_start!: Date | null;

  @Column({ type: 'date', nullable: true })
  historical_period_end!: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  historical_deviation!: number | null;

  @Column({ type: 'boolean', default: false })
  is_builtin!: boolean;

  @Column({ type: 'uuid', nullable: true })
  created_by!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  updated_at!: Date | null;
}
