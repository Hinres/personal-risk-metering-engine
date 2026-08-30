/**
 * [PRME-v1.3-RM-006] 市场波动率监控
 * 文件: MarketVolatilityHistory.ts
 * 需求描述: 市场波动率历史数据
 * 最后更新: 2026-08-20
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique
} from 'typeorm';

@Entity('market_volatility_history')
@Unique(['index_symbol', 'calculation_date'])
export class MarketVolatilityHistory {
  @PrimaryGeneratedColumn('uuid')
  history_id!: string;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  index_symbol!: string;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  volatility!: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  percentile!: number | null;

  @Column({ type: 'date' })
  calculation_date!: string;

  @CreateDateColumn({ type: 'datetime' })
  calculation_time!: Date;

  @Column({ type: 'int', default: 252 })
  data_points!: number;
}
