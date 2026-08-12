/**
 * [PRME-VAR-002] VaR分析和报告
 * 文件: Report.ts
 * 需求描述: 风险报告（设计文档命名对齐，替代 RiskReport）
 * 最后更新: 2026-06-09
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn
} from 'typeorm';
import { DateTimeColumn } from '../utils/dbTypes';
import { Portfolio } from './Portfolio';

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid') report_id!: string;

  @Column({ type: 'uuid' })
  portfolio_id!: string;
  @ManyToOne(() => Portfolio)
  @JoinColumn({ name: 'portfolio_id' })
  portfolio!: Portfolio;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'varchar', length: 200 })
  report_name!: string;

  @Column({ type: 'varchar', length: 20, default: 'var' })
  report_type!: string;

  @Column({ type: 'date', nullable: true })
  period_start!: Date | null;

  @Column({ type: 'date', nullable: true })
  period_end!: Date | null;

  @Column({ type: 'simple-json', default: '{}' })
  report_content!: Record<string, any>;

  @Column({ type: 'varchar', length: 500, nullable: true })
  report_url!: string | null;

  @Column({ type: 'varchar', length: 10, default: 'pdf' })
  file_format!: string;

  @Column({ type: 'integer', nullable: true })
  file_size!: number | null;

  @Column({ type: 'varchar', length: 20, default: 'generated' })
  status!: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @DateTimeColumn({ nullable: true })
  generated_at!: Date | null;

  @DateTimeColumn({ nullable: true })
  expires_at!: Date | null;
}
