import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum DevicePlatform {
  IOS = 'ios',
  ANDROID = 'android',
  WEB = 'web',
}

/** Token de push (Expo) de cada dispositivo móvil del usuario */
@Entity('device_tokens')
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.devices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index({ unique: true })
  @Column({ length: 255 })
  token: string;

  @Column({ type: 'enum', enum: DevicePlatform, default: DevicePlatform.ANDROID })
  platform: DevicePlatform;

  @Column({ name: 'device_name', type: 'varchar', length: 120, nullable: true })
  deviceName: string | null;

  @Column({ name: 'last_seen_at', type: 'timestamptz', default: () => 'now()' })
  lastSeenAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
