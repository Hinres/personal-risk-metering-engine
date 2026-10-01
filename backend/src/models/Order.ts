/**
 * [PRME-INFRA-005] 系统配置
 * 文件: Order.ts
 * 需求描述: 系统配置功能实现
 * 最后更新: 2026-06-09
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn
} from 'typeorm';
import { User } from './User';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid') order_id!: string;

  
  @Column({ type: 'uuid' })
  user_id!: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user!: User;

  @Column({ type: 'uuid', nullable: true })
  plan_id!: string | null;

  @Column({ type: 'varchar', length: 100, unique: true })
  order_no!: string;

  @Column({ type: 'varchar', length: 20, default: 'subscription' })
  order_type!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', length: 10, default: 'CNY' })
  currency!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount_amount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  final_amount!: number;

  @Column({ type: 'varchar', length: 20, default: 'wechat' })
  payment_method!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  payment_status!: string;

  @Column({ type: 'datetime', nullable: true })
  paid_at!: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  payment_details!: Record<string, any> | null;

  @Column({ type: 'date', nullable: true })
  period_start!: Date | null;

  @Column({ type: 'date', nullable: true })
  period_end!: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  refund_info!: Record<string, any> | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
