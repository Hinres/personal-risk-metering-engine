/**
 * [PRME-INFRA-004] 市场数据
 * 文件: ValuationRecord.ts
 * 需求描述: 市场数据功能实现
 * 最后更新: 2026-06-09
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index
} from 'typeorm';
import { Stock } from './Stock';
import { User } from './User';

@Entity('valuation_records')
export class ValuationRecord {
  @PrimaryGeneratedColumn('uuid') valuation_id!: string;

  @Column({ type: 'uuid' })
  @Index()
  stock_id!: string;

  @ManyToOne(() => Stock, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stock_id' })
  stock!: Stock;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  user_id!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  method!: string;  // pe, pb, dcf, ddm, peg, ev_ebitda, ai

  @Column({ type: 'simple-json', default: '{}' })
  inputs!: Record<string, any>;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  result_value!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  result_range_low!: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  result_range_high!: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  confidence_level!: number | null;

  @Column({ type: 'simple-json', default: '{}' })
  assumptions!: Record<string, any>;

  @Column({ type: 'simple-json', default: '{}' })
  sensitivity_analysis!: Record<string, any>;

  @Column({ type: 'varchar', length: 20, default: 'completed' })
  status!: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
