/**
 * [PRME-INFRA-004] 市场数据
 * 文件: FinancialData.ts
 * 需求描述: 市场数据功能实现
 * 最后更新: 2026-06-09
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, Unique
} from 'typeorm';
import { Stock } from './Stock';

@Entity('financial_data')
@Unique(['stock_id', 'report_period', 'report_type'])
export class FinancialData {
  @PrimaryGeneratedColumn('uuid') financial_id!: string;

  @Column({ type: 'uuid' })
  @Index()
  stock_id!: string;

  @ManyToOne(() => Stock, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stock_id' })
  stock!: Stock;

  @Column({ type: 'varchar', length: 10 })
  report_period!: string;  // e.g. "2023" or "2023Q3"

  @Column({ type: 'varchar', length: 10, default: 'annual' })
  report_type!: string;

  // 利润表
  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  revenue!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  net_profit!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  operating_profit!: number | null;

  // 资产负债表
  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  total_assets!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  total_liabilities!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  shareholders_equity!: number | null;

  // 现金流量
  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  operating_cash_flow!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  free_cash_flow!: number | null;

  // 关键指标
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  eps!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  book_value_per_share!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  dividend_per_share!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  roe!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  roa!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  debt_to_equity!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  current_ratio!: number | null;

  // 估值指标
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  pe_ratio!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  pb_ratio!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  ps_ratio!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  ev_ebitda!: number | null;

  // 成长性
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  revenue_growth_yoy!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  profit_growth_yoy!: number | null;

  @Column({ type: 'simple-json', default: '{}' })
  metadata!: Record<string, any>;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
