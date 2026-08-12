/**
 * [PRME-VAR-001] 组合VaR计算
 * 文件: VaRCalculation.ts
 * 需求描述: 组合VaR计算功能实现
 * 最后更新: 2026-06-18
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Check } from 'typeorm';
import { JsonColumn } from '../utils/dbTypes';
import { Portfolio } from './Portfolio';
import { User } from './User';

@Entity('var_calculations')
@Check("CHK_time_horizon", "time_horizon BETWEEN 1 AND 365")
@Check("CHK_confidence_level", "confidence_level BETWEEN 0.90 AND 0.9999")
export class VaRCalculation {
  @PrimaryGeneratedColumn('uuid') var_id!: string;
  @Column({ type: 'uuid' }) portfolio_id!: string;
  @ManyToOne(() => Portfolio) @JoinColumn({ name: 'portfolio_id' }) portfolio!: Portfolio;
  @Column({ type: 'uuid' }) user_id!: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user!: User;
  @Column({ type: 'varchar', length: 20 }) calculation_type!: string;
  @Column({ type: 'decimal', precision: 5, scale: 4 }) confidence_level!: number;
  @Column({ type: 'integer' }) time_horizon!: number;
  @Column({ type: 'varchar', length: 20, nullable: true }) distribution!: string | null;
  @Column({ type: 'integer', nullable: true }) monte_carlo_iterations!: number | null;
  @Column({ type: 'integer', nullable: true }) random_seed!: number | null;
  @Column({ type: 'decimal', precision: 18, scale: 6 }) var_value!: number;
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true }) var_percentage!: number | null;
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true }) expected_return!: number | null;
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true }) expected_shortfall!: number | null;
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true }) volatility!: number | null;
  @Column({ type: 'integer', nullable: true }) calculation_time_ms!: number | null;
  @JsonColumn({ default: '[]' }) var_components!: any[];
  @JsonColumn({ default: '[]' }) risk_factors!: any[];
  @Column({ type: 'varchar', length: 20, default: 'completed' }) status!: string;
  @Column({ type: 'text', nullable: true }) error_message!: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) data_source!: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) data_period!: string | null;
  @Column({ type: 'varchar', length: 10, nullable: true }) estimation_method!: string | null;
  @Column({ type: 'text', nullable: true }) evt_parameters!: string | null;
  @Column({ type: 'text', nullable: true }) warnings!: string | null;
  @CreateDateColumn({ type: 'datetime' }) created_at!: Date;
  @Column({ type: 'datetime', nullable: true }) calculated_at!: Date | null;
}
