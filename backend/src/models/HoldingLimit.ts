/**
 * [PRME-RM-003] 持仓风险管理
 * 文件: HoldingLimit.ts
 * 需求描述: 持仓风险管理功能实现
 * 最后更新: 2026-06-18
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index, Check } from 'typeorm';
import { Portfolio } from './Portfolio';
import { User } from './User';

@Entity('holding_limits')
@Check("CHK_max_weight", "max_weight BETWEEN 0 AND 1")
export class HoldingLimit {
  @PrimaryGeneratedColumn('uuid')
  limit_id!: string;

  @Column({ type: 'uuid' })
  @Index()
  portfolio_id!: string;

  @ManyToOne(() => Portfolio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portfolio_id' })
  portfolio!: Portfolio;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'varchar', length: 20 })
  limit_type!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  target_symbol!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  target_sector!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  max_weight!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  max_value!: number | null;

  @Column({ type: 'varchar', length: 20, default: 'warn' })
  action_on_breach!: string;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  updated_at!: Date | null;
}
