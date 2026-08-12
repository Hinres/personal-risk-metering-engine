/**
 * [PRME-INFRA-004] 市场数据
 * 文件: Stock.ts
 * 需求描述: 市场数据功能实现
 * 最后更新: 2026-06-09
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index
} from 'typeorm';

@Entity('stocks')
export class Stock {
  @PrimaryGeneratedColumn('uuid') stock_id!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  @Index()
  symbol!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  exchange!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  industry!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sector!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  market_cap!: number | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @Column({ type: 'simple-json', default: '{}' })
  metadata!: Record<string, any>;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
