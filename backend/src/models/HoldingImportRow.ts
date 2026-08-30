/**
 * [PRME-v1.3-PA-004] 持仓批量导入
 * 文件: HoldingImportRow.ts
 * 需求描述: 持仓导入逐行记录
 * 最后更新: 2026-08-20
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index
} from 'typeorm';
import { HoldingImportTask } from './HoldingImportTask';
import { Holding } from './Holding';

@Entity('holding_import_rows')
export class HoldingImportRow {
  @PrimaryGeneratedColumn('uuid')
  row_id!: string;

  @Column({ type: 'uuid' })
  @Index()
  task_id!: string;

  @ManyToOne(() => HoldingImportTask, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: HoldingImportTask;

  @Column({ type: 'int' })
  row_number!: number;

  @Column({ type: 'text', nullable: true })
  raw_data!: string | null;

  @Column({ type: 'text', nullable: true })
  parsed_data!: string | null;

  @Column({ type: 'boolean', default: false })
  is_valid!: boolean;

  @Column({ type: 'text', nullable: true })
  error_fields!: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_holding_id!: string | null;

  @ManyToOne(() => Holding, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_holding_id' })
  createdHolding!: Holding | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
