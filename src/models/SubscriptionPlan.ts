/**
 * [PRME-INFRA-005] 系统配置
 * 文件: SubscriptionPlan.ts
 * 需求描述: 系统配置功能实现
 * 最后更新: 2026-06-09
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn
} from 'typeorm';
import { JsonColumn } from '../utils/dbTypes';

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid') plan_id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  plan_code!: string;

  @Column({ type: 'varchar', length: 100 })
  plan_name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price_monthly!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price_yearly!: number | null;

  @Column({ type: 'varchar', length: 10, default: 'CNY' })
  currency!: string;

  @JsonColumn({ default: '[]' })
  features!: any[];

  @Column({ type: 'simple-json', default: '{}' })
  quotas!: Record<string, any>;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
