/**
 * [PRME-VAR-001] 组合VaR计算
 * 文件: VaRComponent.ts
 * 需求描述: 组合VaR计算功能实现
 * 最后更新: 2026-06-09
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { VaRCalculation } from './VaRCalculation';

@Entity('var_components')
export class VaRComponent {
  @PrimaryGeneratedColumn('uuid')
  component_id!: string;

  @Column({ type: 'uuid' })
  @Index()
  var_id!: string;

  @ManyToOne(() => VaRCalculation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'var_id' })
  varCalculation!: VaRCalculation;

  @Column({ type: 'varchar', length: 20 })
  symbol!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  contribution!: number;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  percentage!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  risk_factor!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
