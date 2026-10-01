/**
 * [PRME-INFRA-004] 市场数据
 * 文件: MarketData.ts
 * 需求描述: 市场数据功能实现
 * 最后更新: 2026-06-09
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index
} from 'typeorm';

@Entity('market_data')
export class MarketData {
  @PrimaryGeneratedColumn('uuid') data_id!: string;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  symbol!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'stock' })
  security_type!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  exchange!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sector!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  industry!: string | null;

  @Column({ type: 'varchar', length: 10, default: 'CNY' })
  currency!: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  market_cap!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  open_price!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  high_price!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  low_price!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  close_price!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  volume!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  turnover!: number | null;

  @Column({ type: 'date' })
  @Index()
  trade_date!: Date;

  @Column({ type: 'time', nullable: true })
  trade_time!: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata!: Record<string, any> | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
