/**
 * [PRME-v1.3-PA-003] 收益优化建议细分 - 每日基本面快照
 * 文件: StockDailyBasic.ts
 * 需求描述: stock_daily_basic 表，Tushare daily_basic 接口每日快照
 * 数据来源: Tushare daily_basic（PE/PB/股息率/市值/换手率）
 * 设计来源: PRME-v1.3-Optimization-Screening-Design-Supplement-20260906.md §4.1
 * 最后更新: 2026-09-06
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique
} from 'typeorm';

@Entity('stock_daily_basic')
@Unique(['symbol', 'trade_date'])
export class StockDailyBasic {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  symbol!: string;  // 600000（纯代码，与 stocks.symbol 对齐）

  @Column({ type: 'date' })
  @Index()
  trade_date!: Date;

  // 市盈率 TTM
  @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true })
  pe_ttm!: number | null;

  // 市净率
  @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true })
  pb!: number | null;

  // 股息率 %
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  dv_ratio!: number | null;

  // 总市值（万元）
  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  total_mv!: number | null;

  // 换手率（%）
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  turnover_rate!: number | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
