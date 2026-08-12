/**
 * [PRME-INFRA-005] 系统配置
 * 文件: SystemConfig.ts
 * 需求描述: 系统配置功能实现
 * 最后更新: 2026-06-09
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn
} from 'typeorm';
import { JsonColumn } from '../utils/dbTypes';

@Entity('system_configs')
export class SystemConfig {
  @PrimaryGeneratedColumn('uuid') config_id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  config_key!: string;

  @JsonColumn()
  config_value!: Record<string, any>;

  @Column({ type: 'varchar', length: 20, default: 'system' })
  config_type!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
