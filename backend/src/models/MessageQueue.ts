/**
 * [PRME-INFRA-004] 异步任务队列 — SQLite 消息表
 * 文件: MessageQueue.ts
 * 需求描述: 替代 Redis BullMQ 消息队列
 * 关联: arc v1.2 架构设计 §3.4
 * 最后更新: 2026-06-14
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('message_queue')
@Index(['queue_name', 'status', 'scheduled_at'])
@Index(['priority', 'scheduled_at'])
export class MessageQueue {
  @PrimaryGeneratedColumn('increment')
  message_id!: number;

  @Column({ type: 'varchar', length: 50 })
  queue_name!: string; // var_calculation / report_generation / notification

  @Column({ type: 'text' })
  payload!: string; // JSON 任务参数

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: string; // pending / processing / completed / failed

  @Column({ type: 'integer', default: 5 })
  priority!: number; // 1-10，越小越优先

  @Column({ type: 'integer', default: 0 })
  attempt_count!: number;

  @Column({ type: 'integer', default: 3 })
  max_attempts!: number;

  @Column({ type: 'integer' })
  scheduled_at!: number; // Unix timestamp，计划执行时间

  @Column({ type: 'integer', default: 0 })
  created_at!: number;

  @Column({ type: 'integer', nullable: true })
  processed_at!: number | null;

  @Column({ type: 'integer', nullable: true })
  completed_at!: number | null;

  @Column({ type: 'text', nullable: true })
  error_message!: string | null;
}
