/**
 * [PRME-v1.3-TS-003] 视频教程与学习资源
 * 文件: VideoTutorial.ts
 * 需求描述: 视频教程元数据
 * 最后更新: 2026-08-20
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index
} from 'typeorm';

@Entity('video_tutorials')
export class VideoTutorial {
  @PrimaryGeneratedColumn('uuid')
  video_id!: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  topic!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 500 })
  video_url!: string;

  @Column({ type: 'int', nullable: true })
  duration!: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbnail_url!: string | null;

  @Column({ type: 'varchar', length: 50, default: 'tutorial' })
  @Index()
  category!: string;

  @Column({ type: 'text', nullable: true })
  tags!: string | null;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @Column({ type: 'int', default: 0 })
  watch_count!: number;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
