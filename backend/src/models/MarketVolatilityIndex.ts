/**
 * [PRME-v1.3-RM-006] 市场波动率监控
 * 文件: MarketVolatilityIndex.ts
 * 需求描述: 市场波动率指数配置
 * 最后更新: 2026-08-20
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index
} from 'typeorm';

@Entity('market_volatility_indices')
export class MarketVolatilityIndex {
  @PrimaryGeneratedColumn('uuid')
  index_id!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  @Index()
  index_symbol!: string;

  @Column({ type: 'varchar', length: 100 })
  index_name!: string;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  weight!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  source!: string | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
