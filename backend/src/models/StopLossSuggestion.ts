/**
 * [PRME-v1.3-RM-004] 止损建议
 * 文件: StopLossSuggestion.ts
 * 需求描述: 存储组合止损建议与触发历史
 * 最后更新: 2026-08-20
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index
} from 'typeorm';
import { Portfolio } from './Portfolio';
import { User } from './User';

@Entity('stop_loss_suggestions')
export class StopLossSuggestion {
  @PrimaryGeneratedColumn('uuid')
  suggestion_id!: string;

  @Column({ type: 'uuid' })
  @Index()
  portfolio_id!: string;

  @ManyToOne(() => Portfolio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portfolio_id' })
  portfolio!: Portfolio;

  @Column({ type: 'uuid' })
  @Index()
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  confidence_level!: number;

  @Column({ type: 'int', default: 1 })
  time_horizon!: number;

  @Column({ type: 'varchar', length: 20 })
  dimension!: 'stock' | 'sector' | 'portfolio';

  @Column({ type: 'varchar', length: 30 })
  basis!: 'var' | 'max_drawdown' | 'custom';

  @Column({ type: 'text' })
  suggestions!: string;

  @Column({ type: 'text' })
  disclaimer!: string;

  @Column({ type: 'int', default: 0 })
  triggered_count!: number;

  @Column({ type: 'datetime', nullable: true })
  last_triggered_at!: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
