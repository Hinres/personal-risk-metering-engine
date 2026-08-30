/**
 * [PRME-v1.3-PA-005] 模板化投资组合
 * 文件: PortfolioTemplate.ts
 * 需求描述: 组合模板定义
 * 最后更新: 2026-08-20
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index
} from 'typeorm';

@Entity('portfolio_templates')
export class PortfolioTemplate {
  @PrimaryGeneratedColumn('uuid')
  template_id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  risk_level!: 'conservative' | 'moderate' | 'aggressive';

  @Column({ type: 'text' })
  asset_allocation!: string;

  @Column({ type: 'text', nullable: true })
  sector_allocation!: string | null;

  @Column({ type: 'text', nullable: true })
  sample_holdings!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 100000 })
  base_total_value!: number;

  @Column({ type: 'text' })
  disclaimer!: string;

  @Column({ type: 'boolean', default: true })
  is_builtin!: boolean;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ type: 'int', default: 0 })
  @Index()
  sort_order!: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
