/**
 * [PRME-v1.3-RM-005] 风险事件提醒
 * 文件: RiskEventImpact.ts
 * 需求描述: 风险事件与用户持仓的关联影响
 * 最后更新: 2026-08-20
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index
} from 'typeorm';
import { RiskEvent } from './RiskEvent';
import { User } from './User';
import { Portfolio } from './Portfolio';
import { Holding } from './Holding';

@Entity('risk_event_impacts')
export class RiskEventImpact {
  @PrimaryGeneratedColumn('uuid')
  impact_id!: string;

  @Column({ type: 'uuid' })
  @Index()
  event_id!: string;

  @ManyToOne(() => RiskEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event!: RiskEvent;

  @Column({ type: 'uuid' })
  @Index()
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'uuid' })
  @Index()
  portfolio_id!: string;

  @ManyToOne(() => Portfolio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portfolio_id' })
  portfolio!: Portfolio;

  @Column({ type: 'uuid', nullable: true })
  holding_id!: string | null;

  @ManyToOne(() => Holding, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'holding_id' })
  holding!: Holding | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  symbol!: string | null;

  @Column({ type: 'varchar', length: 20 })
  impact_level!: 'critical' | 'high' | 'medium' | 'low';

  @Column({ type: 'text', nullable: true })
  impact_summary!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  portfolio_weight!: number | null;

  @Column({ type: 'boolean', default: false })
  is_notified!: boolean;

  @Column({ type: 'datetime', nullable: true })
  notified_at!: Date | null;

  @Column({ type: 'boolean', default: false })
  is_read!: boolean;

  @Column({ type: 'datetime', nullable: true })
  read_at!: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
