/**
 * [PRME-v1.3-PA-004] 持仓批量导入
 * 文件: HoldingImportTask.ts
 * 需求描述: 持仓导入任务记录
 * 最后更新: 2026-08-20
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index
} from 'typeorm';
import { Portfolio } from './Portfolio';
import { User } from './User';

@Entity('holding_import_tasks')
export class HoldingImportTask {
  @PrimaryGeneratedColumn('uuid')
  task_id!: string;

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

  @Column({ type: 'varchar', length: 255 })
  file_name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  file_path!: string | null;

  @Column({ type: 'int', nullable: true })
  file_size!: number | null;

  @Column({ type: 'varchar', length: 10 })
  format!: 'xlsx' | 'csv';

  @Column({ type: 'int', default: 0 })
  total_rows!: number;

  @Column({ type: 'int', default: 0 })
  valid_rows!: number;

  @Column({ type: 'int', default: 0 })
  error_rows!: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: 'pending' | 'processing' | 'completed' | 'failed';

  @Column({ type: 'text', nullable: true })
  error_message!: string | null;

  @Column({ type: 'boolean', default: false })
  triggered_var!: boolean;

  @Column({ type: 'boolean', default: false })
  triggered_stress!: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  completed_at!: Date | null;
}
