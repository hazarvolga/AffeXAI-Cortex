import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

import { BaseEntity } from '../../../core/database/entities/base.entity';

@Entity('notifications')
export class Notification extends BaseEntity {

  @Column('text')
  message: string;

  @Column('varchar')
  type: string;

  @Column('boolean', { default: false })
  isRead: boolean;

  @Column('varchar', { nullable: true })
  userId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;



  @ManyToOne(() => User, user => user.notifications, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;
}