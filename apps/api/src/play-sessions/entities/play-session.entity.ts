import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PlaySessionPlayer } from './play-session-player.entity';
import { PlaySessionMatch } from './play-session-match.entity';

export type SessionStatus = 'UPCOMING' | 'ACTIVE' | 'ENDED';

@Entity()
export class PlaySession {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true, default: '' })
  venue!: string;

  @Column()
  date!: string;

  @Column()
  startTime!: string;

  @Column()
  endTime!: string;

  @Column()
  numberOfCourts!: number;

  @Column({ default: 'UPCOMING' })
  status!: SessionStatus;

  @Column({ nullable: true, type: 'timestamptz' })
  startedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => PlaySessionPlayer, (p) => p.session, { cascade: true })
  players!: PlaySessionPlayer[];

  @OneToMany(() => PlaySessionMatch, (m) => m.session, { cascade: true })
  matches!: PlaySessionMatch[];
}
