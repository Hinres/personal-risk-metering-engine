/**
 * [PRME-v1.3.2-V2-01] 用户反馈
 * 文件: UserFeedback.ts
 * 需求描述: 用户反馈收集（feedback/question/suggestion/rating 四类），管理端回复闭环
 * 设计来源: PRME-v1.3.2-Detailed-Design-20260919.md §1.2
 * 日期: 2026-09-19
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from './User';

export type FeedbackType = 'feedback' | 'question' | 'suggestion' | 'rating';
export type FeedbackStatus = 'new' | 'replied' | 'closed';

@Entity('user_feedbacks')
export class UserFeedback {
  @PrimaryGeneratedColumn('uuid')
  feedback_id!: string;

  @Column({ type: 'varchar', length: 36 })
  @Index()
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  /** feedback | question | suggestion | rating */
  @Column({ type: 'varchar', length: 20 })
  type!: FeedbackType;

  @Column({ type: 'text' })
  content!: string;

  /** 仅 type='rating' 时必填，1~5 */
  @Column({ type: 'smallint', nullable: true })
  rating!: number | null;

  /** new | replied | closed */
  @Column({ type: 'varchar', length: 20, default: 'new' })
  @Index()
  status!: FeedbackStatus;

  @Column({ type: 'text', nullable: true })
  admin_reply!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  replied_by!: string | null;

  @Column({ type: 'datetime', nullable: true })
  replied_at!: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
