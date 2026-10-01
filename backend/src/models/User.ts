/**
 * [PRME-TS-002] 用户设置
 * 文件: User.ts
 * 需求描述: 用户设置功能实现
 * 最后更新: 2026-06-09
 */
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  OneToMany, ManyToOne, JoinColumn, Index, DeleteDateColumn
} from 'typeorm';
import { Portfolio } from './Portfolio';
import { MonitorConfig } from './MonitorConfig';
import { AlertHistory } from './AlertHistory';
import { Order } from './Order';
import { UserSession } from './UserSession';
import { AuditLog } from './AuditLog';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  user_id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  @Index()
  username!: string;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  @Index()
  email!: string | null;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  @Index()
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  phone_encrypted!: string | null;

  @Column({ type: 'varchar', length: 64, unique: true, nullable: true })
  @Index()
  openid!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  unionid!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password_hash!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar_url!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  @Index()
  status!: string;

  @Column({ type: 'varchar', length: 20, default: 'user' })
  @Index()
  role!: string;

  @Column({ type: 'boolean', default: false })
  first_risk_acknowledged!: boolean;

  @Column({ type: 'datetime', nullable: true })
  first_risk_acknowledged_at!: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  last_login!: Date | null;

  @Column({ type: 'int', default: 0 })
  login_count!: number;

  @DeleteDateColumn({ type: 'datetime', nullable: true })
  deleted_at!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  deleted_by!: string | null;

  @Column({ type: 'simple-json', default: '{}' })
  preferences!: {
    language?: string;
    theme?: string;
    notifications?: boolean;
    risk_tolerance?: string;
    currency?: string;
    timezone?: string;
    varSettings?: {
      defaultConfidence?: number;
      defaultTimeHorizon?: number;
      defaultMethod?: string;
    };
    // V2-05：数据设置段
    data?: {
      data_source?: 'auto' | 'local_only';
      data_quality_alerts?: boolean;
    };
    alertThresholds?: {
      varLimit?: number;
      concentrationLimit?: number;
      sectorLimit?: number;
    };
  };

  @Column({ type: 'simple-json', default: '{}' })
  subscription!: {
    plan?: string;
    status?: string;
    expires_at?: Date | null;
    features?: string[];
  };

  @Column({ type: 'simple-json', nullable: true })
  wechat_info!: Record<string, any> | null;

  @Column({ type: 'simple-json', default: '{}' })
  metadata!: Record<string, any>;

  // Relations
  @OneToMany(() => Portfolio, (portfolio) => portfolio.user)
  portfolios!: Portfolio[];

  // Naming-aligned relations (v2.0)
  @OneToMany(() => MonitorConfig, (monitor) => monitor.user)
  monitors!: MonitorConfig[];

  @OneToMany(() => AlertHistory, (alert) => alert.user)
  alerts!: AlertHistory[];

  @OneToMany(() => Order, (order) => order.user)
  orders!: Order[];

  @OneToMany(() => UserSession, (session) => session.user)
  sessions!: UserSession[];

  @OneToMany(() => AuditLog, (log) => log.user)
  logs!: AuditLog[];
}
