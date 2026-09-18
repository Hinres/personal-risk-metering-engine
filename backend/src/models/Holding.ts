/**
 * [PRME-RM-003] 持仓风险管理
 * 文件: Holding.ts
 * 需求描述: 持仓风险管理功能实现
 * 最后更新: 2026-06-09
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Index
} from 'typeorm';
import { JsonColumn } from '../utils/dbTypes';
import { Portfolio } from './Portfolio';

@Entity('holdings')
export class Holding {
  @PrimaryGeneratedColumn('uuid')
  holding_id!: string;

  @Column({ type: 'uuid' })
  @Index()
  portfolio_id!: string;

  @ManyToOne(() => Portfolio, (portfolio) => portfolio.holdings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portfolio_id' })
  portfolio!: Portfolio;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  symbol!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'stock' })
  security_type!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  exchange!: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  quantity!: number;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  cost_price!: number;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  current_price!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  market_value!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  weight!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  weight_target!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  unrealized_pnl!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  realized_pnl!: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sector!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  industry!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  region!: string | null;

  @Column({ type: 'varchar', length: 10, default: 'CNY' })
  currency!: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  @Index()
  status!: string;

  @Column({ type: 'date', nullable: true })
  purchase_date!: Date | null;

  @JsonColumn({ nullable: true })
  metadata!: Record<string, any> | null;

  @Column({ type: 'uuid', nullable: true })
  import_row_id!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
