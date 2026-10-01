/**
 * [PRME-VAR-003] 压力测试和情景分析
 * 文件: StressTest.ts
 * 需求描述: 压力测试和情景分析功能实现
 * 最后更新: 2026-06-18
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Check
} from 'typeorm';
import { Portfolio } from './Portfolio';

@Entity('stress_tests')
@Check("CHK_loss_percentage", "loss_percentage BETWEEN -100 AND 0")
export class StressTest {
  @PrimaryGeneratedColumn('uuid') stress_id!: string;

  @Column({ type: 'uuid' })
  portfolio_id!: string;
  @ManyToOne(() => Portfolio) @JoinColumn({ name: 'portfolio_id' }) portfolio!: Portfolio;

  @Column({ type: 'varchar', length: 100 })
  scenario_name!: string;

  @Column({ type: 'varchar', length: 20, default: 'historical' })
  scenario_type!: string;

  @Column({ type: 'simple-json', default: '{}' })
  parameters!: Record<string, any>;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  portfolio_value!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  stressed_value!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  loss_amount!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  loss_percentage!: number | null;

  @Column({ type: 'simple-json', default: '[]' })
  asset_results!: any[];

  @Column({ type: 'simple-json', default: '{}' })
  risk_changes!: Record<string, any>;

  @Column({ type: 'datetime' })
  test_date!: Date;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
