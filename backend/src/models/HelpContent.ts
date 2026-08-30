/**
 * [PRME-TS-003] 帮助和教程
 * 文件: HelpContent.ts
 * 需求描述: 帮助和教程功能实现
 * 最后更新: 2026-06-09
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { JsonColumn, DateTimeColumn } from '../utils/dbTypes';

@Entity('help_content')
export class HelpContent {
  @PrimaryGeneratedColumn('uuid')
  content_id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  @Index()
  topic!: string;

  @Column({ type: 'varchar', length: 20, default: 'general' })
  category!: string;

  @Column({ type: 'varchar', length: 20, default: 'published' })
  status!: string; // 'published', 'draft', 'deleted'

  @JsonColumn({ nullable: true })
  tags!: string[] | null;

  @Column({ type: 'varchar', length: 20, default: 'markdown' })
  format!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 20, default: 'markdown' })
  content_type!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  video_url!: string | null;

  @Column({ type: 'uuid', nullable: true })
  video_id!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbnail_url!: string | null;

  @Column({ type: 'int', nullable: true })
  duration!: number | null;

  @JsonColumn({ nullable: true })
  images!: any[] | null;

  @Column({ type: 'integer', default: 0 })
  sort_order!: number;

  @JsonColumn({ nullable: true })
  related_topics!: string[] | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @DateTimeColumn({ nullable: true })
  updated_at!: Date | null;
}
